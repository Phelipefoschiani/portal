
import { supabase } from './supabase';
import { totalDataStore } from './dataStore';
import { Target, Investment, Sale, Client } from '../types';
import { aggregateSales } from './aggregations';

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

    // Se já temos clientes, não busca novamente (a menos que queiramos forçar)
    if (totalDataStore.clients.length > 0) return;

    try {
        const data = await fetchAllRecords<Client>(() => {
            let q = supabase.from('clientes').select('*');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
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
        // Busca os dados de todos os meses faltando em paralelo
        const salesResults = await Promise.all(missingMonths.map(async (month) => {
            const start = `${year}-${month.toString().padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const end = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
            
            return await fetchAllRecords<Sale>(() => {
                let q = supabase.from('dados_vendas').select('*').gte('data', start).lte('data', end);
                if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
                return q;
            });
        }));

        // Achata os resultados em um único array
        const newSales = salesResults.flat();
        
        // Marcar meses como buscados
        missingMonths.forEach(m => {
            const key = `${year}-${m.toString().padStart(2, '0')}`;
            totalDataStore.fetchedMonths.add(key);
            fetchingMonths.delete(key);
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
                    if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
                    return q;
                }) : Promise.resolve([]),
                !hasInvestmentsForYear ? fetchAllRecords<Investment>(() => {
                    const start = `${year}-01-01`;
                    const end = `${year}-12-31`;
                    let q = supabase.from('investimentos').select('*').gte('data', start).lte('data', end).eq('status', 'approved');
                    if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
                    return q;
                }) : Promise.resolve([])
            ]);
            
            targetsData = targets;
            investmentsData = investments;
            totalDataStore.loading.targets = false;
            totalDataStore.loading.investments = false;
        }

        if (newSales.length > 0) {
            // Evitar duplicatas por ID
            const existingIds = new Set(totalDataStore.sales.map(s => s.id));
            const uniqueNewSales = newSales.filter(s => !existingIds.has(s.id));
            totalDataStore.sales = [...totalDataStore.sales, ...uniqueNewSales];
            
            const aggregations = aggregateSales(totalDataStore.sales);
            totalDataStore.vendasConsolidadas = aggregations.vendasConsolidadas;
            totalDataStore.clientesUltimaCompra = aggregations.clientesUltimaCompra;
            totalDataStore.vendasClientesMes = aggregations.vendasClientesMes;
            totalDataStore.vendasCanaisMes = aggregations.vendasCanaisMes;
            totalDataStore.vendasProdutosMes = aggregations.vendasProdutosMes;

            // Atualizar atividade dos clientes
            const ultimaCompraMap = new Map<string, string>();
            aggregations.clientesUltimaCompra.forEach(c => {
                if (c.cnpj) ultimaCompraMap.set(c.cnpj.replace(/\D/g, ''), c.ultima_compra);
            });

            totalDataStore.clients = totalDataStore.clients.map(client => {
                const cleanCnpj = client.cnpj.replace(/\D/g, '');
                const lastPurchase = ultimaCompraMap.get(cleanCnpj);
                if (!lastPurchase) return { ...client, lastPurchaseDate: undefined };
                return { ...client, lastPurchaseDate: lastPurchase };
            });
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
