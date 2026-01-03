
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
import { Menu } from 'lucide-react';

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

  useEffect(() => {
    const savedSession = sessionStorage.getItem('pcn_session');
    if (savedSession) {
      const { name, role, id } = JSON.parse(savedSession);
      setUserName(name);
      setUserRole(role);
      setUserId(id);
      setIsAuthenticated(true);
      // Mantemos false para forçar reidratação ao abrir o app
      setIsHydrated(false); 
      setCurrentView(role === 'admin' ? 'admin-dashboard' : 'dashboard');
    }
    setIsCheckingAuth(false);
  }, []);

  const handleLogin = (name: string, role: 'admin' | 'rep', id: string) => {
    setUserName(name);
    setUserRole(role);
    setUserId(id);
    setIsAuthenticated(true);
    sessionStorage.setItem('pcn_session', JSON.stringify({ name, role, id }));
    if (role === 'rep') checkAndMarkDeliveredNotifications();
  };

  const handleLogout = async () => {
    if (userId) {
      await supabase.from('usuarios').update({ status_online: false }).eq('id', userId);
    }
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
  
  // Nova etapa: Hidratação do Banco de Dados
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

      {/* Header Mobile */}
      <header className="lg:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-[40] shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">CN</div>
          <span className="font-bold text-sm tracking-tight">Portal Centro-Norte</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 hover:bg-slate-800 rounded-xl transition-colors"
        >
          <Menu className="w-6 h-6 text-slate-200" />
        </button>
      </header>

      {userRole === 'rep' && <UrgentNoticeModal />}

      <main className="flex-1 min-h-screen bg-slate-50 lg:ml-64 transition-all duration-300">
        <div className="p-4 md:p-8">
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
