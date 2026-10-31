import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isValidCnpj, normalizeCnpj } from '../common/utils/document';
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
          select: {
            id: true,
            razaoSocial: true,
            nomeFantasia: true,
            _count: { select: { stores: { where: { deletedAt: null } } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return orgs.map(({ ownerUserId, companies, ...org }) => ({
      ...org,
      // Quantas lojas cada empresa tem: a tela de troca de plano mostra o que cabe em cada plano.
      companies: companies.map(({ _count, ...company }) => ({
        ...company,
        storeCount: _count.stores,
      })),
      isBillingOwner: ownerUserId === userId,
    }));
  }

  /**
   * Troca de plano pelo próprio responsável (decisão do usuário, 2026-10-30): upgrade e downgrade
   * valem na hora; enquanto a cobrança automática não existe, o valor novo vale para a próxima
   * cobrança. O downgrade é recusado se a organização tiver mais empresas, ou alguma empresa mais
   * lojas, do que o plano novo permite. Plano gratuito (o Trial) é só para o período de teste: não
   * dá para escolhê-lo aqui. A situação da assinatura (teste, ativa, em atraso) não muda.
   */
  async changePlan(organizationId: string, planId: string) {
    const [org, plan] = await Promise.all([
      this.prisma.organization.findFirst({
        where: { id: organizationId },
        select: { planId: true },
      }),
      this.prisma.plan.findFirst({
        where: { id: planId },
        select: {
          id: true,
          name: true,
          priceInCents: true,
          maxCompanies: true,
          maxStoresPerCompany: true,
        },
      }),
    ]);
    if (!org) throw new NotFoundException('Organização não encontrada.');
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    if (org.planId === plan.id)
      throw new ConflictException(`Você já está no plano ${plan.name}.`);
    if (plan.priceInCents === 0) {
      throw new ConflictException(
        `O plano ${plan.name} é só para o período de teste. Escolha um plano pago.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // As mesmas travas de criar empresa e loja: ninguém cria uma no meio da conferência.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'org-companies:' + organizationId}))`;
      const companies = await tx.company.findMany({
        where: { organizationId },
        select: { id: true, razaoSocial: true, nomeFantasia: true },
        orderBy: { id: 'asc' },
      });
      if (plan.maxCompanies !== null && companies.length > plan.maxCompanies) {
        throw new ConflictException(
          `O plano ${plan.name} permite ${plan.maxCompanies} empresa(s) e você tem ${companies.length}.`,
        );
      }
      for (const company of companies) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'company-stores:' + company.id}))`;
        const stores = await tx.store.count({
          where: { companyId: company.id },
        });
        if (
          plan.maxStoresPerCompany !== null &&
          stores > plan.maxStoresPerCompany
        ) {
          throw new ConflictException(
            `O plano ${plan.name} permite ${plan.maxStoresPerCompany} loja(s) por empresa e ${company.nomeFantasia || company.razaoSocial} tem ${stores}. Exclua lojas antes de mudar para ele.`,
          );
        }
      }
      await tx.organization.update({
        where: { id: organizationId },
        data: { planId: plan.id },
      });
    });
    return { message: `Plano alterado para ${plan.name}.`, plan };
  }

  /** Cria uma nova company (com a primeira loja) na organização, respeitando o limite do plano. */
  async createCompany(
    organizationId: string,
    userId: string,
    dto: CreateCompanyDto,
  ) {
    const cnpj = normalizeCnpj(dto.cnpj);
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
