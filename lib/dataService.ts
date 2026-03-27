
import { supabase } from './supabase';
import { totalDataStore } from './dataStore';
import { saveToLocal, getFromLocal } from './storage';
import { VendaConsolidada, ClienteUltimaCompra, VendaClienteMes, VendaCanalMes, VendaProdutoMes, Target, Investment } from '../types';

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

export const backgroundSync = async (userId: string, userRole: string, onUpdate?: (viewName: string) => void) => {
    // Quick check to see if we really need to sync sales data
    // This addresses the user's request for a "fast check"
    const checkUpdate = async () => {
        try {
            const { count, error } = await supabase
                .from('dados_vendas')
                .select('*', { count: 'exact', head: true });
            
            if (error) return true;
            
            const lastCount = localStorage.getItem(`pcn_sync_count_${userId}`);
            if (lastCount === String(count)) {
                console.log('Dados sincronizados. Nenhuma alteração detectada no faturamento.');
                return false;
            }
            localStorage.setItem(`pcn_sync_count_${userId}`, String(count || 0));
            return true;
        } catch {
            return true;
        }
    };

    const needsUpdate = await checkUpdate();

    // 1. Vendas Consolidadas
    if (needsUpdate || !totalDataStore.vendasConsolidadas.length) {
        totalDataStore.loading.vendasConsolidadas = true;
        try {
            const data = await fetchAllRecords<VendaConsolidada>(() => {
                let q = supabase.from('vw_vendas_consolidadas').select('*');
                if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
                return q;
            });
            totalDataStore.vendasConsolidadas = data;
            await saveToLocal('views_cache', { ...await getFromLocal('views_cache', userId) as Record<string, unknown>, vendasConsolidadas: data }, userId);
        } finally {
            totalDataStore.loading.vendasConsolidadas = false;
        }
    }

    // 2. Última Compra
    if (needsUpdate || !totalDataStore.clientesUltimaCompra.length) {
        totalDataStore.loading.clientesUltimaCompra = true;
        try {
            const data = await fetchAllRecords<ClienteUltimaCompra>(() => supabase.from('vw_clientes_ultima_compra').select('*'));
            totalDataStore.clientesUltimaCompra = data;
            
            // Update client activity in background
            const ultimaCompraMap = new Map<string, string>();
            data.forEach(c => {
                if (c.cnpj) ultimaCompraMap.set(c.cnpj.replace(/\D/g, ''), c.ultima_compra);
            });

            totalDataStore.clients = totalDataStore.clients.map(client => {
                const cleanCnpj = client.cnpj.replace(/\D/g, '');
                const lastPurchase = ultimaCompraMap.get(cleanCnpj);
                if (!lastPurchase) return { ...client, ativo: false, data_inativacao: 'Sem compras' };
                const inactivationDate = new Date(lastPurchase + 'T00:00:00');
                inactivationDate.setMonth(inactivationDate.getMonth() + 3);
                return { ...client, lastPurchaseDate: lastPurchase, data_inativacao: inactivationDate.toISOString().split('T')[0] };
            });

            await saveToLocal('views_cache', { ...await getFromLocal('views_cache', userId) as Record<string, unknown>, clientesUltimaCompra: data }, userId);
        } finally {
            totalDataStore.loading.clientesUltimaCompra = false;
        }
    }

    // 3. Vendas Clientes Mês
    if (needsUpdate || !totalDataStore.vendasClientesMes.length) {
        totalDataStore.loading.vendasClientesMes = true;
        try {
            const data = await fetchAllRecords<VendaClienteMes>(() => {
                let q = supabase.from('vw_vendas_clientes_mes').select('*');
                if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
                return q;
            });
            totalDataStore.vendasClientesMes = data;
            await saveToLocal('views_cache', { ...await getFromLocal('views_cache', userId) as Record<string, unknown>, vendasClientesMes: data }, userId);
        } finally {
            totalDataStore.loading.vendasClientesMes = false;
        }
    }

    // 4. Vendas Canais Mês
    if (needsUpdate || !totalDataStore.vendasCanaisMes.length) {
        totalDataStore.loading.vendasCanaisMes = true;
        try {
            const data = await fetchAllRecords<VendaCanalMes>(() => {
                let q = supabase.from('vw_vendas_canais_mes').select('*');
                if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
                return q;
            });
            totalDataStore.vendasCanaisMes = data;
            await saveToLocal('views_cache', { ...await getFromLocal('views_cache', userId) as Record<string, unknown>, vendasCanaisMes: data }, userId);
        } finally {
            totalDataStore.loading.vendasCanaisMes = false;
        }
    }

    // 5. Vendas Produtos Mês
    if (needsUpdate || !totalDataStore.vendasProdutosMes.length) {
        totalDataStore.loading.vendasProdutosMes = true;
        try {
            const data = await fetchAllRecords<VendaProdutoMes>(() => {
                let q = supabase.from('vw_vendas_produtos_mes').select('*');
                if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
                return q;
            });
            totalDataStore.vendasProdutosMes = data;
            await saveToLocal('views_cache', { ...await getFromLocal('views_cache', userId) as Record<string, unknown>, vendasProdutosMes: data }, userId);
        } finally {
            totalDataStore.loading.vendasProdutosMes = false;
        }
    }

    // 6. Metas
    if (!totalDataStore.targets.length) {
        totalDataStore.loading.targets = true;
        try {
            const data = await fetchAllRecords<Target>(() => {
                let q = supabase.from('metas_usuarios').select('*').in('ano', [2024, 2025, 2026, 2027]);
                if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
                return q;
            });
            totalDataStore.targets = data;
            await saveToLocal('targets_cache', data, userId);
        } finally {
            totalDataStore.loading.targets = false;
        }
    }

    // 7. Investimentos
    if (!totalDataStore.investments.length) {
        totalDataStore.loading.investments = true;
        try {
            const data = await fetchAllRecords<Investment>(() => {
                let q = supabase.from('investimentos').select('*').gte('data', `2024-01-01`).eq('status', 'approved');
                if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
                return q;
            });
            totalDataStore.investments = data;
            await saveToLocal('investments_cache', data, userId);
        } finally {
            totalDataStore.loading.investments = false;
        }
    }

    // Trigger update once at the end
    if (onUpdate) {
        onUpdate('all');
    }
};
