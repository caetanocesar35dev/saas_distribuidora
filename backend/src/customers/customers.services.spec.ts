import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  createServiceTest,
  ServiceTestContext,
} from '../../test/helpers/service-module';
import { World } from '../../test/helpers/factory';
import { CustomerPaymentsService } from './customer-payments.service';
import { CustomersService } from './customers.service';

describe('Serviços de clientes e fiado', () => {
  let ctx: ServiceTestContext;
  let customers: CustomersService;
  let payments: CustomerPaymentsService;
  let w: World;

  beforeAll(async () => {
    ctx = await createServiceTest([CustomersService, CustomerPaymentsService]);
    customers = ctx.module.get(CustomersService);
    payments = ctx.module.get(CustomerPaymentsService);
  });
  beforeEach(async () => {
    await ctx.reset();
    w = await ctx.factory.world();
  });
  afterAll(() => ctx.close());

  const as = <T>(fn: () => Promise<T>, endpoint = 'POST /api/teste') =>
    ctx.asRequest(fn, { userId: w.owner.id, endpoint });
  const page = { page: 1, limit: 20 };
  const owner = () => ({
    role: 'OWNER' as const,
    storeIds: [w.storeA.id, w.storeB.id],
  });
  const debtOf = async (customerId: string, storeId: string) =>
    (
      await ctx.prisma.customerStoreBalance.findUnique({
        where: { customerId_storeId: { customerId, storeId } },
      })
    )?.balance;

  describe('CustomersService', () => {
    it('cria, busca por nome ou telefone (sem diferenciar maiúsculas) e pagina', async () => {
      await as(() =>
        customers.create(
          w.company.id,
          {
            name: 'Maria da Silva',
            phone: '81999990000',
          },
          'EMPLOYEE',
        ),
      );
      await as(() =>
        customers.create(w.company.id, { name: 'José Souza' }, 'EMPLOYEE'),
      );
      await as(() =>
        customers.create(
          w.company.id,
          {
            name: 'Ana Lima',
            phone: '81988887777',
          },
          'EMPLOYEE',
        ),
      );

      expect(
        (await customers.list(w.company.id, page, owner())).data.map(
          (c) => c.name,
        ),
      ).toEqual(['Ana Lima', 'José Souza', 'Maria da Silva']);
      expect(
        (
          await customers.list(
            w.company.id,
            { ...page, search: 'MARIA' },
            owner(),
          )
        ).data,
      ).toHaveLength(1);
      expect(
        (
          await customers.list(
            w.company.id,
            { ...page, search: '8198888' },
            owner(),
          )
        ).data.map((c) => c.name),
      ).toEqual(['Ana Lima']);
      const second = await customers.list(
        w.company.id,
        { page: 2, limit: 2 },
        owner(),
      );
      expect(second.data).toHaveLength(1);
      expect(second.meta.totalPages).toBe(2);
    });

    it('não enxerga nem altera cliente de outra empresa', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.factory.customer(other.company.id);
      await expect(
        customers.get(w.company.id, foreign.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() =>
          customers.update(w.company.id, foreign.id, { name: 'X' }, 'OWNER'),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        as(() => customers.remove(w.company.id, foreign.id)),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(
        (await customers.list(w.company.id, page, owner())).data,
      ).toHaveLength(0);
    });

    it('lista com a dívida de cada cliente, filtra quem deve e respeita as lojas do funcionário', async () => {
      const ana = await ctx.factory.customer(w.company.id, 'Ana');
      const bia = await ctx.factory.customer(w.company.id, 'Bia');
      const caio = await ctx.factory.customer(w.company.id, 'Caio');
      await ctx.factory.debt(ana.id, w.storeA.id, 30.1);
      await ctx.factory.debt(ana.id, w.storeB.id, 20);
      await ctx.factory.debt(bia.id, w.storeB.id, 15);
      await ctx.factory.debt(caio.id, w.storeA.id, 10);
      await ctx.factory.debt(caio.id, w.storeA.id, -10); // quitou: não aparece

      const all = await customers.list(w.company.id, page, owner());
      expect(
        all.data.map((c) => [
          c.name,
          [...c.debts].sort((a, b) => b.balance - a.balance),
        ]),
      ).toEqual([
        [
          'Ana',
          [
            { storeId: w.storeA.id, balance: 30.1 },
            { storeId: w.storeB.id, balance: 20 },
          ],
        ],
        ['Bia', [{ storeId: w.storeB.id, balance: 15 }]],
        ['Caio', []],
      ]);

      const devedores = await customers.list(
        w.company.id,
        { ...page, withDebt: true },
        owner(),
      );
      expect(devedores.data.map((c) => c.name)).toEqual(['Ana', 'Bia']);
      expect(devedores.meta.totalItems).toBe(2);

      // funcionário só da loja A: não vê a dívida da loja B nem quem só deve lá
      const employee = { role: 'EMPLOYEE' as const, storeIds: [w.storeA.id] };
      const asEmployee = await customers.list(
        w.company.id,
        { ...page, withDebt: true },
        employee,
      );
      expect(asEmployee.data.map((c) => [c.name, c.debts])).toEqual([
        ['Ana', [{ storeId: w.storeA.id, balance: 30.1 }]],
      ]);
    });

    it('limite de crédito: só gerente e dono definem; null tira o limite', async () => {
      await expect(
        as(() =>
          customers.create(
            w.company.id,
            { name: 'Zé', creditLimit: 100 },
            'EMPLOYEE',
          ),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const c = await as(() =>
        customers.create(
          w.company.id,
          { name: 'Zé', creditLimit: 100.555 },
          'MANAGER',
        ),
      );
      expect(c.creditLimit).toBe(100.56);

      // atendente edita nome e telefone, mas não o limite
      await as(() =>
        customers.update(w.company.id, c.id, { name: 'Zé Silva' }, 'EMPLOYEE'),
      );
      await expect(
        as(() =>
          customers.update(
            w.company.id,
            c.id,
            { creditLimit: 500 },
            'EMPLOYEE',
          ),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect((await customers.get(w.company.id, c.id)).creditLimit).toBe(
        100.56,
      );

      const cleared = await as(() =>
        customers.update(w.company.id, c.id, { creditLimit: null }, 'OWNER'),
      );
      expect(cleared).toMatchObject({ name: 'Zé Silva', creditLimit: null });
    });

    it('endereço é opcional: grava, edita campo a campo e texto vazio apaga', async () => {
      const semEndereco = await as(() =>
        customers.create(w.company.id, { name: 'Sem endereço' }, 'EMPLOYEE'),
      );
      expect(semEndereco).toMatchObject({
        zipCode: null,
        street: null,
        state: null,
      });

      const c = await as(() =>
        customers.create(
          w.company.id,
          {
            name: 'Com endereço',
            zipCode: '50030-230',
            street: ' Rua da Aurora ',
            number: '100',
            neighborhood: 'Boa Vista',
            city: 'Recife',
            state: 'pe',
          },
          'EMPLOYEE',
        ),
      );
      expect(c).toMatchObject({
        zipCode: '50030-230',
        street: 'Rua da Aurora',
        number: '100',
        complement: null,
        neighborhood: 'Boa Vista',
        city: 'Recife',
        state: 'PE',
      });

      // editar só o número não mexe no resto; vazio apaga o complemento e a rua
      await as(() =>
        customers.update(
          w.company.id,
          c.id,
          { number: '200', complement: 'Sala 3' },
          'EMPLOYEE',
        ),
      );
      const apagado = await as(() =>
        customers.update(
          w.company.id,
          c.id,
          { complement: '', street: '   ' },
          'EMPLOYEE',
        ),
      );
      expect(apagado).toMatchObject({
        number: '200',
        complement: null,
        street: null,
        city: 'Recife',
        state: 'PE',
      });
    });

    it('atualiza nome e telefone', async () => {
      const c = await as(() =>
        customers.create(w.company.id, { name: 'Antigo' }, 'EMPLOYEE'),
      );
      const updated = await as(() =>
        customers.update(
          w.company.id,
          c.id,
          {
            name: 'Novo',
            phone: '81911112222',
          },
          'EMPLOYEE',
        ),
      );
      expect(updated).toMatchObject({ name: 'Novo', phone: '81911112222' });
    });

    it('exclui por soft delete e restaura', async () => {
      const c = await ctx.factory.customer(w.company.id);
      await as(() => customers.remove(w.company.id, c.id));
      expect(
        (await customers.list(w.company.id, page, owner())).data,
      ).toHaveLength(0);
      await as(() => customers.restore(w.company.id, c.id));
      expect(
        (await customers.list(w.company.id, page, owner())).data,
      ).toHaveLength(1);
      await expect(
        as(() => customers.restore(w.company.id, c.id)),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lista só os excluídos (com a data) para gerente e dono; o atendente é recusado', async () => {
      const kept = await ctx.factory.customer(w.company.id);
      const gone = await ctx.factory.customer(w.company.id);
      await as(() => customers.remove(w.company.id, gone.id));
      const other = await ctx.factory.world();
      const foreign = await ctx.factory.customer(other.company.id);
      await ctx.asRequest(
        () => customers.remove(other.company.id, foreign.id),
        { userId: other.owner.id, endpoint: 'DELETE /api/teste' },
      );

      const deleted = await customers.list(
        w.company.id,
        { ...page, deleted: true },
        { role: 'MANAGER', storeIds: [w.storeA.id] },
      );
      expect(deleted.data.map((c) => c.id)).toEqual([gone.id]);
      expect(deleted.data[0].deletedAt).toBeInstanceOf(Date);
      expect(deleted.data[0].debts).toEqual([]);
      expect(
        (await customers.list(w.company.id, page, owner())).data.map(
          (c) => c.id,
        ),
      ).toEqual([kept.id]);

      await expect(
        customers.list(
          w.company.id,
          { ...page, deleted: true },
          { role: 'EMPLOYEE', storeIds: [w.storeA.id] },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('não exclui cliente com fiado ou com vasilhame em aberto', async () => {
      const c = await ctx.factory.customer(w.company.id);
      await ctx.factory.debt(c.id, w.storeA.id, 10);
      await expect(
        as(() => customers.remove(w.company.id, c.id)),
      ).rejects.toThrow(/dívida/);

      const d = await ctx.factory.customer(w.company.id);
      const bt = await ctx.factory.bottleType(w.company.id);
      await ctx.factory.bottleDebt(d.id, w.storeA.id, bt.id, 2);
      await expect(
        as(() => customers.remove(w.company.id, d.id)),
      ).rejects.toThrow(/vasilhames/);
    });

    describe('balances', () => {
      it('soma o total na hora e separa por loja, com o vasilhame devido', async () => {
        const c = await ctx.factory.customer(w.company.id);
        const bt = await ctx.factory.bottleType(w.company.id, 'Litrão');
        await ctx.factory.debt(c.id, w.storeA.id, 100.1);
        await ctx.factory.debt(c.id, w.storeB.id, 49.9);
        await ctx.factory.bottleDebt(c.id, w.storeA.id, bt.id, 3);

        const b = await customers.balances(w.company.id, c.id, owner());
        expect(b.total).toBe(150);
        // Dívida lançada sem venda (só o saldo): nenhuma venda fiada para contar.
        expect(b.perStore).toEqual([
          {
            storeId: w.storeA.id,
            storeName: 'Loja A',
            balance: 100.1,
            openCreditSales: 0,
            oldestOpenCreditSaleAt: null,
          },
          {
            storeId: w.storeB.id,
            storeName: 'Loja B',
            balance: 49.9,
            openCreditSales: 0,
            oldestOpenCreditSaleAt: null,
          },
        ]);
        expect(b.bottles).toEqual([
          {
            storeId: w.storeA.id,
            storeName: 'Loja A',
            bottleTypeId: bt.id,
            bottleTypeName: 'Litrão',
            balance: 3,
          },
        ]);
      });

      it('funcionário só vê as lojas dele e não recebe o total', async () => {
        const c = await ctx.factory.customer(w.company.id);
        await ctx.factory.debt(c.id, w.storeA.id, 80);
        await ctx.factory.debt(c.id, w.storeB.id, 20);

        const asEmployee = await customers.balances(w.company.id, c.id, {
          role: 'EMPLOYEE',
          storeIds: [w.storeA.id],
        });
        expect(asEmployee.total).toBeNull();
        expect(asEmployee.perStore.map((s) => s.storeId)).toEqual([
          w.storeA.id,
        ]);

        const asManager = await customers.balances(w.company.id, c.id, {
          role: 'MANAGER',
          storeIds: [w.storeA.id],
        });
        expect(asManager.total).toBe(100);
        expect(asManager.perStore).toHaveLength(2);
      });

      it('conta as vendas fiadas em aberto: o pagamento quita primeiro as mais antigas', async () => {
        const c = await ctx.factory.customer(w.company.id);
        const day = (d: number) => new Date(`2026-10-0${d}T12:00:00Z`);
        await ctx.factory.creditSale(c.id, w.storeA.id, 30, day(1));
        await ctx.factory.creditSale(c.id, w.storeA.id, 20, day(2));
        await ctx.factory.creditSale(c.id, w.storeA.id, 50, day(3));
        await ctx.factory.creditSale(c.id, w.storeB.id, 10, day(4));
        const cancelled = await ctx.factory.creditSale(
          c.id,
          w.storeA.id,
          99,
          day(5),
        );
        // venda cancelada: sai da dívida e da contagem
        await ctx.factory.debt(c.id, w.storeA.id, -99);
        await ctx.audit.runAsSystem('seed', () =>
          ctx.prisma.sale.update({
            where: { id: cancelled.id },
            data: { status: 'CANCELED' },
          }),
        );

        const storeA = async () =>
          (await customers.balances(w.company.id, c.id, owner())).perStore.find(
            (s) => s.storeId === w.storeA.id,
          )!;
        expect(await storeA()).toMatchObject({
          balance: 100,
          openCreditSales: 3,
          oldestOpenCreditSaleAt: day(1),
        });

        // pagou R$ 40: a de R$ 30 (mais antiga) está quitada e a de R$ 20 ficou paga em parte
        await ctx.factory.debt(c.id, w.storeA.id, -40);
        expect(await storeA()).toMatchObject({
          balance: 60,
          openCreditSales: 2,
          oldestOpenCreditSaleAt: day(2),
        });

        // pagou mais R$ 10: sobra só a última venda, de R$ 50
        await ctx.factory.debt(c.id, w.storeA.id, -10);
        expect(await storeA()).toMatchObject({
          balance: 50,
          openCreditSales: 1,
          oldestOpenCreditSaleAt: day(3),
        });

        const b = await customers.balances(w.company.id, c.id, owner());
        expect(b.perStore.find((s) => s.storeId === w.storeB.id)).toMatchObject(
          { balance: 10, openCreditSales: 1 },
        );
      });

      it('cliente sem dívida tem total zero; saldo zerado não aparece', async () => {
        const c = await ctx.factory.customer(w.company.id);
        await ctx.factory.debt(c.id, w.storeA.id, 10);
        await ctx.factory.debt(c.id, w.storeA.id, -10);
        const b = await customers.balances(w.company.id, c.id, owner());
        expect(b).toEqual({
          total: 0,
          creditLimit: null,
          perStore: [],
          bottles: [],
        });
      });
    });
  });

  describe('CustomerPaymentsService.pay (abatimento cruzado)', () => {
    let customer: { id: string };

    beforeEach(async () => {
      customer = await ctx.factory.customer(w.company.id, 'Zé do Bar');
      await ctx.factory.openCash(w.storeB.id, 50);
    });

    const pay = (
      over: Partial<Parameters<CustomerPaymentsService['pay']>[3]> = {},
      storeId = w.storeB.id,
    ) =>
      as(
        () =>
          payments.pay(storeId, w.company.id, customer.id, {
            amount: 100,
            paymentMethod: 'MONEY',
            ...over,
          }),
        'POST /api/stores/:storeId/customers/:customerId/payments',
      );

    it('CENÁRIO DO PLANO: R$100 na loja B abatendo R$60 da loja A e R$40 da própria B, numa chamada só', async () => {
      await ctx.factory.debt(customer.id, w.storeA.id, 60);
      await ctx.factory.debt(customer.id, w.storeB.id, 40);

      const payment = await pay({
        allocations: [
          { storeId: w.storeA.id, amount: 60 },
          { storeId: w.storeB.id, amount: 40 },
        ],
      });

      expect(payment).toMatchObject({
        storeId: w.storeB.id,
        amount: 100,
        paymentMethod: 'MONEY',
      });
      expect(
        payment.allocations.map((a) => [a.store.name, a.amount]).sort(),
      ).toEqual([
        ['Loja A', 60],
        ['Loja B', 40],
      ]);
      expect(await debtOf(customer.id, w.storeA.id)).toBe(0);
      expect(await debtOf(customer.id, w.storeB.id)).toBe(0);

      // o dinheiro entrou no caixa da loja onde foi recebido
      const movement = await ctx.prisma.cashMovement.findFirstOrThrow();
      expect(movement).toMatchObject({ type: 'IN', amount: 100 });
      expect(movement.description).toContain('Zé do Bar');

      const balances = await customers.balances(
        w.company.id,
        customer.id,
        owner(),
      );
      expect(balances.total).toBe(0);
    });

    it('sem alocação informada, distribui sozinho: primeiro a loja que recebeu, depois as outras', async () => {
      await ctx.factory.debt(customer.id, w.storeA.id, 70);
      await ctx.factory.debt(customer.id, w.storeB.id, 40);

      const payment = await pay({ amount: 100 });
      const byStore = Object.fromEntries(
        payment.allocations.map((a) => [a.store.name, a.amount]),
      );
      expect(byStore).toEqual({ 'Loja B': 40, 'Loja A': 60 });
      expect(await debtOf(customer.id, w.storeA.id)).toBe(10);
      expect(await debtOf(customer.id, w.storeB.id)).toBe(0);
    });

    it('pagamento parcial reduz a dívida e mantém o resto', async () => {
      await ctx.factory.debt(customer.id, w.storeB.id, 100);
      await pay({ amount: 35.5 });
      expect(await debtOf(customer.id, w.storeB.id)).toBe(64.5);
    });

    it('o total consolidado reflete o pagamento (sem resíduo de ponto flutuante)', async () => {
      await ctx.factory.debt(customer.id, w.storeA.id, 0.3);
      await ctx.factory.debt(customer.id, w.storeB.id, 0.1);
      await pay({
        amount: 0.1,
        allocations: [{ storeId: w.storeA.id, amount: 0.1 }],
      });
      expect(await debtOf(customer.id, w.storeA.id)).toBe(0.2);
      expect(
        (await customers.balances(w.company.id, customer.id, owner())).total,
      ).toBe(0.3);
    });

    it('uma alocação inválida não altera nada (rollback total)', async () => {
      await ctx.factory.debt(customer.id, w.storeA.id, 60);
      await ctx.factory.debt(customer.id, w.storeB.id, 40);

      const bad = [
        {
          amount: 100,
          allocations: [
            { storeId: w.storeA.id, amount: 60 },
            { storeId: w.storeB.id, amount: 30 },
          ],
        }, // soma 90
        { amount: 100, allocations: [{ storeId: w.storeA.id, amount: 100 }] }, // passa da dívida da A
        {
          amount: 100,
          allocations: [
            { storeId: w.storeA.id, amount: 50 },
            { storeId: w.storeA.id, amount: 50 },
          ],
        }, // loja repetida
        {
          amount: 10,
          allocations: [{ storeId: 'loja-de-outra-empresa', amount: 10 }],
        }, // sem dívida lá
      ];
      for (const attempt of bad) {
        await expect(pay(attempt)).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(await debtOf(customer.id, w.storeA.id)).toBe(60);
      expect(await debtOf(customer.id, w.storeB.id)).toBe(40);
      expect(await ctx.prisma.customerPayment.count()).toBe(0);
      expect(await ctx.prisma.cashMovement.count()).toBe(0);
    });

    it('falha no meio da transação desfaz tudo (pagamento, alocações, saldos e caixa)', async () => {
      await ctx.factory.debt(customer.id, w.storeB.id, 40);
      const original = ctx.prisma.$transaction.bind(ctx.prisma);
      jest.spyOn(ctx.prisma, '$transaction').mockImplementationOnce(((
        fn: any,
      ) =>
        original(async (tx: any) => {
          await fn(tx);
          throw new Error('boom');
        })) as any);
      await expect(pay({ amount: 40 })).rejects.toThrow('boom');
      expect(await debtOf(customer.id, w.storeB.id)).toBe(40);
      expect(await ctx.prisma.customerPayment.count()).toBe(0);
      expect(await ctx.prisma.customerPaymentAllocation.count()).toBe(0);
      expect(await ctx.prisma.cashMovement.count()).toBe(0);
    });

    it('recusa valor maior que a dívida total e cliente sem dívida', async () => {
      await expect(pay({ amount: 10 })).rejects.toThrow(/não tem dívida/);
      await ctx.factory.debt(customer.id, w.storeA.id, 30);
      await expect(pay({ amount: 50 })).rejects.toThrow(
        /maior que a dívida total/,
      );
      expect(await debtOf(customer.id, w.storeA.id)).toBe(30);
    });

    it('sem caixa aberto na loja que recebe, abre um sozinho e recebe', async () => {
      await ctx.factory.debt(customer.id, w.storeA.id, 30);
      // a loja A não tem caixa aberto; a B tem
      await pay({ amount: 10 }, w.storeA.id);
      expect(await debtOf(customer.id, w.storeA.id)).toBe(20);
      expect(
        await ctx.prisma.cashRegister.count({
          where: { storeId: w.storeA.id, status: 'OPEN' },
        }),
      ).toBe(1);
    });

    it('não aceita CREDIT_STORE como forma de pagamento', async () => {
      await ctx.factory.debt(customer.id, w.storeB.id, 30);
      await expect(
        pay({ amount: 10, paymentMethod: 'CREDIT_STORE' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cliente de outra empresa não é aceito', async () => {
      const other = await ctx.factory.world();
      const foreign = await ctx.factory.customer(other.company.id);
      await expect(
        as(() =>
          payments.pay(w.storeB.id, w.company.id, foreign.id, {
            amount: 10,
            paymentMethod: 'PIX',
          }),
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('pagamentos simultâneos nunca abatem mais do que a dívida', async () => {
      await ctx.factory.debt(customer.id, w.storeB.id, 100);
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => pay({ amount: 40 })),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      expect(ok).toBeLessThanOrEqual(2); // 40 + 40 = 80; o terceiro (120) passaria da dívida
      expect(ok).toBeGreaterThanOrEqual(1);
      const remaining = await debtOf(customer.id, w.storeB.id);
      expect(remaining).toBeGreaterThanOrEqual(0);
      expect(remaining).toBe(100 - ok * 40);
      expect(await ctx.prisma.customerPayment.count()).toBe(ok);
    });

    it('registra a auditoria: pagamento, alocação e saldo com a rota e o autor', async () => {
      await ctx.factory.debt(customer.id, w.storeB.id, 40);
      const payment = await pay({ amount: 40 });
      const alloc = await ctx.prisma.customerPaymentAllocation.findFirstOrThrow(
        { where: { paymentId: payment.id } },
      );
      expect(alloc).toMatchObject({
        modifierId: w.owner.id,
        modifiedEndpoint:
          'POST /api/stores/:storeId/customers/:customerId/payments',
      });
      const balance = await ctx.prisma.customerStoreBalance.findFirstOrThrow({
        where: { customerId: customer.id },
      });
      expect(balance.modifiedEndpoint).toBe(
        'POST /api/stores/:storeId/customers/:customerId/payments',
      );
    });
  });

  describe('histórico de pagamentos', () => {
    it('lista os pagamentos do cliente; funcionário só vê o que entrou nas lojas dele', async () => {
      const c = await ctx.factory.customer(w.company.id);
      await ctx.factory.openCash(w.storeA.id);
      await ctx.factory.openCash(w.storeB.id);
      await ctx.factory.debt(c.id, w.storeA.id, 50);
      await ctx.factory.debt(c.id, w.storeB.id, 50);
      await as(() =>
        payments.pay(w.storeA.id, w.company.id, c.id, {
          amount: 10,
          paymentMethod: 'PIX',
          allocations: [{ storeId: w.storeA.id, amount: 10 }],
        }),
      );
      await as(() =>
        payments.pay(w.storeB.id, w.company.id, c.id, {
          amount: 20,
          paymentMethod: 'MONEY',
          allocations: [{ storeId: w.storeB.id, amount: 20 }],
        }),
      );

      const all = await payments.list(
        w.company.id,
        c.id,
        { role: 'MANAGER', storeIds: [w.storeA.id] },
        { page: 1, limit: 20 },
      );
      expect(all.data.map((p) => p.amount)).toEqual([20, 10]);

      const employee = await payments.list(
        w.company.id,
        c.id,
        { role: 'EMPLOYEE', storeIds: [w.storeA.id] },
        { page: 1, limit: 20 },
      );
      expect(employee.data.map((p) => p.amount)).toEqual([10]);
    });
  });
});
