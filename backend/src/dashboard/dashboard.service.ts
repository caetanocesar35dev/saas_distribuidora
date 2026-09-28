import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getMetrics() {
    const now = new Date();
    
    // Start of Today
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // Start of 7 Days Ago
    const startOf7Days = new Date(now);
    startOf7Days.setDate(now.getDate() - 6);
    startOf7Days.setHours(0, 0, 0, 0);

    // Start of Month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Aggregate queries for metrics
    const [todayAgg, weekAgg, monthAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { createdAt: { gte: startOfToday }, status: 'COMPLETED' },
        _sum: { total: true, totalCost: true },
        _count: { id: true },
      }),
      this.prisma.sale.aggregate({
        where: { createdAt: { gte: startOf7Days }, status: 'COMPLETED' },
        _sum: { total: true, totalCost: true },
        _count: { id: true },
      }),
      this.prisma.sale.aggregate({
        where: { createdAt: { gte: startOfMonth }, status: 'COMPLETED' },
        _sum: { total: true, totalCost: true },
        _count: { id: true },
      }),
    ]);

    // Top 5 selling products in the last 7 days
    const topProductsRaw = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: { sale: { status: 'COMPLETED', createdAt: { gte: startOf7Days } } },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });

    const topProductsIds = topProductsRaw.map(p => p.productId);
    const topProductsInfo = await this.prisma.product.findMany({
      where: { id: { in: topProductsIds } },
      select: { id: true, name: true, code: true }
    });

    const topProducts = topProductsRaw.map(raw => {
      const pInfo = topProductsInfo.find(p => p.id === raw.productId);
      return {
        id: raw.productId,
        name: pInfo?.name || 'Desconhecido',
        code: pInfo?.code || '',
        quantity: raw._sum.quantity || 0,
      };
    });

    // Chart Data (Last 7 days revenue by day)
    const salesLast7Days = await this.prisma.sale.findMany({
      where: { createdAt: { gte: startOf7Days }, status: 'COMPLETED' },
      select: { total: true, totalCost: true, createdAt: true },
    });

    const chartMap = new Map<string, { date: string, revenue: number, profit: number }>();
    
    // Initialize last 7 days with 0
    for(let i=6; i>=0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      chartMap.set(dateStr, { date: dateStr, revenue: 0, profit: 0 });
    }

    salesLast7Days.forEach(sale => {
      const d = new Date(sale.createdAt);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (chartMap.has(dateStr)) {
        const item = chartMap.get(dateStr)!;
        item.revenue += sale.total;
        item.profit += (sale.total - sale.totalCost);
      }
    });

    const chartData = Array.from(chartMap.values());

    // Low stock alerts
    const lowStockAlerts = await this.prisma.product.findMany({
      where: { stock: { lte: 20 } },
      orderBy: { stock: 'asc' },
      take: 10,
    });

    // Pending Debt
    const debtAgg = await this.prisma.customer.aggregate({
      _sum: { balance: true }
    });

    return {
      today: {
        revenue: todayAgg._sum.total || 0,
        profit: (todayAgg._sum.total || 0) - (todayAgg._sum.totalCost || 0),
        count: todayAgg._count.id
      },
      week: {
        revenue: weekAgg._sum.total || 0,
        profit: (weekAgg._sum.total || 0) - (weekAgg._sum.totalCost || 0),
        count: weekAgg._count.id
      },
      month: {
        revenue: monthAgg._sum.total || 0,
        profit: (monthAgg._sum.total || 0) - (monthAgg._sum.totalCost || 0),
        count: monthAgg._count.id
      },
      debt: debtAgg._sum.balance || 0,
      topProducts,
      chartData,
      lowStockAlerts
    };
  }
}
