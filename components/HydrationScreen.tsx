
import React, { useState, useEffect } from 'react';
import { Database, Loader2, ShieldCheck, CheckCircle2, CloudDownload, BarChart3, Users, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { totalDataStore } from '../lib/dataStore';

interface HydrationScreenProps {
  userId: string;
  userRole: 'admin' | 'rep';
  onComplete: () => void;
}

export const HydrationScreen: React.FC<HydrationScreenProps> = ({ userId, userRole, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Iniciando conexão...');
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { label: 'Segurança', icon: ShieldCheck },
    { label: 'Carteira', icon: Users },
    { label: 'Faturamento', icon: BarChart3 },
    { label: 'Objetivos', icon: Target },
    { label: 'Pronto', icon: CheckCircle2 }
  ];

  useEffect(() => {
    startHydration();
  }, []);

  const fetchAllSalesParallel = async (role: string, uid: string) => {
    // Agora buscamos desde 2024 para permitir filtros históricos
    const startDate = `2024-01-01`;
    const endDate = `2026-12-31`;
    const pageSize = 1000;

    const columns = 'faturamento, cnpj, usuario_id, data, qtde_faturado, produto, codigo_produto, canal_vendas, grupo, cliente_nome';

    let countQuery = supabase
      .from('dados_vendas')
      .select('*', { count: 'exact', head: true })
      .gte('data', startDate)
      .lte('data', endDate);
    
    if (role !== 'admin') countQuery = countQuery.eq('usuario_id', uid);
    
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;

    const totalRecords = count || 0;
    if (totalRecords === 0) return [];

    const totalPages = Math.ceil(totalRecords / pageSize);
    const promises = [];

    for (let i = 0; i < totalPages; i++) {
      const from = i * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('dados_vendas')
        .select(columns)
        .gte('data', startDate)
        .lte('data', endDate)
        .range(from, to);

      if (role !== 'admin') query = query.eq('usuario_id', uid);

      promises.push(
        query.then(res => {
          setProgress(prev => Math.min(prev + (40 / totalPages), 88));
          return res.data || [];
        })
      );
    }

    const results = await Promise.all(promises);
    return results.flat();
  };

  const startHydration = async () => {
    try {
      totalDataStore.clear();
      
      setCurrentStep(0);
      setStatus('Validando credenciais...');
      setProgress(10);
      const { data: users } = await supabase
        .from('usuarios')
        .select('id, nome, nivel_acesso')
        .not('nivel_acesso', 'ilike', 'admin')
        .not('nivel_acesso', 'ilike', 'gerente')
        .order('nome');
      totalDataStore.users = users || [];
      await new Promise(r => setTimeout(r, 200));

      setCurrentStep(1);
      setStatus('Mapeando carteira...');
      setProgress(25);
      let clientQuery = supabase.from('clientes').select('*, usuarios(nome, id)');
      if (userRole !== 'admin') clientQuery = clientQuery.eq('usuario_id', userId);
      const { data: clients } = await clientQuery;
      totalDataStore.clients = clients || [];

      setCurrentStep(2);
      setStatus('Baixando histórico 2024-2025...');
      const sales = await fetchAllSalesParallel(userRole, userId);
      totalDataStore.sales = sales;
      setProgress(80);

      setCurrentStep(3);
      setStatus('Consolidando metas...');
      
      // Carregando metas de múltiplos anos para permitir troca no filtro
      let targetQuery = supabase.from('metas_usuarios').select('*').in('ano', [2024, 2025, 2026]);
      if (userRole !== 'admin') targetQuery = targetQuery.eq('usuario_id', userId);
      const { data: targets } = await targetQuery;
      totalDataStore.targets = targets || [];

      let invQuery = supabase.from('investimentos').select('*').gte('data', `2024-01-01`).eq('status', 'approved');
      if (userRole !== 'admin') invQuery = invQuery.eq('usuario_id', userId);
      const { data: invs } = await invQuery;
      totalDataStore.investments = invs || [];

      setProgress(95);
      await new Promise(r => setTimeout(r, 300));

      setCurrentStep(4);
      setStatus('Ambiente Gerencial Pronto!');
      setProgress(100);
      totalDataStore.isHydrated = true;
      
      await new Promise(r => setTimeout(r, 400));
      onComplete();

    } catch (err) {
      console.error('Erro na hidratação:', err);
      setStatus('Falha na rede. Reconectando...');
      setTimeout(startHydration, 2000);
    }
  };

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
