import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/account.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        nomeFantasia: true,
        organizationId: true,
        createdAt: true,
      },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada.');
    return company;
  }

  /** O CNPJ não muda depois do cadastro. */
  async update(companyId: string, dto: UpdateCompanyDto) {
    await this.get(companyId);
    return this.prisma.company.update({
      where: { id: companyId },
      data: { razaoSocial: dto.razaoSocial, nomeFantasia: dto.nomeFantasia },
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        nomeFantasia: true,
        organizationId: true,
      },
    });
  }
}
