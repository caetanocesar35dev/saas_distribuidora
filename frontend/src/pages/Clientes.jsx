import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  Users, Plus, Search, AlertTriangle, CheckCircle2, DollarSign, Edit, Eye, X, Calendar, ShoppingBag, CreditCard, Beer, ArrowRightLeft
} from 'lucide-react';

const formatPhoneMask = (value) => {
  if (!value) return '';
  let v = value.replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length > 2) {
    v = `(${v.substring(0, 2)}) ${v.substring(2)}`;
  }
  if (v.length > 10) {
    v = `${v.substring(0, 10)}-${v.substring(10)}`;
  }
  return v;
};

export default function Clientes() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tabFilter, setTabFilter] = useState('ALL'); // 'ALL' | 'DEBT' | 'CLEAN'

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal Cadastro/Edição State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '', phone: '' });

  // Modal Pagamento (Quitar Fiado) State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payData, setPayData] = useState({ id: null, name: '', balance: 0, amount: '', paymentMethod: 'PIX' });

  // Modal Detalhes/Histórico do Cliente State
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await api.get('/customers');
      setCustomers(data);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (customer = null) => {
    if (customer) {
      setFormData({ id: customer.id, name: customer.name, phone: formatPhoneMask(customer.phone) });
    } else {
      setFormData({ id: null, name: '', phone: '' });
    }
    setError('');
    setSuccess('');
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (formData.id) {
        await api.put(`/customers/${formData.id}`, { name: formData.name, phone: formData.phone });
        setSuccess('Cliente atualizado com sucesso!');
      } else {
        await api.post('/customers', { name: formData.name, phone: formData.phone });
        setSuccess('Cliente criado com sucesso!');
      }
      setIsModalOpen(false);
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erro ao salvar cliente');
    }
  };

  const handleOpenPayModal = (customer) => {
    setPayData({ id: customer.id, name: customer.name, balance: customer.balance, amount: customer.balance, paymentMethod: 'PIX' });
    setError('');
    setSuccess('');
    setIsPayModalOpen(true);
  };

  const handlePayDebt = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const amount = parseFloat(payData.amount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Valor inválido');
      }

      await api.post(`/customers/${payData.id}/pay`, {
        amount,
        paymentMethod: payData.paymentMethod
      });
      setSuccess('Pagamento registrado com sucesso!');
      setIsPayModalOpen(false);
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erro ao registrar pagamento');
    }
  };

  const handleOpenDetailModal = async (customerId) => {
    try {
      setLoadingDetail(true);
      setIsDetailModalOpen(true);
      const data = await api.get(`/customers/${customerId}`);
      setCustomerDetail(data);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar histórico do cliente');
      setIsDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const translatePayment = (method) => {
    const types = {
      MONEY: 'Dinheiro',
      PIX: 'PIX',
      DEBIT: 'Débito',
      CREDIT: 'Cartão de Débito',
      CREDIT_STORE: 'Fiado'
    };
    return types[method] || method;
  };

  // Filtragem combinada (Busca + Aba de filtro)
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.phone && c.phone.includes(searchQuery));
    if (!matchesSearch) return false;

    if (tabFilter === 'DEBT') return c.balance > 0;
    if (tabFilter === 'CLEAN') return c.balance <= 0;
    return true;
  });

  const totalDebt = customers.reduce((acc, c) => acc + c.balance, 0);
  const debtCount = customers.filter(c => c.balance > 0).length;
  const cleanCount = customers.filter(c => c.balance <= 0).length;

  return (
    <div className="flex-1 p-6 font-sans text-white h-[calc(100vh-64px)] overflow-y-auto space-y-6">

      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="text-amber-500 w-7 h-7" />
            Clientes
          </h1>
          <p className="text-slate-400 text-xs mt-1">Gerencie cadastros, limites de fiado e histórico de compras</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          Novo Cliente
        </button>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-2 text-sm max-w-5xl mx-auto">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl flex items-center gap-2 text-sm max-w-5xl mx-auto">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Resumo de Métricas */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block mb-1">Total de Clientes</span>
            <span className="text-2xl font-black text-white">{customers.length}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block mb-1">Clientes em Débito</span>
            <span className="text-2xl font-black text-rose-400">{debtCount}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block mb-1">Total a Receber (Fiado)</span>
            <span className="text-2xl font-black text-rose-400">R$ {totalDebt.toFixed(2)}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-rose-400" />
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="max-w-5xl mx-auto bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">

          {/* Busca por Nome ou Telefone */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar por nome ou telefone..."
              className="w-full pl-12 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-amber-500 transition-all text-sm shadow-inner"
            />
          </div>

          {/* Abas de Filtro */}
          <div className="flex bg-slate-950 p-1 border border-slate-800 rounded-xl shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setTabFilter('ALL')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${tabFilter === 'ALL' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
            >
              Todos ({customers.length})
            </button>
            <button
              onClick={() => setTabFilter('DEBT')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${tabFilter === 'DEBT' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
            >
              Com Débito ({debtCount})
            </button>
            <button
              onClick={() => setTabFilter('CLEAN')}
              className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${tabFilter === 'CLEAN' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
            >
              Em Dia ({cleanCount})
            </button>
          </div>
        </div>

        {/* Tabela de Clientes */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800">
                <th className="py-4 px-6 font-semibold text-sm text-slate-300">Cliente</th>
                <th className="py-4 px-6 font-semibold text-sm text-slate-300">Telefone</th>
                <th className="py-4 px-6 font-semibold text-sm text-slate-300">Fiado (R$)</th>
                <th className="py-4 px-6 font-semibold text-sm text-slate-300">Vasilhames Devidos</th>
                <th className="py-4 px-6 font-semibold text-sm text-slate-300 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Carregando clientes...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-3 px-6 font-medium text-white">{customer.name}</td>
                    <td className="py-3 px-6 text-slate-400">{customer.phone ? formatPhoneMask(customer.phone) : '-'}</td>
                    <td className="py-3 px-6 font-bold text-rose-400">
                      {customer.balance > 0 ? `R$ ${customer.balance.toFixed(2)}` : '-'}
                    </td>
                    <td className="py-3 px-6">
                      {customer.bottleBalances && customer.bottleBalances.filter(b => b.balance > 0).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {customer.bottleBalances.filter(b => b.balance > 0).map(b => (
                            <span key={b.id} className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold rounded flex items-center gap-1">
                              <Beer className="w-3 h-3" />
                              {b.balance}x {b.bottleType.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-6 flex justify-end gap-2">
                      <button
                        onClick={() => handleOpenDetailModal(customer.id)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors cursor-pointer"
                        title="Ver Histórico / Detalhes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleOpenModal(customer)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-amber-500 rounded-lg transition-colors cursor-pointer"
                        title="Editar Cliente"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      {customer.balance > 0 && (
                        <button
                          onClick={() => handleOpenPayModal(customer)}
                          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <DollarSign className="w-4 h-4" />
                          Receber
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">{formData.id ? 'Editar Cliente' : 'Novo Cliente'}</h2>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Nome do Cliente</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-sm"
                  placeholder="Ex: João Silva"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Telefone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: formatPhoneMask(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-sm"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pagamento (Receber Fiado) */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-1 flex items-center gap-2 text-emerald-400">
              <DollarSign className="w-5 h-5" />
              Receber Fiado
            </h2>
            <p className="text-slate-400 text-xs mb-4">
              Cliente: <strong className="text-white">{payData.name}</strong> • Dívida Total: <strong className="text-rose-400">R$ {payData.balance.toFixed(2)}</strong>
            </p>

            <form onSubmit={handlePayDebt} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Valor a Pagar (R$)</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={payData.balance}
                  value={payData.amount}
                  onChange={e => setPayData({ ...payData, amount: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Forma de Pagamento</label>
                <select
                  value={payData.paymentMethod}
                  onChange={e => setPayData({ ...payData, paymentMethod: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-sm"
                >
                  <option value="MONEY">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="DEBIT">Cartão de Débito</option>
                  <option value="CREDIT">Cartão de Crédito</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Este valor entrará no caixa aberto atualmente.</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Histórico / Ficha do Cliente */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative">
            <button
              onClick={() => setIsDetailModalOpen(false)}
              className="absolute right-4 top-4 text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {loadingDetail || !customerDetail ? (
              <div className="py-16 text-center text-slate-400 flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent"></div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 overflow-hidden min-h-0">

                {/* Topo do Cliente */}
                <div className="border-b border-slate-800 pb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    {customerDetail.name}
                  </h2>
                  <div className="flex gap-4 mt-2 text-xs text-slate-400">
                    <span>Telefone: {customerDetail.phone ? formatPhoneMask(customerDetail.phone) : 'Não informado'}</span>
                    <span>•</span>
                    <span>
                      Saldo Devedor: <strong className={customerDetail.balance > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        R$ {customerDetail.balance.toFixed(2)}
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Lista de Vendas e Pagamentos */}
                <div className="flex-1 overflow-y-auto space-y-6 min-h-0 pr-1">

                  {/* Seção Vendas */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                      Histórico de Compras ({customerDetail.sales?.length || 0})
                    </h3>

                    {!customerDetail.sales || customerDetail.sales.length === 0 ? (
                      <p className="text-xs text-slate-500 italic bg-slate-950 p-4 rounded-xl border border-slate-850">
                        Nenhuma compra registrada para este cliente.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {customerDetail.sales.map(sale => (
                          <div key={sale.id} className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-white">Pedido #{sale.id}</span>
                              <span className="text-slate-400 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(sale.createdAt).toLocaleString('pt-BR')}
                              </span>
                            </div>

                            {/* Itens */}
                            <div className="text-xs text-slate-400 space-y-1 py-1 border-y border-slate-800/60">
                              {sale.items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>{item.product?.name || 'Produto'} x{item.quantity}</span>
                                  <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>

                            <div className="flex justify-between items-center text-xs pt-1">
                              <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">
                                {translatePayment(sale.paymentMethod)}
                              </span>
                              <div className="text-right">
                                {sale.discount > 0 && (
                                  <span className="text-emerald-400 text-[11px] block">- R$ {sale.discount.toFixed(2)} desc.</span>
                                )}
                                <span className="font-bold text-amber-500 text-sm">Total: R$ {sale.total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Seção Pagamentos */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-500" />
                      Histórico de Pagamentos de Fiado ({customerDetail.payments?.length || 0})
                    </h3>

                    {!customerDetail.payments || customerDetail.payments.length === 0 ? (
                      <p className="text-xs text-slate-500 italic bg-slate-950 p-4 rounded-xl border border-slate-850">
                        Nenhum pagamento registrado.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {customerDetail.payments.map(pay => (
                          <div key={pay.id} className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-emerald-400 block">+ R$ {pay.amount.toFixed(2)}</span>
                              <span className="text-slate-500 text-[11px]">
                                {new Date(pay.createdAt).toLocaleString('pt-BR')} • {translatePayment(pay.paymentMethod)}
                              </span>
                            </div>
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                              PAGO
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Seção Vasilhames */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                        <Beer className="w-4 h-4 text-amber-500" />
                        Histórico de Vasilhames ({customerDetail.bottleMovements?.length || 0})
                      </h3>

                      {!customerDetail.bottleMovements || customerDetail.bottleMovements.length === 0 ? (
                        <p className="text-xs text-slate-500 italic bg-slate-950 p-4 rounded-xl border border-slate-850">
                          Nenhuma movimentação de vasilhame registrada.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {customerDetail.bottleMovements.map(mov => {
                            const isReturn = mov.type === 'CUSTOMER_RETURN';
                            return (
                              <div key={mov.id} className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl flex flex-col gap-1 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold flex items-center gap-1.5 text-white">
                                    <ArrowRightLeft className={`w-3 h-3 ${isReturn ? 'text-emerald-400' : 'text-rose-400'}`} />
                                    {isReturn ? 'Devolução' : 'Empréstimo'}: {mov.quantity}x {mov.bottleType.name}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${isReturn ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                                    {isReturn ? 'SALDO -' : 'SALDO +'}
                                  </span>
                                </div>
                                <span className="text-slate-500 text-[11px]">
                                  {new Date(mov.createdAt).toLocaleString('pt-BR')} {mov.saleId ? `• Venda #${mov.saleId}` : ''}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
