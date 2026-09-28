import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  DollarSign, CheckCircle2, AlertCircle, Printer, X, CreditCard, Users, MessageCircle, Beer
} from 'lucide-react';
import html2canvas from 'html2canvas';

export default function PDV() {
  const navigate = useNavigate();
  const [cashRegister, setCashRegister] = useState(null);
  const [loadingCash, setLoadingCash] = useState(true);
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [codeQuery, setCodeQuery] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('MONEY');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [saleResult, setSaleResult] = useState(null);
  const [error, setError] = useState('');
  const [discount, setDiscount] = useState('');
  const [isPackSale, setIsPackSale] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Controle de Vasilhames no Checkout
  const [bottleTypes, setBottleTypes] = useState([]);
  const [returnedBottles, setReturnedBottles] = useState([]);

  const barcodeInputRef = useRef(null);

  useEffect(() => {
    checkCashRegister();
    loadProducts();
    loadCustomers();
    loadBottleTypes();
  }, []);

  const checkCashRegister = async () => {
    try {
      setLoadingCash(true);
      const data = await api.get('/cash-register/current');
      setCashRegister(data);
    } catch (err) {
      console.error('Erro ao verificar caixa:', err);
    } finally {
      setLoadingCash(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await api.get('/products');
      setProducts(data);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const data = await api.get('/customers');
      setCustomers(data);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  };

  const loadBottleTypes = async () => {
    try {
      const data = await api.get('/bottles/types');
      setBottleTypes(data);
    } catch (err) {
      console.error('Erro ao carregar vasilhames:', err);
    }
  };

  // Foca no input do código de barras ao carregar
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [cashRegister]);

  const handleAddByCode = async (e) => {
    if (e) e.preventDefault();
    if (!codeQuery.trim()) return;

    setError('');
    try {
      const product = await api.get(`/products/code/${codeQuery.trim()}`);
      addToCart(product);
      setCodeQuery('');
    } catch (err) {
      setError(err.message || 'Produto não encontrado pelo código');
    }
  };

  const handleAddBySelect = () => {
    if (!selectedProduct) return;
    const product = products.find(p => p.id === Number(selectedProduct));
    if (product) {
      addToCart(product);
      setSelectedProduct('');
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.product.id === product.id);
    const cartQty = existing ? Number(existing.quantity) : 0;
    
    const packQty = Number(product.packQuantity) || 1;
    const qtyToAdd = isPackSale && packQty > 1 ? packQty : 1;

    if (product.stock < cartQty + qtyToAdd) {
      setError(`Estoque insuficiente de "${product.name}". Em estoque: ${product.stock} (Tentou adicionar: ${qtyToAdd})`);
      return;
    }

    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: cartQty + qtyToAdd }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: qtyToAdd }]);
    }
    setError('');
  };

  const updateQuantity = (productId, amount) => {
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const currentQty = Number(item.quantity) || 0;
    const newQty = currentQty + amount;
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    if (amount > 0 && item.product.stock < newQty) {
      setError(`Estoque insuficiente de "${item.product.name}". Em estoque: ${item.product.stock}`);
      return;
    }

    setCart(cart.map(i =>
      i.product.id === productId
        ? { ...i, quantity: newQty }
        : i
    ));
    setError('');
  };

  const handleQuantityChange = (productId, value) => {
    setError('');
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    if (value === '') {
      setCart(cart.map(i =>
        i.product.id === productId
          ? { ...i, quantity: '' }
          : i
      ));
      return;
    }

    // Bloquear caracteres não-numéricos
    if (!/^\d+$/.test(value)) return;

    const newQty = parseInt(value, 10);
    if (isNaN(newQty) || newQty < 0) return;

    if (newQty > item.product.stock) {
      setError(`Estoque insuficiente de "${item.product.name}". Em estoque: ${item.product.stock}`);
      setCart(cart.map(i =>
        i.product.id === productId
          ? { ...i, quantity: item.product.stock }
          : i
      ));
      return;
    }

    setCart(cart.map(i =>
      i.product.id === productId
        ? { ...i, quantity: newQty }
        : i
    ));
  };

  const handleQuantityBlur = (productId, value) => {
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty <= 0) {
      removeFromCart(productId);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product.id !== productId));
    setError('');
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.product.price * (Number(item.quantity) || 0)), 0);
  const discountValue = Number(discount) || 0;
  const finalTotal = cartTotal - discountValue;

  const requiredBottles = cart.reduce((acc, item) => {
    if (item.product.bottleTypeId) {
      const typeId = item.product.bottleTypeId;
      const current = acc.find(b => b.bottleTypeId === typeId);
      if (current) {
        current.quantity += Number(item.quantity) || 0;
      } else {
        acc.push({ bottleTypeId: typeId, quantity: Number(item.quantity) || 0 });
      }
    }
    return acc;
  }, []);

  const handleFinishSale = async () => {
    if (cart.length === 0) return;

    const hasInvalidQty = cart.some(item => !item.quantity || Number(item.quantity) <= 0);
    if (hasInvalidQty) {
      setError('Por favor, insira uma quantidade válida maior que zero para todos os produtos.');
      return;
    }

    // Trava de segurança para vasilhames esquecidos
    const typeSelect = document.getElementById('bottleTypeSelect');
    const returnInput = document.getElementById('bottleReturnQtyInput');
    
    if (typeSelect?.value && parseInt(returnInput?.value) > 0) {
      setError('Você preencheu o campo de devolução de vasilhame, mas esqueceu de clicar no botão "+" para adicionar à lista.');
      return;
    }

    setIsFinishing(true);
    setError('');

    try {
      const items = cart.map(item => ({
        productId: item.product.id,
        quantity: Number(item.quantity)
      }));

      if (paymentMethod === 'CREDIT_STORE' && !selectedCustomer) {
        setError('Selecione um cliente para registrar venda Fiado.');
        setIsFinishing(false);
        return;
      }

      const payloadMovements = returnedBottles.map(rb => ({
        bottleTypeId: rb.bottleTypeId,
        quantity: rb.quantity,
        type: 'CUSTOMER_RETURN'
      }));

      const res = await api.post('/sales', {
        paymentMethod,
        customerId: selectedCustomer ? Number(selectedCustomer) : undefined,
        discount: discountValue > 0 ? discountValue : undefined,
        items,
        bottleMovements: payloadMovements.length > 0 ? payloadMovements : undefined
      });

      setSaleResult(res);
      const customerObj = customers.find(c => c.id === Number(selectedCustomer));
      setWhatsappNumber(customerObj?.phone || '');
      
      setCart([]);
      setSelectedCustomer('');
      setDiscount('');
      setReturnedBottles([]);
      loadProducts(); // Recarregar produtos para atualizar estoque em tela
    } catch (err) {
      setError(err.message || 'Erro ao finalizar venda');
    } finally {
      setIsFinishing(false);
    }
  };

  const addReturnedBottle = (bottleTypeId, quantity) => {
    if (quantity === 0) return;
    const existing = returnedBottles.find(r => r.bottleTypeId === bottleTypeId);
    if (existing) {
      setReturnedBottles(returnedBottles.map(r => 
        r.bottleTypeId === bottleTypeId 
          ? { ...r, quantity: r.quantity + quantity }
          : r
      ));
    } else {
      setReturnedBottles([...returnedBottles, { bottleTypeId, quantity }]);
    }
  };

  const removeReturnedBottle = (bottleTypeId) => {
    setReturnedBottles(returnedBottles.filter(r => r.bottleTypeId !== bottleTypeId));
  };

  const generateReceiptHTML = () => {
    if (!saleResult) return '';
    const cnpj = import.meta.env.VITE_COMPANY_CNPJ || '00.000.000/0001-00';
    let itemsHTML = saleResult.items.map(item => `
      <tr>
        <td style="padding:2px 0">${item.product.name.substring(0, 20)}</td>
        <td style="padding:2px 0;text-align:center">${item.quantity}</td>
        <td style="padding:2px 0;text-align:right">R$ ${item.price.toFixed(2)}</td>
        <td style="padding:2px 0;text-align:right">R$ ${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <div style="width:72mm;font-family:monospace;font-size:12px;color:#000;padding:8px;">
        <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:4px;">DISTRIBUIDORA DE BEBIDAS</div>
        <div style="text-align:center;margin-bottom:8px;">CNPJ: ${cnpj}</div>
        <hr style="border:none;border-top:1px dashed #000;margin:4px 0;">
        <div>COMPROVANTE NÃO FISCAL</div>
        <div>Pedido: #${saleResult.id}</div>
        <div>Data/Hora: ${new Date(saleResult.createdAt).toLocaleString('pt-BR')}</div>
        <hr style="border:none;border-top:1px dashed #000;margin:4px 0;">
        <table style="width:100%;font-size:11px;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid #000;">
              <th style="text-align:left;padding:2px 0;">Item</th>
              <th style="text-align:center;padding:2px 0;">Qtd</th>
              <th style="text-align:right;padding:2px 0;">Unit</th>
              <th style="text-align:right;padding:2px 0;">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHTML}</tbody>
        </table>
        <hr style="border:none;border-top:1px dashed #000;margin:4px 0;">
        ${saleResult.discount > 0 ? `<div style="display:flex;justify-content:space-between;"><span>Desconto:</span><span>- R$ ${saleResult.discount.toFixed(2)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;">
          <span>TOTAL:</span>
          <span>R$ ${saleResult.total.toFixed(2)}</span>
        </div>
        <div>Forma Pgto: ${translatePayment(saleResult.paymentMethod)}</div>
        <hr style="border:none;border-top:1px dashed #000;margin:8px 0;">
        <div style="text-align:center;margin-top:8px;">Obrigado pela preferência!</div>
        <div style="text-align:center;font-size:8px;">Sistema PDV Distribuidora</div>
      </div>
    `;
  };

  const printReceipt = () => {
    const receiptHTML = generateReceiptHTML();
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Comprovante</title>
          <style>
            body { margin: 0; padding: 0; }
            @page { size: 80mm auto; margin: 0; }
          </style>
        </head>
        <body>${receiptHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const formatPhoneMask = (value) => {
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

  const handleSendWhatsapp = async () => {
    if (!whatsappNumber) return;
    
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.background = 'white';
    tempDiv.innerHTML = generateReceiptHTML();
    document.body.appendChild(tempDiv);

    try {
      const canvas = await html2canvas(tempDiv, { scale: 2, backgroundColor: '#ffffff' });
      document.body.removeChild(tempDiv);
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          alert("Comprovante copiado como IMAGEM!\n\nNa próxima tela, aperte Ctrl+V (ou colar) na conversa do WhatsApp para enviar.");
          
          const formattedNumber = whatsappNumber.replace(/\D/g, ''); 
          const finalNumber = formattedNumber.startsWith('55') ? formattedNumber : `55${formattedNumber}`;
          
          window.open(`https://wa.me/${finalNumber}`, '_blank');
        } catch (err) {
          console.error("Erro ao copiar imagem:", err);
          alert("Não foi possível copiar a imagem automaticamente. Verifique as permissões do navegador.");
        }
      });
    } catch (err) {
      document.body.removeChild(tempDiv);
      console.error(err);
      alert("Erro ao processar imagem.");
    }
  };

  const translatePayment = (method) => {
    const types = {
      MONEY: 'Dinheiro',
      PIX: 'PIX',
      DEBIT: 'Cartão de Débito',
      CREDIT: 'Cartão de Crédito',
      CREDIT_STORE: 'Fiado (A Prazo)'
    };
    return types[method] || method;
  };

  if (loadingCash) {
    return (
      <div className="flex-1 flex justify-center items-center h-[calc(100vh-64px)] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!cashRegister) {
    return (
      <div className="flex-1 p-6 md:p-10 max-w-4xl mx-auto flex flex-col justify-center items-center h-[calc(100vh-100px)]">
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Caixa Fechado</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Não é possível registrar vendas no sistema sem antes abrir o caixa diário.
          </p>
          <button
            onClick={() => navigate('/caixa')}
            className="w-full py-3 bg-amber-500 text-slate-950 font-bold rounded-xl hover:bg-amber-400 transition-colors cursor-pointer text-sm shadow-lg shadow-amber-500/10"
          >
            Ir para Controle de Caixa
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="flex-1 p-6 font-sans text-white h-[calc(100vh-64px)] flex flex-col gap-6 overflow-hidden">
        <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="text-amber-500 w-7 h-7" />
            Ponto de Vendas (PDV)
          </h1>
          <p className="text-slate-400 text-xs mt-1">Registrar nova venda na portaria</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Caixa Aberto (Operador)</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl flex items-center gap-2 text-sm shrink-0">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
        <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden min-h-0">
          <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-4 shrink-0">
            <form onSubmit={handleAddByCode} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={codeQuery}
                  onChange={(e) => setCodeQuery(e.target.value)}
                  placeholder="Código do Produto + Enter"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                />
              </div>
              <button
                type="submit"
                className="px-5 bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Buscar
              </button>
            </form>

            <div className="h-px md:h-auto md:w-px bg-slate-800 my-1 md:my-0"></div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const prod = products.find(p => p.name === productSearch);
              if (prod) {
                addToCart(prod);
                setProductSearch('');
                setError('');
              } else {
                setError('Produto não encontrado na lista. Selecione uma opção válida.');
              }
            }} className="flex-1 flex gap-2">
              <input 
                type="text"
                list="products-datalist"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Nome do Produto..."
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors text-sm"
              />
              <datalist id="products-datalist">
                {products.map(p => (
                  <option key={p.id} value={p.name}>
                    Estoque: {p.stock} - R$ {p.price.toFixed(2)}
                  </option>
                ))}
              </datalist>
              <button
                type="submit"
                disabled={!productSearch}
                className="px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-sm transition-colors cursor-pointer disabled:opacity-40"
              >
                Adicionar
              </button>
            </form>
          </div>
          
          <div className="bg-slate-900/20 border border-slate-800/80 px-4 py-3 rounded-2xl shrink-0 flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer text-amber-500 font-semibold text-sm">
              <input
                type="checkbox"
                checked={isPackSale}
                onChange={(e) => setIsPackSale(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900 bg-slate-950"
              />
              Modo de Venda por Lote/Fardo
            </label>
            <span className="text-slate-500 text-xs hidden md:block">
              (Adiciona o fardo inteiro ao selecionar o produto)
            </span>
          </div>

          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl flex flex-col overflow-hidden min-h-0">
            <div className="bg-slate-900/80 px-6 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="font-semibold text-sm tracking-wide uppercase text-slate-400">Carrinho de Compras</h2>
              <span className="bg-amber-500/10 text-amber-400 px-2.5 py-0.5 rounded-full text-xs font-semibold">
                {cart.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} itens
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-slate-500 p-8">
                  <ShoppingCart className="w-16 h-16 stroke-[1.5] mb-4 text-slate-700" />
                  <p className="text-sm">Carrinho vazio</p>
                  <p className="text-xs mt-1 text-slate-650">Leia um código de barras ou selecione na lista acima</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.product.id} className="bg-slate-950/60 border border-slate-800/60 p-4 rounded-xl flex items-center justify-between gap-4 hover:border-slate-800 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-white truncate">{item.product.name}</p>
                      <p className="text-slate-500 text-xs mt-1 font-mono">Cód: {item.product.code}</p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">Subtotal</p>
                        <p className="font-bold text-sm text-amber-500 mt-0.5">R$ {(item.product.price * item.quantity).toFixed(2)}</p>
                      </div>

                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
                          <button
                            onClick={() => updateQuantity(item.product.id, -1)}
                            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.product.id, e.target.value)}
                            onBlur={(e) => handleQuantityBlur(item.product.id, e.target.value)}
                            className="w-12 text-center font-bold text-sm text-white font-mono bg-transparent focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
                          />
                          <button
                            onClick={() => updateQuantity(item.product.id, 1)}
                            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                        {item.product.packQuantity > 1 && (
                          <div className="flex gap-1 w-full mt-1">
                            <button
                              onClick={() => updateQuantity(item.product.id, -(Number(item.product.packQuantity) || 1))}
                              className="flex-1 text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 py-1 rounded font-semibold text-center transition-colors cursor-pointer"
                            >
                              -1 Fardo
                            </button>
                            <button
                              onClick={() => updateQuantity(item.product.id, Number(item.product.packQuantity) || 1)}
                              className="flex-1 text-[10px] bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 py-1 rounded font-semibold text-center transition-colors cursor-pointer"
                            >
                              +1 Fardo ({item.product.packQuantity})
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-2 text-slate-500 hover:text-red-400 transition-colors cursor-pointer rounded-lg hover:bg-red-500/10"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 overflow-hidden min-h-0">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shrink-0 shadow-lg">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Valor da Compra</p>
              <div className="flex justify-between items-end mt-2">
                <span className="text-slate-500 text-sm">Subtotal:</span>
                <span className="text-slate-300">R$ {cartTotal.toFixed(2)}</span>
              </div>
              {discountValue > 0 && (
                <div className="flex justify-between items-end mt-1 text-emerald-500">
                  <span className="text-xs">Desconto:</span>
                  <span className="text-sm">- R$ {discountValue.toFixed(2)}</span>
                </div>
              )}
              <h2 className="text-4xl font-extrabold text-white mt-2 tracking-tight border-t border-slate-800 pt-2">
                R$ {finalTotal.toFixed(2)}
              </h2>
            </div>
            <div className="h-px bg-slate-800 my-4"></div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Itens:</span>
                <span>{cart.reduce((s, i) => s + (Number(i.quantity) || 0), 0)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Status Caixa:</span>
                <span className="text-emerald-400 font-semibold">Aberto</span>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between min-h-0 overflow-y-auto">
            <div className="space-y-4">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-400">Forma de Pagamento</h3>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3">
                {[
                  { id: 'MONEY', label: 'Dinheiro', icon: DollarSign },
                  { id: 'PIX', label: 'PIX', icon: CheckCircle2 },
                  { id: 'DEBIT', label: 'Débito', icon: CreditCard },
                  { id: 'CREDIT', label: 'Crédito', icon: CreditCard },
                  { id: 'CREDIT_STORE', label: 'Fiado', icon: Users }
                ].map(method => {
                  const Icon = method.icon;
                  const isSelected = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-3.5 border rounded-xl flex flex-col items-center gap-2 cursor-pointer transition-all ${isSelected
                        ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                        : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 text-slate-400 hover:text-white'
                        }`}
                    >
                      <Icon className="w-5 h-5 stroke-[1.5]" />
                      <span className="text-[11px] font-semibold">{method.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Cliente {paymentMethod === 'CREDIT_STORE' ? <span className="text-red-400">(Obrigatório)</span> : '(Opcional)'}
                </label>
                <select
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className={`w-full px-4 py-2.5 bg-slate-950 border ${paymentMethod === 'CREDIT_STORE' && !selectedCustomer ? 'border-red-500/50' : 'border-slate-800'} rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm`}
                >
                  <option value="">Selecione o Cliente...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Desconto (R$)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value.replace(',', '.'))}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm"
                />
              </div>

              <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Beer className="w-6 h-6 text-amber-500" />
                  Vasilhames na Venda
                </h2>
                
                {requiredBottles.length > 0 && (
                  <div className="mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <p className="text-xs text-amber-500 font-bold uppercase tracking-wider mb-2">Exigidos por esta venda:</p>
                    <div className="flex flex-col gap-1.5">
                      {requiredBottles.map(rb => {
                        const type = bottleTypes.find(t => t.id === rb.bottleTypeId);
                        return (
                          <div key={rb.bottleTypeId} className="flex justify-between items-center text-sm">
                            <span className="text-amber-100 flex items-center gap-1.5">
                              <Beer className="w-3.5 h-3.5 text-amber-500" />
                              {type?.name}
                            </span>
                            <span className="font-bold text-amber-400 text-base">{rb.quantity}x</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-2 mb-3">
                  <select
                    id="bottleTypeSelect"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-xs"
                  >
                    <option value="">Selecione o Vasilhame Devolvido...</option>
                    {bottleTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      id="bottleReturnQtyInput"
                      type="number"
                      min="0"
                      placeholder="Trouxe Qtd"
                      title="Quantidade que o cliente está devolvendo (Entrada na Loja)"
                      className="w-24 px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors text-xs text-center"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const typeSelect = document.getElementById('bottleTypeSelect');
                        const returnInput = document.getElementById('bottleReturnQtyInput');
                        const typeId = parseInt(typeSelect.value);
                        const returnQty = parseInt(returnInput.value) || 0;
                        
                        if (typeId && returnQty > 0) {
                          addReturnedBottle(typeId, returnQty);
                          typeSelect.value = '';
                          returnInput.value = '';
                        }
                      }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-500 rounded-xl transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {returnedBottles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1 mt-3">Devolvidos agora:</p>
                    {returnedBottles.map(rb => {
                      const type = bottleTypes.find(t => t.id === rb.bottleTypeId);
                      return (
                        <div key={rb.bottleTypeId} className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Beer className="w-3.5 h-3.5 text-emerald-500" />
                            {type?.name}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono text-xs font-bold">
                              {rb.quantity}x
                            </span>
                            <button
                              onClick={() => removeReturnedBottle(rb.bottleTypeId)}
                              className="text-slate-500 hover:text-red-400 p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8">
              <button
                onClick={handleFinishSale}
                disabled={cart.length === 0 || isFinishing}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10 disabled:opacity-40 disabled:cursor-not-allowed text-sm uppercase tracking-wider"
              >
                {isFinishing ? 'Finalizando...' : 'Confirmar Venda (F2)'}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Modal de Comprovante de Sucesso */}
      {saleResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button
              onClick={() => setSaleResult(null)}
              className="absolute right-4 top-4 text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-white">Venda Concluída!</h3>
              <p className="text-slate-400 text-xs mt-1">Pedido registrado com sucesso.</p>

              {/* Box de comprovante resumido no modal */}
              <div className="w-full mt-6 bg-slate-950 border border-slate-850 p-4 rounded-xl text-left font-mono text-xs text-slate-300 space-y-2">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span>Pedido:</span>
                  <span className="text-white font-bold">#{saleResult.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Data/Hora:</span>
                  <span>{new Date(saleResult.createdAt).toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pagamento:</span>
                  <span>{translatePayment(saleResult.paymentMethod)}</span>
                </div>
                <div className="border-b border-slate-800 pb-1"></div>
                <div className="space-y-1">
                  {saleResult.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-slate-450">
                      <span>{item.product.name.substring(0, 20)} x{item.quantity}</span>
                      <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                {saleResult.discount > 0 && (
                  <div className="flex justify-between text-emerald-400 text-xs pt-1 border-t border-slate-800/60">
                    <span>Desconto:</span>
                    <span>- R$ {saleResult.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-slate-800 pt-2 flex justify-between font-bold text-amber-500 text-sm">
                  <span>Total:</span>
                  <span>R$ {saleResult.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="w-full mt-4 flex flex-col gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <label className="text-xs text-slate-400 font-semibold text-left">Enviar Comprovante (WhatsApp)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: (31) 99999-9999"
                    value={formatPhoneMask(whatsappNumber)}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleSendWhatsapp}
                    disabled={!whatsappNumber || whatsappNumber.replace(/\D/g, '').length < 10}
                    className="px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Enviar
                  </button>
                </div>
              </div>

              <div className="w-full grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={printReceipt}
                  className="py-2.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Comprovante
                </button>
                <button
                  onClick={() => setSaleResult(null)}
                  className="py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center cursor-pointer transition-colors"
                >
                  Nova Venda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
