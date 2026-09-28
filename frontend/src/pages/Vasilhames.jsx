import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  Beer, Plus, AlertTriangle, CheckCircle2, ArrowRightLeft, Users, Package, RefreshCcw, Search, Edit, Trash
} from 'lucide-react';

export default function Vasilhames() {
  const [types, setTypes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [activeTab, setActiveTab] = useState('STOCK'); // 'STOCK' | 'CUSTOMERS' | 'MOVEMENTS'

  // Type Modal
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [typeForm, setTypeForm] = useState({ id: null, name: '', initialStock: 0 });

  // Movement Modal
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [moveForm, setMoveForm] = useState({
    bottleTypeId: '',
    quantity: '',
    type: 'CUSTOMER_BORROW', // CUSTOMER_BORROW, CUSTOMER_RETURN, SUPPLIER_SEND, SUPPLIER_RECEIVE
    customerId: '',
  });

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [typesRes, customersRes] = await Promise.all([
        api.get('/bottles/types'),
        api.get('/customers')
      ]);
      setTypes(typesRes);
      setCustomers(customersRes);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar dados de vasilhames.');
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  // --- Type Management ---
  const handleOpenTypeModal = (type = null) => {
    if (type) {
      setTypeForm({ id: type.id, name: type.name, initialStock: type.stock });
    } else {
      setTypeForm({ id: null, name: '', initialStock: 0 });
    }
    setIsTypeModalOpen(true);
  };

  const handleSaveType = async (e) => {
    e.preventDefault();
    try {
      if (typeForm.id) {
        await api.put(`/bottles/types/${typeForm.id}`, { name: typeForm.name });
        showSuccess('Tipo atualizado com sucesso!');
      } else {
        await api.post('/bottles/types', { name: typeForm.name, initialStock: parseInt(typeForm.initialStock) || 0 });
        showSuccess('Tipo criado com sucesso!');
      }
      setIsTypeModalOpen(false);
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || 'Erro ao salvar tipo.');
    }
  };

  const handleDeleteType = async (id) => {
    if (!confirm('Deseja realmente excluir este tipo de vasilhame?')) return;
    try {
      await api.delete(`/bottles/types/${id}`);
      showSuccess('Tipo excluído com sucesso!');
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || 'Erro ao excluir tipo.');
    }
  };

  // --- Movement Management ---
  const handleOpenMoveModal = (defaultType = 'CUSTOMER_BORROW', defaultCustomerId = '') => {
    setMoveForm({
      bottleTypeId: types.length > 0 ? types[0].id : '',
      quantity: '',
      type: defaultType,
      customerId: defaultCustomerId,
    });
    setIsMoveModalOpen(true);
  };

  const handleSaveMovement = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bottles/movement', {
        bottleTypeId: parseInt(moveForm.bottleTypeId),
        quantity: parseInt(moveForm.quantity),
        type: moveForm.type,
        customerId: moveForm.customerId ? parseInt(moveForm.customerId) : undefined,
        description: 'Lançamento manual via Painel de Vasilhames'
      });
      showSuccess('Movimentação registrada com sucesso!');
      setIsMoveModalOpen(false);
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || 'Erro ao registrar movimentação.');
    }
  };

  // --- Filters ---
  const filteredCustomers = customers.filter(c => {
    const hasBalances = c.bottleBalances && c.bottleBalances.length > 0 && c.bottleBalances.some(b => b.balance > 0);
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return hasBalances && matchesSearch;
  });

  return (
    <div className="flex-1 p-6 font-sans text-white h-[calc(100vh-64px)] overflow-y-auto space-y-6">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Beer className="text-amber-500 w-7 h-7" />
            Vasilhames
          </h1>
          <p className="text-slate-400 text-xs mt-1">Gerencie o estoque físico da loja e o saldo emprestado aos clientes</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => handleOpenTypeModal()}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Tipo
          </button>
          <button 
            onClick={() => handleOpenMoveModal()}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowRightLeft className="w-5 h-5 stroke-[2.5]" />
            Nova Movimentação
          </button>
        </div>
      </div>

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

      {/* Tabs */}
      <div className="max-w-5xl mx-auto flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('STOCK')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'STOCK' ? 'bg-amber-500/10 text-amber-500' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Package className="w-4 h-4" />
          Estoque da Loja
        </button>
        <button
          onClick={() => setActiveTab('CUSTOMERS')}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'CUSTOMERS' ? 'bg-amber-500/10 text-amber-500' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Users className="w-4 h-4" />
          Clientes Devedores
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto space-y-4">
          
          {/* TAB: ESTOQUE */}
          {activeTab === 'STOCK' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {types.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
                  Nenhum tipo de vasilhame cadastrado.
                </div>
              ) : (
                types.map(type => (
                  <div key={type.id} className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl relative group">
                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenTypeModal(type)} className="p-1.5 bg-slate-800 text-amber-500 rounded-lg hover:bg-slate-700 cursor-pointer">
                        <Edit className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDeleteType(type.id)} className="p-1.5 bg-slate-800 text-rose-400 rounded-lg hover:bg-slate-700 cursor-pointer">
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block mb-1">Tipo Físico</span>
                    <h3 className="text-lg font-black text-white mb-4 pr-16">{type.name}</h3>
                    
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-xs text-slate-500 block mb-1">Qtd. na Loja</span>
                        <span className={`text-2xl font-black ${type.stock > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {type.stock}
                        </span>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center justify-center">
                        <Beer className="w-6 h-6 text-slate-400" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: CLIENTES */}
          {activeTab === 'CUSTOMERS' && (
            <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-5">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar cliente..."
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-amber-500 transition-all text-sm shadow-inner"
                />
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/50">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-800">
                      <th className="py-4 px-6 font-semibold text-sm text-slate-300">Cliente</th>
                      <th className="py-4 px-6 font-semibold text-sm text-slate-300">Vasilhames Devidos</th>
                      <th className="py-4 px-6 font-semibold text-sm text-slate-300 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-sm">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                          Nenhum cliente com vasilhames pendentes.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="py-3 px-6 font-medium text-white">{customer.name}</td>
                          <td className="py-3 px-6">
                            <div className="flex flex-wrap gap-2">
                              {customer.bottleBalances.filter(b => b.balance > 0).map(b => (
                                <span key={b.id} className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded-lg flex items-center gap-1">
                                  <Beer className="w-3 h-3" />
                                  {b.balance}x {b.bottleType.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-6 flex justify-end gap-2">
                            <button
                              onClick={() => handleOpenMoveModal('CUSTOMER_RETURN', customer.id)}
                              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCcw className="w-3 h-3" />
                              Receber
                            </button>
                            <button
                              onClick={() => handleOpenMoveModal('CUSTOMER_BORROW', customer.id)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 cursor-pointer"
                            >
                              Emprestar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Modal: Tipo de Vasilhame */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-bold mb-4">{typeForm.id ? 'Editar Tipo' : 'Novo Tipo de Vasilhame'}</h2>
            <form onSubmit={handleSaveType} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Nome do Vasilhame</label>
                <input
                  required
                  type="text"
                  value={typeForm.name}
                  onChange={e => setTypeForm({...typeForm, name: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-sm"
                  placeholder="Ex: Garrafa 600ml Ambev"
                />
              </div>
              
              {!typeForm.id && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Estoque Inicial na Loja</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={typeForm.initialStock}
                    onChange={e => setTypeForm({...typeForm, initialStock: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-sm"
                  />
                </div>
              )}
              
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsTypeModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Movimentação Manual */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-amber-500" />
              Registrar Movimentação
            </h2>
            <form onSubmit={handleSaveMovement} className="space-y-4">
              
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Tipo de Movimento</label>
                <select
                  required
                  value={moveForm.type}
                  onChange={e => setMoveForm({...moveForm, type: e.target.value})}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-sm"
                >
                  <option value="CUSTOMER_BORROW">Empréstimo (Cliente leva)</option>
                  <option value="CUSTOMER_RETURN">Devolução (Cliente devolve)</option>
                  <option value="SUPPLIER_SEND">Envio p/ Fornecedor (Sai da loja)</option>
                  <option value="SUPPLIER_RECEIVE">Recebimento Fornecedor (Entra na loja)</option>
                </select>
              </div>

              {(moveForm.type === 'CUSTOMER_BORROW' || moveForm.type === 'CUSTOMER_RETURN') && (
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Cliente</label>
                  <select
                    required
                    value={moveForm.customerId}
                    onChange={e => setMoveForm({...moveForm, customerId: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-sm"
                  >
                    <option value="">Selecione um cliente...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Vasilhame</label>
                  <select
                    required
                    value={moveForm.bottleTypeId}
                    onChange={e => setMoveForm({...moveForm, bottleTypeId: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-sm"
                  >
                    {types.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Quantidade</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={moveForm.quantity}
                    onChange={e => setMoveForm({...moveForm, quantity: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all text-sm font-bold"
                  />
                </div>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsMoveModalOpen(false)} className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer">
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
