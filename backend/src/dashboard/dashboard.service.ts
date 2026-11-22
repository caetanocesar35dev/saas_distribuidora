import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { fromCents, roundMoney, toCents } from '../common/utils/money';
import {
  addDays,
  formatDayInTz,
  startOfDayInTz,
  startOfMonthInTz,
} from '../common/utils/time';
import { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { RealizedProfit, realizeFiadoProfit } from './fiado-profit';

export interface PeriodStats {
  /** Tudo o que foi vendido em produtos (inclusive no fiado), sem os cascos comprados. */
  revenue: number;
  /**
   * Lucro recebido: o das vendas à vista do período mais o das vendas fiadas (de qualquer data)
   * pagas no período, proporcional ao pagamento. O fiado não pago não entra.
   */
  profit: number;
  count: number;
  /**
   * Vendido no fiado no período: quanto do faturamento e o lucro dessas vendas (este NÃO está em
   * `profit`: entra lá só quando o cliente paga).
   */
  fiado: { revenue: number; profit: number };
  /** Parte de `profit` que veio de pagamentos de fiado no período. */
  fiadoProfitReceived: number;
  /** Pagamentos de fiado recebidos na loja no período (de vendas de qualquer data). */
  fiadoReceived: number;
  /** Cascos de vasilhame vendidos no período (fora do faturamento e do lucro). */
  bottles: number;
}

export interface DashboardStore {
  id: string;
  name: string;
}

/** "Primeiros passos" do Início: true = já feito. */
export interface Onboarding {
  /** A loja tem rua e cidade. */
  address: boolean;
  /** Há produto à venda na loja. */
  products: boolean;
  /** O caixa da loja já foi aberto alguma vez. */
  cashOpened: boolean;
  /** A empresa tem mais alguém além do dono. */
  team: boolean;
}

export interface Dashboard {
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  topProducts: {
    productId: string;
    code: string;
    name: string;
    quantity: number;
  }[];
  /** Faturamento e lucro do mês por categoria (`categoryId` null = sem categoria). */
  byCategory: {
    categoryId: string | null;
    name: string;
    revenue: number;
    profit: number;
  }[];
  /**
   * Vendas do mês por origem (balcão, iFood...; `channelId` null = vendas de antes de existir a
   * origem). Faturamento sem os cascos; `profit` é o lucro vendido (como na tabela por categoria).
   */
  byChannel: {
    channelId: string | null;
    name: string;
    count: number;
    revenue: number;
    profit: number;
  }[];
  chart: { date: string; revenue: number; profit: number; count: number }[];
  lowStock: {
    storeProductId: string;
    storeId: string;
    storeName: string;
    code: string;
    name: string;
    stock: number;
  }[];
  /** Fiado em aberto (soma dos saldos das lojas). */
  debt: number;
  /** Lucro das vendas fiadas ainda não pago (entra em `profit` quando o cliente pagar). */
  pendingFiadoProfit: number;
  /** Só no painel da empresa: o mesmo resumo por loja. */
  byStore?: {
    storeId: string;
    storeName: string;
    today: PeriodStats;
    week: PeriodStats;
    month: PeriodStats;
    debt: number;
    pendingFiadoProfit: number;
  }[];
}

const EMPTY: PeriodStats = {
  revenue: 0,
  profit: 0,
  count: 0,
  fiado: { revenue: 0, profit: 0 },
  fiadoProfitReceived: 0,
  fiadoReceived: 0,
  bottles: 0,
};

/**
 * Painéis. Tudo é agregado no banco (groupBy/SQL), nunca somado trazendo as vendas para a memória.
 * "Hoje", "7 dias" e "mês" seguem o fuso APP_TIMEZONE. Só vendas COMPLETED entram.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * "Primeiros passos" do Início (para o dono): o que já foi feito nesta loja. Cada item é
   * conferido no banco a cada chamada, então marca sozinho quando a pessoa faz a tarefa.
   */
  async onboarding(storeId: string, companyId: string): Promise<Onboarding> {
    const [store, products, cashRegisters, members] = await Promise.all([
      this.prisma.store.findFirst({
        where: { id: storeId },
        select: { street: true, city: true },
      }),
      this.prisma.storeProduct.count({ where: { storeId } }),
      this.prisma.cashRegister.count({ where: { storeId } }),
      this.prisma.membership.count({ where: { companyId } }),
    ]);
    return {
      address: !!(store?.street && store.city),
      products: products > 0,
      cashOpened: cashRegisters > 0,
      team: members > 1,
    };
  }

  async forStore(storeId: string, now = new Date()): Promise<Dashboard> {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId },
      select: { id: true, name: true },
    });
    if (!store) throw new NotFoundException('Loja não encontrada.');
    return this.build([store], false, now);
  }

  /** Painel consolidado da empresa, com a quebra por loja. */
  async forCompany(companyId: string, now = new Date()): Promise<Dashboard> {
    const stores = await this.prisma.store.findMany({
      where: { companyId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return this.build(stores, true, now);
  }

  private async build(
    stores: DashboardStore[],
    breakdown: boolean,
    now: Date,
  ): Promise<Dashboard> {
    const tz = this.config.get('APP_TIMEZONE', { infer: true });
    const storeIds = stores.map((s) => s.id);

    const todayStart = startOfDayInTz(now, tz);
    const weekStart = startOfDayInTz(addDays(todayStart, -6), tz);
    const monthStart = startOfMonthInTz(now, tz);

    if (storeIds.length === 0) {
      return {
        today: EMPTY,
        week: EMPTY,
        month: EMPTY,
        topProducts: [],
        byCategory: [],
        byChannel: [],
        chart: [],
        lowStock: [],
        debt: 0,
        pendingFiadoProfit: 0,
        ...(breakdown ? { byStore: [] } : {}),
      };
    }

    // O lucro do fiado entra quando o cliente paga: calculado uma vez e repartido nos períodos.
    const fiadoProfit = await this.fiadoProfit(
      storeIds,
      weekStart < monthStart ? weekStart : monthStart,
    );

    const [
      today,
      week,
      month,
      topProducts,
      byCategory,
      byChannel,
      chart,
      lowStock,
      debts,
    ] = await Promise.all([
      this.periodStats(storeIds, todayStart, fiadoProfit.realized),
      this.periodStats(storeIds, weekStart, fiadoProfit.realized),
      this.periodStats(storeIds, monthStart, fiadoProfit.realized),
      this.topProducts(storeIds, weekStart),
      this.byCategory(storeIds, monthStart),
      this.byChannel(storeIds, monthStart),
      this.chart(storeIds, weekStart, now, tz, fiadoProfit.realized),
      this.lowStock(storeIds),
      this.debts(storeIds),
    ]);

    const pending = fiadoProfit.pendingByStore;
    const result: Dashboard = {
      today: today.total,
      week: week.total,
      month: month.total,
      topProducts,
      byCategory,
      byChannel,
      chart,
      lowStock,
      debt: fromCents(
        [...debts.values()].reduce((sum, v) => sum + toCents(v), 0),
      ),
      pendingFiadoProfit: fromCents(
        [...pending.values()].reduce((sum, v) => sum + v, 0),
      ),
    };

    if (breakdown) {
      result.byStore = stores.map((s) => ({
        storeId: s.id,
        storeName: s.name,
        today: today.byStore.get(s.id) ?? EMPTY,
        week: week.byStore.get(s.id) ?? EMPTY,
        month: month.byStore.get(s.id) ?? EMPTY,
        debt: roundMoney(debts.get(s.id) ?? 0),
        pendingFiadoProfit: fromCents(pending.get(s.id) ?? 0),
      }));
    }
    return result;
  }

  /**
   * Lucro do fiado pelo dinheiro recebido (ver `realizeFiadoProfit`). Só olha os clientes que
   * pagaram fiado nestas lojas desde `since` ou que ainda devem; desses, traz todo o histórico de
   * vendas fiadas e pagamentos nestas lojas, porque o pagamento quita a venda mais antiga.
   */
  private async fiadoProfit(storeIds: string[], since: Date) {
    const [paid, owing] = await Promise.all([
      this.prisma.customerPaymentAllocation.findMany({
        where: {
          storeId: { in: storeIds },
          payment: { createdAt: { gte: since }, deletedAt: null },
        },
        select: { payment: { select: { customerId: true } } },
        distinct: ['paymentId'],
      }),
      this.prisma.customerStoreBalance.findMany({
        where: { storeId: { in: storeIds }, balance: { gt: 0 } },
        select: { customerId: true },
      }),
    ]);
    const customerIds = [
      ...new Set([
        ...paid.map((a) => a.payment.customerId),
        ...owing.map((b) => b.customerId),
      ]),
    ];
    if (customerIds.length === 0) return realizeFiadoProfit([], []);

    const [sales, allocations] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          storeId: { in: storeIds },
          customerId: { in: customerIds },
          paymentMethod: 'CREDIT_STORE',
          status: 'COMPLETED',
        },
        select: {
          customerId: true,
          storeId: true,
          createdAt: true,
          total: true,
          bottlesTotal: true,
          totalCost: true,
        },
      }),
      this.prisma.customerPaymentAllocation.findMany({
        where: {
          storeId: { in: storeIds },
          payment: { customerId: { in: customerIds }, deletedAt: null },
        },
        select: {
          storeId: true,
          amount: true,
          payment: { select: { customerId: true, createdAt: true } },
        },
      }),
    ]);

    return realizeFiadoProfit(
      sales.map((s) => ({
        customerId: s.customerId!,
        storeId: s.storeId,
        createdAt: s.createdAt,
        totalCents: toCents(s.total),
        profitCents:
          toCents(s.total) - toCents(s.bottlesTotal) - toCents(s.totalCost),
      })),
      allocations.map((a) => ({
        customerId: a.payment.customerId,
        storeId: a.storeId,
        createdAt: a.payment.createdAt,
        amountCents: toCents(a.amount),
      })),
    );
  }

  /**
   * Receita, lucro e nº de vendas desde `since`, no total e por loja. O faturamento conta o fiado
   * vendido (separado em `fiado`); o lucro conta só o recebido: à vista na venda, fiado quando o
   * cliente paga (`realized`). `fiadoReceived` são os pagamentos de fiado recebidos na loja.
   */
  private async periodStats(
    storeIds: string[],
    since: Date,
    realized: RealizedProfit[],
  ) {
    const [rows, received] = await Promise.all([
      this.prisma.sale.groupBy({
        by: ['storeId', 'paymentMethod'],
        where: {
          storeId: { in: storeIds },
          status: 'COMPLETED',
          createdAt: { gte: since },
        },
        _sum: { total: true, totalCost: true, bottlesTotal: true },
        _count: { _all: true },
      }),
      this.prisma.customerPayment.groupBy({
        by: ['storeId'],
        where: { storeId: { in: storeIds }, createdAt: { gte: since } },
        _sum: { amount: true },
      }),
    ]);

    // Somas em centavos por loja; `null` = total da empresa.
    type Acc = {
      revenue: number;
      cost: number;
      count: number;
      fiado: number;
      fiadoCost: number;
      /** lucro do fiado pago no período */
      realized: number;
      received: number;
      bottles: number;
    };
    const acc = new Map<string | null, Acc>();
    const at = (key: string | null) => {
      let a = acc.get(key);
      if (!a) {
        a = {
          revenue: 0,
          cost: 0,
          count: 0,
          fiado: 0,
          fiadoCost: 0,
          realized: 0,
          received: 0,
          bottles: 0,
        };
        acc.set(key, a);
      }
      return a;
    };
    for (const row of rows) {
      // O total da venda inclui os cascos comprados: saem do faturamento e vão à parte.
      const b = toCents(row._sum.bottlesTotal ?? 0);
      const r = toCents(row._sum.total ?? 0) - b;
      const c = toCents(row._sum.totalCost ?? 0);
      for (const a of [at(row.storeId), at(null)]) {
        a.revenue += r;
        a.cost += c;
        a.bottles += b;
        a.count += row._count._all;
        if (row.paymentMethod === 'CREDIT_STORE') {
          a.fiado += r;
          a.fiadoCost += c;
        }
      }
    }
    for (const row of received) {
      const r = toCents(row._sum.amount ?? 0);
      for (const a of [at(row.storeId), at(null)]) a.received += r;
    }
    for (const event of realized) {
      if (event.at < since) continue;
      for (const a of [at(event.storeId), at(null)])
        a.realized += event.profitCents;
    }

    const toStats = (a: Acc): PeriodStats => ({
      revenue: fromCents(a.revenue),
      // à vista: lucro na venda; fiado: lucro quando o cliente paga
      profit: fromCents(
        a.revenue - a.cost - (a.fiado - a.fiadoCost) + a.realized,
      ),
      count: a.count,
      fiado: {
        revenue: fromCents(a.fiado),
        profit: fromCents(a.fiado - a.fiadoCost),
      },
      fiadoProfitReceived: fromCents(a.realized),
      fiadoReceived: fromCents(a.received),
      bottles: fromCents(a.bottles),
    });
    const byStore = new Map<string, PeriodStats>();
    for (const [key, a] of acc) if (key !== null) byStore.set(key, toStats(a));
    return { total: toStats(at(null)), byStore };
  }

  /** Top 5 produtos mais vendidos (por quantidade) desde `since`. Soma as lojas pelo produto do catálogo. */
  private async topProducts(storeIds: string[], since: Date) {
    const rows = await this.prisma.$queryRaw<
      { productId: string; code: string; name: string; quantity: number }[]
    >`
      SELECT p.id AS "productId", p.code AS code, p.name AS name, SUM(si.quantity)::int AS quantity
      FROM tb_sale_items si
      JOIN tb_sales s ON s.id = si."saleId"
      JOIN tb_store_products sp ON sp.id = si."storeProductId"
      JOIN tb_products p ON p.id = sp."productId"
      WHERE s."storeId" IN (${Prisma.join(storeIds)})
        AND s.status = 'COMPLETED'
        AND s."createdAt" >= ${since}
        AND s."deletedAt" IS NULL
        AND si."deletedAt" IS NULL
      GROUP BY p.id, p.code, p.name
      ORDER BY quantity DESC, p.name ASC
      LIMIT 5`;
    return rows.map((r) => ({ ...r, quantity: Number(r.quantity) }));
  }

  /**
   * Faturamento e lucro por categoria desde `since`. O desconto é da venda inteira, então é
   * repartido entre os itens na proporção do valor de cada um; a soma pode diferir do faturamento
   * total em centavos, por causa do arredondamento de cada categoria.
   */
  private async byCategory(storeIds: string[], since: Date) {
    const rows = await this.prisma.$queryRaw<
      {
        categoryId: string | null;
        name: string | null;
        revenue: number;
        cost: number;
      }[]
    >`
      SELECT c.id AS "categoryId", c.name AS name,
             SUM(
               ((si.quantity - si.packs * COALESCE(si."packSize", 0)) * si.price
                 + si.packs * COALESCE(si."packPrice", si.price * COALESCE(si."packSize", 0)))
               * (s.total - s."bottlesTotal") / NULLIF(s.total - s."bottlesTotal" + s.discount, 0)
             ) AS revenue,
             SUM(si."costPrice" * si.quantity) AS cost
      FROM tb_sale_items si
      JOIN tb_sales s ON s.id = si."saleId"
      JOIN tb_store_products sp ON sp.id = si."storeProductId"
      JOIN tb_products p ON p.id = sp."productId"
      LEFT JOIN tb_product_categories c ON c.id = p."categoryId"
      WHERE s."storeId" IN (${Prisma.join(storeIds)})
        AND s.status = 'COMPLETED'
        AND s."createdAt" >= ${since}
        AND s."deletedAt" IS NULL
        AND si."deletedAt" IS NULL
      GROUP BY c.id, c.name
      ORDER BY revenue DESC NULLS LAST, c.name ASC`;
    return rows.map((r) => {
      const revenue = toCents(Number(r.revenue ?? 0));
      const cost = toCents(Number(r.cost ?? 0));
      return {
        categoryId: r.categoryId,
        name: r.name ?? 'Sem categoria',
        revenue: fromCents(revenue),
        profit: fromCents(revenue - cost),
      };
    });
  }

  /**
   * Vendas, faturamento (sem os cascos) e lucro vendido por origem desde `since`. A origem
   * excluída depois continua aparecendo com o nome (as vendas dela existem).
   */
  private async byChannel(storeIds: string[], since: Date) {
    const rows = await this.prisma.$queryRaw<
      {
        channelId: string | null;
        name: string | null;
        count: bigint;
        revenue: number | null;
        cost: number | null;
      }[]
    >`
      SELECT ch.id AS "channelId", ch.name AS name, COUNT(*) AS count,
             SUM(s.total - s."bottlesTotal") AS revenue, SUM(s."totalCost") AS cost
      FROM tb_sales s
      LEFT JOIN tb_sale_channels ch ON ch.id = s."channelId"
      WHERE s."storeId" IN (${Prisma.join(storeIds)})
        AND s.status = 'COMPLETED'
        AND s."createdAt" >= ${since}
        AND s."deletedAt" IS NULL
      GROUP BY ch.id, ch.name
      ORDER BY revenue DESC NULLS LAST, ch.name ASC`;
    return rows.map((r) => {
      const revenue = toCents(Number(r.revenue ?? 0));
      const cost = toCents(Number(r.cost ?? 0));
      return {
        channelId: r.channelId,
        name: r.name ?? 'Sem origem',
        count: Number(r.count),
        revenue: fromCents(revenue),
        profit: fromCents(revenue - cost),
      };
    });
  }

  /**
   * Receita e lucro por dia (no fuso da aplicação) dos últimos 7 dias, com os dias sem venda
   * zerados. Como nos cards, o lucro é o recebido: o fiado entra no dia em que o cliente paga.
   */
  private async chart(
    storeIds: string[],
    since: Date,
    now: Date,
    tz: string,
    realized: RealizedProfit[],
  ) {
    const rows = await this.prisma.$queryRaw<
      { day: string; revenue: number; cashProfit: number; count: number }[]
    >`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}::text, 'YYYY-MM-DD') AS day,
             SUM(total - "bottlesTotal") AS revenue,
             COALESCE(SUM(total - "bottlesTotal" - "totalCost")
               FILTER (WHERE "paymentMethod" <> 'CREDIT_STORE'), 0) AS "cashProfit",
             COUNT(*)::int AS count
      FROM tb_sales
      WHERE "storeId" IN (${Prisma.join(storeIds)})
        AND status = 'COMPLETED'
        AND "deletedAt" IS NULL
        AND "createdAt" >= ${since}
      GROUP BY 1`;
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const fiadoByDay = new Map<string, number>();
    for (const event of realized) {
      if (event.at < since) continue;
      const day = formatDayInTz(event.at, tz);
      fiadoByDay.set(day, (fiadoByDay.get(day) ?? 0) + event.profitCents);
    }

    const days: string[] = [];
    for (let i = 6; i >= 0; i--) days.push(formatDayInTz(addDays(now, -i), tz));
    return days.map((date) => {
      const row = byDay.get(date);
      const revenue = toCents(Number(row?.revenue ?? 0));
      const profit =
        toCents(Number(row?.cashProfit ?? 0)) + (fiadoByDay.get(date) ?? 0);
      return {
        date,
        revenue: fromCents(revenue),
        profit: fromCents(profit),
        count: Number(row?.count ?? 0),
      };
    });
  }

  private async lowStock(storeIds: string[]) {
    const threshold = this.config.get('LOW_STOCK_THRESHOLD', { infer: true });
    const rows = await this.prisma.storeProduct.findMany({
      where: {
        storeId: { in: storeIds },
        isActive: true,
        stock: { lte: threshold },
        product: { deletedAt: null },
      },
      select: {
        id: true,
        storeId: true,
        stock: true,
        store: { select: { name: true } },
        product: { select: { code: true, name: true } },
      },
      orderBy: [{ stock: 'asc' }, { product: { name: 'asc' } }],
      take: 10,
    });
    return rows.map((r) => ({
      storeProductId: r.id,
      storeId: r.storeId,
      storeName: r.store.name,
      code: r.product.code,
      name: r.product.name,
      stock: r.stock,
    }));
  }

  /** Saldo de fiado por loja (só dívidas). */
  private async debts(storeIds: string[]): Promise<Map<string, number>> {
    const rows = await this.prisma.customerStoreBalance.groupBy({
      by: ['storeId'],
      where: { storeId: { in: storeIds }, balance: { gt: 0 } },
      _sum: { balance: true },
    });
    return new Map(
      rows.map((r) => [r.storeId, roundMoney(r._sum.balance ?? 0)]),
    );
  }
}
