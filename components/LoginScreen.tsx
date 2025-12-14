import React, { useState } from 'react';
import { User, Lock, ArrowRight, Check } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { supabase, INTERNAL_DOMAIN, isSupabaseConfigured } from '../lib/supabase';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Tenta Login via Supabase se estiver configurado
      if (isSupabaseConfigured) {
        // Se o usuário não digitou um email completo, adiciona o domínio interno
        const email = login.includes('@') ? login : `${login}${INTERNAL_DOMAIN}`;
        
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (!authError && data.user) {
          setIsLoading(false);
          onLogin(); 
          return;
        }
        
        console.warn('Supabase Auth falhou, tentando fallback local...', authError?.message);
      }

      // 2. Fallback: Login Local (Mock) para demonstração
      setTimeout(() => {
        const normalizedLogin = login.trim().toLowerCase();
        
        if (normalizedLogin === 'repre' && password === '123') {
          setIsLoading(false);
          onLogin();
        } else {
          setIsLoading(false);
          setError('Usuário ou senha incorretos.');
        }
      }, 1000);

    } catch (err) {
      setIsLoading(false);
      setError('Ocorreu um erro ao tentar entrar. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 overflow-hidden relative p-4">
      {/* Background Decorativo - Tema Escuro/Corporativo */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 opacity-90 animate-gradient"></div>
        <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[100px] animate-pulse"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px] animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-10 animate-slideUp">
        
        {/* Logo & Header Section */}
        <div className="px-8 pt-10 pb-6 text-center border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex flex-col items-center justify-center">
            
            {/* Logo Image Area */}
            <div className="relative mb-4 group cursor-default">
               {/* Glow effect */}
               <div className="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
               
               {/* Image Container */}
               <div className="relative z-10 p-2 transition-transform duration-300 group-hover:scale-105">
                 {!logoError ? (
                   <img 
                     src="/logo.png" 
                     alt="Portal Centro-Norte" 
                     className="w-48 h-auto mx-auto object-contain drop-shadow-xl"
                     onError={() => setLogoError(true)}
                   />
                 ) : (
                   <div className="flex flex-col items-center justify-center text-white">
                      <span className="text-4xl font-bold tracking-tighter">PCN</span>
                      <span className="text-[10px] uppercase tracking-widest text-blue-300 mt-1">Centro-Norte</span>
                   </div>
                 )}
               </div>
            </div>
            
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-wide mt-2">
              BEM-VINDO
            </h1>
            <p className="mt-1 text-slate-400 text-xs md:text-sm font-medium tracking-wide uppercase">Acesso Corporativo</p>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          <div className="space-y-5">
            <div className="space-y-2">
               <Input
                id="login"
                type="text"
                label="Usuário"
                placeholder="Digite seu login"
                icon={User}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                className="!bg-slate-800/50 !border-slate-700 !text-white placeholder:!text-slate-500 focus:!bg-slate-800 focus:!border-blue-500 focus:!ring-blue-500/20"
                labelClassName="!text-slate-300"
              />
            </div>
            
            <div className="space-y-2">
              <Input
                id="password"
                type="password"
                label="Senha"
                placeholder="••••••••"
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="!bg-slate-800/50 !border-slate-700 !text-white placeholder:!text-slate-500 focus:!bg-slate-800 focus:!border-blue-500 focus:!ring-blue-500/20"
                labelClassName="!text-slate-300"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer group select-none">
                <div 
                  className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center ${rememberMe ? 'bg-blue-500 border-blue-500' : 'border-slate-500 bg-transparent group-hover:border-blue-400'}`}
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  {rememberMe && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors" onClick={() => setRememberMe(!rememberMe)}>Lembrar de mim</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium text-center flex items-center justify-center gap-2 animate-fadeIn">
              <span>⚠️</span> {error}
            </div>
          )}

          <Button 
            type="submit" 
            isLoading={isLoading} 
            fullWidth
            className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-900/50 py-3.5 text-base font-semibold tracking-wide transition-transform active:scale-[0.98]"
          >
            Acessar Sistema <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <div className="pt-4 text-center">
             <p className="text-xs text-slate-500 hover:text-slate-400 transition-colors cursor-default">
               © 2024 Grupo Centro-Norte. Todos os direitos reservados.
             </p>
          </div>
        </form>
      </div>
    </div>
  );
};