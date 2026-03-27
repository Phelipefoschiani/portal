import { supabase } from './supabase';
import { totalDataStore } from './dataStore';
import { saveToLocal } from './storage';
import { Client, Target, Investment, User, VendaConsolidada, ClienteUltimaCompra, VendaClienteMes, VendaCanalMes, VendaProdutoMes, Sale } from '../types';
import { aggregateSales } from './aggregations';

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

export const performBackgroundSync = async (userId: string, userRole: string) => {
    try {
        console.log('[Sync] Iniciando sincronização em segundo plano...');

        const getUsersQuery = () => supabase
          .from('usuarios')
          .select('id, nome, nivel_acesso')
          .not('nivel_acesso', 'ilike', 'admin')
          .not('nivel_acesso', 'ilike', 'gerente')
          .not('nivel_acesso', 'ilike', 'director')
          .not('nivel_acesso', 'ilike', 'diretor')
          .order('nome');

        const getClientQuery = () => {
            let q = supabase.from('clientes').select('*, usuarios(nome, id)');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };

        const getSalesQuery = () => {
            let q = supabase.from('dados_vendas').select('*');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };

        const getTargetQuery = () => {
            let q = supabase.from('metas_usuarios').select('*').in('ano', [2024, 2025, 2026, 2027]);
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };

        const getInvQuery = () => {
            let q = supabase.from('investimentos').select('*').gte('data', `2024-01-01`).eq('status', 'approved');
            if (userRole !== 'admin' && userRole !== 'director') q = q.eq('usuario_id', userId);
            return q;
        };

        const [
            users,
            clients,
            sales,
            targets,
            invs
        ] = await Promise.all([
            fetchAllRecords<User>(getUsersQuery),
            fetchAllRecords<Client>(getClientQuery),
            fetchAllRecords<Sale>(getSalesQuery),
            fetchAllRecords<Target>(getTargetQuery),
            fetchAllRecords<Investment>(getInvQuery)
        ]);

        const aggregations = aggregateSales(sales);
        const { vendasConsolidadas, clientesUltimaCompra, vendasClientesMes, vendasCanaisMes, vendasProdutosMes } = aggregations;

        // Otimização: Atualizar lastPurchaseDate dos clientes
        const ultimaCompraMap = new Map<string, string>();
        clientesUltimaCompra.forEach(c => {
            if (c.cnpj) ultimaCompraMap.set(c.cnpj.replace(/\D/g, ''), c.ultima_compra);
        });

        const processedClients = clients.map(client => {
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

        // Update DataStore
        totalDataStore.users = users;
        totalDataStore.clients = processedClients;
        totalDataStore.sales = sales;
        totalDataStore.vendasConsolidadas = vendasConsolidadas;
        totalDataStore.clientesUltimaCompra = clientesUltimaCompra;
        totalDataStore.vendasClientesMes = vendasClientesMes;
        totalDataStore.vendasCanaisMes = vendasCanaisMes;
        totalDataStore.vendasProdutosMes = vendasProdutosMes;
        totalDataStore.targets = targets;
        totalDataStore.investments = invs;

        // Save to cache
        await Promise.all([
            saveToLocal('users_cache', users, userId),
            saveToLocal('clients_cache', processedClients, userId),
            saveToLocal('sales_cache', sales, userId),
            saveToLocal('vendas_consolidadas_cache', vendasConsolidadas, userId),
            saveToLocal('clientes_ultima_compra_cache', clientesUltimaCompra, userId),
            saveToLocal('vendas_clientes_mes_cache', vendasClientesMes, userId),
            saveToLocal('vendas_canais_mes_cache', vendasCanaisMes, userId),
            saveToLocal('vendas_produtos_mes_cache', vendasProdutosMes, userId),
            saveToLocal('targets_cache', targets, userId),
            saveToLocal('investments_cache', invs, userId),
            saveToLocal('last_sync', Date.now(), userId)
        ]);

        console.log('[Sync] Sincronização em segundo plano concluída com sucesso!');
        
        // Disparar evento para atualizar UI se necessário
        window.dispatchEvent(new CustomEvent('pcn_sync_complete'));

    } catch (error) {
        console.error('[Sync] Erro na sincronização em segundo plano:', error);
    }
};
