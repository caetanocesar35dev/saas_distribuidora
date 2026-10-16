import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { AuditContext } from '../audit/audit-context';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { addDays } from '../common/utils/time';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  /** Validade do access token, em segundos. */
  expires_in: number;
}

const INVALID_SESSION = 'Sessão inválida ou expirada. Faça login novamente.';

/**
 * Sessões com access token curto (JWT) + refresh token opaco com rotação:
 *  - o refresh token é aleatório e só o hash SHA-256 fica no banco;
 *  - cada uso gera um novo token da mesma família e revoga o anterior;
 *  - reuso de um token já revogado indica roubo: a família inteira é revogada.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
    private readonly config: ConfigService<Env, true>,
  ) {}

  hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private newRawToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private async signAccess(
    userId: string,
  ): Promise<{ token: string; expiresIn: number }> {
    const token = await this.jwt.signAsync({ sub: userId, typ: 'access' });
    const decoded = this.jwt.decode<{ exp: number; iat: number }>(token);
    return { token, expiresIn: decoded.exp - decoded.iat };
  }

  private refreshExpiry(): Date {
    return addDays(
      new Date(),
      this.config.get('REFRESH_TOKEN_DAYS', { infer: true }),
    );
  }

  /** Abre uma sessão nova (login/cadastro): nova família de refresh tokens. */
  async issueSession(userId: string, meta: SessionMeta = {}): Promise<Session> {
    const raw = this.newRawToken();
    await this.audit.actAs(userId, () =>
      this.prisma.refreshToken.create({
        data: {
          userId,
          familyId: randomUUID(),
          tokenHash: this.hash(raw),
          expiresAt: this.refreshExpiry(),
          userAgent: meta.userAgent?.slice(0, 255),
          ip: meta.ip?.slice(0, 64),
        },
      }),
    );
    return this.buildSession(userId, raw);
  }

  /** Troca um refresh token válido por um novo par de tokens, revogando o anterior. */
  async rotate(rawToken: string, meta: SessionMeta = {}): Promise<Session> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!record) throw new UnauthorizedException(INVALID_SESSION);

    if (record.revokedAt) {
      // Token já usado sendo apresentado de novo: possível roubo. Derruba a sessão inteira.
      await this.revokeFamily(record.userId, record.familyId);
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (record.expiresAt.getTime() <= Date.now())
      throw new UnauthorizedException(INVALID_SESSION);

    const user = await this.prisma.user.findFirst({
      where: { id: record.userId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException(INVALID_SESSION);

    const raw = this.newRawToken();
    const newId = randomUUID();
    await this.audit.actAs(record.userId, () =>
      this.prisma.$transaction(async (tx) => {
        // Reivindica o token antigo de forma atômica: só uma requisição concorrente vence.
        const claimed = await tx.refreshToken.updateMany({
          where: { id: record.id, revokedAt: null },
          data: { revokedAt: new Date(), replacedById: newId },
        });
        if (claimed.count === 0)
          throw new UnauthorizedException(INVALID_SESSION);

        await tx.refreshToken.create({
          data: {
            id: newId,
            userId: record.userId,
            familyId: record.familyId,
            tokenHash: this.hash(raw),
            expiresAt: this.refreshExpiry(),
            userAgent: meta.userAgent?.slice(0, 255) ?? record.userAgent,
            ip: meta.ip?.slice(0, 64) ?? record.ip,
          },
        });
      }),
    );
    return this.buildSession(record.userId, raw);
  }

  private async buildSession(
    userId: string,
    refreshToken: string,
  ): Promise<Session> {
    const { token, expiresIn } = await this.signAccess(userId);
    return {
      access_token: token,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
    };
  }

  private revokeFamily(userId: string, familyId: string) {
    return this.audit.actAs(userId, () =>
      this.prisma.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }

  /** Logout: revoga a sessão (família) do refresh token informado. Idempotente. */
  async revokeByToken(rawToken: string): Promise<void> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (record) await this.revokeFamily(record.userId, record.familyId);
  }

  /** Encerra todas as sessões do usuário (troca de senha, logout geral). */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.audit.actAs(userId, () =>
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }

  // ---- Tokens de redefinição de senha / convite --------------------------------------------

  /**
   * Token de redefinição sem tabela: JWT assinado com JWT_SECRET + hash atual da senha. Ao trocar
   * a senha o hash muda e o token deixa de valer, então só pode ser usado uma vez.
   */
  signPasswordToken(
    user: { id: string; passwordHash: string },
    expiresIn: '30m' | '7d',
  ): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, typ: 'reset' },
      {
        secret:
          this.config.get('JWT_SECRET', { infer: true }) + user.passwordHash,
        expiresIn,
      },
    );
  }

  /** Lê o id do usuário do token SEM validar (a validação exige o hash da senha do usuário). */
  peekPasswordTokenSubject(token: string): string | null {
    const decoded = this.jwt.decode<{ sub?: string; typ?: string }>(token);
    return decoded?.typ === 'reset' && decoded.sub ? decoded.sub : null;
  }

  async verifyPasswordToken(
    token: string,
    user: { passwordHash: string },
  ): Promise<boolean> {
    try {
      const payload = await this.jwt.verifyAsync<{ typ: string }>(token, {
        secret:
          this.config.get('JWT_SECRET', { infer: true }) + user.passwordHash,
      });
      return payload.typ === 'reset';
    } catch {
      return false;
    }
  }
}
