import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { AuditContext } from '../audit/audit-context';
import { isValidCnpj, normalizeCnpj } from '../common/utils/document';
import { TERMS_VERSION } from './terms';
import { addDays } from '../common/utils/time';
import { Env } from '../config/env';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  registerSignupReferral,
  resolveReferralCode,
} from '../referrals/referral-rewards';
import {
  ChangePasswordDto,
  LoginDto,
  ResetPasswordDto,
  SignupDto,
} from './dto/auth.dto';
import { Session, SessionMeta, TokenService } from './token.service';

const INVALID_CREDENTIALS = 'E-mail ou senha incorretos.';
const INVALID_RESET_LINK = 'Link inválido ou expirado.';

export interface AuthResult extends Session {
  user: {
    id: string;
    name: string;
    email: string;
    platformRole: string | null;
  };
}

@Injectable()
export class AuthService {
  private dummyHash?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditContext,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get rounds(): number {
    return this.config.get('BCRYPT_ROUNDS', { infer: true });
  }

  private hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.rounds);
  }

  /** Hash falso para comparar quando o e-mail não existe: o tempo de resposta não revela quem existe. */
  private async getDummyHash(): Promise<string> {
    this.dummyHash ??= await this.hashPassword(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }

  private toResult(
    session: Session,
    user: {
      id: string;
      name: string;
      email: string;
      platformRole: string | null;
    },
  ): AuthResult {
    return {
      ...session,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        platformRole: user.platformRole,
      },
    };
  }

  /**
   * Cadastro público: cria numa única transação o usuário, a organização (em trial), a company, a
   * primeira loja e o vínculo de OWNER. O gateway de pagamento não é chamado aqui.
   */
  async signup(dto: SignupDto, meta: SessionMeta = {}): Promise<AuthResult> {
    const cnpj = normalizeCnpj(dto.cnpj);
    if (!isValidCnpj(cnpj)) throw new BadRequestException('CNPJ inválido.');

    await this.audit.withDeleted(async () => {
      if (
        await this.prisma.user.findUnique({
          where: { email: dto.email },
          select: { id: true },
        })
      ) {
        throw new ConflictException('Este e-mail já está cadastrado.');
      }
      if (
        await this.prisma.company.findUnique({
          where: { cnpj },
          select: { id: true },
        })
      ) {
        throw new ConflictException('Este CNPJ já está cadastrado.');
      }
    });

    const plan = dto.planId
      ? await this.prisma.plan.findFirst({ where: { id: dto.planId } })
      : await this.prisma.plan.findFirst({ orderBy: { priceInCents: 'asc' } });
    if (!plan) {
      throw dto.planId
        ? new BadRequestException('Plano não encontrado.')
        : new ConflictException('Nenhum plano disponível para o cadastro.');
    }

    // Indicação: código desconhecido é recusado antes de criar qualquer coisa.
    const referral = dto.referralCode
      ? await resolveReferralCode(this.prisma, dto.referralCode)
      : null;

    const passwordHash = await this.hashPassword(dto.password);
    const userId = randomUUID();
    const trialDays = this.config.get('TRIAL_DAYS', { infer: true });
    const trialEndsAt = addDays(new Date(), trialDays);

    // O autor das gravações do cadastro é o próprio usuário que está sendo criado.
    const user = await this.audit.actAs(userId, () =>
      this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            id: userId,
            name: dto.name,
            email: dto.email,
            passwordHash,
            phone: dto.phone,
            termsAcceptedAt: new Date(),
            termsVersion: TERMS_VERSION,
          },
        });
        const organization = await tx.organization.create({
          data: {
            name: dto.nomeFantasia || dto.razaoSocial,
            ownerUserId: userId,
            planId: plan.id,
            subscriptionStatus: 'TRIAL',
            trialEndsAt,
            billingEmail: dto.email,
            billingDocument: cnpj,
          },
        });
        const company = await tx.company.create({
          data: {
            cnpj,
            razaoSocial: dto.razaoSocial,
            nomeFantasia: dto.nomeFantasia,
            organizationId: organization.id,
          },
        });
        // Endereço e telefone da primeira loja: o que a consulta pública do CNPJ trouxe na tela
        // (opcional; campos vazios ficam nulos). O dono confere depois em Lojas.
        const address = dto.storeAddress ?? {};
        const store = await tx.store.create({
          data: {
            companyId: company.id,
            name: dto.storeName,
            phone: address.phone || undefined,
            zipCode: address.zipCode || undefined,
            street: address.street || undefined,
            number: address.number || undefined,
            complement: address.complement || undefined,
            neighborhood: address.neighborhood || undefined,
            city: address.city || undefined,
            state: address.state ? address.state.toUpperCase() : undefined,
          },
        });
        const membership = await tx.membership.create({
          data: { userId, companyId: company.id },
        });
        await tx.membershipStore.create({
          data: {
            membershipId: membership.id,
            storeId: store.id,
            role: 'OWNER',
          },
        });
        if (referral)
          await registerSignupReferral(tx, organization.id, referral);
        return created;
      }),
    );

    // Boas-vindas: falha de envio não desfaz o cadastro (o MailService só registra).
    await this.mail.sendWelcome(
      user.email,
      user.name,
      dto.nomeFantasia || dto.razaoSocial,
      trialEndsAt,
    );
    const session = await this.tokens.issueSession(user.id, meta);
    return this.toResult(session, user);
  }

  async login(dto: LoginDto, meta: SessionMeta = {}): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const matches = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? (await this.getDummyHash()),
    );
    if (!user || !matches || !user.isActive)
      throw new UnauthorizedException(INVALID_CREDENTIALS);

    const session = await this.tokens.issueSession(user.id, meta);
    return this.toResult(session, user);
  }

  async refresh(
    refreshToken: string,
    meta: SessionMeta = {},
  ): Promise<Session> {
    return this.tokens.rotate(refreshToken, meta);
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.tokens.revokeByToken(refreshToken);
    return { message: 'Sessão encerrada.' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.tokens.revokeAllForUser(userId);
    return { message: 'Todas as sessões foram encerradas.' };
  }

  /** Resposta sempre igual, exista o e-mail ou não. */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
    });
    if (user) {
      const token = await this.tokens.signPasswordToken(user, '30m');
      const url = `${this.config.get('APP_URL', { infer: true })}/redefinir-senha?token=${encodeURIComponent(token)}`;
      await this.mail.sendPasswordReset(user.email, user.name, url);
    }
    return {
      message: 'Se o e-mail estiver cadastrado, enviaremos as instruções.',
    };
  }

  /** Redefinição de senha e também definição da primeira senha de um usuário convidado. */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const userId = this.tokens.peekPasswordTokenSubject(dto.token);
    if (!userId) throw new BadRequestException(INVALID_RESET_LINK);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
    });
    if (!user || !(await this.tokens.verifyPasswordToken(dto.token, user))) {
      throw new BadRequestException(INVALID_RESET_LINK);
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.audit.actAs(user.id, () =>
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
    );
    await this.tokens.revokeAllForUser(user.id);
    await this.mail.sendPasswordChanged(user.email, user.name);
    return { message: 'Senha redefinida com sucesso.' };
  }

  /** Troca a senha, encerra as outras sessões e devolve uma sessão nova para este dispositivo. */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: SessionMeta = {},
  ): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
    });
    if (!user) throw new UnauthorizedException();
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Senha atual incorreta.');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.audit.actAs(userId, () =>
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
    );
    await this.tokens.revokeAllForUser(userId);
    await this.mail.sendPasswordChanged(user.email, user.name);
    const session = await this.tokens.issueSession(userId, meta);
    return this.toResult(session, user);
  }

  /** Senha aleatória inutilizável, para usuários criados por convite (definem a senha pelo link). */
  async unusablePasswordHash(): Promise<string> {
    return this.hashPassword(randomBytes(32).toString('hex'));
  }
}
