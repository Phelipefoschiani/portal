
import React, { useState } from 'react';
import { User, Lock, ArrowRight, Check, Building2 } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { supabase } from '../lib/supabase';

interface LoginScreenProps {
  onLogin: (name: string, role: 'admin' | 'rep', userId: string) => void;
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
      // Usando ilike para permitir login independente de maiúsculas/minúsculas
      const { data, error: queryError } = await supabase
        .from('usuarios')
        .select('id, nome, nivel_acesso, ativo')
        .ilike('nome', login.trim())
        .eq('senha_hash', password)
        .single();

      if (queryError || !data) {
        setIsLoading(false);
        setError('Usuário ou senha incorretos.');
        return;
      }

      if (!data.ativo) {
        setIsLoading(false);
        setError('Esta conta está desativada.');
        return;
      }

      await supabase
        .from('usuarios')
        .update({ 
          status_online: true, 
          ultimo_acesso: new Date().toISOString() 
        })
        .eq('id', data.id);

      // Normaliza o nível de acesso para comparação
      const accessLevel = data.nivel_acesso.toLowerCase();
      const mappedRole: 'admin' | 'rep' = (accessLevel === 'gerente' || accessLevel === 'admin') ? 'admin' : 'rep';
      
      setIsLoading(false);
      onLogin(data.nome, mappedRole, data.id);

    } catch (err) {
      setIsLoading(false);
      setError('Erro na conexão com o banco de dados.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] overflow-hidden relative font-inter">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse delay-700"></div>
      </div>

      <div className="w-full max-w-[400px] z-10 p-4">
        <div className="text-center mb-8 animate-slideUp">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl shadow-2xl shadow-blue-900/50 mb-4 ring-1 ring-white/20">
             {!logoError ? (
               <img 
                 src="/logo.png" 
                 alt="Logo" 
                 className="w-10 h-10 object-contain brightness-0 invert"
                 onError={() => setLogoError(true)}
               />
             ) : (
               <Building2 className="text-white w-8 h-8" />
             )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Portal Centro-Norte</h1>
          <p className="text-slate-400 text-sm mt-1">Acesso corporativo integrado</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-4">
              <Input
                id="login"
                type="text"
                label="Nome de Usuário"
                placeholder="Seu Login"
                icon={User}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                className="!bg-slate-900/50 !border-slate-700 !text-slate-200 placeholder:!text-slate-500 focus:!border-blue-500 focus:!ring-blue-500/20 !h-12"
                labelClassName="!text-slate-300 text-xs uppercase tracking-wider font-semibold"
              />
              
              <Input
                id="password"
                type="password"
                label="Senha"
                placeholder="Sua senha"
                icon={Lock}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="!bg-slate-900/50 !border-slate-700 !text-slate-200 placeholder:!text-slate-500 focus:!border-blue-500 focus:!ring-blue-500/20 !h-12"
                labelClassName="!text-slate-300 text-xs uppercase tracking-wider font-semibold"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center space-x-2 cursor-pointer group select-none">
                <div 
                  className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-slate-600 bg-transparent group-hover:border-slate-500'}`}
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  {rememberMe && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors" onClick={() => setRememberMe(!rememberMe)}>Manter conectado</span>
              </label>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-center gap-2 animate-fadeIn">
                <div className="w-1 h-1 bg-red-500 rounded-full"></div> {error}
              </div>
            )}

            <Button 
              type="submit" 
              isLoading={isLoading} 
              fullWidth
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-blue-900/20 font-semibold tracking-wide"
            >
              Entrar no Sistema <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
          
          <div className="p-4 bg-white/5 border-t border-white/5 text-center">
             <p className="text-xs text-slate-500">
               Controle de Acesso Corporativo
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
