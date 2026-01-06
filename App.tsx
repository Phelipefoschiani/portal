
import React, { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { ClientsScreen } from './components/ClientsScreen';
import { ForecastScreen } from './components/ForecastScreen';
import { NotificationsScreen } from './components/NotificationsScreen';
import { InvestmentsScreen } from './components/InvestmentsScreen';
import { CampaignsScreen } from './components/CampaignsScreen';
import { UrgentNoticeModal } from './components/UrgentNoticeModal';
import { HydrationScreen } from './components/HydrationScreen';
import { Sidebar } from './components/Sidebar';
import { supabase } from './lib/supabase';
import { checkAndMarkDeliveredNotifications } from './lib/mockData';
import { Menu, AlertTriangle, X } from 'lucide-react';
import { createPortal } from 'react-dom';

// Rep Screens
import { RepAnalysisScreen } from './components/rep/RepAnalysisScreen';

// Manager Screens
import { ManagerDashboard } from './components/manager/ManagerDashboard';
import { ManagerCampaignsScreen } from './components/manager/ManagerCampaignsScreen';
import { ManagerForecastScreen } from './components/manager/ManagerForecastScreen';
import { ManagerNotificationsScreen } from './components/manager/ManagerNotificationsScreen';
import { ManagerClientsScreen } from './components/manager/ManagerClientsScreen';
import { ManagerTargetsScreen } from './components/manager/ManagerTargetsScreen';
import { ManagerImportScreen } from './components/manager/ManagerImportScreen';
import { ManagerAnalysisScreen } from './components/manager/ManagerAnalysisScreen';
import { ManagerDetailedAnalysisScreen } from './components/manager/ManagerDetailedAnalysisScreen';
import { ManagerUsersScreen } from './components/manager/ManagerUsersScreen';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userName, setUserName] = useState('Visitante'); 
  const [userRole, setUserRole] = useState<'admin' | 'rep'>('rep');
  const [userId, setUserId] = useState<string | null>(null);
  const [forecastToEditId, setForecastToEditId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showImportantNotice, setShowImportantNotice] = useState(false);

  useEffect(() => {
    const savedSession = sessionStorage.getItem('pcn_session');
    if (savedSession) {
      const { name, role, id } = JSON.parse(savedSession);
      setUserName(name);
      setUserRole(role);
      setUserId(id);
      setIsAuthenticated(true);
      setIsHydrated(false); 
      setCurrentView(role === 'admin' ? 'admin-dashboard' : 'dashboard');
      
      if (role === 'rep') {
          const timer = setTimeout(() => checkImportantNotices(id), 5 * 60 * 1000);
          return () => clearTimeout(timer);
      }
    }
    setIsCheckingAuth(false);

    const handleNav = (e: any) => {
        if (e.detail) setCurrentView(e.detail);
    };
    window.addEventListener('pcn_navigate', handleNav);
    return () => window.removeEventListener('pcn_navigate', handleNav);
  }, []);

  const checkImportantNotices = async (uid: string) => {
      try {
          const { data } = await supabase
              .from('notificacoes')
              .select('id')
              .eq('para_usuario_id', uid)
              .eq('prioridade', 'medium')
              .eq('lida', false);
          
          if (data && data.length > 0) {
              setShowImportantNotice(true);
          }
      } catch (e) {
          console.error(e);
      }
  };

  const handleLogin = (name: string, role: 'admin' | 'rep', id: string) => {
    setUserName(name);
    setUserRole(role);
    setUserId(id);
    setIsAuthenticated(true);
    setCurrentView(role === 'admin' ? 'admin-dashboard' : 'dashboard');
    sessionStorage.setItem('pcn_session', JSON.stringify({ name, role, id }));
    if (role === 'rep') {
        checkAndMarkDeliveredNotifications();
        setTimeout(() => checkImportantNotices(id), 5 * 60 * 1000);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('pcn_session');
    setIsAuthenticated(false);
    setIsHydrated(false);
    setCurrentView('dashboard');
    setUserRole('rep');
    setUserId(null);
    setIsSidebarOpen(false);
  };

  const handleNavigateToForecastCorrection = (forecastId: string) => {
    setForecastToEditId(forecastId);
    setCurrentView('forecast');
  };

  if (isCheckingAuth) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-inter">Iniciando Portal...</div>;
  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />;
  
  if (!isHydrated && userId) {
    return <HydrationScreen userId={userId} userRole={userRole} onComplete={() => setIsHydrated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-inter overflow-x-hidden">
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        onLogout={handleLogout} 
        userName={userName} 
        userRole={userRole}
        isOpen={isSidebarOpen}
        onToggle={setIsSidebarOpen}
      />

      {/* Header Mobile - AGORA FIXO */}
      <header className="lg:hidden bg-slate-900/95 backdrop-blur-md text-white p-4 flex items-center justify-between sticky top-0 z-[100] shadow-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-lg shadow-blue-500/20">CN</div>
          <span className="font-black text-xs uppercase tracking-tighter italic">Portal <span className="text-blue-500">CN</span></span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10"
        >
          <Menu className="w-5 h-5 text-slate-200" />
        </button>
      </header>

      {userRole === 'rep' && <UrgentNoticeModal />}

      {showImportantNotice && createPortal(
          <div className="fixed bottom-6 right-6 z-[180] animate-slideUp">
              <div className="bg-amber-600 text-white p-5 rounded-[24px] shadow-2xl flex items-center gap-4 max-w-sm border border-amber-500 ring-4 ring-amber-100">
                  <div className="p-3 bg-amber-500 rounded-xl">
                      <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                      <h4 className="font-black text-xs uppercase tracking-widest">Comunicado Importante</h4>
                      <p className="text-[10px] font-bold opacity-90 mt-1">Existem avisos importantes pendentes. Por favor, verifique seu mural.</p>
                  </div>
                  <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => { setCurrentView('notifications'); setShowImportantNotice(false); }}
                        className="p-2 bg-white/20 hover:bg-white/40 rounded-lg transition-all"
                      >
                          <Menu className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setShowImportantNotice(false)}
                        className="p-2 bg-black/20 hover:bg-black/40 rounded-lg transition-all"
                      >
                          <X className="w-4 h-4" />
                      </button>
                  </div>
              </div>
          </div>,
          document.body
      )}

      <main className="flex-1 min-h-screen bg-slate-50 lg:ml-64 transition-all duration-300">
        <div className="p-3 md:p-8">
           {userRole === 'rep' && (
               <>
                {currentView === 'dashboard' && <Dashboard />}
                {currentView === 'rep-analysis' && <RepAnalysisScreen />}
                {currentView === 'rep-bi-builder' && <ManagerDetailedAnalysisScreen />}
                {currentView === 'clients' && <ClientsScreen />}
                {currentView === 'campaigns' && <CampaignsScreen onNavigateToInvestments={() => setCurrentView('investments')} />}
                {currentView === 'forecast' && <ForecastScreen />}
                {currentView === 'investments' && <InvestmentsScreen />}
                {currentView === 'notifications' && <NotificationsScreen onFixForecast={handleNavigateToForecastCorrection} />}
               </>
           )}
           {userRole === 'admin' && (
               <>
                {currentView === 'admin-dashboard' && <ManagerDashboard />}
                {currentView === 'admin-import' && <ManagerImportScreen />}
                {currentView === 'admin-analysis' && <ManagerAnalysisScreen />}
                {currentView === 'admin-detailed-analysis' && <ManagerDetailedAnalysisScreen />}
                {currentView === 'admin-campaigns' && <ManagerCampaignsScreen />}
                {currentView === 'admin-forecast' && <ManagerForecastScreen />}
                {currentView === 'admin-notifications' && <ManagerNotificationsScreen />}
                {currentView === 'admin-users' && <ManagerUsersScreen />}
                {currentView === 'admin-clients' && <ManagerClientsScreen />}
                {currentView === 'admin-targets' && <ManagerTargetsScreen />}
               </>
           )}
        </div>
      </main>
    </div>
  );
};

export default App;
