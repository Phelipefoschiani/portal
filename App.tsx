import React, { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Dashboard } from './components/Dashboard';
import { ClientsScreen } from './components/ClientsScreen';
import { Sidebar } from './components/Sidebar';
import { supabase, isSupabaseConfigured } from './lib/supabase';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'clients'
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Efeito para verificar sessão
  useEffect(() => {
    // Se não tiver Supabase configurado (Modo Offline), não verificamos sessão na nuvem
    if (!isSupabaseConfigured) {
      setIsCheckingAuth(false);
      return;
    }

    // Modo Online: Verificar sessão atual
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
      {/* Sidebar Navigation */}
      <Sidebar 
        currentView={currentView} 
        onChangeView={setCurrentView} 
        onLogout={handleLogout} 
      />
      
      {/* Main Content Area */}
      <main className="flex-1 ml-64 min-h-screen overflow-y-auto transition-all">
        <div className="p-8">
           {currentView === 'dashboard' && <Dashboard />}
           {currentView === 'clients' && <ClientsScreen />}
        </div>
      </main>
    </div>
  );
};

export default App;