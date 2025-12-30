
import React, { useState } from 'react';
import { User, Lock, ArrowRight, Check, Building2, ShieldCheck } from 'lucide-react';
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
      const { data, error: queryError } = await supabase
        .from('usuarios')
        .select('id, nome, nivel_acesso, ativo')
        .ilike('nome', login.trim())
        .eq('senha_hash', password)
        .single();

      if (queryError || !data) {
        setIsLoading(false);
        setError('Credenciais inválidas. Verifique usuário e senha.');
        return;
      }

      if (!data.ativo) {
        setIsLoading(false);
        setError('Esta conta está temporariamente desativada.');
        return;
      }

      await supabase
        .from('usuarios')
        .update({ 
          status_online: true, 
          ultimo_acesso: new Date().toISOString() 
        })
        .eq('id', data.id);

      const accessLevel = data.nivel_acesso.toLowerCase();
      const mappedRole: 'admin' | 'rep' = (accessLevel === 'gerente' || accessLevel === 'admin') ? 'admin' : 'rep';
      
      setIsLoading(false);
      onLogin(data.nome, mappedRole, data.id);

    } catch (err) {
      setIsLoading(false);
      setError('Falha de comunicação com o servidor.');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#020617] overflow-hidden relative font-inter p-4">
      {/* Background Decorativo Premium */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-blue-600/20 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/15 rounded-full blur-[150px] animate-pulse delay-1000"></div>
        <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-[440px] z-10 space-y-8">
        <div className="text-center animate-slideUp">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-[28px] shadow-2xl shadow-blue-500/20 mb-6 ring-1 ring-white/20 transform hover:scale-105 transition-transform duration-300">
             {!logoError ? (
               <img 
                 src="/logo.png" 
                 alt="Logo" 
                 className="w-12 h-12 object-contain brightness-0 invert"
                 onError={() => setLogoError(true)}
               />
             ) : (
               <Building2 className="text-white w-10 h-10" />
             )}
          </div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">
            Centro-Norte <span className="text-blue-500">Portal</span>
          </h1>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden animate-slideUp">
          <div className="p-8 md:p-10 space-y-8">
            <div className="space-y-2">
                <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Insira suas credenciais corporativas</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <Input
                  id="login"
                  type="text"
                  label="Usuário"
                  placeholder="Seu nome de usuário"
                  icon={User}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  required
                  className="!bg-slate-950/40 !border-white/5 !text-slate-100 placeholder:!text-slate-600 focus:!border-blue-500/50 focus:!ring-blue-500/10 !h-14 !rounded-2xl transition-all"
                  labelClassName="!text-slate-500 text-[10px] uppercase tracking-widest font-black"
                />
                
                <Input
                  id="password"
                  type="password"
                  label="Senha de Acesso"
                  placeholder="••••••••"
                  icon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="!bg-slate-950/40 !border-white/5 !text-slate-100 placeholder:!text-slate-600 focus:!border-blue-500/50 focus:!ring-blue-500/10 !h-14 !rounded-2xl transition-all"
                  labelClassName="!text-slate-500 text-[10px] uppercase tracking-widest font-black"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-3 cursor-pointer group select-none">
                  <div 
                    className={`w-5 h-5 rounded-lg border transition-all duration-300 flex items-center justify-center ${rememberMe ? 'bg-blue-600 border-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'border-slate-700 bg-white/5 group-hover:border-slate-500'}`}
                    onClick={() => setRememberMe(!rememberMe)}
                  >
                    {rememberMe && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                  </div>
                  <span className="text-xs text-slate-400 font-bold group-hover:text-slate-200 transition-colors uppercase tracking-wider" onClick={() => setRememberMe(!rememberMe)}>Lembrar acesso</span>
                </label>
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-3 animate-fadeIn">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div> {error}
                </div>
              )}

              <Button 
                type="submit" 
                isLoading={isLoading} 
                fullWidth
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-2xl shadow-blue-900/40 h-14 !rounded-2xl font-black text-sm uppercase tracking-[0.15em] transition-all active:scale-[0.98]"
              >
                Acessar Portal <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>
          </div>
          
          <div className="px-10 py-6 bg-white/[0.02] border-t border-white/5 flex items-center justify-center gap-2">
             <ShieldCheck className="w-4 h-4 text-emerald-500" />
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
               Ambiente Seguro Centro-Norte
             </p>
          </div>
        </div>

        <div className="text-center animate-fadeIn delay-700">
           <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
             © {new Date().getFullYear()} Grupo Centro-Norte. Todos os direitos reservados.
           </p>
        </div>
      </div>
    </div>
  );
};
