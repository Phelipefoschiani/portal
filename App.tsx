
import React, { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { ClientsScreen } from './components/ClientsScreen';
import { ForecastScreen } from './components/ForecastScreen';
import { NotificationsScreen } from './components/NotificationsScreen';
import { InvestmentsScreen } from './components/InvestmentsScreen';
import { CampaignsScreen } from './components/CampaignsScreen';
import { UrgentNoticeModal } from './components/UrgentNoticeModal';
import { Sidebar } from './components/Sidebar';
import { supabase } from './lib/supabase';
import { checkAndMarkDeliveredNotifications } from './lib/mockData';

// Manager Screens
import { ManagerDashboard } from './components/manager/ManagerDashboard';
import { ManagerCampaignsScreen } from './components/manager/ManagerCampaignsScreen';
import { ManagerForecastScreen } from './components/manager/ManagerForecastScreen';
import { ManagerNotificationsScreen } from './components/manager/ManagerNotificationsScreen';
import { ManagerClientsScreen } from './components/manager/ManagerClientsScreen';
import { ManagerTargetsScreen } from './components/manager/ManagerTargetsScreen';
import { ManagerImportScreen } from './components/manager/ManagerImportScreen';
import { ManagerAnalysisScreen } from './components/manager/ManagerAnalysisScreen';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userName, setUserName] = useState('Visitante'); 
  const [userRole, setUserRole] = useState<'admin' | 'rep'>('rep');
  const [userId, setUserId] = useState<string | null>(null);
  const [forecastToEditId, setForecastToEditId] = useState<string | null>(null);

  useEffect(() => {
    const savedSession = sessionStorage.getItem('pcn_session');
    if (savedSession) {
      const { name, role, id } = JSON.parse(savedSession);
      setUserName(name);
      setUserRole(role);
      setUserId(id);
      setIsAuthenticated(true);
      setCurrentView(role === 'admin' ? 'admin-dashboard' : 'dashboard');
    }
    setIsCheckingAuth(false);
  }, []);

  const handleLogin = (name: string, role: 'admin' | 'rep', id: string) => {
    setUserName(name);
    setUserRole(role);
    setUserId(id);
    setIsAuthenticated(true);
    setCurrentView(role === 'admin' ? 'admin-dashboard' : 'dashboard');
    sessionStorage.setItem('pcn_session', JSON.stringify({ name, role, id }));
    if (role === 'rep') checkAndMarkDeliveredNotifications();
  };

  const handleLogout = async () => {
    if (userId) {
      await supabase.from('usuarios').update({ status_online: false }).eq('id', userId);
    }
    sessionStorage.removeItem('pcn_session');
    setIsAuthenticated(false);
    setCurrentView('dashboard');
    setUserRole('rep');
    setUserId(null);
  };

  const handleNavigateToForecastCorrection = (forecastId: string) => {
    setForecastToEditId(forecastId);
    setCurrentView('forecast');
  };

  if (isCheckingAuth) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-inter">Iniciando Portal...</div>;
  if (!isAuthenticated) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-slate-50 flex font-inter">
      <Sidebar currentView={currentView} onChangeView={setCurrentView} onLogout={handleLogout} userName={userName} userRole={userRole} />
      {userRole === 'rep' && <UrgentNoticeModal />}
      <main className="flex-1 ml-64 min-h-screen overflow-y-auto bg-slate-50">
        <div className="p-8">
           {userRole === 'rep' && (
               <>
                {currentView === 'dashboard' && <Dashboard />}
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
