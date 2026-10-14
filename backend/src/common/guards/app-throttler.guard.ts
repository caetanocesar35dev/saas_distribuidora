import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limiting em memória (uma instância do backend). A chave é o usuário logado ou o IP; nas
 * rotas de autenticação, o e-mail informado também entra na chave (IP + e-mail).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const base: string = req.user?.id ?? req.ip ?? 'anon';
    const email = req.body?.email;
    if (typeof email === 'string' && email)
      return `${base}|${email.trim().toLowerCase()}`;
    return base;
  }
}
