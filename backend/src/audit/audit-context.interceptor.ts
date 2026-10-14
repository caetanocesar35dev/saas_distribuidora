import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, Subscription } from 'rxjs';
import { AuditContext } from './audit-context';

/**
 * Interceptor global: captura o usuário autenticado (preenchido pelo AuthGuard, que roda antes)
 * e a rota da requisição, e abre o contexto de auditoria para todo o handler. A extensão do
 * Prisma lê esse contexto para preencher `modifierId` e `modifiedEndpoint` nas escritas.
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest();
    const routePath: string = request.route?.path ?? request.path ?? '';
    const endpoint = `${request.method} ${routePath}`;
    const userId: string | null = request.user?.id ?? null;

    return new Observable((subscriber) => {
      let inner: Subscription | undefined;
      this.audit.run({ userId, endpoint, withDeleted: false }, () => {
        inner = next.handle().subscribe(subscriber);
      });
      return () => inner?.unsubscribe();
    });
  }
}
