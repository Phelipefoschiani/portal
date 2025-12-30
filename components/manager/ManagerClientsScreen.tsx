
import React, { useState, useEffect } from 'react';
import { Search, Filter, Users, Building2, User, Percent, Loader2, TrendingUp, RefreshCw, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ClientDetailModal } from '../ClientDetailModal';
import { totalDataStore } from '../../lib/dataStore';

export const ManagerClientsScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRep, setSelectedRep] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<any | null>(null);
    const [enrichedClients, setEnrichedClients] = useState<any[]>([]);
    const [totalSalesTotal, setTotalSalesTotal] = useState(0);

    useEffect(() => {
        processClientData();
    }, [selectedRep]);

    const processClientData = () => {
        const reps = totalDataStore.users;
        const clients = totalDataStore.clients;
        const sales = totalDataStore.sales;

        const salesMap = new Map();
        let totalFaturadoReal = 0;

        sales.forEach(s => {
            const cleanCnpj = String(s.cnpj || '').replace(/\D/g, '');
            if (cleanCnpj) {
                const faturamento = Number(s.faturamento) || 0;
                salesMap.set(cleanCnpj, (salesMap.get(cleanCnpj) || 0) + faturamento);
                totalFaturadoReal += faturamento;
            }
        });

        const enriched = clients.map(c => ({
            ...c,
            totalPurchase: salesMap.get(String(c.cnpj || '').replace(/\D/g, '')) || 0,
            repName: c.usuarios?.nome || 'Sem Rep.',
            repId: c.usuarios?.id
        }));

        setEnrichedClients(enriched);
        setTotalSalesTotal(totalFaturadoReal);
    };

    const filteredClients = enrichedClients.filter(c => {
        const repMatch = selectedRep === 'all' ? true : c.repId === selectedRep;
        const searchMatch = (c.nome_fantasia || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          String(c.cnpj || '').includes(searchTerm);
        return repMatch && searchMatch;
    }).sort((a, b) => b.totalPurchase - a.totalPurchase);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Carteira Total</h2>
                    <p className="text-slate-500 text-xs mt-1 font-bold uppercase tracking-wider">Gestão centralizada e auditoria de faturamento anual.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <select 
                        value={selectedRep}
                        onChange={(e) => setSelectedRep(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl text-xs font-black uppercase px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm flex-1 min-w-[200px] cursor-pointer"
                    >
                        <option value="all">TODOS REPRESENTANTES</option>
                        {totalDataStore.users.map(r => <option key={r.id} value={r.id}>{r.nome.toUpperCase()}</option>)}
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
                                const pctTotal = totalSalesTotal > 0 ? (client.totalPurchase / totalSalesTotal) * 100 : 0;
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
                                                <span className="font-bold text-slate-600 text-xs uppercase">{client.repName}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(client.totalPurchase)}</td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">{pctTotal.toFixed(2)}%</span>
                                                <div className="w-24 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(pctTotal * 10, 100)}%` }}></div>
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
