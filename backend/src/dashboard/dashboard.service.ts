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
  revenue: number;
  profit: number;
  count: number;
}

export interface DashboardStore {
  id: string;
  name: string;
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

const EMPTY: PeriodStats = { revenue: 0, profit: 0, count: 0 };

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

  /** Receita, lucro e nº de vendas desde `since`, no total e por loja (uma consulta). */
  private async periodStats(storeIds: string[], since: Date) {
    const rows = await this.prisma.sale.groupBy({
      by: ['storeId'],
      where: {
        storeId: { in: storeIds },
        status: 'COMPLETED',
        createdAt: { gte: since },
      },
      _sum: { total: true, totalCost: true },
      _count: { _all: true },
    });

    const byStore = new Map<string, PeriodStats>();
    let revenue = 0;
    let cost = 0;
    let count = 0;
    for (const row of rows) {
      const r = toCents(row._sum.total ?? 0);
      const c = toCents(row._sum.totalCost ?? 0);
      byStore.set(row.storeId, {
        revenue: fromCents(r),
        profit: fromCents(r - c),
        count: row._count._all,
      });
      revenue += r;
      cost += c;
      count += row._count._all;
    }
    return {
      total: {
        revenue: fromCents(revenue),
        profit: fromCents(revenue - cost),
        count,
      },
      byStore,
    };
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
