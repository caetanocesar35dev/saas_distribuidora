import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Se não for GET e tiver um user no request (colocado pelo AuthGuard)
    if (request.method !== 'GET' && request.user) {
      // Injeta o ID do usuário (sub) e a URL no corpo da requisição
      request.body = {
        ...request.body,
        modifierId: request.user.sub,
        modifiedEndpoint: request.url,
      };
    }

    return next.handle();
  }
}
