import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Observable, map } from 'rxjs';
import { hasMinRole } from '../decorators/access.decorators';

/** Campos que o atendente (EMPLOYEE) nunca recebe: custo e lucro. */
export const COST_KEYS = new Set([
  'costPrice',
  'totalCost',
  'totalProfit',
  'profit',
]);

/** Cópia da resposta sem os campos de custo, em qualquer nível (listas, itens, `meta`). */
export function stripCost(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCost);
  if (value === null || typeof value !== 'object') return value;
  const proto = Object.getPrototypeOf(value) as unknown;
  // Date e outras classes passam como estão; só objetos simples (o que o Prisma devolve).
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!COST_KEYS.has(key)) out[key] = stripCost(item);
  }
  return out;
}

/**
 * O atendente não vê custo nem lucro (regra do produto). Esconder na tela não basta: a resposta
 * da API é filtrada aqui, para toda rota de loja ou empresa em que o papel de quem pede (resolvido
 * pelo TenantGuard) é menor que MANAGER. Vale para as rotas atuais e as futuras.
 */
@Injectable()
export class HideCostInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context
      .switchToHttp()
      .getRequest<{ tenant?: { role?: Role | null } }>();
    return next.handle().pipe(
      map((body: unknown) => {
        const role = request.tenant?.role;
        return role && !hasMinRole(role, Role.MANAGER) ? stripCost(body) : body;
      }),
    );
  }
}
