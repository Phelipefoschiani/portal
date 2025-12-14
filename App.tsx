import React, { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { ClientsScreen } from './components/ClientsScreen';
import { ForecastScreen } from './components/ForecastScreen';
import { Sidebar } from './components/Sidebar';
import { supabase, isSupabaseConfigured } from './lib/supabase';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Efeito para verificar sessão
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsCheckingAuth(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsAuthenticated(true);
      }
      setIsCheckingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
    setCurrentView('dashboard');
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
      />
      
      {/* Main Content Area - Margem esquerda fixa para acomodar a Sidebar */}
      <main className="flex-1 ml-64 min-h-screen overflow-y-auto bg-slate-50">
        <div className="p-8">
           {currentView === 'dashboard' && <Dashboard />}
           {currentView === 'clients' && <ClientsScreen />}
           {currentView === 'forecast' && <ForecastScreen />}
        </div>
      </main>
    </div>
  );
};

export default App;