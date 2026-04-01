
import React, { useState, useEffect, useCallback } from 'react';
import { Database, ShieldCheck, CheckCircle2, BarChart3, Users, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { totalDataStore } from '../lib/dataStore';

interface HydrationScreenProps {
  userId: string;
  userRole: 'admin' | 'rep' | 'director';
  onComplete: () => void;
}

export const HydrationScreen: React.FC<HydrationScreenProps> = ({ userId, userRole, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Iniciando conexão...');
  const [currentStep, setCurrentStep] = useState(0);

  const steps = React.useMemo(() => [
    { label: 'Segurança', icon: ShieldCheck },
    { label: 'Carteira', icon: Users },
    { label: 'Faturamento', icon: BarChart3 },
    { label: 'Objetivos', icon: Target },
    { label: 'Pronto', icon: CheckCircle2 }
  ], []);  const fetchCurrentMonthData = useCallback(async (role: string, uid: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const start = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

    const columns = 'faturamento, cnpj, usuario_id, data, qtde_faturado, produto, codigo_produto, canal_vendas, grupo, cliente_nome';

    const { data, error } = await supabase
      .from('dados_vendas')
      .select(columns)
      .gte('data', start)
      .lte('data', end)
      .eq(role !== 'admin' && role !== 'director' ? 'usuario_id' : 'dummy', role !== 'admin' && role !== 'director' ? uid : 'dummy');

    if (error) throw error;
    
    const key = `${year}-${month.toString().padStart(2, '0')}`;
    totalDataStore.fetchedMonths.add(key);
    
    return data || [];
  }, []);

  const startHydration = useCallback(async () => {
    const execute = async () => {
      try {
        totalDataStore.clear();
        
        setCurrentStep(0);
        setStatus('Validando credenciais...');
        setProgress(10);
        
        const { data: allUsers, error: usersError } = await supabase
          .from('usuarios')
          .select('id, nome, nivel_acesso')
          .order('nome');
        
        if (usersError) throw usersError;

        const excludedRoles = ['admin', 'gerente', 'director', 'diretor'];
        totalDataStore.users = (allUsers || []).filter(u => 
          !u.nivel_acesso || !excludedRoles.some(role => u.nivel_acesso.toLowerCase().includes(role))
        );

        setCurrentStep(1);
        setStatus('Mapeando carteira...');
        setProgress(30);
        let clientQuery = supabase.from('clientes').select('*, usuarios(nome, id)');
        if (userRole !== 'admin' && userRole !== 'director') clientQuery = clientQuery.eq('usuario_id', userId);
        const { data: clients, error: clientsError } = await clientQuery;
        
        if (clientsError) throw clientsError;
        totalDataStore.clients = clients || [];

        setCurrentStep(2);
        setStatus('Carregando dados do mês atual...');
        setProgress(60);
        const sales = await fetchCurrentMonthData(userRole, userId);
        totalDataStore.sales = sales;

        setCurrentStep(3);
        setStatus('Consolidando metas...');
        setProgress(85);
        
        const now = new Date();
        const currentYear = now.getFullYear();
        
        let targetQuery = supabase.from('metas_usuarios').select('*').eq('ano', currentYear);
        if (userRole !== 'admin' && userRole !== 'director') targetQuery = targetQuery.eq('usuario_id', userId);
        const { data: targets, error: targetsError } = await targetQuery;
        
        if (targetsError) throw targetsError;
        totalDataStore.targets = targets || [];

        let invQuery = supabase.from('investimentos').select('*').gte('data', `${currentYear}-01-01`).eq('status', 'approved');
        if (userRole !== 'admin' && userRole !== 'director') invQuery = invQuery.eq('usuario_id', userId);
        const { data: invs, error: invsError } = await invQuery;
        
        if (invsError) throw invsError;
        totalDataStore.investments = invs || [];

        setProgress(100);
        setCurrentStep(4);
        setStatus('Ambiente Pronto!');
        totalDataStore.isHydrated = true;
        
        await new Promise(r => setTimeout(r, 400));
        onComplete();

      } catch (err: unknown) {
        // Log detalhado com todas as propriedades do erro
        const detailedError = err instanceof Error ? JSON.stringify(err, Object.getOwnPropertyNames(err), 2) : String(err);
        console.error(`Erro detalhado na hidratação (Passo ${currentStep + 1}):`, detailedError);
        
        let errorMsg = 'Erro desconhecido';
        if (err instanceof Error) errorMsg = err.message;
        else if (typeof err === 'object' && err !== null && 'details' in err) errorMsg = String((err as Record<string, unknown>).details);
        else if (typeof err === 'object' && err !== null && 'hint' in err) errorMsg = String((err as Record<string, unknown>).hint);
        else if (typeof err === 'object' && err !== null && 'code' in err) errorMsg = `Código: ${(err as Record<string, unknown>).code}`;
        else if (typeof err === 'string') errorMsg = err;
        else errorMsg = detailedError;
        
        setStatus(`Erro no passo ${currentStep + 1} (${steps[currentStep].label}): ${errorMsg.substring(0, 150)}`);
        
        // Retry with backoff
        setTimeout(execute, 5000);
      }
    };

    await execute();
  }, [userId, userRole, onComplete, currentStep, steps, fetchCurrentMonthData]);

  useEffect(() => {
    startHydration();
  }, [startHydration]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0f172a] p-6 font-inter overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
      </div>

      <div className="w-full max-w-md z-10 space-y-10">
        <div className="text-center space-y-4 animate-fadeIn">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-[28px] shadow-2xl shadow-blue-900/40 mb-2">
             <Database className="text-white w-10 h-10 animate-bounce" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight uppercase">Sincronização Turbo</h1>
          <p className="text-slate-400 text-sm font-medium">Extraindo inteligência de dados Centro-Norte</p>
        </div>

        <div className="flex justify-between relative px-2">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/5 -translate-y-1/2"></div>
            {steps.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx <= currentStep;
                return (
                    <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 ${isActive ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/40' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-blue-400' : 'text-slate-600'}`}>{step.label}</span>
                    </div>
                );
            })}
        </div>

        <div className="space-y-4">
            <div className="flex justify-between items-end">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] animate-pulse">{status}</span>
                <span className="text-xl font-black text-white tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden p-1 border border-white/5 shadow-inner">
                <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                    style={{ width: `${progress}%` }}
                ></div>
            </div>
        </div>
        
        <div className="text-center pt-8">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em]">Engine de Dados v2.1 • Portal Centro-Norte</p>
        </div>
      </div>
    </div>
  );
};
