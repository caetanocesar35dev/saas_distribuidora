import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  Beer, ShoppingCart, DollarSign, Package, History, LogOut, User, Users, BarChart3, Key, AlertTriangle, Coffee
} from 'lucide-react';
import { api } from './services/api';

import Login from './pages/Login';
import PDV from './pages/PDV';
import Caixa from './pages/Caixa';
import Estoque from './pages/Estoque';
import Historico from './pages/Historico';
import Comandas from './pages/Comandas';
import Clientes from './pages/Clientes';
import Dashboard from './pages/Dashboard';
import Usuarios from './pages/Usuarios';
import Vasilhames from './pages/Vasilhames';

// Componente para proteção de rotas
function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Layout Base com Sidebar
function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('USER');

  // Change Password States
  const [passwordModal, setPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserName(user.name || 'Operador');
      setUserRole(user.role || 'USER');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      return setPasswordError('A nova senha e a confirmação não conferem.');
    }
    if (newPassword.length < 6) {
      return setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
    }

    setPasswordLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Senha alterada com sucesso!');
    } catch (err) {
      setPasswordError(err.message || 'Erro ao alterar a senha.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const menuItems = [
    ...(userRole === 'ADMIN' ? [{ path: '/dashboard', label: 'Painel Inicial', icon: BarChart3 }] : []),
    { path: '/pdv', label: 'Registrar Venda', icon: ShoppingCart },
    { path: '/caixa', label: 'Controle de Caixa', icon: DollarSign },
    { path: '/estoque', label: 'Estoque / Produtos', icon: Package },
    { path: '/comandas', label: 'Comandas', icon: Coffee },
    { path: '/historico', label: 'Histórico de Vendas', icon: History },
    { path: '/clientes', label: 'Clientes', icon: Users },
    { path: '/vasilhames', label: 'Vasilhames', icon: Package },
    ...(userRole === 'ADMIN' ? [{ path: '/usuarios', label: 'Usuários', icon: User }] : [])
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900/60 backdrop-blur-xl border-r border-slate-800 flex flex-col justify-between shrink-0">
        
        {/* Topo / Logo */}
        <div>
          <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800/80">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Beer className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm tracking-tight text-white uppercase">Distribuidora</h2>
              <p className="text-[10px] font-semibold text-amber-500/80 tracking-wide uppercase">Painel de Controle</p>
            </div>
          </div>

          {/* Links do Menu */}
          <nav className="p-4 space-y-1.5">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3.5 px-4.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive 
                      ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/10' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-850/60'
                  }`}
                >
                  <Icon className="w-5 h-5 stroke-[1.8]" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Rodapé / Operador & Logout */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-slate-950/40 rounded-xl border border-slate-850">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-slate-450" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{userName}</p>
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                {userRole === 'ADMIN' ? 'Administrador' : 'Operador'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPasswordModal(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer uppercase tracking-wider"
            >
              <Key className="w-4 h-4" />
              <span>Senha</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 hover:border-transparent rounded-xl text-[10px] font-bold transition-all cursor-pointer uppercase tracking-wider"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col">
        {/* Background Decorative Gradients */}
        <div className="absolute top-[-30%] right-[-10%] w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-30%] left-[-10%] w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none" />
        
        {/* Renderização de Conteúdo */}
        <div className="flex-1 z-10 overflow-hidden">
          <Routes>
            <Route path="/dashboard" element={userRole === 'ADMIN' ? <Dashboard /> : <Navigate to="/pdv" replace />} />
            <Route path="/pdv" element={<PDV />} />
            <Route path="/caixa" element={<Caixa />} />
            <Route path="/estoque" element={<Estoque />} />
            <Route path="/comandas" element={<Comandas />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/vasilhames" element={<Vasilhames />} />
            <Route path="/usuarios" element={userRole === 'ADMIN' ? <Usuarios /> : <Navigate to="/pdv" replace />} />
            <Route path="*" element={<Navigate to={userRole === 'ADMIN' ? "/dashboard" : "/pdv"} replace />} />
          </Routes>
        </div>

        {/* Change Password Modal */}
        {passwordModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-full">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Key className="w-6 h-6 text-amber-500" />
                  Mudar Minha Senha
                </h2>
                <button onClick={() => setPasswordModal(false)} className="text-slate-500 hover:text-white transition-colors">
                  <span className="text-xl font-bold">×</span>
                </button>
              </div>
              
              <form onSubmit={handleChangePassword} className="p-6 flex flex-col gap-4 overflow-y-auto">
                {passwordError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {passwordError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300 ml-1">Senha Atual</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300 ml-1">Nova Senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300 ml-1">Confirme a Nova Senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setPasswordModal(false)}
                    className="px-5 py-2.5 rounded-xl text-slate-300 font-bold hover:bg-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="px-6 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
                  >
                    {passwordLoading ? 'Salvando...' : 'Atualizar Senha'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/*" 
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        } 
      />
    </Routes>
  );
}
