import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useForm } from 'react-hook-form';
import { 
  Package, Plus, Edit3, Trash2, ArrowUpRight, Search, 
  X, AlertTriangle, ArrowUpDown, RefreshCw
} from 'lucide-react';

export default function Estoque() {
  const [products, setProducts] = useState([]);
  const [bottleTypes, setBottleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modais
  const [activeModal, setActiveModal] = useState(null); // 'create' | 'edit' | 'entry'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isPackEntry, setIsPackEntry] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const [prodData, bottleData] = await Promise.all([
        api.get('/products'),
        api.get('/bottles/types')
      ]);
      setProducts(prodData);
      setBottleTypes(bottleData.data || bottleData);
    } catch (err) {
      console.error(err);
      setError('Erro ao carregar dados do estoque');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (data) => {
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: data.name,
        price: parseFloat(data.price),
        costPrice: parseFloat(data.costPrice || 0),
        stock: parseInt(data.stock) || 0,
        packQuantity: parseInt(data.packQuantity) || 1
      };
      if (data.requiresBottle && data.bottleTypeId) {
        payload.bottleTypeId = parseInt(data.bottleTypeId);
      }

      await api.post('/products', payload);
      setSuccess(`Produto "${data.name}" criado com sucesso!`);
      loadProducts();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erro ao criar produto');
    }
  };

  const handleEditProduct = async (data) => {
    setError('');
    setSuccess('');
    try {
      const payload = {
        name: data.name,
        price: parseFloat(data.price),
        costPrice: parseFloat(data.costPrice || 0),
        packQuantity: parseInt(data.packQuantity) || 1,
        bottleTypeId: (data.requiresBottle && data.bottleTypeId) ? parseInt(data.bottleTypeId) : null
      };
      await api.patch(`/products/${selectedProduct.id}`, payload);
      setSuccess(`Produto "${data.name}" atualizado com sucesso!`);
      loadProducts();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erro ao editar produto');
    }
  };

  const handleStockEntry = async (data) => {
    setError('');
    setSuccess('');
    try {
      // Aceitar tanto vírgula quanto ponto e converter para float
      const parsedQty = parseFloat(data.quantity.toString().replace(',', '.'));
      const finalQuantity = isPackEntry 
        ? Math.round(parsedQty * (selectedProduct.packQuantity || 1)) 
        : Math.round(parsedQty);
        
      await api.post(`/products/${selectedProduct.id}/entry`, {
        quantity: finalQuantity
      });
      setSuccess(`Entrada de estoque para "${selectedProduct.name}" registrada!`);
      loadProducts();
      closeModal();
    } catch (err) {
      setError(err.message || 'Erro ao registrar entrada de estoque');
    }
  };

  const handleDeleteProduct = async (id, name) => {
    if (!window.confirm(`Tem certeza que deseja excluir o produto "${name}"?`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/products/${id}`);
      setSuccess(`Produto "${name}" removido com sucesso.`);
      loadProducts();
    } catch (err) {
      setError(err.message || 'Não foi possível excluir o produto');
    }
  };

  const openModal = (type, product = null) => {
    setSelectedProduct(product);
    setActiveModal(type);
    reset();

    if (type === 'edit' && product) {
      setValue('name', product.name);
      setValue('price', product.price);
      setValue('costPrice', product.costPrice || 0);
      setValue('packQuantity', product.packQuantity || 1);
      setValue('requiresBottle', !!product.bottleTypeId);
      if (product.bottleTypeId) {
        setValue('bottleTypeId', product.bottleTypeId);
      }
    }
    
    if (type === 'entry') {
      setIsPackEntry(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setSelectedProduct(null);
    reset();
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.includes(searchQuery)
  );

  return (
    <div className="flex-1 p-6 font-sans text-white h-[calc(100vh-64px)] overflow-y-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="text-amber-500 w-7 h-7" />
            Controle de Estoque
          </h1>
          <p className="text-slate-400 text-xs mt-1">Gerencie mercadorias e entradas de produtos</p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => openModal('create')}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-lg shadow-amber-500/10"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Novo Produto
          </button>
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
          <ArrowUpRight className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Barra de Busca */}
      <div className="max-w-6xl mx-auto bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por nome ou código..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-amber-500 transition-colors text-sm"
          />
        </div>
        <button
          onClick={loadProducts}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
          title="Recarregar"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Tabela de Produtos */}
      <div className="max-w-6xl mx-auto bg-slate-900/20 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-20 flex justify-center items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Código</th>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4 text-right">Preço Venda</th>
                  <th className="px-6 py-4 text-right">Preço Custo</th>
                  <th className="px-6 py-4 text-center">Fardo</th>
                  <th className="px-6 py-4 text-center">Quantidade</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                      Nenhum produto cadastrado ou correspondente à pesquisa.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const isLowStock = product.stock <= 5;
                    const isOut = product.stock === 0;
                    return (
                      <tr key={product.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-450">{product.code}</td>
                        <td className="px-6 py-4 font-semibold text-white">{product.name}</td>
                        <td className="px-6 py-4 text-right font-bold text-amber-500">R$ {product.price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-400">R$ {(product.costPrice || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-center text-slate-400 text-xs">{product.packQuantity > 1 ? `${product.packQuantity} un.` : '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              isOut 
                                ? 'bg-red-500/10 text-red-500' 
                                : isLowStock 
                                  ? 'bg-amber-500/10 text-amber-400' 
                                  : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              {product.stock} {product.stock === 1 ? 'unidade' : 'unidades'}
                            </span>
                            {product.packQuantity > 1 && (
                              <span className="text-xs font-medium text-slate-400 bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800/80">
                                ~ {parseFloat((product.stock / product.packQuantity).toFixed(2))} {parseFloat((product.stock / product.packQuantity).toFixed(2)) === 1 ? 'caixa' : 'caixas'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center items-center gap-2">
                            <button
                              onClick={() => openModal('entry', product)}
                              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Registrar Entrada (Entrada de Mercadoria)"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openModal('edit', product)}
                              className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Editar Produto"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id, product.name)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Excluir Produto"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

      {/* MODAL: Cadastrar Produto */}
      {activeModal === 'create' && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button onClick={closeModal} className="absolute right-4 top-4 text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-6">Cadastrar Novo Produto</h3>

            <form onSubmit={handleSubmit(handleCreateProduct)} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Nome do Produto</label>
                <input
                  type="text"
                  {...register('name', { required: 'Nome do produto é obrigatório' })}
                  placeholder="Ex: Cerveja Brahma Lata 350ml"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                />
                {errors.name && <span className="text-red-400 text-xs mt-1 block">{errors.name.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Preço Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...register('price', { required: 'Preço é obrigatório', min: { value: 0.01, message: 'Preço deve ser maior que zero' } })}
                    placeholder="4.50"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                  {errors.price && <span className="text-red-400 text-xs mt-1 block">{errors.price.message}</span>}
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Preço Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('costPrice', { required: 'Custo é obrigatório', min: { value: 0, message: 'Custo não pode ser negativo' } })}
                    placeholder="2.00"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                  {errors.costPrice && <span className="text-red-400 text-xs mt-1 block">{errors.costPrice.message}</span>}
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Estoque Inicial (Unid.)</label>
                  <input
                    type="number"
                    min="0"
                    {...register('stock', { min: { value: 0, message: 'Estoque não pode ser negativo' } })}
                    placeholder="120"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-655 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                  {errors.stock && <span className="text-red-400 text-xs mt-1 block">{errors.stock.message}</span>}
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Unidades p/ Fardo</label>
                  <input
                    type="number"
                    min="1"
                    {...register('packQuantity', { min: { value: 1, message: 'Mínimo de 1 unidade por fardo' } })}
                    placeholder="Ex: 24"
                    defaultValue="1"
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-655 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                  {errors.packQuantity && <span className="text-red-400 text-xs mt-1 block">{errors.packQuantity.message}</span>}
                </div>
              </div>

              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="requiresBottleCreate"
                    {...register('requiresBottle')}
                    className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-900 focus:ring-amber-500"
                  />
                  <label htmlFor="requiresBottleCreate" className="text-sm font-semibold text-slate-300">
                    Este produto exige vasilhame físico
                  </label>
                </div>
                
                <div className="pl-6">
                  <select
                    {...register('bottleTypeId')}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  >
                    <option value="">Selecione o tipo de vasilhame...</option>
                    {bottleTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cadastrar Produto
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Produto */}
      {activeModal === 'edit' && selectedProduct && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button onClick={closeModal} className="absolute right-4 top-4 text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-6">Editar Produto</h3>

            <form onSubmit={handleSubmit(handleEditProduct)} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Nome do Produto</label>
                <input
                  type="text"
                  {...register('name', { required: 'Nome do produto é obrigatório' })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm"
                />
                {errors.name && <span className="text-red-400 text-xs mt-1 block">{errors.name.message}</span>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Preço Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    {...register('price', { required: 'Preço é obrigatório', min: { value: 0.01, message: 'Preço deve ser maior que zero' } })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                  {errors.price && <span className="text-red-400 text-xs mt-1 block">{errors.price.message}</span>}
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Preço Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register('costPrice', { required: 'Custo é obrigatório', min: { value: 0, message: 'Custo não pode ser negativo' } })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                  {errors.costPrice && <span className="text-red-400 text-xs mt-1 block">{errors.costPrice.message}</span>}
                </div>

                <div>
                  <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Unidades p/ Fardo</label>
                  <input
                    type="number"
                    min="1"
                    {...register('packQuantity', { min: { value: 1, message: 'Mínimo de 1 unidade por fardo' } })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                  {errors.packQuantity && <span className="text-red-400 text-xs mt-1 block">{errors.packQuantity.message}</span>}
                </div>
              </div>

              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800/80 mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="requiresBottleEdit"
                    {...register('requiresBottle')}
                    className="w-4 h-4 text-amber-500 rounded border-slate-700 bg-slate-900 focus:ring-amber-500"
                  />
                  <label htmlFor="requiresBottleEdit" className="text-sm font-semibold text-slate-300">
                    Este produto exige vasilhame físico
                  </label>
                </div>
                
                <div className="pl-6">
                  <select
                    {...register('bottleTypeId')}
                    className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  >
                    <option value="">Selecione o tipo de vasilhame...</option>
                    {bottleTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Entrada de Estoque (Mercadoria) */}
      {activeModal === 'entry' && selectedProduct && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button onClick={closeModal} className="absolute right-4 top-4 text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white mb-2">Entrada de Mercadoria</h3>
            <p className="text-slate-400 text-xs mb-6">Adicionar produtos ao estoque de: <span className="text-white font-semibold">{selectedProduct.name}</span></p>

            <form onSubmit={handleSubmit(handleStockEntry)} className="space-y-4">
              {selectedProduct?.packQuantity > 1 && (
                <div className="flex items-center gap-2 mb-2 p-3 bg-slate-950/50 rounded-xl border border-slate-800/80">
                  <input
                    type="checkbox"
                    id="packToggle"
                    checked={isPackEntry}
                    onChange={(e) => setIsPackEntry(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 bg-slate-900"
                  />
                  <label htmlFor="packToggle" className="text-sm font-semibold text-amber-400 cursor-pointer">
                    Entrada em Fardos/Engradados ({selectedProduct.packQuantity} un/fardo)
                  </label>
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Quantidade a Adicionar {isPackEntry ? '(Fardos)' : '(Unidades)'}
                </label>
                <input
                  type="number"
                  step="any"
                  {...register('quantity', { required: 'Defina a quantidade de entrada', min: { value: 0.01, message: 'A quantidade deve ser maior que zero' } })}
                  placeholder={isPackEntry ? "Ex: 10.5 (fardos)" : "Ex: 24 (unidades)"}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-655 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                />
                {errors.quantity && <span className="text-red-400 text-xs mt-1 block">{errors.quantity.message}</span>}
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Estoque atual:</span>
                  <span className="text-slate-350">{selectedProduct.stock} unidades</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Código do produto:</span>
                  <span className="font-mono text-slate-350">{selectedProduct.code}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Confirmar Entrada
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
