import React, { useState } from 'react';
import { User, Lock, ArrowRight, Compass } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { supabase, INTERNAL_DOMAIN, isSupabaseConfigured } from '../lib/supabase';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
          // Sucesso no Supabase
          setIsLoading(false);
          onLogin(); // O listener no App.tsx também vai pegar a sessão, mas chamamos aqui para garantir
          return;
        }
        
        // Se falhar no Supabase, verificamos se é erro de credencial ou configuração
        console.warn('Supabase Auth falhou, tentando fallback local...', authError?.message);
      }

      // 2. Fallback: Login Local (Mock) para demonstração
      // Útil enquanto as chaves do Supabase não estão no ar ou para usuários de teste
      setTimeout(() => {
        const normalizedLogin = login.trim().toLowerCase();
        
        if (normalizedLogin === 'repre' && password === '123') {
          setIsLoading(false);
          onLogin();
        } else {
          setIsLoading(false);
          // Mensagem genérica para segurança
          setError('Usuário ou senha incorretos.');
        }
      }, 1000);

    } catch (err) {
      setIsLoading(false);
      setError('Ocorreu um erro ao tentar entrar. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 overflow-hidden relative">
      {/* Background Decorativo - Tema Escuro/Corporativo */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 opacity-90"></div>
        <div className="absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full bg-blue-600/20 blur-[100px]"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-indigo-600/20 blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-10 transition-all duration-300">
        
        {/* Logo & Header Section */}
        <div className="px-8 pt-12 pb-8 text-center border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-4 group">
               <div className="absolute inset-0 bg-blue-500 rounded-full blur opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
               <div className="relative w-16 h-16 bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700 rounded-2xl flex items-center justify-center shadow-xl">
                 <Compass className="w-8 h-8 text-blue-400" strokeWidth={1.5} />
               </div>
               <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-slate-800"></div>
            </div>
            
            <h1 className="text-2xl font-bold text-white tracking-wide">
              PORTAL <span className="text-blue-400 font-light">CENTRO-NORTE</span>
            </h1>
            <p className="mt-2 text-slate-400 text-sm font-medium">Acesso Restrito</p>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
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
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium text-center flex items-center justify-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <Button 
            type="submit" 
            isLoading={isLoading} 
            fullWidth
            className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-900/50 py-3.5 text-base"
          >
            Acessar Sistema <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <div className="pt-4 text-center">
             <p className="text-xs text-slate-500">
               © 2024 Grupo Centro-Norte. Todos os direitos reservados.
             </p>
          </div>
        </form>
      </div>
    </div>
  );
};