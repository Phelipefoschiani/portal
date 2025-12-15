import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, LogOut, TrendingUp, Bell, Wallet, Megaphone, UserCircle, ShieldCheck } from 'lucide-react';
import { getUnreadCount, mockNotifications } from '../lib/mockData';

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  onLogout: () => void;
  userName: string;
  userRole: 'admin' | 'rep';
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  onChangeView, 
  onLogout,
  userName,
  userRole
}) => {
  const [logoError, setLogoError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
        // Se for admin, pode ver quantos leram (lógica diferente) ou notificações do sistema
        // Para simplificar, o admin vê tudo
        if (userRole === 'rep') {
             setUnreadCount(getUnreadCount());
        } else {
             setUnreadCount(0); // Admin vê painel de controle
        }
    };
    updateCount();
    const interval = setInterval(updateCount, 2000);
    return () => clearInterval(interval);
  }, [mockNotifications, userRole]);

  // Itens do Representante
  const repMenuItems: MenuItem[] = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'clients', label: 'Meus Clientes', icon: Users },
    { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
    { id: 'forecast', label: 'Previsão', icon: TrendingUp },
    { id: 'investments', label: 'Investimentos', icon: Wallet },
    { id: 'notifications', label: 'Notificações', icon: Bell, badge: unreadCount },
  ];

  // Itens do Gerente (Admin)
  const adminMenuItems: MenuItem[] = [
    { id: 'admin-dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'admin-clients', label: 'Carteira Global', icon: Users },
    { id: 'admin-campaigns', label: 'Análise Campanhas', icon: ShieldCheck }, // Aprovações
    { id: 'admin-forecast', label: 'Previsões Enviadas', icon: TrendingUp },
    { id: 'admin-notifications', label: 'Gestão Notificações', icon: Bell },
  ];

  const menuItems = userRole === 'admin' ? adminMenuItems : repMenuItems;

  return (
    <aside className="fixed top-0 left-0 z-40 h-screen w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800 shadow-2xl">
      {/* Logo Area */}
      <div className="p-6 border-b border-slate-800/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shadow-inner shrink-0">
            {!logoError ? (
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-contain p-1"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-xs font-bold text-blue-400">PCN</span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-none tracking-tight text-slate-100 truncate">Centro-Norte</h1>
            <p className="text-[10px] text-blue-400 font-semibold mt-0.5 uppercase tracking-widest">
                {userRole === 'admin' ? 'Gerência' : 'Portal'}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1 truncate flex items-center gap-1">
                <UserCircle className="w-3 h-3" />
                {userName}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-800">
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
};