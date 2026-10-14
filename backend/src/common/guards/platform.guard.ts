import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole } from '@prisma/client';
import { PLATFORM_ROLE_KEY } from '../decorators/access.decorators';

/** Rotas /platform/*: exige platformRole (SUPPORT lê, SUPERADMIN lê e escreve). */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const required = this.reflector.getAllAndOverride<PlatformRole[]>(
      PLATFORM_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user?.platformRole || !required.includes(user.platformRole)) {
      throw new ForbiddenException('Acesso restrito à plataforma.');
    }
    return true;
  }
}
