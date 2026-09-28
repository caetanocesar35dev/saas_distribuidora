import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  History, Search, Printer, XSquare, AlertTriangle, CheckCircle2, 
  Calendar, Info, X, ChevronRight, Coffee
} from 'lucide-react';

export default function Historico() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPayment, setFilterPayment] = useState('ALL');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterStartTime, setFilterStartTime] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterEndTime, setFilterEndTime] = useState('');
  
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedPayment, setAppliedPayment] = useState('ALL');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedStartTime, setAppliedStartTime] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedEndTime, setAppliedEndTime] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userRole, setUserRole] = useState('USER');
  
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalItems: 0, totalRevenue: 0, totalProfit: 0, totalPages: 1 });

  // Detalhes e reimpressão
  const [selectedSale, setSelectedSale] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserRole(user.role || 'USER');
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    loadSales(1);
  }, [appliedSearch, appliedPayment, appliedStartDate, appliedStartTime, appliedEndDate, appliedEndTime]);

  const loadSales = async (currentPage = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: currentPage, limit: 15 });
      
      if (appliedSearch) params.append('search', appliedSearch);
      if (appliedPayment !== 'ALL') params.append('paymentMethod', appliedPayment);
      
      if (appliedStartDate) {
        const time = appliedStartTime || '00:00:00';
        const start = new Date(`${appliedStartDate}T${time}`);
        params.append('startDate', start.toISOString());
      }
      if (appliedEndDate) {
        const time = appliedEndTime ? (appliedEndTime.length === 5 ? `${appliedEndTime}:59` : appliedEndTime) : '23:59:59.999';
        const end = new Date(`${appliedEndDate}T${time}`);
        params.append('endDate', end.toISOString());
      }

      const response = await api.get(`/sales?${params.toString()}`);
      setSales(response.data);
      if (response.meta) {
        setMeta(response.meta);
        setPage(response.meta.page);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar histórico de vendas');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSale = async (id) => {
    if (!window.confirm(`Tem certeza que deseja cancelar a venda #${id}? Os produtos voltarão ao estoque e o estorno será registrado no caixa.`)) {
      return;
    }
    setError('');
    setSuccess('');
    try {
      await api.post(`/sales/${id}/cancel`);
      setSuccess(`Venda #${id} cancelada com sucesso.`);
      loadSales();
      if (selectedSale && selectedSale.id === id) {
        setSelectedSale(null);
      }
    } catch (err) {
      setError(err.message || 'Erro ao cancelar venda');
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const translatePayment = (method) => {
    const types = {
      MONEY: 'Dinheiro',
      PIX: 'PIX',
      DEBIT: 'Cartão de Débito',
      CREDIT: 'Cartão de Crédito',
      CREDIT_STORE: 'Fiado'
    };
    return types[method] || method;
  };

  const translateStatus = (status) => {
    const statuses = {
      COMPLETED: { label: 'Concluída', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
      CANCELED: { label: 'Cancelada', class: 'bg-red-500/10 text-red-400 border-red-500/20' }
    };
    return statuses[status] || { label: status, class: 'bg-slate-800 text-slate-400' };
  };

  const handleSearch = () => {
    setAppliedSearch(searchQuery);
    setAppliedPayment(filterPayment);
    setAppliedStartDate(filterStartDate);
    setAppliedStartTime(filterStartTime);
    setAppliedEndDate(filterEndDate);
    setAppliedEndTime(filterEndTime);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setFilterPayment('ALL');
    setFilterStartDate('');
    setFilterStartTime('');
    setFilterEndDate('');
    setFilterEndTime('');
    
    setAppliedSearch('');
    setAppliedPayment('ALL');
    setAppliedStartDate('');
    setAppliedStartTime('');
    setAppliedEndDate('');
    setAppliedEndTime('');
  };

  return (
    <div className="flex-1 p-6 font-sans text-white h-[calc(100vh-64px)] overflow-y-auto space-y-6">
      
      {/* Impressão do Comprovante Não-Fiscal (Oculto em tela, exibido no Print) */}
      {selectedSale && (
        <div className="hidden print:block print:p-4 text-black bg-white w-[80mm] text-xs font-mono">
          <div className="text-center font-bold text-sm mb-2">DISTRIBUIDORA DE BEBIDAS</div>
          <div className="text-center mb-2">CNPJ: 00.000.000/0001-00</div>
          <div className="border-b border-dashed border-black my-1"></div>
          <div className="text-center font-bold">REIMPRESSÃO DE COMPROVANTE</div>
          <div className="border-b border-dashed border-black my-1"></div>
          <div>Pedido: #{selectedSale.id}</div>
          <div>Data/Hora: {new Date(selectedSale.createdAt).toLocaleString('pt-BR')}</div>
          {selectedSale.user && (
            <div>Operador: {selectedSale.user.name}</div>
          )}
          {selectedSale.customer && (
            <div>Cliente: {selectedSale.customer.name}</div>
          )}
          <div>Status: {selectedSale.status === 'CANCELED' ? 'CANCELADO' : 'CONCLUÍDO'}</div>
          <div className="border-b border-dashed border-black my-1"></div>
          
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black">
                <th className="py-1">Item</th>
                <th className="py-1 text-center">Qtd</th>
                <th className="py-1 text-right">Unit</th>
                <th className="py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedSale.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1">{item.product.name.substring(0, 18)}</td>
                  <td className="py-1 text-center">{item.quantity}</td>
                  <td className="py-1 text-right">R$ {item.price.toFixed(2)}</td>
                  <td className="py-1 text-right">R$ {(item.price * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-b border-dashed border-black my-1"></div>
          {selectedSale.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span>Desconto:</span>
              <span>- R$ {selectedSale.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm">
            <span>TOTAL:</span>
            <span>R$ {selectedSale.total.toFixed(2)}</span>
          </div>
          <div>Forma Pgto: {translatePayment(selectedSale.paymentMethod)}</div>
          <div className="border-b border-dashed border-black my-2"></div>
          <div className="text-center mt-4">Comprovante de Venda Não Fiscal</div>
          <div className="text-center text-[8px]">Sistema PDV Distribuidora</div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="text-amber-500 w-7 h-7" />
            Histórico de Vendas
          </h1>
          <p className="text-slate-400 text-xs mt-1">Consulte vendas realizadas, reimprima comprovantes e efetue estornos</p>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-2 text-sm max-w-6xl mx-auto">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl flex items-center gap-2 text-sm max-w-6xl mx-auto">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Filtros e Busca */}
      <div className="max-w-6xl mx-auto bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-5">
        
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por número do pedido..."
              className="w-full pl-12 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-amber-500 transition-all text-sm shadow-inner"
            />
          </div>
          
          <select 
            value={filterPayment}
            onChange={e => setFilterPayment(e.target.value)}
            className="px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-sm min-w-[200px] shadow-inner cursor-pointer"
          >
            <option value="ALL">Todas as Formas (Pgto)</option>
            <option value="MONEY">Dinheiro</option>
            <option value="PIX">PIX</option>
            <option value="DEBIT">Cartão de Débito</option>
            <option value="CREDIT">Cartão de Crédito</option>
            <option value="CREDIT_STORE">Fiado</option>
          </select>
        </div>
        
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto bg-slate-950/50 p-1.5 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2 pl-3">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Início:</span>
            </div>
            <div className="flex gap-1">
              <input
                type="date"
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500 text-xs w-full sm:w-auto"
              />
              <input
                type="time"
                value={filterStartTime}
                onChange={e => setFilterStartTime(e.target.value)}
                className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-amber-500 text-xs w-full sm:w-auto"
              />
            </div>
            
            <div className="flex items-center gap-2 pl-3 sm:border-l border-slate-700">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Fim:</span>
            </div>
            <div className="flex gap-1">
              <input
                type="date"
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500 text-xs w-full sm:w-auto"
              />
              <input
                type="time"
                value={filterEndTime}
                onChange={e => setFilterEndTime(e.target.value)}
                className="px-2 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 focus:outline-none focus:border-amber-500 text-xs w-full sm:w-auto"
              />
            </div>
            
            {(filterStartDate || filterEndDate) && (
              <button 
                onClick={() => { 
                  setFilterStartDate(''); setFilterStartTime(''); 
                  setFilterEndDate(''); setFilterEndTime(''); 
                }}
                className="text-slate-500 hover:text-red-400 p-2 rounded-lg transition-colors bg-slate-900 hover:bg-red-500/10 ml-1"
                title="Limpar Datas"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
            {(appliedSearch || appliedPayment !== 'ALL' || appliedStartDate || appliedEndDate || searchQuery || filterPayment !== 'ALL' || filterStartDate || filterEndDate) && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition-all flex justify-center items-center gap-2 active:scale-95"
                title="Limpar todos os filtros"
              >
                <X className="w-4 h-4" />
                Limpar Filtros
              </button>
            )}
            <button
              onClick={handleSearch}
              className="flex-1 lg:flex-none px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex justify-center items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Filtrar Resultados
            </button>
          </div>
        </div>
      </div>

      {/* Resumo Financeiro */}
      <div className="max-w-6xl mx-auto flex flex-wrap gap-4">
        <div className="flex-1 bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block mb-1">Vendas (Filtradas)</span>
            <span className="text-2xl font-black text-white">R$ {(meta.totalRevenue || 0).toFixed(2)}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <History className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        
        {userRole === 'ADMIN' && (
          <div className="flex-1 bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block mb-1">Lucro Líquido (Filtrado)</span>
              <span className="text-2xl font-black text-emerald-400">R$ {(meta.totalProfit || 0).toFixed(2)}</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        )}
      </div>

      {/* Grid de Lista e Detalhes */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Lista de Vendas (Col-span 2) */}
        <div className="lg:col-span-2 bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {loading ? (
            <div className="py-20 flex justify-center items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Pedido</th>
                    <th className="px-6 py-4">Data/Hora</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    {userRole === 'ADMIN' && <th className="px-6 py-4 text-right">Lucro</th>}
                    <th className="px-6 py-4 text-center">Pagamento</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={userRole === 'ADMIN' ? 7 : 6} className="px-6 py-12 text-center text-slate-500">
                        Nenhuma venda registrada ou correspondente à pesquisa.
                      </td>
                    </tr>
                  ) : (
                    sales.map((sale) => {
                      const status = translateStatus(sale.status);
                      const isSelected = selectedSale?.id === sale.id;
                      return (
                        <tr 
                          key={sale.id} 
                          onClick={() => setSelectedSale(sale)}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-amber-500/5 hover:bg-amber-500/10 border-l-2 border-l-amber-500' 
                              : 'hover:bg-slate-900/10'
                          }`}
                        >
                          <td className="px-6 py-4 font-mono font-bold text-white flex items-center gap-2">
                            #{sale.id}
                            {sale.commandTab && (
                              <span className="flex items-center gap-1 bg-amber-500/20 text-amber-500 text-[10px] px-2 py-0.5 rounded-full font-sans uppercase tracking-wider" title={`Mesa: ${sale.commandTab.name}`}>
                                <Coffee className="w-3 h-3" />
                                Comanda
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-400">
                            {new Date(sale.createdAt).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-amber-550">R$ {sale.total.toFixed(2)}</td>
                          {userRole === 'ADMIN' && <td className="px-6 py-4 text-right font-bold text-emerald-500">R$ {(sale.total - (sale.totalCost || 0)).toFixed(2)}</td>}
                          <td className="px-6 py-4 text-center text-slate-300 font-semibold">{translatePayment(sale.paymentMethod)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-bold ${status.class}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center items-center" onClick={(e) => e.stopPropagation()}>
                              <ChevronRight className="w-5 h-5 text-slate-600" />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lado Direito: Detalhes do Pedido */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl sticky top-6">
          {!selectedSale ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <Info className="w-12 h-12 stroke-[1.5] text-slate-700" />
              <p className="text-sm">Selecione uma venda para ver os detalhes</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Detalhes do Pedido #{selectedSale.id}
                    {selectedSale.commandTab && (
                      <span className="flex items-center gap-1 bg-amber-500/20 text-amber-500 text-xs px-2 py-1 rounded-lg uppercase tracking-wider">
                        <Coffee className="w-4 h-4" />
                        Comanda: {selectedSale.commandTab.name}
                      </span>
                    )}
                  </h3>
                  <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(selectedSale.createdAt).toLocaleString('pt-BR')}
                  </p>
                  {selectedSale.user && userRole === 'ADMIN' && (
                    <p className="text-slate-400 text-xs mt-1.5 font-medium border-l-2 border-amber-500 pl-2">
                      Venda realizada por: <span className="text-white font-bold">{selectedSale.user.name}</span>
                    </p>
                  )}
                  {selectedSale.customer && (
                    <p className="text-slate-400 text-xs mt-1.5 font-medium border-l-2 border-blue-500 pl-2">
                      Cliente: <span className="text-white font-bold">{selectedSale.customer.name}</span>
                      {selectedSale.customer.phone && <span className="text-slate-500 ml-1">({selectedSale.customer.phone})</span>}
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedSale(null)}
                  className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Itens */}
              <div className="space-y-3">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-400">Produtos Vendidos</h4>
                <div className="space-y-2 bg-slate-950/60 border border-slate-850 p-4 rounded-xl divide-y divide-slate-900">
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} className={`flex justify-between py-2 ${idx === 0 ? 'pt-0' : ''}`}>
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-sm font-medium text-white truncate">{item.product.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {item.quantity} x R$ {item.price.toFixed(2)}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-white shrink-0 mt-0.5">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {selectedSale.discount > 0 && (
                    <div className="pt-3 pb-1 flex justify-between text-emerald-500 text-sm border-t border-slate-800">
                      <span>Desconto Aplicado:</span>
                      <span>- R$ {selectedSale.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className={`${selectedSale.discount > 0 ? 'pt-1' : 'pt-3 border-t border-slate-800'} flex justify-between font-bold text-amber-500 text-sm`}>
                    <span>Total do Pedido:</span>
                    <span>R$ {selectedSale.total.toFixed(2)}</span>
                  </div>
                  {userRole === 'ADMIN' && (
                    <div className="flex justify-between font-bold text-emerald-500 text-sm">
                      <span>Lucro Líquido:</span>
                      <span>R$ {(selectedSale.total - (selectedSale.totalCost || 0)).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Informações Extras */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 border border-slate-850 rounded-xl text-xs">
                <div>
                  <span className="text-slate-500 block">Forma Pgto</span>
                  <span className="font-bold text-slate-200 mt-0.5 block">{translatePayment(selectedSale.paymentMethod)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Status da Venda</span>
                  <span className={`font-bold mt-0.5 block ${selectedSale.status === 'CANCELED' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {selectedSale.status === 'CANCELED' ? 'Cancelado' : 'Concluído'}
                  </span>
                </div>
              </div>

              {/* Ações */}
              <div className="space-y-3">
                <button
                  onClick={printReceipt}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Printer className="w-4.5 h-4.5" />
                  Imprimir Comprovante (Reimpressão)
                </button>

                {selectedSale.status !== 'CANCELED' && (
                  <button
                    onClick={() => handleCancelSale(selectedSale.id)}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-transparent text-red-400 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <XSquare className="w-4.5 h-4.5" />
                    Cancelar Pedido (Estornar)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Paginação */}
      {meta.totalPages > 1 && (
        <div className="max-w-6xl mx-auto flex justify-center items-center gap-3 mt-4 pb-8">
          <button
            disabled={page === 1}
            onClick={() => loadSales(page - 1)}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-slate-400 font-semibold px-4 text-sm">
            Página <span className="text-white">{page}</span> de <span className="text-white">{meta.totalPages}</span>
          </span>
          <button
            disabled={page === meta.totalPages}
            onClick={() => loadSales(page + 1)}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Próxima
          </button>
        </div>
      )}

    </div>
  );
}
