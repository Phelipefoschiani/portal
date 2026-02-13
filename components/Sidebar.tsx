
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, LogOut, TrendingUp, Bell, Wallet, Megaphone, UserCircle, ShieldCheck, Target, FileUp, LucideIcon, AlertCircle, BarChart3, Lock, Key, Eye, EyeOff, CheckCircle2, X, Menu, Table2, Trophy, PackageSearch } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  onLogout: () => void;
  userName: string;
  userRole: 'admin' | 'rep';
  isOpen: boolean;
  onToggle: (state: boolean) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  hasAlert?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onChangeView, 
  onLogout,
  userName,
  userRole,
  isOpen,
  onToggle
}) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [forecastAlert, setForecastAlert] = useState(false);
  const [investmentAlert, setInvestmentAlert] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  const formattedName = userName
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  useEffect(() => {
    if (userId) {
        const fetchStatus = async () => {
            const { count } = await supabase
                .from('notificacoes')
                .select('*', { count: 'exact', head: true })
                .eq('para_usuario_id', userId)
                .eq('lida', false);
            setUnreadCount(count || 0);

            if (userRole === 'rep') {
                const { data: rejForecast } = await supabase.from('previsao_clientes').select('id, previsoes!inner(usuario_id)').eq('status', 'rejected').eq('previsoes.usuario_id', userId);
                setForecastAlert(!!(rejForecast && rejForecast.length > 0));
                const { data: rejInv } = await supabase.from('investimentos').select('id').eq('status', 'rejected').eq('usuario_id', userId);
                if (rejInv && rejInv.length > 0) {
                    const seenIds = JSON.parse(localStorage.getItem('pcn_seen_inv_rejections') || '[]');
                    const hasUnseenRejection = rejInv.some(inv => !seenIds.includes(inv.id));
                    setInvestmentAlert(hasUnseenRejection);
                } else {
                    setInvestmentAlert(false);
                }
            } else if (userRole === 'admin') {
                const { data: penForecast } = await supabase.from('previsao_clientes').select('id').eq('status', 'pending');
                setForecastAlert(!!(penForecast && penForecast.length > 0));
                const { data: penInv } = await supabase.from('investimentos').select('id').eq('status', 'pendente');
                setInvestmentAlert(!!(penInv && penInv.length > 0));
            }
        };
        fetchStatus();
        const interval = setInterval(fetchStatus, 10000); 
        return () => clearInterval(interval);
    }
  }, [userId, userRole, currentView]);

  const repMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'rep-analysis', label: 'Análise de Metas', icon: BarChart3 },
    { id: 'rep-bi-builder', label: 'Construtor de BI', icon: Table2 },
    { id: 'clients', label: 'Meus Clientes', icon: Users },
    { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
    { id: 'forecast', label: 'Previsão', icon: TrendingUp, hasAlert: forecastAlert },
    { id: 'investments', label: 'Investimentos', icon: Wallet, hasAlert: investmentAlert },
    { id: 'notifications', label: 'Notificações', icon: Bell, badge: unreadCount },
  ];

  const adminMenuItems: MenuItem[] = [
    { id: 'admin-dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'admin-analysis', label: 'Análise Performance', icon: BarChart3 },
    { id: 'admin-detailed-analysis', label: 'Construtor de BI', icon: Table2 },
    { id: 'admin-product-analysis', label: 'Análise de Produtos', icon: PackageSearch },
    { id: 'admin-import', label: 'Importar Faturamento', icon: FileUp },
    { id: 'admin-targets', label: 'Definição de Metas', icon: Target },
    { id: 'admin-clients', label: 'Carteira Total', icon: Users },
    { id: 'admin-campaigns', label: 'Análise Campanhas', icon: ShieldCheck, hasAlert: investmentAlert },
    { id: 'admin-forecast', label: 'Previsões Enviadas', icon: TrendingUp, hasAlert: forecastAlert },
    { id: 'admin-notifications', label: 'Gestão Notificações', icon: Bell },
    { id: 'admin-users', label: 'Gestão Acessos', icon: Lock },
    { id: 'admin-scorecard', label: 'Score Card', icon: Trophy },
  ];

  const menuItems = userRole === 'admin' ? adminMenuItems : repMenuItems;

  const handleMenuClick = (id: string) => {
    onChangeView(id);
    if (window.innerWidth < 1024) {
      onToggle(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45] lg:hidden animate-fadeIn"
          onClick={() => onToggle(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-inner shrink-0">CN</div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-none tracking-tight text-slate-100 truncate">Centro-Norte</h1>
              <p className="text-[10px] text-blue-400 font-semibold mt-1 uppercase tracking-widest leading-tight">
                  {userRole === 'admin' ? 'Gerência Regional' : 'Portal do Representante'}
              </p>
            </div>
          </div>
          <button onClick={() => onToggle(false)} className="lg:hidden p-2 hover:bg-slate-800 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group relative ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.hasAlert && <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>}
                  {item.badge !== undefined && item.badge > 0 && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-[10px] font-bold text-white">{item.badge}</span>}
                </div>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div 
            onClick={() => { setShowPasswordModal(true); if(window.innerWidth < 1024) onToggle(false); }}
            className="flex items-center gap-3 px-4 py-3 mb-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl cursor-pointer transition-all group"
          >
             <UserCircle className="w-5 h-5 group-hover:text-blue-400" />
             <div className="min-w-0">
               <span className="text-xs font-bold truncate block">{formattedName}</span>
               <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-blue-500/70">Alterar Senha</span>
             </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200">
            <LogOut className="w-5 h-5" />
            <span className="font-medium text-sm">Sair</span>
          </button>
        </div>
      </aside>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} userId={userId} />}
    </>
  );
};

const ChangePasswordModal: React.FC<{ onClose: () => void, userId: string }> = ({ onClose, userId }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (newPassword !== confirmPassword) {
            setError('A nova senha e a confirmação não coincidem.');
            return;
        }

        if (newPassword.length < 4) {
            setError('A nova senha deve ter pelo menos 4 caracteres.');
            return;
        }

        setIsLoading(true);
        try {
            const { data: user, error: checkError } = await supabase
                .from('usuarios')
                .select('id')
                .eq('id', userId)
                .eq('senha_hash', oldPassword)
                .single();

            if (checkError || !user) {
                setError('Senha atual incorreta.');
                setIsLoading(false);
                return;
            }

            const { error: updateError } = await supabase
                .from('usuarios')
                .update({ senha_hash: newPassword })
                .eq('id', userId);

            if (updateError) throw updateError;

            setSuccess(true);
            setTimeout(() => onClose(), 2000);
        } catch (e: any) {
            setError('Erro ao atualizar senha.');
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
            <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-slideUp border border-white/20">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Lock className="w-5 h-5" /></div>
                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-sm">Segurança</h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-8">
                    {success ? (
                        <div className="text-center py-10 space-y-4 animate-fadeIn">
                            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Senha Alterada!</h4>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Suas credenciais foram sincronizadas.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdate} className="space-y-5">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Senha Atual</label>
                                    <div className="relative">
                                        <input 
                                            type={showPass ? "text" : "password"} 
                                            value={oldPassword} 
                                            onChange={e => setOldPassword(e.target.value)}
                                            required
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                            placeholder="••••••••"
                                        />
                                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-50">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Nova Senha</label>
                                    <input 
                                        type="password" 
                                        value={newPassword} 
                                        onChange={e => setNewPassword(e.target.value)}
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                        placeholder="Min. 4 caracteres"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Confirmar Nova Senha</label>
                                    <input 
                                        type="password" 
                                        value={confirmPassword} 
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                        placeholder="Repita a nova senha"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-fadeIn">
                                    <AlertCircle className="w-4 h-4" /> {error}
                                </div>
                            )}

                            <Button type="submit" isLoading={isLoading} fullWidth className="h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20">
                                <Key className="w-4 h-4 mr-2" /> Salvar Nova Senha
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
