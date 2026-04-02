
import { supabase } from './supabase';
import { totalDataStore } from './dataStore';
import { Target, Investment, Client, VendaConsolidada, VendaClienteMes, VendaCanalMes, VendaProdutoMes, ClienteUltimaCompra, Sale } from '../types';

interface SupabaseError {
    message: string;
    details?: string;
    code?: string;
    status?: number;
}

const fetchAllRecords = async <T,>(queryFn: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> }, maxRetries = 2): Promise<T[]> => {
    let allData: T[] = [];
    let from = 0;
    const pageSize = 500;
    let hasMore = true;
    let retryCount = 0;

    while (hasMore) {
        try {
            const query = queryFn();
            const { data, error } = await query.range(from, from + pageSize - 1);
            if (error) {
                const err = error as SupabaseError;
                if (err.code === '57014' && retryCount < maxRetries) {
                    retryCount++;
                    await new Promise(r => setTimeout(r, 1000 * retryCount));
                    continue;
                }
                throw error;
            }
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    from += pageSize;
                    await new Promise(r => setTimeout(r, 50));
                }
            } else {
                hasMore = false;
            }
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

const fetchingMonths = new Set<string>();

export const fetchClients = async (onUpdate?: (viewName: string) => void) => {
    const { userId, userRole } = totalDataStore;
    if (!userId) return;

    const role = userRole?.toLowerCase() || '';
    const isPrivileged = role === 'admin' || role === 'diretor' || role === 'gerente' || role === 'director' || role === 'manager';

    // Se já temos clientes, não busca novamente (a menos que queiramos forçar)
    if (totalDataStore.clients.length > 0) return;

    try {
        const data = await fetchAllRecords<Client>(() => {
            let q = supabase.from('clientes').select('*');
            if (!isPrivileged) q = q.eq('usuario_id', userId);
            return q.order('nome_fantasia');
        });
        
        totalDataStore.clients = data || [];
        
        if (onUpdate) onUpdate('clients');
        window.dispatchEvent(new CustomEvent('pcn_data_update'));
    } catch (e) {
        console.error('Erro ao buscar clientes:', e);
    }
};

export const fetchSalesForMonths = async (year: number, months: number[], onUpdate?: (viewName: string) => void) => {
    const { userId, userRole } = totalDataStore;
    if (!userId) return;

    const role = userRole?.toLowerCase() || '';
    const isPrivileged = role === 'admin' || role === 'diretor' || role === 'gerente' || role === 'director' || role === 'manager';

    // Identificar meses que ainda não foram buscados e não estão sendo buscados agora
    const missingMonths = months.filter(m => {
        const key = `${year}-${m.toString().padStart(2, '0')}`;
        return !totalDataStore.fetchedMonths.has(key) && !fetchingMonths.has(key);
    });
    
    // Se não houver meses faltando, não faz nada
    if (missingMonths.length === 0) return;

    // Marcar como em processo de busca
    missingMonths.forEach(m => fetchingMonths.add(`${year}-${m.toString().padStart(2, '0')}`));

    totalDataStore.loading.vendasConsolidadas = true;
    totalDataStore.loading.clientesUltimaCompra = true;
    totalDataStore.loading.vendasClientesMes = true;
    totalDataStore.loading.vendasCanaisMes = true;
    totalDataStore.loading.vendasProdutosMes = true;

    try {
        // Busca os dados de todos os meses faltando em paralelo usando as VIEWS do Supabase
        const results = await Promise.all(missingMonths.map(async (month) => {
            const [vConsolidadas, vClientes, vCanais, vProdutos, vGranular] = await Promise.all([
                fetchAllRecords<VendaConsolidada>(() => {
                    let q = supabase.from('vw_vendas_consolidadas').select('*').eq('ano', year).eq('mes', month);
                    if (!isPrivileged) q = q.eq('usuario_id', userId);
                    return q;
                }),
                fetchAllRecords<VendaClienteMes>(() => {
                    let q = supabase.from('vw_vendas_clientes_mes').select('*').eq('ano', year).eq('mes', month);
                    if (!isPrivileged) q = q.eq('usuario_id', userId);
                    return q;
                }),
                fetchAllRecords<VendaCanalMes>(() => {
                    let q = supabase.from('vw_vendas_canais_mes').select('*').eq('ano', year).eq('mes', month);
                    if (!isPrivileged) q = q.eq('usuario_id', userId);
                    return q;
                }),
                fetchAllRecords<VendaProdutoMes>(() => {
                    let q = supabase.from('vw_vendas_produtos_mes').select('*').eq('ano', year).eq('mes', month);
                    if (!isPrivileged) q = q.eq('usuario_id', userId);
                    return q;
                }),
                fetchAllRecords<Sale>(() => {
                    const start = `${year}-${month.toString().padStart(2, '0')}-01`;
                    const end = new Date(year, month, 0).toISOString().split('T')[0];
                    let q = supabase.from('dados_vendas')
                        .select('faturamento, data, cnpj, produto, codigo_produto, canal_vendas, cliente_nome, grupo, usuario_id, qtde_faturado')
                        .gte('data', start)
                        .lte('data', end);
                    if (!isPrivileged) q = q.eq('usuario_id', userId);
                    return q;
                })
            ]);
            
            return { month, vConsolidadas, vClientes, vCanais, vProdutos, vGranular };
        }));

        // Marcar meses como buscados
        missingMonths.forEach(m => {
            const key = `${year}-${m.toString().padStart(2, '0')}`;
            totalDataStore.fetchedMonths.add(key);
            fetchingMonths.delete(key);
        });

        // Atualizar o store com os dados das views
        results.forEach(res => {
            totalDataStore.vendasConsolidadas = [...totalDataStore.vendasConsolidadas, ...res.vConsolidadas];
            totalDataStore.vendasClientesMes = [...totalDataStore.vendasClientesMes, ...res.vClientes];
            totalDataStore.vendasCanaisMes = [...totalDataStore.vendasCanaisMes, ...res.vCanais];
            totalDataStore.vendasProdutosMes = [...totalDataStore.vendasProdutosMes, ...res.vProdutos];

            // Popular totalDataStore.sales com dados granulares reais da dados_vendas
            const granularSales: Sale[] = res.vGranular.map(s => ({
                ...s,
                faturamento: Number(s.faturamento) || 0,
                quantidade: Number(s.quantidade || s.qtde_faturado) || 0,
                grupo: s.grupo || 'SEM GRUPO',
                canal_vendas: s.canal_vendas || 'GERAL / OUTROS'
            }));
            totalDataStore.sales = [...totalDataStore.sales, ...granularSales];
        });

        // Também buscamos metas e investimentos para o ano se ainda não tivermos nada desse ano
        const hasTargetsForYear = totalDataStore.targets.some(t => Number(t.ano) === year);
        const hasInvestmentsForYear = totalDataStore.investments.some(i => new Date(i.data + 'T00:00:00').getUTCFullYear() === year);
        
        let targetsData: Target[] = [];
        let investmentsData: Investment[] = [];

        if (!hasTargetsForYear || !hasInvestmentsForYear) {
            totalDataStore.loading.targets = true;
            totalDataStore.loading.investments = true;
            
            const [targets, investments] = await Promise.all([
                !hasTargetsForYear ? fetchAllRecords<Target>(() => {
                    let q = supabase.from('metas_usuarios').select('*').eq('ano', year);
                    if (!isPrivileged) q = q.eq('usuario_id', userId);
                    return q;
                }) : Promise.resolve([]),
                !hasInvestmentsForYear ? fetchAllRecords<Investment>(() => {
                    const start = `${year}-01-01`;
                    const end = `${year}-12-31`;
                    let q = supabase.from('investimentos').select('*').gte('data', start).lte('data', end).eq('status', 'approved');
                    if (!isPrivileged) q = q.eq('usuario_id', userId);
                    return q;
                }) : Promise.resolve([])
            ]);
            
            targetsData = targets;
            investmentsData = investments;
            totalDataStore.loading.targets = false;
            totalDataStore.loading.investments = false;
        }

        if (results.some(r => r.vConsolidadas.length > 0)) {
            // Atualizar atividade dos clientes (usando a data da última compra da view se disponível, 
            // ou mantendo a lógica de buscar a maior data das vendas consolidadas)
            // Como as views já são por mês, a data de última compra real precisaria de outra view ou lógica
            // Para simplificar, vamos usar o último dia do mês da venda consolidada como referência aproximada
            // ou apenas não atualizar aqui se a view não trouxer a data exata.
            // O ideal é ter a view view_pcn_clientes_ultima_compra

            // Se tivermos a view de última compra, buscamos ela também
            const missingCucMonths = missingMonths.filter(m => {
                const key = `cuc-${year}-${m}`;
                return !totalDataStore.fetchedMonths.has(key);
            });

            if (missingCucMonths.length > 0) {
                const cucData = await fetchAllRecords<ClienteUltimaCompra>(() => {
                    const q = supabase.from('vw_clientes_ultima_compra').select('*');
                    // Esta view geralmente não é por mês, mas sim o estado atual
                    return q;
                });
                totalDataStore.clientesUltimaCompra = cucData;
                
                const cucMap = new Map<string, string>();
                cucData.forEach(c => {
                    if (c.cnpj) cucMap.set(c.cnpj.replace(/\D/g, ''), c.ultima_compra);
                });

                totalDataStore.clients = totalDataStore.clients.map(client => {
                    const cleanCnpj = client.cnpj.replace(/\D/g, '');
                    const lastPurchase = cucMap.get(cleanCnpj);
                    if (!lastPurchase) return client;
                    return { ...client, lastPurchaseDate: lastPurchase };
                });
            }
        }

        if (targetsData.length > 0) {
            const existingTargetIds = new Set(totalDataStore.targets.map(t => t.id));
            const newTargets = targetsData.filter(t => !existingTargetIds.has(t.id));
            totalDataStore.targets = [...totalDataStore.targets, ...newTargets];
        }

        if (investmentsData.length > 0) {
            const existingInvIds = new Set(totalDataStore.investments.map(i => i.id));
            const newInvs = investmentsData.filter(i => !existingInvIds.has(i.id));
            totalDataStore.investments = [...totalDataStore.investments, ...newInvs];
        }
        
        window.dispatchEvent(new CustomEvent('pcn_data_update'));
    } catch (e) {
        console.error(`Erro ao buscar vendas para o período:`, e);
        // Em caso de erro, remover de fetching para permitir tentar novamente
        missingMonths.forEach(m => {
            fetchingMonths.delete(`${year}-${m.toString().padStart(2, '0')}`);
        });
    } finally {
        totalDataStore.loading.vendasConsolidadas = false;
        totalDataStore.loading.clientesUltimaCompra = false;
        totalDataStore.loading.vendasClientesMes = false;
        totalDataStore.loading.vendasCanaisMes = false;
        totalDataStore.loading.vendasProdutosMes = false;
        totalDataStore.loading.targets = false;
        totalDataStore.loading.investments = false;
        // Trigger update after setting loading to false
        if (onUpdate) onUpdate('data_loaded');
        window.dispatchEvent(new CustomEvent('pcn_data_update'));
    }
};

export const fetchUsers = async () => {
    if (totalDataStore.users.length > 0) return;
    try {
        const { data, error } = await supabase.from('usuarios').select('*').order('nome');
        if (error) throw error;
        totalDataStore.users = data || [];
        window.dispatchEvent(new CustomEvent('pcn_data_update'));
    } catch (e) {
        console.error('Erro ao buscar usuários:', e);
    }
};

export const fetchTargets = async (year: number) => {
    const { userId, userRole } = totalDataStore;
    if (!userId) return;
    try {
        totalDataStore.loading.targets = true;
        const data = await fetchAllRecords<Target>(() => {
            let q = supabase.from('metas_usuarios').select('*').eq('ano', year);
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        });
        
        const existingIds = new Set(totalDataStore.targets.map(t => t.id));
        const newTargets = data.filter(t => !existingIds.has(t.id));
        totalDataStore.targets = [...totalDataStore.targets, ...newTargets];
        
        window.dispatchEvent(new CustomEvent('pcn_data_update'));
    } catch (e) {
        console.error('Erro ao buscar metas:', e);
    } finally {
        totalDataStore.loading.targets = false;
    }
};

export const fetchInvestments = async (year: number) => {
    const { userId, userRole } = totalDataStore;
    if (!userId) return;
    try {
        totalDataStore.loading.investments = true;
        const data = await fetchAllRecords<Investment>(() => {
            const start = `${year}-01-01`;
            const end = `${year}-12-31`;
            let q = supabase.from('investimentos').select('*').gte('data', start).lte('data', end).eq('status', 'approved');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        });
        
        const existingIds = new Set(totalDataStore.investments.map(i => i.id));
        const newInvs = data.filter(i => !existingIds.has(i.id));
        totalDataStore.investments = [...totalDataStore.investments, ...newInvs];
        
        window.dispatchEvent(new CustomEvent('pcn_data_update'));
    } catch (e) {
        console.error('Erro ao buscar investimentos:', e);
    } finally {
        totalDataStore.loading.investments = false;
    }
};

export const backgroundSync = async (userId: string, userRole: string, onUpdate?: (viewName: string) => void) => {
    totalDataStore.userId = userId;
    totalDataStore.userRole = userRole;

    // Trigger update once at the end
    if (onUpdate) {
        onUpdate('all');
    }
};
