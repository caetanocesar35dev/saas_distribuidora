import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/access.decorators';
import { PrismaService } from '../prisma/prisma.service';

/** Vitrine pública de planos, usada na tela de cadastro. */
@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.plan.findMany({
      orderBy: { priceInCents: 'asc' },
      select: {
        id: true,
        name: true,
        priceInCents: true,
        maxCompanies: true,
        maxStoresPerCompany: true,
      },
    });
  }
}
