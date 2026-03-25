
import React, { useState, useEffect, useCallback } from 'react';
import { Database, ShieldCheck, CheckCircle2, BarChart3, Users, Target as TargetIcon } from 'lucide-react';
import { Client, Target, Investment, User, VendaConsolidada, ClienteUltimaCompra, VendaClienteMes, VendaCanalMes, VendaProdutoMes } from '../types';
import { supabase } from '../lib/supabase';
import { totalDataStore } from '../lib/dataStore';
import { saveToLocal, getFromLocal } from '../lib/storage';
import { performBackgroundSync } from '../lib/sync';

const fetchAllRecords = async <T,>(queryFn: () => unknown): Promise<T[]> => {
    let allData: T[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const query = queryFn() as { range: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }> };
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
            allData = [...allData, ...data];
            from += pageSize;
            if (data.length < pageSize) hasMore = false;
        } else {
            hasMore = false;
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
  { label: 'Faturamento', icon: BarChart3 },
  { label: 'Objetivos', icon: TargetIcon },
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
        setStatus('Verificando cache local...');
        setProgress(10);
        
        const cachedUsers = await getFromLocal('users_cache', userId) as User[] | null;
        const cachedClients = await getFromLocal('clients_cache', userId) as Client[] | null;
        const cachedVendasConsolidadas = await getFromLocal('vendas_consolidadas_cache', userId) as VendaConsolidada[] | null;
        const cachedClientesUltimaCompra = await getFromLocal('clientes_ultima_compra_cache', userId) as ClienteUltimaCompra[] | null;
        const cachedVendasClientesMes = await getFromLocal('vendas_clientes_mes_cache', userId) as VendaClienteMes[] | null;
        const cachedVendasCanaisMes = await getFromLocal('vendas_canais_mes_cache', userId) as VendaCanalMes[] | null;
        const cachedVendasProdutosMes = await getFromLocal('vendas_produtos_mes_cache', userId) as VendaProdutoMes[] | null;
        const cachedTargets = await getFromLocal('targets_cache', userId) as Target[] | null;
        const cachedInvs = await getFromLocal('investments_cache', userId) as Investment[] | null;
        const lastSync = await getFromLocal('last_sync', userId) as number | null;

        const isCacheValid = lastSync && (Date.now() - lastSync < 1000 * 60 * 60); // 1 hour cache validity

        if (
            cachedUsers && cachedClients && cachedVendasConsolidadas && cachedClientesUltimaCompra && 
            cachedVendasClientesMes && cachedVendasCanaisMes && cachedVendasProdutosMes && 
            cachedTargets && cachedInvs
        ) {
            setStatus('Carregando dados do cache criptografado...');
            setProgress(50);
            
            totalDataStore.users = cachedUsers;
            totalDataStore.clients = cachedClients;
            totalDataStore.vendasConsolidadas = cachedVendasConsolidadas;
            totalDataStore.clientesUltimaCompra = cachedClientesUltimaCompra;
            totalDataStore.vendasClientesMes = cachedVendasClientesMes;
            totalDataStore.vendasCanaisMes = cachedVendasCanaisMes;
            totalDataStore.vendasProdutosMes = cachedVendasProdutosMes;
            totalDataStore.targets = cachedTargets;
            totalDataStore.investments = cachedInvs;
            
            setProgress(100);
            setStatus('Ambiente Gerencial Pronto!');
            totalDataStore.isHydrated = true;
            
            await new Promise(r => setTimeout(r, 400));
            onComplete();

            // Background sync if cache is old
            if (!isCacheValid) {
                console.log('Cache expirado, iniciando sincronização em segundo plano...');
                performBackgroundSync(userId, userRole);
            }
            return;
        }

        // If no cache, fetch everything normally
        stepIdx = 0;
        setCurrentStep(0);
        setStatus('Validando credenciais...');
        setProgress(10);
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

        stepIdx = 1;
        setCurrentStep(1);
        setStatus('Mapeando carteira...');
        setProgress(25);
        
        const getClientQuery = () => {
            let q = supabase.from('clientes').select('*, usuarios(nome, id)');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };
        const clients = await fetchAllRecords<Client>(getClientQuery);
        totalDataStore.clients = clients || [];
        
        stepIdx = 2;
        setCurrentStep(2);
        setStatus('Sincronizando visões consolidadas...');
        const getVendasConsolidadas = () => {
            let q = supabase.from('vw_vendas_consolidadas').select('*');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };
        const getClientesUltimaCompra = () => {
            return supabase.from('vw_clientes_ultima_compra').select('*');
        };
        const getVendasClientesMes = () => {
            let q = supabase.from('vw_vendas_clientes_mes').select('*');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };
        const getVendasCanaisMes = () => {
            let q = supabase.from('vw_vendas_canais_mes').select('*');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };
        const getVendasProdutosMes = () => {
            let q = supabase.from('vw_vendas_produtos_mes').select('*');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };

        const [
            vendasConsolidadas,
            clientesUltimaCompra,
            vendasClientesMes,
            vendasCanaisMes,
            vendasProdutosMes
        ] = await Promise.all([
            fetchAllRecords<VendaConsolidada>(getVendasConsolidadas),
            fetchAllRecords<ClienteUltimaCompra>(getClientesUltimaCompra),
            fetchAllRecords<VendaClienteMes>(getVendasClientesMes),
            fetchAllRecords<VendaCanalMes>(getVendasCanaisMes),
            fetchAllRecords<VendaProdutoMes>(getVendasProdutosMes)
        ]);

        totalDataStore.vendasConsolidadas = vendasConsolidadas || [];
        totalDataStore.clientesUltimaCompra = clientesUltimaCompra || [];
        totalDataStore.vendasClientesMes = vendasClientesMes || [];
        totalDataStore.vendasCanaisMes = vendasCanaisMes || [];
        totalDataStore.vendasProdutosMes = vendasProdutosMes || [];
        totalDataStore.sales = []; // Clear old sales data to save memory

        // Otimização: Atualizar lastPurchaseDate dos clientes
        const ultimaCompraMap = new Map<string, string>();
        totalDataStore.clientesUltimaCompra.forEach(c => {
            if (c.cnpj) ultimaCompraMap.set(c.cnpj.replace(/\D/g, ''), c.ultima_compra);
        });

        totalDataStore.clients = totalDataStore.clients.map(client => {
            const cleanCnpj = client.cnpj.replace(/\D/g, '');
            const lastPurchase = ultimaCompraMap.get(cleanCnpj);
            
            if (!lastPurchase) {
                return { ...client, ativo: false, data_inativacao: 'Sem compras' };
            }
            
            const inactivationDate = new Date(lastPurchase + 'T00:00:00');
            inactivationDate.setMonth(inactivationDate.getMonth() + 3);
            
            return {
                ...client,
                lastPurchaseDate: lastPurchase,
                data_inativacao: inactivationDate.toISOString().split('T')[0]
            };
        });
 
        setProgress(80);
 
        stepIdx = 3;
        setCurrentStep(3);
        setStatus('Consolidando metas...');
        
        const getTargetQuery = () => {
            let q = supabase.from('metas_usuarios').select('*').in('ano', [2024, 2025, 2026, 2027]);
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };
        const targets = await fetchAllRecords<Target>(getTargetQuery);
        totalDataStore.targets = targets || [];

        const getInvQuery = () => {
            let q = supabase.from('investimentos').select('*').gte('data', `2024-01-01`).eq('status', 'approved');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };
        const invs = await fetchAllRecords<Investment>(getInvQuery);
        totalDataStore.investments = invs || [];

        // Save everything to cache
        setStatus('Criptografando e salvando cache local...');
        await Promise.all([
            saveToLocal('users_cache', totalDataStore.users, userId),
            saveToLocal('clients_cache', totalDataStore.clients, userId),
            saveToLocal('vendas_consolidadas_cache', totalDataStore.vendasConsolidadas, userId),
            saveToLocal('clientes_ultima_compra_cache', totalDataStore.clientesUltimaCompra, userId),
            saveToLocal('vendas_clientes_mes_cache', totalDataStore.vendasClientesMes, userId),
            saveToLocal('vendas_canais_mes_cache', totalDataStore.vendasCanaisMes, userId),
            saveToLocal('vendas_produtos_mes_cache', totalDataStore.vendasProdutosMes, userId),
            saveToLocal('targets_cache', totalDataStore.targets, userId),
            saveToLocal('investments_cache', totalDataStore.investments, userId),
            saveToLocal('last_sync', Date.now(), userId)
        ]);
 
        setProgress(95);
        await new Promise(r => setTimeout(r, 300));
 
        stepIdx = 4;
        setCurrentStep(4);
        setStatus('Ambiente Gerencial Pronto!');
        setProgress(100);
        totalDataStore.isHydrated = true;
        
        await new Promise(r => setTimeout(r, 400));
        onComplete();
 
      } catch (err: unknown) {
        console.error('Erro detalhado na hidratação:', err);
        const errorMsg = err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err)) || 'Erro desconhecido';
        setStatus(`Erro no passo ${stepIdx + 1} (${steps[stepIdx]?.label || 'Processamento'}): ${errorMsg.substring(0, 60)}...`);
        
        // Stop retrying if it's an auth/permission error (401, 403)
        const isAuthError = (err && typeof err === 'object' && 'status' in err && (err.status === 401 || err.status === 403)) || 
                           errorMsg.toLowerCase().includes('unauthorized') || 
                           errorMsg.toLowerCase().includes('permission denied') ||
                           errorMsg.toLowerCase().includes('invalid api key');

        if (!isAuthError) {
          // Retry with backoff for other errors (network, etc)
          setTimeout(execute, 5000);
        } else {
          setStatus(`Erro Crítico: Falha de Permissão/Autenticação. Verifique as chaves do Supabase.`);
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
