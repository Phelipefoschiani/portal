
import { totalDataStore } from './dataStore';

// --- TIPOS ---
export interface RepRanking {
    repId: string;
    repName: string;
    value: number;
    shareInPortfolio: number; // % do produto na carteira do rep
    lastSaleDate: string;
}

export interface ChannelDrillDown {
    [channelName: string]: {
        reps: {
            repId: string;
            repName: string;
            value: number; // Valor dos itens selecionados (Top 5)
            clients: {
                id: string;
                name: string;
                value: number; // Valor dos itens selecionados
                shareInClient: number; // % da compra do cliente que esses itens representam
            }[];
        }[];
    };
}

export interface RepGeneralDrillDown {
    [repId: string]: {
        top5General: { id: string; name: string; value: number; qty: number; share: number }[];
        channelShareGeneral: { channel: string; value: number; percentage: number }[];
        channelShareSelected: { channel: string; value: number; percentage: number }[];
    };
}

export interface GeneralMarketAnalysis {
    top5Products: {
        id: string;
        name: string;
        value: number;
        qty: number;
        shareRegional: number;
        repRanking: RepRanking[];
    }[];
    bottom10Products: {
        id: string;
        name: string;
        value: number;
        repRanking: RepRanking[];
    }[];
    top5Analysis: {
        shareByChannel: { channel: string; value: number; percentage: number }[];
        shareByRep: { repId: string; repName: string; value: number; percentage: number }[];
        top5Clients: { id: string; name: string; value: number; qty: number }[];
        channelDrillDown: ChannelDrillDown;
        repDrillDown: RepGeneralDrillDown;
    };
}

export interface SpecificProductAnalysis {
    summary: {
        totalValue: number;
        totalQty: number;
        totalRegionalValue: number; // Para calcular share global
        shareByRep: { repId: string; repName: string; value: number; percentage: number }[];
        shareByGroup: { group: string; value: number; percentage: number }[];
    };
    products: {
        id: string;
        name: string;
        value: number;
        qty: number;
    }[];
    repDrillDown: {
        [repId: string]: {
            repName: string;
            totalValue: number;
            clients: {
                id: string;
                name: string;
                channel: string; // Adicionado Canal
                totalValue: number;
                items: { productId: string; productName: string; value: number; qty: number; lastDate: string }[];
            }[];
        };
    };
}

// --- REGRA DE OURO: FILTRO DE CLIENTES ATIVOS ---
export const getActiveClientsForYear = (year: number): Set<string> => {
    const activeClients = new Set<string>();
    const previousYear = year - 1;
    
    totalDataStore.vendasConsolidadas.forEach(s => {
        const cnpj = String(s.cnpj || '').replace(/\D/g, '');
        if (s.ano === year) {
            activeClients.add(cnpj);
        } else if (s.ano === previousYear && s.mes >= 10) {
            activeClients.add(cnpj);
        }
    });

    return activeClients;
};

// --- GUIA 1: VISÃO DE MERCADO (AUTOMÁTICA) ---
export const generateGeneralMarketAnalysis = (
    year: number, 
    months: number[], 
    managerFilterId: string = 'all'
): GeneralMarketAnalysis => {
    const activeClients = getActiveClientsForYear(year);
    const productMap = new Map<string, { id: string; name: string; value: number; qty: number }>();
    let totalRegionalSales = 0;
    
    // Mapas Auxiliares para Drill-down
    const repTotalSales = new Map<string, number>(); // RepId -> Total Venda
    const clientTotalSales = new Map<string, number>(); // ClientId -> Total Venda
    const repProductSales = new Map<string, Map<string, { value: number; lastDate: string }>>(); // RepId -> ProductId -> { val, date }
    
    // 1. Identificar Top 5 e Bottom 10 e Totais
    totalDataStore.sales.forEach(s => {
        const d = new Date(s.data + 'T00:00:00');
        const m = d.getUTCMonth() + 1;
        const y = d.getUTCFullYear();
        const cnpj = String(s.cnpj || '').replace(/\D/g, '');

        if (y === year && months.includes(m) && activeClients.has(cnpj)) {
            if (managerFilterId !== 'all' && s.usuario_id !== managerFilterId) return;

            const val = Number(s.faturamento) || 0;
            const qty = Number(s.qtde_faturado) || 0;
            const pId = s.codigo_produto || s.produto;
            const repId = s.usuario_id;

            totalRegionalSales += val;

            // Totais por Rep e Cliente (para cálculos de share)
            repTotalSales.set(repId, (repTotalSales.get(repId) || 0) + val);
            clientTotalSales.set(cnpj, (clientTotalSales.get(cnpj) || 0) + val);

            // Totais por Produto
            const current = productMap.get(pId) || { id: pId, name: s.produto || 'N/I', value: 0, qty: 0 };
            current.value += val;
            current.qty += qty;
            productMap.set(pId, current);

            // Venda Rep-Produto
            if (!repProductSales.has(repId)) repProductSales.set(repId, new Map());
            const rpMap = repProductSales.get(repId)!;
            const rpCurrent = rpMap.get(pId) || { value: 0, lastDate: '0000-00-00' };
            rpCurrent.value += val;
            if (s.data > rpCurrent.lastDate) rpCurrent.lastDate = s.data;
            rpMap.set(pId, rpCurrent);
        }
    });

    const allProducts = Array.from(productMap.values());
    const top5 = [...allProducts].sort((a, b) => b.value - a.value).slice(0, 5);
    const bottom10 = [...allProducts].filter(p => p.value > 0).sort((a, b) => a.value - b.value).slice(0, 10);
    const top5Ids = new Set(top5.map(p => p.id));

    // 2. Gerar Rankings de Reps para Top 5 e Bottom 10
    const generateRepRanking = (pId: string): RepRanking[] => {
        const ranking: RepRanking[] = [];
        repProductSales.forEach((products, repId) => {
            if (products.has(pId)) {
                const data = products.get(pId)!;
                const repTotal = repTotalSales.get(repId) || 1;
                const repName = totalDataStore.users.find(u => u.id === repId)?.nome || 'N/I';
                ranking.push({
                    repId,
                    repName,
                    value: data.value,
                    shareInPortfolio: (data.value / repTotal) * 100,
                    lastSaleDate: data.lastDate
                });
            }
        });
        return ranking.sort((a, b) => b.value - a.value);
    };

    // 3. Analisar o Top 5 (Consolidado e Drill-downs)
    const channelMap = new Map<string, number>();
    const repMap = new Map<string, { name: string; value: number }>();
    const clientMap = new Map<string, { name: string; value: number; qty: number }>();
    let top5TotalValue = 0;

    // Estruturas para Drill-down Complexo
    const channelDrillDown: ChannelDrillDown = {};
    const repDrillDown: RepGeneralDrillDown = {};

    // Inicializar Rep Drill Down Maps
    totalDataStore.users.forEach(u => {
        if (managerFilterId !== 'all' && u.id !== managerFilterId) return;
        // Só inicializa se o rep teve venda
        if (repTotalSales.has(u.id)) {
            repDrillDown[u.id] = { top5General: [], channelShareGeneral: [], channelShareSelected: [] };
        }
    });

    // Iterar novamente para preencher os detalhes
    totalDataStore.sales.forEach(s => {
        const d = new Date(s.data + 'T00:00:00');
        const m = d.getUTCMonth() + 1;
        const y = d.getUTCFullYear();
        const cnpj = String(s.cnpj || '').replace(/\D/g, '');
        const pId = s.codigo_produto || s.produto;
        const repId = s.usuario_id;

        if (y === year && months.includes(m) && activeClients.has(cnpj)) {
            if (managerFilterId !== 'all' && repId !== managerFilterId) return;

            const val = Number(s.faturamento) || 0;
            const qty = Number(s.qtde_faturado) || 0;
            const client = totalDataStore.clients.find(c => String(c.cnpj).replace(/\D/g, '') === cnpj);
            const channel = client?.canal_vendas || 'GERAL';
            const repName = totalDataStore.users.find(u => u.id === repId)?.nome || 'N/I';

            // --- DADOS GERAIS DO REP (Para Drill-down) ---
            if (repDrillDown[repId]) {
                // Share Canal Geral
                const generalChannels = repDrillDown[repId].channelShareGeneral;
                const chIdx = generalChannels.findIndex(c => c.channel === channel);
                if (chIdx >= 0) generalChannels[chIdx].value += val;
                else generalChannels.push({ channel, value: val, percentage: 0 });
            }

            // --- DADOS DO TOP 5 SELECIONADO ---
            if (top5Ids.has(pId)) {
                top5TotalValue += val;

                // Canal
                channelMap.set(channel, (channelMap.get(channel) || 0) + val);

                // Rep
                const rData = repMap.get(repId) || { name: repName, value: 0 };
                rData.value += val;
                repMap.set(repId, rData);

                // Cliente
                const cData = clientMap.get(cnpj) || { name: client?.nome_fantasia || s.cliente_nome || 'N/I', value: 0, qty: 0 };
                cData.value += val;
                cData.qty += qty;
                clientMap.set(cnpj, cData);

                // Drill-down: Channel -> Rep -> Client
                if (!channelDrillDown[channel]) channelDrillDown[channel] = { reps: [] };
                let chRep = channelDrillDown[channel].reps.find(r => r.repId === repId);
                if (!chRep) {
                    chRep = { repId, repName, value: 0, clients: [] };
                    channelDrillDown[channel].reps.push(chRep);
                }
                chRep.value += val;
                
                let chClient = chRep.clients.find(c => c.id === cnpj);
                if (!chClient) {
                    chClient = { id: cnpj, name: cData.name, value: 0, shareInClient: 0 };
                    chRep.clients.push(chClient);
                }
                chClient.value += val;

                // Drill-down: Rep -> Channel Share Selected
                if (repDrillDown[repId]) {
                    const selChannels = repDrillDown[repId].channelShareSelected;
                    const chSelIdx = selChannels.findIndex(c => c.channel === channel);
                    if (chSelIdx >= 0) selChannels[chSelIdx].value += val;
                    else selChannels.push({ channel, value: val, percentage: 0 });
                }
            }
        }
    });

    // Finalizar Cálculos de Drill-down
    // 1. Channel Drill-down: Calcular Shares e Ordenar
    Object.values(channelDrillDown).forEach(ch => {
        ch.reps.forEach(r => {
            r.clients.forEach(c => {
                const totalClient = clientTotalSales.get(c.id) || 1;
                c.shareInClient = (c.value / totalClient) * 100;
            });
            r.clients.sort((a, b) => b.value - a.value);
        });
        ch.reps.sort((a, b) => b.value - a.value);
    });

    // 2. Rep Drill-down: Top 5 Geral e Porcentagens de Canal
    Object.keys(repDrillDown).forEach(repId => {
        const data = repDrillDown[repId];
        const repTotal = repTotalSales.get(repId) || 1;
        const repTop5Val = repMap.get(repId)?.value || 0; // Valor total do Top 5 Selecionado para esse Rep

        // Top 5 Geral do Rep
        const products = repProductSales.get(repId);
        if (products) {
            const sorted = Array.from(products.entries())
                .map(([pid, d]) => ({ 
                    id: pid, 
                    name: productMap.get(pid)?.name || 'N/I', 
                    value: d.value, 
                    qty: 0, // Simplificação
                    share: (d.value / repTotal) * 100 
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);
            data.top5General = sorted;
        }

        // Porcentagens Canal Geral
        data.channelShareGeneral.forEach(c => c.percentage = (c.value / repTotal) * 100);
        data.channelShareGeneral.sort((a, b) => b.value - a.value);

        // Porcentagens Canal Selecionado
        data.channelShareSelected.forEach(c => c.percentage = repTop5Val > 0 ? (c.value / repTop5Val) * 100 : 0);
        data.channelShareSelected.sort((a, b) => b.value - a.value);
    });

    return {
        top5Products: top5.map(p => ({
            ...p,
            shareRegional: totalRegionalSales > 0 ? (p.value / totalRegionalSales) * 100 : 0,
            repRanking: generateRepRanking(p.id)
        })),
        bottom10Products: bottom10.map(p => ({
            ...p,
            repRanking: generateRepRanking(p.id)
        })),
        top5Analysis: {
            shareByChannel: Array.from(channelMap.entries()).map(([c, v]) => ({ channel: c, value: v, percentage: (v / top5TotalValue) * 100 })).sort((a, b) => b.value - a.value),
            shareByRep: Array.from(repMap.entries()).map(([id, d]) => ({ repId: id, repName: d.name, value: d.value, percentage: (d.value / top5TotalValue) * 100 })).sort((a, b) => b.value - a.value),
            top5Clients: Array.from(clientMap.entries()).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.value - a.value).slice(0, 5),
            channelDrillDown,
            repDrillDown
        }
    };
};

// --- GUIA 2: ANÁLISE ESPECÍFICA (MANUAL) ---
export const generateSpecificAnalysis = (
    productIds: string[],
    year: number,
    months: number[],
    managerFilterId: string = 'all'
): SpecificProductAnalysis | null => {
    if (productIds.length === 0) return null;

    const activeClients = getActiveClientsForYear(year);
    const targetIds = new Set(productIds);

    let totalValue = 0;
    let totalQty = 0;
    let totalRegionalValue = 0; // Para calcular share global

    const repMap = new Map<string, { name: string; value: number }>();
    const groupMap = new Map<string, number>();
    const productStats = new Map<string, { name: string; value: number; qty: number }>();
    const repDrillDown: SpecificProductAnalysis['repDrillDown'] = {};

    totalDataStore.sales.forEach(s => {
        const d = new Date(s.data + 'T00:00:00');
        const m = d.getUTCMonth() + 1;
        const y = d.getUTCFullYear();
        const cnpj = String(s.cnpj || '').replace(/\D/g, '');
        
        if (y === year && months.includes(m) && activeClients.has(cnpj)) {
            if (managerFilterId !== 'all' && s.usuario_id !== managerFilterId) return;

            const val = Number(s.faturamento) || 0;
            totalRegionalValue += val; // Acumula total regional

            const pId = s.codigo_produto || s.produto;

            if (targetIds.has(pId)) {
                const qty = Number(s.qtde_faturado) || 0;
                const repId = s.usuario_id;
                const repName = totalDataStore.users.find(u => u.id === repId)?.nome || 'N/I';
                const group = s.grupo || 'GERAL';
                const pName = s.produto || 'N/I';
                const client = totalDataStore.clients.find(c => String(c.cnpj).replace(/\D/g, '') === cnpj);
                const channel = client?.canal_vendas || 'GERAL';

                // Totais Gerais
                totalValue += val;
                totalQty += qty;

                // Por Rep
                const rData = repMap.get(repId) || { name: repName, value: 0 };
                rData.value += val;
                repMap.set(repId, rData);

                // Por Grupo
                groupMap.set(group, (groupMap.get(group) || 0) + val);

                // Por Produto
                const pData = productStats.get(pId) || { name: pName, value: 0, qty: 0 };
                pData.value += val;
                pData.qty += qty;
                productStats.set(pId, pData);

                // Drill-down: Rep -> Cliente -> Item
                if (!repDrillDown[repId]) {
                    repDrillDown[repId] = { repName, totalValue: 0, clients: [] };
                }
                repDrillDown[repId].totalValue += val;

                let clientEntry = repDrillDown[repId].clients.find(c => c.id === cnpj);
                if (!clientEntry) {
                    clientEntry = { 
                        id: cnpj, 
                        name: client?.nome_fantasia || s.cliente_nome || 'N/I', 
                        channel, // Adicionado Canal
                        totalValue: 0, 
                        items: [] 
                    };
                    repDrillDown[repId].clients.push(clientEntry);
                }
                clientEntry.totalValue += val;

                let itemEntry = clientEntry.items.find(i => i.productId === pId);
                if (!itemEntry) {
                    itemEntry = { productId: pId, productName: pName, value: 0, qty: 0, lastDate: '0000-00-00' };
                    clientEntry.items.push(itemEntry);
                }
                itemEntry.value += val;
                itemEntry.qty += qty;
                if (s.data > itemEntry.lastDate) itemEntry.lastDate = s.data;
            }
        }
    });

    if (totalValue === 0) return null;

    return {
        summary: {
            totalValue,
            totalQty,
            totalRegionalValue,
            shareByRep: Array.from(repMap.entries()).map(([id, d]) => ({ repId: id, repName: d.name, value: d.value, percentage: (d.value / totalValue) * 100 })).sort((a, b) => b.value - a.value),
            shareByGroup: Array.from(groupMap.entries()).map(([g, v]) => ({ group: g, value: v, percentage: (v / totalValue) * 100 })).sort((a, b) => b.value - a.value)
        },
        products: Array.from(productStats.entries()).map(([id, d]) => ({ id, ...d })).sort((a, b) => b.value - a.value),
        repDrillDown
    };
};
