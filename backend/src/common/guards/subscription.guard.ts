import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_READ_ONLY_KEY } from '../decorators/access.decorators';
import { SubscriptionAccess } from '../utils/access-mode';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const REASON_MESSAGES: Record<string, string> = {
  TRIAL_EXPIRED:
    'O período de teste terminou. O sistema está em modo somente leitura até a assinatura ser paga.',
  PAST_DUE:
    'A mensalidade está em atraso. O sistema está em modo somente leitura até o pagamento.',
  CANCELED:
    'A assinatura foi cancelada. O sistema está em modo somente leitura.',
};

/**
 * Inadimplência nunca bloqueia o sistema inteiro: em somente leitura, tudo que é leitura
 * continua funcionando. Escritas respondem 402, exceto as marcadas com @AllowWhenReadOnly
 * (fechar o caixa já aberto e pagar a assinatura).
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest();
    const subscription: SubscriptionAccess | undefined =
      request.tenant?.subscription;
    if (!subscription || subscription.accessMode !== 'READ_ONLY') return true;
    if (SAFE_METHODS.has(request.method)) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_READ_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;

    throw new HttpException(
      {
        statusCode: 402,
        code: 'SUBSCRIPTION_READ_ONLY',
        reason: subscription.reason,
        message: REASON_MESSAGES[subscription.reason ?? 'CANCELED'],
      },
      402,
    );
  }
}
