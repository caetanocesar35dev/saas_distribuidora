import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

/** Origem das gravações feitas sem usuário logado. Vai exatamente assim para `modifiedEndpoint`. */
export type SystemOrigin = 'seed' | 'webhook:asaas' | `job:${string}`;

export interface AuditStore {
  /** Id do usuário autor da alteração (ou 'system'). Nulo = ninguém identificado. */
  userId: string | null;
  /** Rota (ex.: "POST /api/stores/:storeId/sales") ou a origem de sistema. */
  endpoint: string | null;
  /** Quando true, as leituras e updates enxergam registros com deletedAt preenchido. */
  withDeleted: boolean;
}

const storage = new AsyncLocalStorage<AuditStore>();

/**
 * Executa fn dentro do contexto. As promessas do Prisma são preguiçosas (só rodam ao receber
 * `then`), então, se fn devolver uma, ela é executada aqui dentro: caso contrário o `await`
 * do chamador aconteceria fora do contexto e o autor da alteração se perderia.
 */
function runIn<T>(store: AuditStore, fn: () => T): T {
  return storage.run(store, () => {
    const result = fn();
    if (result && typeof (result as any).then === 'function') {
      return new Promise((resolve, reject) =>
        (result as any).then(resolve, reject),
      ) as T;
    }
    return result;
  });
}

/**
 * Contexto de auditoria da operação em andamento (quem está alterando e por qual rota).
 * É preenchido pelo AuditContextInterceptor em cada requisição HTTP e consumido pela
 * extensão do Prisma, que grava `modifierId`/`modifiedEndpoint` em toda escrita.
 */
@Injectable()
export class AuditContext {
  get(): AuditStore | undefined {
    return storage.getStore();
  }

  run<T>(store: AuditStore, fn: () => T): T {
    return runIn(store, fn);
  }

  /** Executa fn como o usuário informado, mantendo a rota do contexto atual. */
  actAs<T>(userId: string, fn: () => T): T {
    const current = storage.getStore();
    return runIn(
      {
        userId,
        endpoint: current?.endpoint ?? null,
        withDeleted: current?.withDeleted ?? false,
      },
      fn,
    );
  }

  /** Executa fn como o sistema (seed, webhook, job). */
  runAsSystem<T>(origin: SystemOrigin, fn: () => T): T {
    return runIn(
      { userId: 'system', endpoint: origin, withDeleted: false },
      fn,
    );
  }

  /** Executa fn enxergando também os registros excluídos (soft delete). */
  withDeleted<T>(fn: () => T): T {
    const current = storage.getStore();
    return runIn(
      {
        userId: current?.userId ?? null,
        endpoint: current?.endpoint ?? null,
        withDeleted: true,
      },
      fn,
    );
  }
}
