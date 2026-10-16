import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditContext } from '../audit/audit-context';
import { PrismaService } from '../prisma/prisma.service';

export type AuditScope = 'store' | 'company';

interface EntityConfig {
  scope: AuditScope;
  /** Delegate do Prisma do registro original (para conferir o tenant, mesmo excluído). */
  original: string;
  /** Delegate do Prisma do histórico (somente leitura). */
  history: string;
  /** Filtro do registro original: garante que ele pertence à loja/empresa da rota. */
  originalWhere: (
    id: string,
    scopeId: string,
  ) => Record<string, unknown> | null;
  /** Filtro do histórico para o mesmo registro. */
  historyWhere: (id: string) => Record<string, unknown>;
}

const simple = (
  scope: AuditScope,
  original: string,
  history: string,
): EntityConfig => ({
  scope,
  original,
  history,
  originalWhere: (id, scopeId) => ({
    id,
    [scope === 'store' ? 'storeId' : 'companyId']: scopeId,
  }),
  historyWhere: (id) => ({ id }),
});

/** "membershipId:storeId" -> chave composta de MembershipStore. */
function splitCompositeId(
  id: string,
): { membershipId: string; storeId: string } | null {
  const [membershipId, storeId, ...rest] = id.split(':');
  return membershipId && storeId && rest.length === 0
    ? { membershipId, storeId }
    : null;
}

/**
 * LISTA FECHADA das entidades consultáveis. Nada vindo da requisição vira nome de tabela ou de
 * modelo: o `entity` da rota só escolhe uma entrada daqui.
 */
export const AUDITABLE: Record<string, EntityConfig> = {
  // escopo loja
  'store-products': simple('store', 'storeProduct', 'storeProductHistory'),
  sales: simple('store', 'sale', 'saleHistory'),
  'command-tabs': simple('store', 'commandTab', 'commandTabHistory'),
  'cash-registers': simple('store', 'cashRegister', 'cashRegisterHistory'),
  'bottle-movements': simple(
    'store',
    'bottleMovement',
    'bottleMovementHistory',
  ),
  // escopo empresa
  products: simple('company', 'product', 'productHistory'),
  customers: simple('company', 'customer', 'customerHistory'),
  'bottle-types': simple('company', 'bottleType', 'bottleTypeHistory'),
  stores: simple('company', 'store', 'storeHistory'),
  memberships: simple('company', 'membership', 'membershipHistory'),
  'membership-stores': {
    scope: 'company',
    original: 'membershipStore',
    history: 'membershipStoreHistory',
    originalWhere: (id, companyId) => {
      const key = splitCompositeId(id);
      return key ? { ...key, membership: { companyId } } : null;
    },
    historyWhere: (id) => splitCompositeId(id) ?? { id: '__invalid__' },
  },
};

/** Colunas que não entram no diff: são metadados da versão ou a identidade do registro. */
const META_FIELDS = new Set([
  'historyId',
  'historyStart',
  'historyEnd',
  'modifierId',
  'modifiedEndpoint',
  'id',
]);

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export type VersionAction = 'CREATED' | 'UPDATED' | 'DELETED' | 'RESTORED';

export interface AuditVersion {
  version: number;
  historyStart: Date;
  historyEnd: Date | null;
  action: VersionAction;
  author: { id: string | null; name: string | null };
  endpoint: string | null;
  /** Só os campos que mudaram em relação à versão anterior (null na criação). */
  changes: FieldChange[] | null;
  /** Como o registro estava nesta versão. */
  snapshot: Record<string, unknown>;
}

const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

@Injectable()
export class AuditLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
  ) {}

  /** Histórico completo de um registro, com autor e diff por versão. */
  async history(
    scope: AuditScope,
    scopeId: string,
    entity: string,
    id: string,
  ) {
    const config = await this.resolve(scope, scopeId, entity, id);
    const rows = await this.readHistory(config, id);
    return { entity, id, versions: await this.toVersions(rows) };
  }

  /** Como o registro estava em um instante (a versão vigente naquele momento). */
  async at(
    scope: AuditScope,
    scopeId: string,
    entity: string,
    id: string,
    instant: Date,
  ) {
    const config = await this.resolve(scope, scopeId, entity, id);
    const rows = await this.readHistory(config, id);
    const versions = await this.toVersions(rows);
    const found = versions.find(
      (v) =>
        v.historyStart.getTime() <= instant.getTime() &&
        (!v.historyEnd || v.historyEnd.getTime() > instant.getTime()),
    );
    if (!found)
      throw new NotFoundException('O registro não existia nesse momento.');
    return { entity, id, at: instant, version: found };
  }

  /** Confere a entidade (lista fechada) e que o registro original pertence ao tenant da rota. */
  private async resolve(
    scope: AuditScope,
    scopeId: string,
    entity: string,
    id: string,
  ) {
    const config = Object.hasOwn(AUDITABLE, entity)
      ? AUDITABLE[entity]
      : undefined;
    if (!config || config.scope !== scope)
      throw new NotFoundException('Entidade não auditável.');

    const where = config.originalWhere(id, scopeId);
    if (!where) throw new NotFoundException('Registro não encontrado.');

    // O registro pode ter sido excluído (soft delete): o histórico continua valendo.
    const original = await this.audit.withDeleted(() =>
      (this.prisma as any)[config.original].findFirst({ where }),
    );
    if (!original) throw new NotFoundException('Registro não encontrado.');
    return config;
  }

  private readHistory(
    config: EntityConfig,
    id: string,
  ): Promise<Record<string, any>[]> {
    return (this.prisma as any)[config.history].findMany({
      where: config.historyWhere(id),
      orderBy: [
        { historyStart: 'asc' },
        { historyEnd: { sort: 'asc', nulls: 'last' } },
      ],
    });
  }

  private async toVersions(
    rows: Record<string, any>[],
  ): Promise<AuditVersion[]> {
    const authorIds = [
      ...new Set(
        rows
          .map((r) => r.modifierId)
          .filter((v): v is string => !!v && v !== 'system'),
      ),
    ];
    const users = authorIds.length
      ? await this.audit.withDeleted(() =>
          this.prisma.user.findMany({
            where: { id: { in: authorIds } },
            select: { id: true, name: true },
          }),
        )
      : [];
    const names = new Map(users.map((u) => [u.id, u.name]));

    return rows.map((row, index) => {
      const previous = index > 0 ? rows[index - 1] : null;
      const snapshot = Object.fromEntries(
        Object.entries(row).filter(([key]) => !META_FIELDS.has(key)),
      );
      const changes = previous ? this.diff(previous, row) : null;

      const authorId: string | null = row.modifierId ?? null;
      return {
        version: index + 1,
        historyStart: row.historyStart,
        historyEnd: row.historyEnd,
        action: this.action(previous, row),
        author: {
          id: authorId,
          name:
            authorId === 'system'
              ? 'Sistema'
              : authorId
                ? (names.get(authorId) ?? null)
                : null,
        },
        endpoint: row.modifiedEndpoint ?? null,
        changes,
        snapshot,
      };
    });
  }

  private diff(
    before: Record<string, any>,
    after: Record<string, any>,
  ): FieldChange[] {
    return Object.keys(after)
      .filter(
        (field) =>
          !META_FIELDS.has(field) && !same(before[field], after[field]),
      )
      .map((field) => ({
        field,
        from: before[field] ?? null,
        to: after[field] ?? null,
      }));
  }

  private action(
    previous: Record<string, any> | null,
    row: Record<string, any>,
  ): VersionAction {
    if (!previous) return 'CREATED';
    if (!previous.deletedAt && row.deletedAt) return 'DELETED';
    if (previous.deletedAt && !row.deletedAt) return 'RESTORED';
    return 'UPDATED';
  }
}
