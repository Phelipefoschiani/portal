
import React, { useState, useEffect, useCallback } from 'react';
import { Database, ShieldCheck, CheckCircle2, Users } from 'lucide-react';
import { Client, Target, Investment, User, VendaConsolidada, ClienteUltimaCompra, VendaClienteMes, VendaCanalMes, VendaProdutoMes, Sale } from '../types';
import { supabase } from '../lib/supabase';
import { totalDataStore } from '../lib/dataStore';
import { saveToLocal, getFromLocal } from '../lib/storage';

interface SupabaseError {
    message: string;
    details?: string;
    code?: string;
    status?: number;
}

const fetchAllRecords = async <T,>(queryFn: () => unknown, maxRetries = 2): Promise<T[]> => {
    let allData: T[] = [];
    let from = 0;
    const pageSize = 500;
    let hasMore = true;
    let retryCount = 0;

    while (hasMore) {
        try {
            const query = queryFn() as { range: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }> };
            if (!query || typeof query.range !== 'function') {
                throw new Error('Query function did not return a valid Supabase query object.');
            }
            const { data, error } = await query.range(from, from + pageSize - 1);
            if (error) {
                const err = error as SupabaseError;
                // Check for timeout (57014)
                if (err.code === '57014' && retryCount < maxRetries) {
                    retryCount++;
                    console.warn(`Timeout detectado. Tentando novamente (${retryCount}/${maxRetries})...`);
                    await new Promise(r => setTimeout(r, 1000 * retryCount)); // Exponential backoff
                    continue;
                }
                console.error('Supabase Query Error:', error);
                throw error;
            }
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    from += pageSize;
                    // Small delay to let DB breathe between pages
                    await new Promise(r => setTimeout(r, 50));
                }
            } else {
                hasMore = false;
            }
            // Reset retry count on success
            retryCount = 0;
        } catch (err) {
            if (retryCount < maxRetries) {
                retryCount++;
                await new Promise(r => setTimeout(r, 1000 * retryCount));
                continue;
            }
            throw err;
        }
    }
    return allData;
};

interface HydrationScreenProps {
  onComplete: () => void;
}

const steps = [
  { label: 'Segurança', icon: ShieldCheck },
  { label: 'Carteira', icon: Users },
  { label: 'Pronto', icon: CheckCircle2 }
];

export const HydrationScreen: React.FC<HydrationScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Iniciando conexão...');
  const [currentStep, setCurrentStep] = useState(0);
  const hydrationStarted = React.useRef(false);

  const startHydration = useCallback(async () => {
    const execute = async () => {
      let stepIdx = 0;
      try {
        totalDataStore.clear();
        
        const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
        const userId = session.id;
        const userRole = session.role;

        if (!userId) {
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        }

        stepIdx = 0;
        setCurrentStep(0);
        setStatus('Validando credenciais...');
        setProgress(20);
        const getUsersQuery = () => supabase
          .from('usuarios')
          .select('id, nome, nivel_acesso')
          .not('nivel_acesso', 'ilike', 'admin')
          .not('nivel_acesso', 'ilike', 'gerente')
          .not('nivel_acesso', 'ilike', 'director')
          .not('nivel_acesso', 'ilike', 'diretor')
          .order('nome');
        const users = await fetchAllRecords<User>(getUsersQuery);
        totalDataStore.users = users || [];
        await new Promise(r => setTimeout(r, 100));
 
        stepIdx = 1;
        setCurrentStep(1);
        setStatus('Mapeando carteira...');
        setProgress(50);
        
        let cachedClients: Client[] | null = null;
        try {
            cachedClients = await getFromLocal('clients_cache', userId) as Client[] | null;
        } catch (e) {
            console.warn('Erro ao ler cache de clientes:', e);
        }

        if (cachedClients && cachedClients.length > 0) {
            totalDataStore.clients = cachedClients;
            setStatus('Carteira carregada do cache...');
        } else {
            const getClientQuery = () => {
                let q = supabase.from('clientes').select('*, usuarios(nome, id)');
                if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
                return q;
            };
            const clients = await fetchAllRecords<Client>(getClientQuery);
            totalDataStore.clients = clients || [];
            await saveToLocal('clients_cache', totalDataStore.clients, userId);
        }

        // Tentar carregar visões do cache em silêncio (não bloqueante)
        try {
            const cachedSales = await getFromLocal('sales_cache', userId) as Sale[] | null;
            if (cachedSales) totalDataStore.sales = cachedSales;

            const cachedViews = await getFromLocal('views_cache', userId) as { 
                vendasConsolidadas?: VendaConsolidada[], 
                clientesUltimaCompra?: ClienteUltimaCompra[], 
                vendasClientesMes?: VendaClienteMes[], 
                vendasCanaisMes?: VendaCanalMes[], 
                vendasProdutosMes?: VendaProdutoMes[] 
            };
            if (cachedViews) {
                totalDataStore.vendasConsolidadas = cachedViews.vendasConsolidadas || [];
                totalDataStore.clientesUltimaCompra = cachedViews.clientesUltimaCompra || [];
                totalDataStore.vendasClientesMes = cachedViews.vendasClientesMes || [];
                totalDataStore.vendasCanaisMes = cachedViews.vendasCanaisMes || [];
                totalDataStore.vendasProdutosMes = cachedViews.vendasProdutosMes || [];
            }
            
            const cachedTargets = await getFromLocal('targets_cache', userId) as Target[] | null;
            if (cachedTargets) totalDataStore.targets = cachedTargets;
            
            const cachedInvs = await getFromLocal('investments_cache', userId) as Investment[] | null;
            if (cachedInvs) totalDataStore.investments = cachedInvs;
        } catch (e) {
            console.warn('Erro ao ler cache de visões:', e);
        }

        setProgress(80);
        await new Promise(r => setTimeout(r, 100));
 
        stepIdx = 2;
        setCurrentStep(2);
        setStatus('Ambiente Gerencial Pronto!');
        setProgress(100);
        totalDataStore.isHydrated = true;
        
        await new Promise(r => setTimeout(r, 200));
        onComplete();
 
      } catch (err: unknown) {
        console.error('Erro detalhado na hidratação:', err);
        let errorMsg = 'Erro desconhecido';
        let errorCode = '';
        let errorStatus: number | undefined;

        if (err instanceof Error) {
            errorMsg = err.message;
        } else if (err && typeof err === 'object') {
            const e = err as SupabaseError;
            errorMsg = e.message || e.details || JSON.stringify(err);
            errorCode = e.code || '';
            errorStatus = e.status;
        }

        setStatus(`Erro no passo ${stepIdx + 1} (${steps[stepIdx]?.label || 'Processamento'}): ${errorMsg.substring(0, 80)}${errorCode ? ` [${errorCode}]` : ''}`);
        
        // Stop retrying if it's an auth/permission error (401, 403)
        const isAuthError = errorStatus === 401 || 
                           errorStatus === 403 || 
                           errorMsg.toLowerCase().includes('unauthorized') || 
                           errorMsg.toLowerCase().includes('permission denied') ||
                           errorMsg.toLowerCase().includes('invalid api key') ||
                           errorCode === 'PGRST301';

        if (!isAuthError) {
          // Retry with backoff for other errors (network, etc)
          setTimeout(execute, 5000);
        } else {
          setStatus(`Erro Crítico: Falha de Permissão/Autenticação. Verifique as chaves do Supabase. [${errorCode}]`);
        }
      }
    };

    await execute();
  }, [onComplete]);

  useEffect(() => {
    if (!hydrationStarted.current) {
      hydrationStarted.current = true;
      startHydration();
    }
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
