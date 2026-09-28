import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  TrendingUp, TrendingDown, DollarSign, Package, 
  ShoppingCart, AlertTriangle, Users, BarChart3
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const data = await api.get('/dashboard/metrics');
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao carregar dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="flex-1 flex justify-center items-center h-[calc(100vh-64px)] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  const { today, week, month, debt, topProducts, chartData, lowStockAlerts } = metrics;

  return (
    <div className="flex-1 p-6 font-sans text-white h-[calc(100vh-64px)] overflow-y-auto space-y-6">
      
      {/* Título */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
          <BarChart3 className="w-6 h-6 text-slate-950 stroke-[2.5]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-400 text-xs mt-0.5">Visão geral do negócio e indicadores de desempenho</p>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        
        {/* Card Hoje */}
        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Vendas Hoje</p>
              <h3 className="text-2xl font-black text-white mt-1">R$ {today.revenue.toFixed(2)}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs relative">
            <span className="text-emerald-400 font-bold flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" /> Lucro: R$ {today.profit.toFixed(2)}
            </span>
            <span className="text-slate-500">• {today.count} vendas</span>
          </div>
        </div>

        {/* Card 7 Dias */}
        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Últimos 7 Dias</p>
              <h3 className="text-2xl font-black text-white mt-1">R$ {week.revenue.toFixed(2)}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs relative">
            <span className="text-amber-400 font-bold flex items-center">
              <TrendingUp className="w-3 h-3 mr-1" /> Lucro: R$ {week.profit.toFixed(2)}
            </span>
            <span className="text-slate-500">• {week.count} vendas</span>
          </div>
        </div>

        {/* Card Mês */}
        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Mês Atual</p>
              <h3 className="text-2xl font-black text-white mt-1">R$ {month.revenue.toFixed(2)}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs relative">
            <span className="text-blue-400 font-bold">
              Lucro: R$ {month.profit.toFixed(2)}
            </span>
            <span className="text-slate-500">• {month.count} vendas</span>
          </div>
        </div>

        {/* Card Fiado */}
        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150 duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Contas a Receber (Fiado)</p>
              <h3 className="text-2xl font-black text-white mt-1">R$ {debt.toFixed(2)}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-rose-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs relative">
            <span className="text-rose-400 font-bold flex items-center">
              <TrendingDown className="w-3 h-3 mr-1" /> Capital Pendente
            </span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Gráfico de Faturamento (7 dias) */}
        <div className="xl:col-span-2 bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col min-h-[350px]">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-6 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-500" />
            Faturamento (Últimos 7 Dias)
          </h2>
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '13px' }}
                  itemStyle={{ color: '#f8fafc' }}
                  formatter={(value) => [`R$ ${value.toFixed(2)}`, '']}
                />
                <Area type="monotone" name="Receita" dataKey="revenue" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" name="Lucro Líquido" dataKey="profit" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Top 5 & Alerts */}
        <div className="space-y-6 flex flex-col">
          
          {/* Top 5 Produtos */}
          <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex-1">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-500" />
              Top 5 Vendidos (7 dias)
            </h2>
            <div className="space-y-3">
              {topProducts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nenhuma venda na última semana.</p>
              ) : (
                topProducts.map((p, index) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800/60">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-6 h-6 rounded-md bg-slate-800 text-xs font-bold flex items-center justify-center text-slate-400 shrink-0">
                        {index + 1}º
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs text-slate-400">Qtd.</p>
                      <p className="font-bold text-sm text-amber-500">{p.quantity}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Alerta de Estoque Baixo */}
          <div className="bg-slate-900/40 border border-rose-500/30 p-5 rounded-2xl flex-1 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl"></div>
            <h2 className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alerta de Estoque Baixo
            </h2>
            <div className="space-y-2 overflow-y-auto max-h-[220px] pr-2 custom-scrollbar">
              {lowStockAlerts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Estoque estável.</p>
              ) : (
                lowStockAlerts.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-slate-800/50 last:border-0">
                    <span className="text-slate-300 truncate mr-2">{p.name}</span>
                    <span className="font-bold text-rose-400 px-2 py-0.5 bg-rose-500/10 rounded-md shrink-0">
                      {p.stock} un
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
