
import React, { useState, useEffect } from 'react';
import { Search, Filter, Users, Building2, User, Percent, Loader2, TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ClientDetailModal } from '../ClientDetailModal';

export const ManagerClientsScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [selectedRep, setSelectedRep] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<any | null>(null);
    const [reps, setReps] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [totalSalesGlobal, setTotalSalesGlobal] = useState(0);

    const CACHE_KEY = 'pcn_manager_clients_cache';
    const CACHE_TIME = 5 * 60 * 1000;

    useEffect(() => {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const { timestamp, reps: cachedReps, clients: cachedClients, totalSales } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TIME) {
                setReps(cachedReps);
                setClients(cachedClients);
                setTotalSalesGlobal(totalSales);
                setIsLoading(false);
                return;
            }
        }
        fetchInitialData();
    }, []);

    const fetchAllSalesForClients = async (year: number) => {
        let allData: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase
                .from('dados_vendas')
                .select('faturamento, cnpj')
                .gte('data', `${year}-01-01`)
                .lte('data', `${year}-12-31`)
                .range(from, to);
            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += 1000;
                to += 1000;
                if (data.length < 1000) hasMore = false;
            } else { hasMore = false; }
        }
        return allData;
    };

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const { data: repsData } = await supabase
                .from('usuarios')
                .select('id, nome, nivel_acesso')
                .not('nivel_acesso', 'ilike', 'admin')
                .not('nivel_acesso', 'ilike', 'gerente')
                .order('nome');
            
            const { data: clientsData } = await supabase.from('clientes').select('*, usuarios(nome, id)').order('nome_fantasia');
            const currentYear = new Date().getFullYear();
            const salesData = await fetchAllSalesForClients(currentYear);

            const salesMap = new Map();
            let totalFaturadoReal = 0;

            salesData.forEach(s => {
                const cleanCnpj = String(s.cnpj || '').replace(/\D/g, '');
                if (cleanCnpj) {
                    const faturamento = Number(s.faturamento) || 0;
                    salesMap.set(cleanCnpj, (salesMap.get(cleanCnpj) || 0) + faturamento);
                    totalFaturadoReal += faturamento;
                }
            });

            const enriched = clientsData?.map(c => ({
                ...c,
                totalPurchase: salesMap.get(String(c.cnpj || '').replace(/\D/g, '')) || 0,
                repName: c.usuarios?.nome || 'Sem Rep.',
                repId: c.usuarios?.id
            })) || [];

            setReps(repsData || []);
            setClients(enriched);
            setTotalSalesGlobal(totalFaturadoReal);
            
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ 
                timestamp: Date.now(), 
                reps: repsData, 
                clients: enriched, 
                totalSales: totalFaturadoReal 
            }));
        } catch (error) {
            console.error('Erro ao carregar carteira global:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredClients = clients.filter(c => {
        const repMatch = selectedRep === 'all' ? true : c.repId === selectedRep;
        const searchMatch = (c.nome_fantasia || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          String(c.cnpj || '').includes(searchTerm);
        return repMatch && searchMatch;
    }).sort((a, b) => b.totalPurchase - a.totalPurchase);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                <p className="font-bold uppercase text-[10px] tracking-widest animate-pulse text-center">Consolidando Carteira Global...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
            
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Carteira Global</h2>
                    <p className="text-slate-500 text-xs mt-1 font-bold uppercase tracking-wider">Gestão centralizada e auditoria de faturamento anual.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={() => fetchInitialData()} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                    <select 
                        value={selectedRep}
                        onChange={(e) => setSelectedRep(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl text-xs font-black uppercase px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm flex-1 min-w-[200px] cursor-pointer"
                    >
                        <option value="all">TODOS REPRESENTANTES</option>
                        {reps.map(r => <option key={r.id} value={r.id}>{r.nome.toUpperCase()}</option>)}
                    </select>
                    <div className="relative flex-1 min-w-[250px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar cliente ou CNPJ..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                         <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                <th className="px-8 py-5">Cliente / Local</th>
                                <th className="px-8 py-5">Representante</th>
                                <th className="px-8 py-5 text-right">Faturamento Ano</th>
                                <th className="px-8 py-5 text-center">Share no Faturado</th>
                                <th className="px-8 py-5 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredClients.map(client => {
                                const pctGlobal = totalSalesGlobal > 0 ? (client.totalPurchase / totalSalesGlobal) * 100 : 0;
                                return (
                                    <tr key={client.id} className="hover:bg-slate-50 cursor-pointer group transition-all" onClick={() => setSelectedClient(client)}>
                                        <td className="px-8 py-5">
                                            <div>
                                                <p className="font-black text-slate-800 group-hover:text-blue-600 transition-colors uppercase tracking-tight text-xs">{client.nome_fantasia}</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase mt-0.5 tracking-wider">{client.city || 'S/ CIDADE'} • {client.cnpj}</p>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-[9px] uppercase">
                                                    {client.repName.charAt(0)}
                                                </div>
                                                <span className="font-bold text-slate-600 text-xs uppercase">{client.repName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(client.totalPurchase)}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">{pctGlobal.toFixed(2)}%</span>
                                                <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pctGlobal * 10, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button className="p-2 bg-slate-100 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all"><TrendingUp className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedClient && <ClientDetailModal client={selectedClient} onClose={() => setSelectedClient(null)} />}
        </div>
    );
};
