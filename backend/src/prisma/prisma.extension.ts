import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { AuditContext, AuditStore } from '../audit/audit-context';

/** Erro de uso da camada de dados (programação), não de entrada do usuário. */
export class AuditViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditViolationError';
  }
}

const READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);
const NESTED_WRITE_KEYS = ['create', 'createMany', 'connectOrCreate', 'upsert'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/** Falha se algum campo tiver escrita aninhada: o registro filho ficaria sem autor. */
function assertNoNestedWrites(model: string, data: Record<string, unknown>) {
  for (const [field, value] of Object.entries(data)) {
    if (isPlainObject(value) && NESTED_WRITE_KEYS.some((k) => k in value)) {
      throw new AuditViolationError(
        `Escrita aninhada em ${model}.${field} não é permitida: o registro filho ficaria sem ` +
          'autor na auditoria. Crie o filho com uma chamada própria dentro da mesma transação.',
      );
    }
  }
}

function requireActor(
  audit: AuditContext,
  model: string,
  operation: string,
): AuditStore {
  const store = audit.get();
  if (!store?.userId || !store.endpoint) {
    throw new AuditViolationError(
      `Escrita sem contexto de auditoria em ${model}.${operation}. Use o AuditContext ` +
        '(requisição HTTP, runAsSystem ou actAs).',
    );
  }
  return store;
}

function stamp(model: string, data: any, store: AuditStore): any {
  if (!isPlainObject(data)) return data;
  assertNoNestedWrites(model, data);
  return {
    ...data,
    modifierId: store.userId,
    modifiedEndpoint: store.endpoint,
  };
}

function notDeleted(where: any, store: AuditStore | undefined) {
  if (store?.withDeleted) return where;
  return { ...(where ?? {}), deletedAt: null };
}

/**
 * Cria o PrismaClient com a extensão de auditoria e soft delete:
 *  - toda escrita recebe `modifierId`/`modifiedEndpoint` do AuditContext (erro se não houver);
 *  - delete/deleteMany são proibidos (o banco também recusa): use `deletedAt`;
 *  - leituras e updates ignoram registros com `deletedAt` (salvo AuditContext.withDeleted);
 *  - modelos *History (escritos só por trigger) são somente leitura.
 *
 * Os filtros valem para o nível de cima da consulta; relações em include/select devem filtrar
 * `deletedAt: null` explicitamente.
 */
export function createPrismaClient(
  connectionString: string,
  audit: AuditContext,
) {
  const pool = new Pool({ connectionString });
  const base = new PrismaClient({ adapter: new PrismaPg(pool) });

  const client = base.$extends({
    name: 'audit-soft-delete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          const store = audit.get();

          if (model.endsWith('History')) {
            if (!READ_OPS.has(operation)) {
              throw new AuditViolationError(
                `${model} é somente leitura: o histórico é gravado pelo trigger do banco.`,
              );
            }
            return query(args);
          }

          if (operation === 'delete' || operation === 'deleteMany') {
            throw new AuditViolationError(
              `Exclusão física não é permitida (${model}.${operation}). Use soft delete: ` +
                'update com deletedAt.',
            );
          }

          if (READ_OPS.has(operation)) {
            return query({
              ...(args ?? {}),
              where: notDeleted(args?.where, store),
            });
          }

          const actor = requireActor(audit, model, operation);

          switch (operation) {
            case 'create':
              return query({ ...args, data: stamp(model, args.data, actor) });
            case 'createMany':
            case 'createManyAndReturn': {
              const data = Array.isArray(args.data)
                ? args.data.map((d: any) => stamp(model, d, actor))
                : stamp(model, args.data, actor);
              return query({ ...args, data });
            }
            case 'update':
            case 'updateMany':
            case 'updateManyAndReturn':
              return query({
                ...args,
                data: stamp(model, args.data, actor),
                where: notDeleted(args.where, store),
              });
            case 'upsert':
              // Sem filtro de deletedAt: o upsert precisa achar (e reativar) o registro excluído.
              return query({
                ...args,
                create: stamp(model, args.create, actor),
                update: stamp(model, args.update, actor),
              });
            default:
              return query(args);
          }
        },
      },
    },
  });

  return { client, base, pool };
}

export type ExtendedPrismaClient = ReturnType<
  typeof createPrismaClient
>['client'];

/** Cliente de transação (o argumento de `prisma.$transaction(async (tx) => ...)`). */
export type PrismaTx = Omit<
  ExtendedPrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;
