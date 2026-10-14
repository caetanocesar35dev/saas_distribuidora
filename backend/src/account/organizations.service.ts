import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidCnpj, onlyDigits } from '../common/utils/document';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/account.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Organizações em que o usuário é o responsável ou tem acesso por alguma company. */
  async mine(userId: string) {
    const orgs = await this.prisma.organization.findMany({
      where: {
        OR: [
          { ownerUserId: userId },
          {
            companies: {
              some: {
                deletedAt: null,
                memberships: { some: { userId, deletedAt: null } },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        pastDueSince: true,
        plan: {
          select: {
            id: true,
            name: true,
            maxCompanies: true,
            maxStoresPerCompany: true,
          },
        },
        companies: {
          where: { deletedAt: null },
          select: { id: true, razaoSocial: true, nomeFantasia: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return orgs.map(({ ownerUserId, ...org }) => ({
      ...org,
      isBillingOwner: ownerUserId === userId,
    }));
  }

  /** Cria uma nova company (com a primeira loja) na organização, respeitando o limite do plano. */
  async createCompany(
    organizationId: string,
    userId: string,
    dto: CreateCompanyDto,
  ) {
    const cnpj = onlyDigits(dto.cnpj);
    if (!isValidCnpj(cnpj)) throw new BadRequestException('CNPJ inválido.');

    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId },
      select: { plan: { select: { maxCompanies: true } } },
    });
    if (!org) throw new NotFoundException('Organização não encontrada.');

    return this.prisma.$transaction(async (tx) => {
      // Serializa criações concorrentes na mesma organização, para o limite do plano valer de verdade.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'org-companies:' + organizationId}))`;

      const max = org.plan.maxCompanies;
      if (max !== null) {
        const current = await tx.company.count({ where: { organizationId } });
        if (current >= max) {
          throw new ConflictException(
            `O plano permite no máximo ${max} empresa(s).`,
          );
        }
      }

      const existing = await this.prisma.company.findFirst({ where: { cnpj } });
      if (existing)
        throw new ConflictException('Este CNPJ já está cadastrado.');

      const company = await tx.company.create({
        data: {
          cnpj,
          razaoSocial: dto.razaoSocial,
          nomeFantasia: dto.nomeFantasia,
          organizationId,
        },
      });
      const store = await tx.store.create({
        data: { companyId: company.id, name: dto.storeName },
      });
      const membership = await tx.membership.create({
        data: { userId, companyId: company.id },
      });
      await tx.membershipStore.create({
        data: { membershipId: membership.id, storeId: store.id, role: 'OWNER' },
      });
      return { company, store };
    });
  }
}
