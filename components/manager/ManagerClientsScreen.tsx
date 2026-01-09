
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Users, Building2, User, Percent, Loader2, TrendingUp, RefreshCw, Database, Tag, Info, CalendarClock, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ClientDetailModal } from '../ClientDetailModal';
import { totalDataStore } from '../../lib/dataStore';

export const ManagerClientsScreen: React.FC = () => {
    const now = new Date();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRep, setSelectedRep] = useState('all');
    const [selectedChannel, setSelectedChannel] = useState('all');
    const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<any | null>(null);

    const availableYears = [2024, 2025, 2026, 2027];

    // 1. Extrair canais únicos da base hidratada
    const channels = useMemo(() => {
        const set = new Set<string>();
        totalDataStore.clients.forEach(c => {
            if (c.canal_vendas) set.add(c.canal_vendas);
        });
        return Array.from(set).sort();
    }, []);

    // 2. Motor de Processamento com Base Dinâmica
    const processedData = useMemo(() => {
        const sales = totalDataStore.sales;
        const clients = totalDataStore.clients;
        const usersMap = new Map(totalDataStore.users.map(u => [u.id, u.nome]));

        // Filtro A: Clientes que batem com os critérios de Rep, Canal e Busca
        const filteredClientsBase = clients.filter(c => {
            const repMatch = selectedRep === 'all' ? true : c.usuario_id === selectedRep;
            const channelMatch = selectedChannel === 'all' ? true : c.canal_vendas === selectedChannel;
            const searchMatch = c.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase()) || 
                               (c.cnpj && c.cnpj.includes(searchTerm));
            return repMatch && channelMatch && searchMatch;
        });

        const filteredCnpjs = new Set(filteredClientsBase.map(c => String(c.cnpj || '').replace(/\D/g, '')));

        // Filtro B: Vendas APENAS dos clientes filtrados acima e no ANO selecionado
        const relevantSales = sales.filter(s => {
            const cleanCnpj = String(s.cnpj || '').replace(/\D/g, '');
            const matchClient = filteredCnpjs.has(cleanCnpj);
            const saleDate = new Date(s.data + 'T00:00:00');
            const matchYear = selectedYear === 'all' ? true : saleDate.getUTCFullYear() === selectedYear;
            return matchClient && matchYear;
        });

        const totalGroupFaturamento = relevantSales.reduce((acc, s) => acc + (Number(s.faturamento) || 0), 0);

        // Mapear faturamento individual e última data de compra
        const statsMap = new Map<string, { faturamento: number; lastDate: string }>();
        relevantSales.forEach(s => {
            const cleanCnpj = String(s.cnpj || '').replace(/\D/g, '');
            const current = statsMap.get(cleanCnpj) || { faturamento: 0, lastDate: '0000-00-00' };
            statsMap.set(cleanCnpj, {
                faturamento: current.faturamento + (Number(s.faturamento) || 0),
                lastDate: s.data > current.lastDate ? s.data : current.lastDate
            });
        });

        // Enriquecer lista final
        const ranking = filteredClientsBase.map(c => {
            const stats = statsMap.get(String(c.cnpj || '').replace(/\D/g, ''));
            const fat = stats?.faturamento || 0;
            const lastDate = stats?.lastDate || null;
            
            return {
                ...c,
                totalPurchase: fat,
                lastPurchase: lastDate,
                repName: usersMap.get(c.usuario_id) || 'Sem Rep.',
                participation: totalGroupFaturamento > 0 ? (fat / totalGroupFaturamento) * 100 : 0
            };
        }).sort((a, b) => b.totalPurchase - a.totalPurchase);

        return {
            ranking,
            totalGroupFaturamento
        };
    }, [selectedRep, selectedChannel, searchTerm, selectedYear]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

    const checkLastPurchaseStatus = (dateStr: string | null) => {
        if (!dateStr || dateStr === '0000-00-00') return { label: 'S/ REGISTRO', isOld: true };
        
        const lastDate = new Date(dateStr + 'T00:00:00');
        const diffTime = Math.abs(now.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return {
            label: lastDate.toLocaleDateString('pt-BR'),
            isOld: diffDays > 90,
            days: diffDays
        };
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
            <div className="flex flex-col lg:flex-row justify-between items-end gap-4">
                <div className="w-full lg:w-auto">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Carteira Total</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-2">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                        {selectedChannel === 'all' ? 'Ranking Geral Regional' : `Análise de Participação: ${selectedChannel}`}
                    </p>
                </div>
                
                <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                    {/* Filtro Rep */}
                    <div className="relative flex-1 lg:flex-none">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <select 
                            value={selectedRep}
                            onChange={(e) => setSelectedRep(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                        >
                            <option value="all">TODOS REPRESENTANTES</option>
                            {totalDataStore.users.map(r => <option key={r.id} value={r.id}>{r.nome.toUpperCase()}</option>)}
                        </select>
                    </div>

                    {/* Filtro Canal */}
                    <div className="relative flex-1 lg:flex-none">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <select 
                            value={selectedChannel}
                            onChange={(e) => setSelectedChannel(e.target.value)}
                            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                        >
                            <option value="all">TODOS OS CANAIS</option>
                            {channels.map(ch => <option key={ch} value={ch}>{ch.toUpperCase()}</option>)}
                        </select>
                    </div>

                    {/* Filtro de Ano */}
                    <div className="relative flex-1 lg:flex-none">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <select 
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                        >
                            <option value="all">HISTÓRICO TOTAL</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    {/* Busca */}
                    <div className="relative flex-1 min-w-[200px]">
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

            {/* Resumo da Base Dinâmica */}
            {processedData.totalGroupFaturamento > 0 && (
                <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-blue-600">
                    <div>
                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">Faturamento da Seleção (100%)</p>
                        <h3 className="text-2xl font-black">{formatCurrency(processedData.totalGroupFaturamento)}</h3>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-2xl border border-white/5">
                        <Info className="w-4 h-4 text-blue-400" />
                        <p className="text-[10px] font-bold text-slate-400 leading-tight">
                            A porcentagem de participação abaixo refere-se à fatia <br/> que o cliente ocupa neste montante filtrado de {selectedYear === 'all' ? 'todo o período' : selectedYear}.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                         <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                <th className="px-8 py-5">Cliente / Local</th>
                                <th className="px-6 py-5">Última Compra</th>
                                <th className="px-6 py-5">Representante</th>
                                <th className="px-6 py-5">Canal</th>
                                <th className="px-6 py-5 text-right">Faturamento No Ano</th>
                                <th className="px-8 py-5 text-right">Participação (%)</th>
                                <th className="px-8 py-5 text-center">Ver</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {processedData.ranking.map((client, idx) => {
                                const purchaseStatus = checkLastPurchaseStatus(client.lastPurchase);
                                return (
                                    <tr key={client.id} className="hover:bg-slate-50 cursor-pointer group transition-all" onClick={() => setSelectedClient(client)}>
                                        <td className="px-8 py-5">
                                            <div>
                                                <p className="font-black text-slate-800 group-hover:text-blue-600 transition-colors uppercase tracking-tight text-xs">{client.nome_fantasia}</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase mt-0.5 tracking-wider">{client.city || 'S/ CIDADE'} • {client.cnpj}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider ${purchaseStatus.isOld ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                                    <CalendarClock className="w-3 h-3" />
                                                    {purchaseStatus.label}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="font-bold text-slate-600 text-[10px] uppercase bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">{client.repName}</span>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{client.canal_vendas || 'GERAL'}</span>
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(client.totalPurchase)}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col items-end gap-1.5">
                                                <span className={`text-[11px] font-black tabular-nums ${client.participation > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                                                    {client.participation.toFixed(2)}%
                                                </span>
                                                <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    {/* Fixed malformed className and style attribute */}
                                                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(client.participation, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <button className="p-2.5 bg-slate-50 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                <TrendingUp className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {processedData.ranking.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-32 text-center text-slate-400">
                                        <div className="flex flex-col items-center">
                                            <Building2 className="w-16 h-16 mb-4 opacity-10 text-blue-600" />
                                            <p className="font-black uppercase text-xs tracking-[0.3em]">Nenhum cliente mapeado para este critério.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedClient && <ClientDetailModal client={selectedClient} onClose={() => setSelectedClient(null)} />}
        </div>
    );
};
