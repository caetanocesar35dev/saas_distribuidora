import { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  TrendingUp, TrendingDown, DollarSign, Lock, Unlock,
  ArrowUpRight, ArrowDownRight, History, Calendar, CheckCircle2, AlertTriangle
} from 'lucide-react';

export default function Caixa() {
  const [currentCash, setCurrentCash] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);

  // States para formulários
  const [initialBalance, setInitialBalance] = useState('0.00');
  const [movementType, setMovementType] = useState('IN');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDesc, setMovementDesc] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadCashData();
    loadHistory();
  }, []);

  const loadCashData = async () => {
    try {
      setLoading(true);
      const data = await api.get('/cash-register/current');
      setCurrentCash(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await api.get('/cash-register/history');
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpen = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const data = await api.post('/cash-register/open', {
        initialBalance: parseFloat(initialBalance) || 0
      });
      setSuccess('Caixa aberto com sucesso!');
      setCurrentCash(data);
      setInitialBalance('0.00');
      loadCashData();
    } catch (err) {
      setError(err.message || 'Erro ao abrir o caixa');
    }
  };

  const handleClose = async () => {
    if (!window.confirm('Tem certeza que deseja fechar o caixa?')) return;
    setError('');
    setSuccess('');
    try {
      await api.post('/cash-register/close');
      setSuccess('Caixa fechado com sucesso!');
      setCurrentCash(null);
      loadHistory();
      loadCashData();
    } catch (err) {
      setError(err.message || 'Erro ao fechar o caixa');
    }
  };

  const handleMovement = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!movementAmount || parseFloat(movementAmount) <= 0) {
      setError('Insira um valor válido maior que zero.');
      return;
    }

    try {
      await api.post('/cash-register/movement', {
        type: movementType,
        amount: parseFloat(movementAmount),
        description: movementDesc || (movementType === 'IN' ? 'Entrada manual' : 'Saida manual')
      });
      setSuccess('Movimentação registrada com sucesso!');
      setMovementAmount('');
      setMovementDesc('');
      loadCashData();
    } catch (err) {
      setError(err.message || 'Erro ao registrar movimentação');
    }
  };

  // Calcula saldo em tempo real do caixa ativo
  const calculateCurrentBalance = () => {
    if (!currentCash) return 0;
    let balance = currentCash.initialBalance;
    currentCash.movements.forEach(m => {
      if (m.type === 'IN' || m.type === 'SALE') {
        balance += m.amount;
      } else if (m.type === 'OUT') {
        balance -= m.amount;
      }
    });
    return balance;
  };

  const translateMovement = (type) => {
    const t = {
      IN: 'Entrada',
      OUT: 'Saida',
      SALE: 'Venda'
    };
    return t[type] || type;
  };

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center h-[calc(100vh-64px)] text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  const currentBalance = calculateCurrentBalance();

  return (
    <div className="flex-1 p-6 font-sans text-white h-[calc(100vh-64px)] overflow-y-auto space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="text-amber-500 w-7 h-7" />
          Fluxo de Caixa Diário
        </h1>
        <p className="text-slate-400 text-xs mt-1">Abertura, fechamento e movimentações de caixa</p>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-2 text-sm max-w-4xl mx-auto">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl flex items-center gap-2 text-sm max-w-4xl mx-auto">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-start">

        {/* Lado Esquerdo: Caixa Aberto ou Abertura (Col-span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {!currentCash ? (
            /* Formulário de Abertura */
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                  <Lock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Abrir Caixa Diário</h2>
                  <p className="text-slate-400 text-xs mt-0.5">Defina o fundo de troco inicial</p>
                </div>
              </div>

              <form onSubmit={handleOpen} className="space-y-4">
                <div>
                  <label className="block text-slate-350 text-xs font-semibold uppercase tracking-wider mb-2">Fundo de Troco (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={initialBalance}
                    onChange={(e) => {
                      const val = e.target.value.replace(',', '.');
                      if (val === '' || Number(val) >= 0) setInitialBalance(val);
                    }}
                    placeholder="100.00"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer text-sm uppercase tracking-wider shadow-lg shadow-amber-500/10"
                >
                  Confirmar Abertura
                </button>
              </form>
            </div>
          ) : (
            /* Caixa Ativo */
            <div className="space-y-6">
              {/* Cards de Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 rounded-2xl shadow-md">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Fundo Inicial</p>
                  <p className="text-2xl font-bold text-slate-300 mt-2">R$ {currentCash.initialBalance.toFixed(2)}</p>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 rounded-2xl shadow-md">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Saldo Atual</p>
                  <p className="text-2xl font-bold text-amber-500 mt-2">R$ {currentBalance.toFixed(2)}</p>
                </div>

                <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
                  <div>
                    <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Abertura</p>
                    <p className="text-xs text-white font-mono mt-2">
                      {new Date(currentCash.openedAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="mt-3 py-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent rounded-lg text-xs font-bold transition-all cursor-pointer uppercase"
                  >
                    Fechar Caixa
                  </button>
                </div>
              </div>

              {/* Movimentações do Dia */}
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="bg-slate-900/60 px-6 py-4 border-b border-slate-800">
                  <h3 className="font-bold text-sm tracking-wide uppercase text-slate-450">Extrato de Movimentações</h3>
                </div>

                <div className="divide-y divide-slate-800 max-h-[350px] overflow-y-auto">
                  {currentCash.movements.length === 0 ? (
                    <div className="p-8 text-center text-slate-550 text-sm">
                      Nenhuma movimentação registrada no caixa de hoje.
                    </div>
                  ) : (
                    currentCash.movements.map((mov) => {
                      const isSale = mov.type === 'SALE';
                      const isAddition = mov.type === 'IN';
                      return (
                        <div key={mov.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-900/20 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSale
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : isAddition
                                  ? 'bg-blue-500/10 text-blue-400'
                                  : 'bg-red-500/10 text-red-400'
                              }`}>
                              {isSale || isAddition ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">{mov.description}</p>
                              <p className="text-slate-500 text-[10px] mt-0.5 font-mono">
                                {translateMovement(mov.type)} • {new Date(mov.createdAt).toLocaleTimeString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <span className={`font-mono text-sm font-bold ${isSale || isAddition ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                            {isSale || isAddition ? '+' : '-'} R$ {mov.amount.toFixed(2)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lado Direito: Adicionar Movimentação Manual (Entrada/Saida) */}
        {currentCash && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
                <Unlock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Movimentação Manual</h2>
                <p className="text-slate-400 text-xs mt-0.5">Entrada ou saída de dinheiro</p>
              </div>
            </div>

            <form onSubmit={handleMovement} className="space-y-4">
              <div>
                <label className="block text-slate-350 text-xs font-semibold uppercase tracking-wider mb-2">Tipo de Movimento</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMovementType('IN')}
                    className={`py-2 px-4 border rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors ${movementType === 'IN'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                        : 'bg-slate-950 border-slate-850 text-slate-500'
                      }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-xs font-bold">Entrada</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('OUT')}
                    className={`py-2 px-4 border rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors ${movementType === 'OUT'
                        ? 'bg-red-500/10 border-red-500 text-red-400'
                        : 'bg-slate-950 border-slate-850 text-slate-500'
                      }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-xs font-bold">Saida</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-355 text-xs font-semibold uppercase tracking-wider mb-2">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={movementAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(',', '.');
                    if (val === '' || Number(val) >= 0) setMovementAmount(val);
                  }}
                  placeholder="0.00"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              <div>
                <label className="block text-slate-355 text-xs font-semibold uppercase tracking-wider mb-2">Descrição / Motivo</label>
                <input
                  type="text"
                  value={movementDesc}
                  onChange={(e) => setMovementDesc(e.target.value)}
                  placeholder="Ex: Troco inicial extra, Saida para almoço..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-colors text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-all cursor-pointer text-xs uppercase tracking-wider font-semibold"
              >
                Registrar Movimentação
              </button>
            </form>
          </div>
        )}

      </div>

      {/* Seção Histórico de Caixas Fechados */}
      <div className="max-w-6xl mx-auto bg-slate-900/20 border border-slate-800/80 rounded-2xl p-6 shadow-lg">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
          <History className="w-5 h-5 text-amber-500" />
          Histórico de Caixas Fechados
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {history.length === 0 ? (
            <div className="col-span-full py-8 text-center text-slate-550 text-sm">
              Nenhum caixa fechado no histórico.
            </div>
          ) : (
            history.map((box) => (
              <div key={box.id} className="bg-slate-950/80 border border-slate-850 p-5 rounded-xl flex flex-col justify-between gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-sm text-slate-200">Caixa #{box.id}</h3>
                    <p className="text-slate-500 text-[10px] mt-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(box.openedAt).toLocaleDateString('pt-BR')} {new Date(box.openedAt).toLocaleTimeString('pt-BR')} às {new Date(box.closedAt).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                  <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">FECHADO</span>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-3 rounded-lg text-xs">
                  <div>
                    <span className="text-slate-500 block">Fundo Inicial</span>
                    <span className="font-semibold text-slate-350">R$ {box.initialBalance.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Saldo Final</span>
                    <span className="font-semibold text-emerald-400">R$ {box.finalBalance?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
