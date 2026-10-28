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

export interface PeriodStats {
  /** Tudo o que foi vendido (inclusive no fiado). */
  revenue: number;
  profit: number;
  count: number;
  /** Parte do faturamento e do lucro que foi vendida no fiado. */
  fiado: { revenue: number; profit: number };
  /** Pagamentos de fiado recebidos na loja no período (de vendas de qualquer data). */
  fiadoReceived: number;
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
  /** Só no painel da empresa: o mesmo resumo por loja. */
  byStore?: {
    storeId: string;
    storeName: string;
    today: PeriodStats;
    week: PeriodStats;
    month: PeriodStats;
    debt: number;
  }[];
}

const EMPTY: PeriodStats = {
  revenue: 0,
  profit: 0,
  count: 0,
  fiado: { revenue: 0, profit: 0 },
  fiadoReceived: 0,
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
        chart: [],
        lowStock: [],
        debt: 0,
        ...(breakdown ? { byStore: [] } : {}),
      };
    }

    const [today, week, month, topProducts, chart, lowStock, debts] =
      await Promise.all([
        this.periodStats(storeIds, todayStart),
        this.periodStats(storeIds, weekStart),
        this.periodStats(storeIds, monthStart),
        this.topProducts(storeIds, weekStart),
        this.chart(storeIds, weekStart, now, tz),
        this.lowStock(storeIds),
        this.debts(storeIds),
      ]);

    const result: Dashboard = {
      today: today.total,
      week: week.total,
      month: month.total,
      topProducts,
      chart,
      lowStock,
      debt: fromCents(
        [...debts.values()].reduce((sum, v) => sum + toCents(v), 0),
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
      }));
    }
    return result;
  }

  /**
   * Receita, lucro e nº de vendas desde `since`, no total e por loja. O fiado entra no faturamento
   * e no lucro (o que foi vendido), mas sai separado em `fiado` (quanto disso foi vendido no
   * fiado) e `fiadoReceived` (pagamentos de fiado recebidos na loja no período), decisão do
   * usuário: separar sem esconder.
   */
  private async periodStats(storeIds: string[], since: Date) {
    const [rows, received] = await Promise.all([
      this.prisma.sale.groupBy({
        by: ['storeId', 'paymentMethod'],
        where: {
          storeId: { in: storeIds },
          status: 'COMPLETED',
          createdAt: { gte: since },
        },
        _sum: { total: true, totalCost: true },
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
      received: number;
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
          received: 0,
        };
        acc.set(key, a);
      }
      return a;
    };
    for (const row of rows) {
      const r = toCents(row._sum.total ?? 0);
      const c = toCents(row._sum.totalCost ?? 0);
      for (const a of [at(row.storeId), at(null)]) {
        a.revenue += r;
        a.cost += c;
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

    const toStats = (a: Acc): PeriodStats => ({
      revenue: fromCents(a.revenue),
      profit: fromCents(a.revenue - a.cost),
      count: a.count,
      fiado: {
        revenue: fromCents(a.fiado),
        profit: fromCents(a.fiado - a.fiadoCost),
      },
      fiadoReceived: fromCents(a.received),
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

  /** Receita e lucro por dia (no fuso da aplicação) dos últimos 7 dias, com os dias sem venda zerados. */
  private async chart(storeIds: string[], since: Date, now: Date, tz: string) {
    const rows = await this.prisma.$queryRaw<
      { day: string; revenue: number; cost: number; count: number }[]
    >`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}::text, 'YYYY-MM-DD') AS day,
             SUM(total) AS revenue, SUM("totalCost") AS cost, COUNT(*)::int AS count
      FROM tb_sales
      WHERE "storeId" IN (${Prisma.join(storeIds)})
        AND status = 'COMPLETED'
        AND "deletedAt" IS NULL
        AND "createdAt" >= ${since}
      GROUP BY 1`;
    const byDay = new Map(rows.map((r) => [r.day, r]));

    const days: string[] = [];
    for (let i = 6; i >= 0; i--) days.push(formatDayInTz(addDays(now, -i), tz));
    return days.map((date) => {
      const row = byDay.get(date);
      const revenue = toCents(Number(row?.revenue ?? 0));
      const cost = toCents(Number(row?.cost ?? 0));
      return {
        date,
        revenue: fromCents(revenue),
        profit: fromCents(revenue - cost),
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
