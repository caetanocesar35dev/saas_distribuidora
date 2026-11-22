"use client";

import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, Money, StatCard } from "@/components/app/common";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Dashboard, PeriodStats } from "@/lib/api/types";
import {
  formatDayString,
  formatInt,
  formatMoney,
  profitHint,
  revenueHint,
} from "@/lib/format";
import { averageTicket, channelShare } from "@/lib/sale-channels";

function PeriodCards({ title, stats }: { title: string; stats: PeriodStats }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Faturamento"
          value={<Money value={stats.revenue} />}
          hint={revenueHint(stats.fiado.revenue, stats.bottles)}
        />
        <StatCard
          label="Lucro recebido"
          value={<Money value={stats.profit} />}
          tone="success"
          hint={profitHint(stats.fiadoProfitReceived ?? 0, stats.fiado.profit)}
        />
        <StatCard label="Vendas" value={formatInt(stats.count)} />
        <StatCard
          label="Fiado recebido"
          value={<Money value={stats.fiadoReceived} />}
          hint="Pagamentos de fiado no período, de vendas de qualquer data."
        />
      </div>
    </section>
  );
}

/**
 * De onde vieram as vendas do mês (balcão, iFood...): quantas, quanto faturaram, a parte de cada
 * uma no faturamento (barra), o ticket médio e o lucro vendido. Uma medida só, numa cor só.
 */
function ChannelsSection({ data }: { data: Dashboard }) {
  const rows = data.byChannel;
  const totalRevenue = rows.reduce((sum, c) => sum + c.revenue, 0);
  // O atendente não recebe lucro do backend.
  const showProfit = rows.some((c) => c.profit !== undefined);

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="font-medium">Por origem (este mês)</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        De onde vieram as vendas. Faturamento sem os cascos de vasilhame; vendas canceladas ficam de
        fora.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">Origem</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Ticket médio</TableHead>
                {showProfit && (
                  <TableHead className="text-right" title="Inclui o fiado ainda não pago">
                    Lucro vendido
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const share = channelShare(c.revenue, totalRevenue);
                return (
                  <TableRow key={c.channelId ?? "none"}>
                    <TableCell>
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={c.channelId ? "font-medium" : "text-muted-foreground"}
                        >
                          {c.name}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {share}%
                        </span>
                      </div>
                      <div
                        className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={`${c.name}: ${share}% do faturamento do mês`}
                        title={`${c.name}: ${share}% do faturamento do mês`}
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(c.count)}</TableCell>
                    <TableCell className="text-right">
                      <Money value={c.revenue} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={averageTicket(c.revenue, c.count)} />
                    </TableCell>
                    {showProfit && (
                      <TableCell className="text-right">
                        <Money value={c.profit ?? 0} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

/**
 * Painel de loja ou de empresa. Os períodos são fixos e calculados no backend: o painel não
 * aceita filtro (para períodos livres, use o histórico de vendas).
 */
export function DashboardView({
  data,
  storeHref,
}: {
  data: Dashboard;
  /** Monta o link da loja (no painel da empresa, a quebra por loja leva ao painel dela). */
  storeHref?: (storeId: string) => string;
}) {
  const chartData = data.chart.map((d) => ({
    ...d,
    label: formatDayString(d.date).slice(0, 5),
  }));
  // O atendente não recebe lucro do backend.
  const showCategoryProfit = data.byCategory.some((c) => c.profit !== undefined);

  return (
    <div className="space-y-6">
      <PeriodCards title="Hoje" stats={data.today} />
      <PeriodCards title="Últimos 7 dias" stats={data.week} />
      <PeriodCards title="Este mês" stats={data.month} />

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-medium">Faturamento e lucro recebido dos últimos 7 dias</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={64}
                tickFormatter={(v: number) => formatMoney(v).replace(",00", "")}
              />
              <ChartTooltip
                formatter={(value, name) => [formatMoney(Number(value)), String(name)]}
                labelFormatter={(label) => `Dia ${String(label)}`}
              />
              <Legend />
              <Bar dataKey="revenue" name="Faturamento" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              <Line
                dataKey="profit"
                name="Lucro recebido"
                type="monotone"
                stroke="oklch(0.55 0.15 150)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <ChannelsSection data={data} />

      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-3 font-medium">Por categoria (este mês)</h2>
        {data.byCategory.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  {showCategoryProfit && (
                    <TableHead className="text-right" title="Inclui o fiado ainda não pago">
                      Lucro vendido
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byCategory.map((c) => (
                  <TableRow key={c.categoryId ?? "none"}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">
                      <Money value={c.revenue} />
                    </TableCell>
                    {showCategoryProfit && (
                      <TableCell className="text-right">
                        <Money value={c.profit ?? 0} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-medium">Produtos mais vendidos (7 dias)</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
          ) : (
            <ol className="space-y-2">
              {data.topProducts.map((p, i) => (
                <li key={p.productId} className="flex items-center gap-3 text-sm">
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatInt(p.quantity)} un.
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-medium">Fiado em aberto</h2>
            <Money value={data.debt} className="text-xl font-semibold" />
          </div>
          {data.pendingFiadoProfit !== undefined && data.pendingFiadoProfit !== 0 && (
            <p className="-mt-2 mb-3 text-sm text-muted-foreground">
              {formatMoney(data.pendingFiadoProfit)} disso é lucro, que entra no painel quando o
              cliente pagar.
            </p>
          )}
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Estoque baixo</h3>
          {data.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum produto com estoque baixo.</p>
          ) : (
            <ul className="space-y-1.5">
              {data.lowStock.map((item) => (
                <li key={item.storeProductId} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {item.name}
                    {data.byStore && (
                      <span className="text-muted-foreground"> · {item.storeName}</span>
                    )}
                  </span>
                  <span
                    className={
                      item.stock <= 0
                        ? "font-semibold text-destructive tabular-nums"
                        : "tabular-nums text-amber-700"
                    }
                  >
                    {formatInt(item.stock)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {data.byStore && (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-3 font-medium">Por loja</h2>
          {data.byStore.length === 0 ? (
            <EmptyState title="Nenhuma loja cadastrada" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loja</TableHead>
                    <TableHead className="text-right">Hoje</TableHead>
                    <TableHead className="text-right">7 dias</TableHead>
                    <TableHead className="text-right">Mês</TableHead>
                    <TableHead className="text-right">Lucro recebido (mês)</TableHead>
                    <TableHead className="text-right">Fiado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byStore.map((s) => (
                    <TableRow key={s.storeId}>
                      <TableCell className="font-medium">
                        {storeHref ? (
                          <Link href={storeHref(s.storeId)} className="text-primary hover:underline">
                            {s.storeName}
                          </Link>
                        ) : (
                          s.storeName
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={s.today.revenue} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={s.week.revenue} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={s.month.revenue} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={s.month.profit} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={s.debt} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
