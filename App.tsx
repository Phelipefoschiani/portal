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
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { checkAndMarkDeliveredNotifications } from './lib/mockData';

// Manager Screens
import { ManagerDashboard } from './components/manager/ManagerDashboard';
import { ManagerCampaignsScreen } from './components/manager/ManagerCampaignsScreen';
import { ManagerForecastScreen } from './components/manager/ManagerForecastScreen';
import { ManagerNotificationsScreen } from './components/manager/ManagerNotificationsScreen';
import { ManagerClientsScreen } from './components/manager/ManagerClientsScreen';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [userName, setUserName] = useState('Representante'); 
  const [userRole, setUserRole] = useState<'admin' | 'rep'>('rep'); // Estado da Role
  
  // Estado para navegação com contexto (Correção de Previsão)
  const [forecastToEditId, setForecastToEditId] = useState<string | null>(null);

  // Efeito para verificar sessão
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsCheckingAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
        setUserName(session.user.user_metadata?.full_name || 'Ricardo Souza');
        // Check Role (Mocked for now in Supabase context or logic)
        // checkAndMarkDeliveredNotifications(); // Only for reps
      }
      setIsCheckingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
         setIsAuthenticated(true);
         setUserName(session.user.user_metadata?.full_name || 'Ricardo Souza');
      } else {
         setIsAuthenticated(false);
         setUserName('Representante');
         setUserRole('rep');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = (name: string, role: 'admin' | 'rep') => {
    setUserName(name);
    setUserRole(role);
    setIsAuthenticated(true);
    
    // Se for admin, dashboard inicial é diferente
    setCurrentView(role === 'admin' ? 'admin-dashboard' : 'dashboard');

    if (role === 'rep') {
        checkAndMarkDeliveredNotifications();
    }
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
    setCurrentView('dashboard');
    setUserRole('rep');
  };

  // Handler para navegar da Notificação para a Previsão em modo de correção
  const handleNavigateToForecastCorrection = (forecastId: string) => {
    setForecastToEditId(forecastId);
    setCurrentView('forecast');
  };

  if (isCheckingAuth) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-inter">
      {/* Sidebar Navigation - Sempre visível no Desktop */}
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        onLogout={handleLogout}
        userName={userName}
        userRole={userRole}
      />
      
      {/* Apenas Reps veem o Modal Urgente ao entrar */}
      {userRole === 'rep' && <UrgentNoticeModal />}
      
      {/* Main Content Area - Margem esquerda fixa para acomodar a Sidebar */}
      <main className="flex-1 ml-64 min-h-screen overflow-y-auto bg-slate-50">
        <div className="p-8">
           {/* Telas do Representante */}
           {userRole === 'rep' && (
               <>
                {currentView === 'dashboard' && <Dashboard />}
                {currentView === 'clients' && <ClientsScreen />}
                {currentView === 'campaigns' && <CampaignsScreen />}
                
                {/* Passa o ID de edição e função de limpeza */}
                {currentView === 'forecast' && (
                  <ForecastScreen 
                    initialForecastId={forecastToEditId}
                    onDraftLoaded={() => setForecastToEditId(null)}
                  />
                )}
                
                {currentView === 'investments' && <InvestmentsScreen />}
                
                {/* Passa o handler de navegação */}
                {currentView === 'notifications' && (
                  <NotificationsScreen onFixForecast={handleNavigateToForecastCorrection} />
                )}
               </>
           )}

           {/* Telas do Gerente (Admin) */}
           {userRole === 'admin' && (
               <>
                {currentView === 'admin-dashboard' && <ManagerDashboard />}
                {currentView === 'admin-campaigns' && <ManagerCampaignsScreen />}
                {currentView === 'admin-forecast' && <ManagerForecastScreen />}
                {currentView === 'admin-notifications' && <ManagerNotificationsScreen />}
                {currentView === 'admin-clients' && <ManagerClientsScreen />}
               </>
           )}
        </div>
      </main>
    </div>
  );
};

export default App;