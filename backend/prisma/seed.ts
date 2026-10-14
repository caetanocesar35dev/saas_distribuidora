/**
 * Dados de demonstração para desenvolvimento.
 *
 *   npm run db:seed
 *
 * Cria: planos, 1 organização (em teste), 1 empresa, 2 lojas, 4 usuários (1 da plataforma +
 * dono, gerente e funcionário), produtos (um com vasilhame), caixas abertos e um cliente com fiado
 * nas duas lojas. Tudo passa pelos serviços da aplicação (inclusive as vendas a prazo), então
 * auditoria, histórico e saldos nascem como na operação real. Todas as gravações constam como
 * `modifierId = 'system'` e `modifiedEndpoint = 'seed'`.
 *
 * Não roda em produção (a menos que SEED_ALLOW_PRODUCTION=1) e não duplica: se o seed já foi
 * aplicado, avisa e sai.
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { AuditContext } from '../src/audit/audit-context';
import { BottleMovementsService } from '../src/bottles/bottle-movements.service';
import { CashRegisterService } from '../src/cash-register/cash-register.service';
import { buildCnpj } from '../src/common/utils/document';
import { addDays } from '../src/common/utils/time';
import { PrismaService } from '../src/prisma/prisma.service';
import { SalesService } from '../src/sales/sales.service';

const PASSWORD = process.env.SEED_PASSWORD ?? '123456';
const EMAILS = {
  superadmin: 'admin@plataforma.com',
  owner: 'dono@exemplo.com',
  manager: 'gerente@exemplo.com',
  employee: 'funcionario@exemplo.com',
};

async function main() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SEED_ALLOW_PRODUCTION !== '1'
  ) {
    throw new Error(
      'O seed de demonstração não roda em produção (defina SEED_ALLOW_PRODUCTION=1 para forçar).',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const audit = app.get(AuditContext);
    const sales = app.get(SalesService);
    const cash = app.get(CashRegisterService);
    const bottles = app.get(BottleMovementsService);
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

    await audit.runAsSystem('seed', async () => {
      const already = await prisma.user.findUnique({
        where: { email: EMAILS.owner },
      });
      if (already) {
        console.log(
          'Seed já aplicado (o usuário dono@exemplo.com existe). Nada a fazer.',
        );
        return;
      }

      const passwordHash = await bcrypt.hash(PASSWORD, rounds);
      const user = (name: string, email: string, platformRole?: 'SUPERADMIN') =>
        prisma.user.create({
          data: { name, email, passwordHash, platformRole },
        });

      // ---- planos ----
      const [trial] = await Promise.all([
        prisma.plan.create({
          data: {
            name: 'Trial',
            priceInCents: 0,
            maxCompanies: 1,
            maxStoresPerCompany: 2,
          },
        }),
        prisma.plan.create({
          data: {
            name: 'Básico',
            priceInCents: 9900,
            maxCompanies: 1,
            maxStoresPerCompany: 3,
          },
        }),
        prisma.plan.create({ data: { name: 'Pro', priceInCents: 19900 } }),
      ]);

      // ---- pessoas, organização, empresa e lojas ----
      await user(
        'Administrador da Plataforma',
        EMAILS.superadmin,
        'SUPERADMIN',
      );
      const owner = await user('Maria Dona', EMAILS.owner);
      const manager = await user('Carlos Gerente', EMAILS.manager);
      const employee = await user('Ana Funcionária', EMAILS.employee);

      const organization = await prisma.organization.create({
        data: {
          name: 'Distribuidora Exemplo',
          ownerUserId: owner.id,
          planId: trial.id,
          subscriptionStatus: 'TRIAL',
          trialEndsAt: addDays(new Date(), 14),
          billingEmail: owner.email,
        },
      });
      const company = await prisma.company.create({
        data: {
          cnpj: buildCnpj('123456780001'),
          razaoSocial: 'Distribuidora Exemplo LTDA',
          nomeFantasia: 'Distribuidora Exemplo',
          organizationId: organization.id,
        },
      });
      const centro = await prisma.store.create({
        data: {
          companyId: company.id,
          name: 'Loja Centro',
          city: 'Recife',
          state: 'PE',
        },
      });
      const norte = await prisma.store.create({
        data: {
          companyId: company.id,
          name: 'Loja Norte',
          city: 'Olinda',
          state: 'PE',
        },
      });

      const link = async (
        userId: string,
        stores: { storeId: string; role: 'OWNER' | 'MANAGER' | 'EMPLOYEE' }[],
      ) => {
        const membership = await prisma.membership.create({
          data: { userId, companyId: company.id },
        });
        for (const s of stores) {
          await prisma.membershipStore.create({
            data: { membershipId: membership.id, ...s },
          });
        }
      };
      await link(owner.id, [
        { storeId: centro.id, role: 'OWNER' },
        { storeId: norte.id, role: 'OWNER' },
      ]);
      await link(manager.id, [{ storeId: centro.id, role: 'MANAGER' }]);
      await link(employee.id, [{ storeId: norte.id, role: 'EMPLOYEE' }]);

      // ---- catálogo: um produto com vasilhame retornável e preço diferente por loja ----
      const litrao = await prisma.bottleType.create({
        data: { companyId: company.id, name: 'Litrão' },
      });
      const catalog = [
        {
          code: '7891000100103',
          name: 'Cerveja Lata 350ml',
          packQuantity: 12,
          bottleTypeId: undefined,
          centro: [4.5, 3, 240],
          norte: [4.8, 3, 120],
        },
        {
          code: '7891000200207',
          name: 'Refrigerante 2L',
          packQuantity: 6,
          bottleTypeId: undefined,
          centro: [9, 6, 60],
          norte: [9, 6, 60],
        },
        {
          code: '7891000300301',
          name: 'Cerveja Litrão',
          packQuantity: 12,
          bottleTypeId: litrao.id,
          centro: [14, 10, 80],
          norte: [14.5, 10, 40],
        },
        {
          code: '7891000400405',
          name: 'Água Mineral 500ml',
          packQuantity: 12,
          bottleTypeId: undefined,
          centro: [2.5, 1, 15],
          norte: [2.5, 1, 200],
        },
      ];
      const offers: Record<string, string> = {}; // "<nome>|<loja>" -> storeProductId
      for (const item of catalog) {
        const product = await prisma.product.create({
          data: {
            companyId: company.id,
            code: item.code,
            name: item.name,
            packQuantity: item.packQuantity,
            bottleTypeId: item.bottleTypeId,
          },
        });
        for (const [store, [price, costPrice, stock]] of [
          [centro, item.centro],
          [norte, item.norte],
        ] as const) {
          const sp = await prisma.storeProduct.create({
            data: {
              storeId: store.id,
              productId: product.id,
              price,
              costPrice,
              stock,
            },
          });
          offers[`${item.name}|${store.id}`] = sp.id;
        }
      }

      // ---- vasilhames em estoque (por movimentação, como na operação) ----
      for (const store of [centro, norte]) {
        await bottles.registerManual(store.id, company.id, {
          bottleTypeId: litrao.id,
          type: 'MANUAL_ADJUSTMENT',
          quantity: 100,
          description: 'Estoque inicial',
        });
      }

      // ---- caixas abertos e um cliente com fiado nas duas lojas ----
      await cash.open(centro.id, 100);
      await cash.open(norte.id, 100);
      const customer = await prisma.customer.create({
        data: {
          companyId: company.id,
          name: 'Bar do Zé',
          phone: '81999990000',
        },
      });
      const fiado = (storeId: string, item: string, quantity: number) =>
        sales.create(storeId, company.id, owner.id, {
          paymentMethod: 'CREDIT_STORE',
          customerId: customer.id,
          items: [{ storeProductId: offers[`${item}|${storeId}`], quantity }],
        });
      await fiado(centro.id, 'Cerveja Litrão', 5); // dívida em dinheiro e 5 litrões emprestados
      await fiado(norte.id, 'Refrigerante 2L', 4);

      console.log('\nSeed aplicado com sucesso.\n');
      console.log(`Senha de todos os usuários: ${PASSWORD}`);
      console.table([
        { papel: 'SUPERADMIN (plataforma)', e_mail: EMAILS.superadmin },
        { papel: 'OWNER nas duas lojas', e_mail: EMAILS.owner },
        { papel: 'MANAGER na Loja Centro', e_mail: EMAILS.manager },
        { papel: 'EMPLOYEE na Loja Norte', e_mail: EMAILS.employee },
      ]);
    });
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
