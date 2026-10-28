import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { hasMinRole } from '../common/decorators/access.decorators';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Autorização do gerente no balcão (decisão do usuário): na venda fiada acima do limite, o
 * atendente não precisa sair da conta. O gerente ou dono digita o e-mail e a senha dele na tela do
 * atendente e a venda passa como se ele tivesse confirmado. As credenciais servem só para esta
 * conferência: não abrem sessão e não são gravadas em lugar nenhum.
 *
 * Contra tentativa e erro de senha: no máximo MAX_FAILURES erros por e-mail a cada WINDOW_MS (em
 * memória, como o rate limit da API).
 */
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; resetAt: number }>();

let dummyHash: Promise<string> | undefined;

export interface ManagerApproval {
  email: string;
  password: string;
}

export interface Approver {
  userId: string;
  role: Role;
}

export async function verifyManagerApproval(
  prisma: PrismaService,
  storeId: string,
  approval: ManagerApproval,
  now = Date.now(),
): Promise<Approver> {
  const key = approval.email;
  const entry = failures.get(key);
  if (entry && entry.resetAt <= now) failures.delete(key);
  if ((failures.get(key)?.count ?? 0) >= MAX_FAILURES) {
    throw new HttpException(
      'Muitas tentativas de autorização com este e-mail. Aguarde 15 minutos.',
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: approval.email },
    select: { id: true, passwordHash: true, isActive: true },
  });
  // Hash falso quando o e-mail não existe: o tempo de resposta não revela quem existe.
  dummyHash ??= bcrypt.hash(randomBytes(16).toString('hex'), 10);
  const matches = await bcrypt.compare(
    approval.password,
    user?.passwordHash ?? (await dummyHash),
  );
  if (!user || !matches || !user.isActive) {
    const current = failures.get(key);
    failures.set(key, {
      count: (current?.count ?? 0) + 1,
      resetAt: current?.resetAt ?? now + WINDOW_MS,
    });
    throw new BadRequestException('E-mail ou senha do gerente incorretos.');
  }
  failures.delete(key);

  const access = await prisma.membershipStore.findFirst({
    where: {
      storeId,
      store: { deletedAt: null },
      membership: {
        userId: user.id,
        deletedAt: null,
        company: { deletedAt: null },
      },
    },
    select: { role: true },
  });
  if (!access || !hasMinRole(access.role, Role.MANAGER)) {
    throw new ForbiddenException(
      'Só um gerente ou dono desta loja pode autorizar a venda acima do limite.',
    );
  }
  return { userId: user.id, role: access.role };
}

/** Só para testes: zera a contagem de erros. */
export function resetManagerApprovalFailures() {
  failures.clear();
}
