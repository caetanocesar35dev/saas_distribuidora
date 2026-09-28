import { useState, useEffect } from 'react';
import { Users, UserPlus, Power, AlertTriangle, Briefcase, Mail, Lock, User as UserIcon, Shield, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';

export default function Usuarios() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'USER' });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [resetModal, setResetModal] = useState({ show: false, userId: null, userName: '' });
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/auth/users');
      setUsers(response);
    } catch (err) {
      setError(err.message || 'Erro ao carregar usuários. Apenas administradores têm acesso.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (userId) => {
    try {
      await api.patch(`/auth/users/${userId}/toggle-active`);
      fetchUsers(); // Recarrega os dados após alterar
    } catch (err) {
      alert(err.message || 'Erro ao alterar status do usuário');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      await api.post('/auth/register', formData);
      setShowModal(false);
      setFormData({ name: '', email: '', password: '', role: 'USER' });
      fetchUsers();
    } catch (err) {
      setFormError(err.message || 'Erro ao cadastrar usuário');
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword) return;
    setFormError('');
    setResetLoading(true);
    try {
      await api.post(`/auth/users/${resetModal.userId}/reset-password`, { newPassword });
      setResetModal({ show: false, userId: null, userName: '' });
      setNewPassword('');
      alert('Senha redefinida com sucesso!');
    } catch (err) {
      setFormError(err.message || 'Erro ao redefinir senha');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 p-6 md:p-8 space-y-6 overflow-y-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3 tracking-tight">
            <Users className="w-8 h-8 text-amber-500" />
            Gestão de Usuários
          </h1>
          <p className="text-slate-400 mt-1 text-sm font-medium">Cadastre e gerencie os operadores do sistema</p>
        </div>
        
        <button
          onClick={() => setShowModal(true)}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <UserPlus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Lista de Usuários */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-5 font-semibold">Usuário</th>
                <th className="p-5 font-semibold">Contato</th>
                <th className="p-5 font-semibold">Nível</th>
                <th className="p-5 font-semibold">Status</th>
                <th className="p-5 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">Carregando usuários...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">Nenhum usuário encontrado.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className={`transition-colors hover:bg-slate-800/30 ${!user.isActive ? 'opacity-60 grayscale' : ''}`}>
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                          ${user.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-300'}`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white font-bold">{user.name}</p>
                          <p className="text-xs text-slate-500">Adicionado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-2 text-slate-300 text-sm">
                        <Mail className="w-4 h-4 text-slate-500" />
                        {user.email}
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
                        ${user.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                        {user.role === 'ADMIN' ? <Shield className="w-3.5 h-3.5" /> : <Briefcase className="w-3.5 h-3.5" />}
                        {user.role === 'ADMIN' ? 'ADMIN' : 'OPERADOR'}
                      </span>
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
                        ${user.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {user.isActive ? 'Ativo' : 'Desativado'}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <button
                        onClick={() => handleToggleActive(user.id)}
                        className={`inline-flex items-center justify-center p-2 rounded-xl transition-colors
                          ${user.isActive 
                            ? 'bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400' 
                            : 'bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400'}`}
                        title={user.isActive ? 'Desativar usuário' : 'Ativar usuário'}
                      >
                        <Power className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setResetModal({ show: true, userId: user.id, userName: user.name })}
                        className="inline-flex items-center justify-center p-2 rounded-xl transition-colors bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 ml-2"
                        title="Redefinir Senha"
                      >
                        <Lock className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Registro */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-amber-500" />
                Novo Usuário
              </h2>
            </div>
            
            <form onSubmit={handleRegister} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nome Completo</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                    placeholder="João da Silva"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                    placeholder="joao@distribuidora.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Senha Provisória</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength="6"
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-12 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                    placeholder="******"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-500 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nível de Acesso</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, role: 'USER'})}
                    className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                      formData.role === 'USER' 
                      ? 'bg-slate-800 border-slate-700 text-white' 
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    Operador
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, role: 'ADMIN'})}
                    className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                      formData.role === 'ADMIN' 
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400' 
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    Admin
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-5 py-3 rounded-xl font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20"
                >
                  {formLoading ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nova Senha (Reset) */}
      {resetModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-full">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Lock className="w-6 h-6 text-amber-500" />
                Redefinir Senha
              </h2>
              <button onClick={() => setResetModal({ show: false, userId: null, userName: '' })} className="text-slate-500 hover:text-white transition-colors">
                <AlertTriangle className="w-6 h-6 opacity-0" />
                <span className="sr-only">Fechar</span>
                X
              </button>
            </div>
            
            <form onSubmit={handleResetPassword} className="p-6 flex flex-col gap-5 overflow-y-auto">
              <p className="text-sm text-slate-400">
                Digite a nova senha para o usuário <strong className="text-white">{resetModal.userName}</strong>.
              </p>

              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-300 ml-1">Nova Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="w-5 h-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setResetModal({ show: false, userId: null, userName: '' })}
                  className="px-5 py-2.5 rounded-xl text-slate-300 font-bold hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-6 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20"
                >
                  {resetLoading ? 'Salvando...' : 'Salvar Senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
