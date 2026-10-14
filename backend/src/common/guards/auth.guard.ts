import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser, IS_PUBLIC_KEY } from '../decorators/access.decorators';

export interface AccessTokenPayload {
  sub: string;
  typ: 'access';
}

/**
 * Guard global: valida o access token (JWT) e carrega o usuário. A cada requisição confere se o
 * usuário continua ativo e não excluído, então desativar alguém bloqueia na hora, mesmo com o
 * token ainda dentro da validade.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const [type, token] = (request.headers.authorization ?? '').split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Token de autenticação ausente.');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado.');
    }
    if (payload.typ !== 'access')
      throw new UnauthorizedException('Token inválido.');

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true },
      select: { id: true, name: true, email: true, platformRole: true },
    });
    if (!user)
      throw new UnauthorizedException('Usuário inativo ou inexistente.');

    request.user = user satisfies AuthUser;
    return true;
  }
}
