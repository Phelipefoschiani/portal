
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BarChart3, TrendingUp, ChevronRight, ArrowUpRight, ArrowDownRight, Users, Loader2, X, AlertCircle, Tag, CheckSquare, Square, ChevronDown } from 'lucide-react';
import { Button } from '../Button';
import { createPortal } from 'react-dom';
import { totalDataStore } from '../../lib/dataStore';
import { useSalesData } from '../../hooks/useSalesData';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface SalesSource {
    usuario_id: string;
    canal_vendas: string;
    mes?: number;
    ano?: number;
    data?: string;
    faturamento_total?: number;
    faturamento?: number;
}

// --- COMPONENTE DE DETALHAMENTO DO CLIENTE ---
const ClientDetailModal: React.FC<{
    client: { cnpj: string; name: string };
    year: number;
    userId: string;
    onClose: () => void;
    formatBRL: (v: number) => string;
    monthNames: string[];
}> = ({ client, year, userId, onClose, formatBRL, monthNames }) => {
    const data = useMemo(() => {
        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const monthTotalRep = totalDataStore.vendasClientesMes
                .filter(s => s.usuario_id === userId && s.ano === year && s.mes === month)
                .reduce((acc, curr) => acc + Number(curr.faturamento_total), 0);
            
            const clientMonthTotal = totalDataStore.vendasClientesMes
                .filter(s => s.usuario_id === userId && s.ano === year && s.mes === month && String(s.cnpj || '').replace(/\D/g, '') === String(client.cnpj || '').replace(/\D/g, ''))
                .reduce((acc, curr) => acc + Number(curr.faturamento_total), 0);

            return {
                name: monthNames[i].substring(0, 3),
                total: clientMonthTotal,
                participation: monthTotalRep > 0 ? (clientMonthTotal / monthTotalRep) * 100 : 0
            };
        });
        return monthlyData;
    }, [client, year, userId, monthNames]);

    return createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{client.name}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Análise de Fidelidade {year}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                <div className="p-6 md:p-8">
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} tickFormatter={(v) => `R$ ${v/1000}k`} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: number | string | undefined, name: string | undefined) => [String(name) === 'total' ? formatBRL(Number(value || 0)) : `${Number(value || 0).toFixed(1)}%`, String(name) === 'total' ? 'Faturamento' : 'Participação']}
                                />
                                <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} name="total" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total no Ano</p>
                            <p className="text-lg font-black text-slate-900">{formatBRL(data.reduce((a, b) => a + b.total, 0))}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Média de Part.</p>
                            <p className="text-lg font-black text-blue-600">{(data.reduce((a, b) => a + b.participation, 0) / 12).toFixed(1)}%</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- COMPONENTE DE DECOMPOSIÇÃO POR CANAL ---
const MonthlyChannelBreakdown: React.FC<{
    monthIdx: number;
    year: number;
    userId: string;
    formatBRL: (v: number) => string;
}> = ({ monthIdx, year, userId, formatBRL }) => {
    const breakdown = useMemo(() => {
        const clientNameLookup = new Map();
        totalDataStore.clients.forEach(c => {
            const clean = String(c.cnpj || '').replace(/\D/g, '');
            clientNameLookup.set(clean, c.nome_fantasia);
        });

        const sales = totalDataStore.vendasConsolidadas.filter(s => {
            return s.usuario_id === userId && s.mes === (monthIdx + 1) && s.ano === year;
        });

        const monthTotal = sales.reduce((a, b) => a + Number(b.faturamento_total), 0);
        const channelMap = new Map<string, {
            label: string;
            total: number;
            clients: Map<string, { name: string; total: number }>;
        }>();

        sales.forEach(s => {
            const cName = s.canal_vendas || 'GERAL / OUTROS';
            if (!channelMap.has(cName)) {
                channelMap.set(cName, { label: cName, total: 0, clients: new Map() });
            }
            const channel = channelMap.get(cName);
            if (channel) {
                channel.total += Number(s.faturamento_total);

                const cnpjClean = String(s.cnpj || '').replace(/\D/g, '');
                if (!channel.clients.has(cnpjClean)) {
                    channel.clients.set(cnpjClean, { 
                        name: (s.cliente_nome || clientNameLookup.get(cnpjClean) || `CNPJ: ${s.cnpj}`).trim().toUpperCase(), 
                        total: 0 
                    });
                }
                const client = channel.clients.get(cnpjClean);
                if (client) {
                    client.total += Number(s.faturamento_total);
                }
            }
        });

        return Array.from(channelMap.values())
            .sort((a, b) => b.total - a.total)
            .map(ch => ({
                ...ch,
                shareInMonth: monthTotal > 0 ? (ch.total / monthTotal) * 100 : 0,
                clients: Array.from(ch.clients.values())
                    .sort((a, b) => b.total - a.total)
                    .map(c => ({
                        ...c,
                        shareInChannel: ch.total > 0 ? (c.total / ch.total) * 100 : 0
                    }))
            }));
    }, [monthIdx, year, userId]);

    if (breakdown.length === 0) return (
        <div className="py-12 text-center text-slate-300">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-black uppercase tracking-widest text-[10px]">Sem faturamento detalhado neste mês</p>
        </div>
    );

    return (
        <div className="space-y-6 md:space-y-8 mt-6 md:mt-8">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <Tag className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                <h4 className="text-xs md:text-sm font-black text-slate-900 uppercase tracking-widest">Distribuição por Canal</h4>
            </div>
            
            {breakdown.map((channel, cIdx) => (
                <div key={cIdx} className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between bg-slate-900 text-white p-4 md:p-5 rounded-2xl shadow-lg border-b-4 border-blue-600">
                        <span className="font-black uppercase tracking-tight text-[10px] md:text-sm">{channel.label}</span>
                        <div className="text-right">
                            <p className="text-sm md:text-lg font-black">{formatBRL(channel.total)}</p>
                            <p className="text-[8px] md:text-[9px] font-black text-blue-400 uppercase tracking-widest">{channel.shareInMonth.toFixed(1)}% do mês</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                <tr>
                                    <th className="px-4 md:px-6 py-3">Cliente</th>
                                    <th className="px-4 md:px-6 py-3 text-right">Faturado</th>
                                    <th className="px-4 md:px-6 py-3 text-right hidden md:table-cell">Part.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {channel.clients.map((client, clIdx) => (
                                    <tr key={clIdx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 md:px-6 py-3 text-[10px] md:text-[11px] font-bold text-slate-700 uppercase truncate max-w-[150px] md:max-w-[300px]">{client.name}</td>
                                        <td className="px-4 md:px-6 py-3 text-right font-black text-slate-900 text-[10px] md:text-[11px] tabular-nums">{formatBRL(client.total)}</td>
                                        <td className="px-4 md:px-6 py-3 text-right hidden md:table-cell">
                                            <span className="text-[10px] font-black text-blue-600">{client.shareInChannel.toFixed(1)}%</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};

import { LoadingOverlay } from '../LoadingOverlay';

interface MonthlyStat {
    month: number;
    sales: number;
    target: number;
    prevSales: number;
    positive: number;
}

interface RepAnalysisScreenProps {
    updateTrigger?: number;
}

export const RepAnalysisScreen: React.FC<RepAnalysisScreenProps> = ({ updateTrigger = 0 }) => {
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [, setForceUpdate] = useState(0);
    
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    
    const allMonths = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], []);
    useSalesData(selectedYear, allMonths, updateTrigger, () => setForceUpdate(prev => prev + 1));

    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'metas' | 'canais' | 'grupos' | 'clientes'>('metas');
    const [selectedClientForDetail, setSelectedClientForDetail] = useState<{ cnpj: string; name: string } | null>(null);

    const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
    const userId = session.id;

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowMonthDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const stats: { monthly: MonthlyStat[] } = useMemo(() => {
        void updateTrigger;
        const sales = totalDataStore.vendasConsolidadas;
        const targets = totalDataStore.targets;

        // Group sales by year and month to avoid cumulative issues and handle deduplication
        const salesByYearMonth = new Map<string, number>();
        
        sales.forEach(s => {
            if (s.usuario_id === userId) {
                const key = `${s.cnpj}-${s.ano}-${s.mes}`;
                // We take the latest record for each client/month/year to deduplicate
                salesByYearMonth.set(key, Number(s.faturamento_total) || 0);
            }
        });

        const monthly = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            
            let mSales = 0;
            let mPrevSales = 0;

            salesByYearMonth.forEach((val, key) => {
                const parts = key.split('-');
                const sMes = Number(parts[parts.length - 1]);
                const sAno = Number(parts[parts.length - 2]);
                
                if (sMes === month) {
                    if (sAno === selectedYear) mSales += val;
                    if (sAno === selectedYear - 1) mPrevSales += val;
                }
            });
            
            const targetObj = targets.find(t => 
                t.usuario_id === userId && t.ano === selectedYear && t.mes === month
            );
            const mTarget = targetObj ? Number(targetObj.valor) : 0;

            const mPositive = new Set(totalDataStore.vendasClientesMes
                .filter(s => s.usuario_id === userId && s.ano === selectedYear && s.mes === month)
                .map(s => String(s.cnpj || '').replace(/\D/g, ''))).size;

            return { month, sales: mSales, target: mTarget, prevSales: mPrevSales, positive: mPositive };
        });

        return { monthly };
    }, [selectedYear, userId, updateTrigger]);

    const handleApplyFilter = () => {
        setSelectedMonths([...tempSelectedMonths]);
        setShowMonthDropdown(false);
    };

    const getMonthsLabel = () => {
        if (selectedMonths.length === 0) return "Selecionar";
        if (selectedMonths.length === 1) return monthNames[selectedMonths[0] - 1].toUpperCase();
        if (selectedMonths.length === 12) return "ANO COMPLETO";
        return `${selectedMonths.length} MESES`;
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    if (!stats) return (
        <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
            <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Processando Inteligência...</p>
        </div>
    );

    const isLoading = Object.values(totalDataStore.loading).some(v => v === true);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-4 md:space-y-8 animate-fadeIn pb-20">
            
            {/* Header Mobile Otimizado */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-2 md:px-4">
                <div className="w-full md:w-auto">
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">ANÁLISES</h2>
                    <p className="text-[8px] md:text-[10px] font-black text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-widest">
                        <BarChart3 className="w-3 md:w-3.5 h-3 md:h-3.5 text-blue-500" /> Cockpit de Performance
                    </p>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none">
                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 md:py-2.5 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer">
                            <option value={2024}>2024</option>
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                        </select>
                    </div>

                    {activeTab !== 'metas' && (
                        <div className="relative flex-1 md:flex-none" ref={dropdownRef}>
                            <button 
                                onClick={() => {
                                    setTempSelectedMonths([...selectedMonths]);
                                    setShowMonthDropdown(!showMonthDropdown);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 md:py-2.5 text-[10px] font-black uppercase flex items-center gap-2 shadow-sm hover:bg-slate-50 justify-between transition-all"
                            >
                                <span className="truncate">{getMonthsLabel()}</span>
                                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {showMonthDropdown && (
                                <div className="absolute top-full right-0 mt-2 w-64 md:w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
                                        <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[8px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all">Todos</button>
                                        <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[8px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-all">Limpar</button>
                                    </div>
                                    <div className="p-2 grid grid-cols-2 gap-1 max-h-60 md:max-h-64 overflow-y-auto custom-scrollbar">
                                        {monthNames.map((m, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => setTempSelectedMonths(prev => prev.includes(i+1) ? prev.filter(x => x !== i+1) : [...prev, i+1])}
                                                className={`flex items-center gap-2 p-2 rounded-xl text-[9px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                            >
                                                {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-20" />}
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 border-t border-slate-100 bg-slate-50">
                                        <button 
                                            onClick={handleApplyFilter}
                                            className="w-full bg-blue-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                        >
                                            Aplicar Filtro
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* Navegação por Abas */}
            <div className="px-2 md:px-4">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('metas')}
                        className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'metas' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Análises
                    </button>
                    <button 
                        onClick={() => setActiveTab('canais')}
                        className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'canais' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Canais
                    </button>
                    <button 
                        onClick={() => setActiveTab('grupos')}
                        className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'grupos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Grupos
                    </button>
                    <button 
                        onClick={() => setActiveTab('clientes')}
                        className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'clientes' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Clientes
                    </button>
                </div>
            </div>

            {activeTab === 'metas' && (
                <>
                    {/* Gráfico Principal - Recharts */}
                    <div className="bg-white p-4 md:p-10 rounded-[32px] md:rounded-[48px] border border-slate-200 shadow-sm relative overflow-hidden mx-2 md:mx-auto max-w-6xl mt-6">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-[10px] md:text-sm font-black text-slate-900 uppercase tracking-widest">Realizado vs Meta Mensal (Anual)</h3>
                                <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase mt-1">Barras representam o Objetivo Planejado</p>
                            </div>
                            <div className="flex gap-3 md:gap-6">
                                <div className="flex items-center gap-1 md:gap-2">
                                    <div className="w-2 h-2 md:w-3 md:h-3 bg-blue-600 rounded-full"></div>
                                    <span className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">Objetivo</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-[300px] md:h-[400px] w-full">
                            {(() => {
                                const chartData = stats.monthly.map((item, idx) => ({
                                    name: monthShort[idx],
                                    target: item.target,
                                    sales: item.sales,
                                    achievement: item.target > 0 ? (item.sales / item.target) * 100 : 0,
                                    monthIdx: idx
                                }));

                                return (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 30, right: 10, left: 10, bottom: 0 }} onClick={(data) => {
                                            const d = data as { activePayload?: { payload: { monthIdx: number } }[] };
                                            if (d && d.activePayload && d.activePayload.length > 0) {
                                                setSelectedMonthIdx(d.activePayload[0].payload.monthIdx);
                                            }
                                        }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} 
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} 
                                                tickFormatter={(v) => `R$ ${v/1000}k`}
                                            />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: string | number | undefined, name: string | undefined) => [
                                                    name === 'target' ? formatBRL(Number(value || 0)) : `${Number(value || 0).toFixed(1)}%`,
                                                    name === 'target' ? 'Objetivo' : 'Atingimento'
                                                ]}
                                            />
                                            <Bar 
                                                dataKey="target" 
                                                fill="#2563eb" 
                                                radius={[8, 8, 0, 0]} 
                                                name="target"
                                                label={(props: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => {
                                                    const { x, y, width, index } = props;
                                                    if (index === undefined) return null;
                                                    const achievement = chartData[index].achievement;
                                                    return (
                                                        <text 
                                                            x={Number(x || 0) + Number(width || 0) / 2} 
                                                            y={Number(y || 0) - 10} 
                                                            fill={achievement >= 100 ? '#1d4ed8' : '#dc2626'} 
                                                            textAnchor="middle" 
                                                            fontSize={10} 
                                                            fontWeight={900}
                                                        >
                                                            {achievement.toFixed(0)}%
                                                        </text>
                                                    );
                                                }}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Visualização de Dados Mensais (Desktop) */}
                    <div className="hidden md:block bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm mx-4">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                    <th className="px-8 py-5">Mês</th>
                                    <th className="px-8 py-5">Meta Planejada</th>
                                    <th className="px-8 py-5">Faturado Real</th>
                                    <th className="px-8 py-5 text-center">% Atingimento</th>
                                    <th className="px-8 py-5 text-center">Ano a Ano</th>
                                    <th className="px-8 py-5 text-right">Positivação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {stats.monthly.map((m: MonthlyStat, idx: number) => {
                                    const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                                    const growth = m.prevSales > 0 ? ((m.sales / m.prevSales) - 1) * 100 : 0;
                                    return (
                                        <tr 
                                            key={idx} 
                                            className="group hover:bg-blue-50/40 transition-colors cursor-pointer"
                                            onClick={() => setSelectedMonthIdx(m.month - 1)}
                                        >
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-slate-700 uppercase text-xs">{monthNames[m.month - 1]}</span>
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                </div>
                                            </td>
                                            <td className="px-8 py-4 text-slate-400 font-medium">{formatBRL(m.target)}</td>
                                            <td className="px-8 py-4 text-slate-900 font-black">{formatBRL(m.sales)}</td>
                                            <td className="px-8 py-4 text-center">
                                                <span className={`px-3 py-1 rounded-full text-[9px] font-black border ${achievement >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                    {achievement.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-center">
                                                {m.sales > 0 ? (
                                                    <div className={`flex items-center justify-center gap-1 text-[10px] font-black ${growth >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                                        {growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {Math.abs(growth).toFixed(1)}%
                                                    </div>
                                                ) : <span className="text-slate-200">--</span>}
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black">
                                                    {m.positive} Clts
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Visualização de Dados Mensais (Mobile) - Layout em Cards Empilhados */}
                    <div className="md:hidden space-y-3 px-2">
                        {stats.monthly.map((m: MonthlyStat, idx: number) => {
                            const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                            return (
                                <div 
                                    key={idx} 
                                    onClick={() => setSelectedMonthIdx(m.month - 1)}
                                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="font-black text-slate-800 uppercase text-[10px] tracking-widest">{monthNames[m.month - 1]}</span>
                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase ${achievement >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                            {achievement.toFixed(1)}%
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Faturado</p>
                                            <p className="text-xs font-black text-slate-900">{formatBRL(m.sales)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Objetivo</p>
                                            <p className="text-xs font-bold text-slate-500">{formatBRL(m.target)}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Users className="w-3 h-3" /> {m.positive} Clientes Ativos
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-slate-300" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {activeTab === 'canais' && (
                <div className="px-2 md:px-4 space-y-6">
                    <div className="bg-white p-6 md:p-10 rounded-[32px] border border-slate-200 shadow-sm">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <h3 className="text-sm md:text-lg font-black text-slate-900 uppercase tracking-widest">Performance por Canal de Venda</h3>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 h-[400px]">
                                {(() => {
                                    const channelSales = new Map<string, number>();
                                    // Fallback to granular sales if the monthly view is empty
                                    const source = totalDataStore.vendasCanaisMes.length > 0 
                                        ? totalDataStore.vendasCanaisMes 
                                        : totalDataStore.sales;

                                    (source as SalesSource[]).forEach(s => {
                                        const sMes = 'mes' in s && s.mes !== undefined ? s.mes : (s.data ? new Date(s.data).getUTCMonth() + 1 : 0);
                                        const sAno = 'ano' in s && s.ano !== undefined ? s.ano : (s.data ? new Date(s.data).getUTCFullYear() : 0);
                                        const sFaturamento = 'faturamento_total' in s ? s.faturamento_total : s.faturamento;

                                        if (s.usuario_id === userId && sAno === selectedYear && selectedMonths.includes(sMes)) {
                                            const val = channelSales.get(s.canal_vendas) || 0;
                                            channelSales.set(s.canal_vendas, val + Number(sFaturamento || 0));
                                        }
                                    });
                                    const chartData = Array.from(channelSales.entries())
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([name, value]) => ({ name, value }));
                                    const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#4f46e5', '#f59e0b', '#10b981', '#6366f1'];
                                    
                                    return (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
                                                <XAxis type="number" hide />
                                                <YAxis 
                                                    dataKey="name" 
                                                    type="category" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}}
                                                    width={100}
                                                />
                                                <Tooltip formatter={(v: string | number | undefined) => formatBRL(Number(v || 0))} />
                                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    );
                                })()}
                            </div>
                            <div className="bg-slate-50 rounded-[32px] p-8 border border-slate-100 h-[400px]">
                                {(() => {
                                    const channelSales = new Map<string, number>();
                                    const source = totalDataStore.vendasCanaisMes.length > 0 
                                        ? totalDataStore.vendasCanaisMes 
                                        : totalDataStore.sales;

                                    (source as SalesSource[]).forEach(s => {
                                        const sMes = 'mes' in s && s.mes !== undefined ? s.mes : (s.data ? new Date(s.data).getUTCMonth() + 1 : 0);
                                        const sAno = 'ano' in s && s.ano !== undefined ? s.ano : (s.data ? new Date(s.data).getUTCFullYear() : 0);
                                        const sFaturamento = 'faturamento_total' in s ? s.faturamento_total : s.faturamento;

                                        if (s.usuario_id === userId && sAno === selectedYear && selectedMonths.includes(sMes)) {
                                            const val = channelSales.get(s.canal_vendas) || 0;
                                            channelSales.set(s.canal_vendas, val + Number(sFaturamento || 0));
                                        }
                                    });
                                    const chartData = Array.from(channelSales.entries()).map(([name, value]) => ({ name, value }));
                                    const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#4f46e5', '#f59e0b', '#10b981', '#6366f1'];
                                    
                                    return (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={chartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v: number | string | undefined) => formatBRL(Number(v || 0))} />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'grupos' && (
                <div className="px-2 md:px-4 space-y-6">
                    <div className="bg-white p-6 md:p-10 rounded-[32px] border border-slate-200 shadow-sm">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <h3 className="text-sm md:text-lg font-black text-slate-900 uppercase tracking-widest">Performance por Grupos de Produtos</h3>
                        </div>
                        
                        <div className="h-[400px] w-full mb-10 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                            {(() => {
                                const groupSales = new Map<string, number>();
                                totalDataStore.vendasProdutosMes.forEach(s => {
                                    if (s.usuario_id === userId && s.ano === selectedYear && selectedMonths.includes(s.mes)) {
                                        const val = groupSales.get(s.grupo) || 0;
                                        groupSales.set(s.grupo, val + Number(s.faturamento_total));
                                    }
                                });
                                const chartData = Array.from(groupSales.entries())
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 8)
                                    .map(([name, value]) => ({ name, value }));
                                
                                return (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 40 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                                            <XAxis type="number" hide />
                                            <YAxis 
                                                dataKey="name" 
                                                type="category" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{fontSize: 10, fontWeight: 900, fill: '#64748b'}}
                                                width={100}
                                            />
                                            <Tooltip formatter={(v: number | string | undefined) => formatBRL(Number(v || 0))} cursor={{fill: '#f8fafc'}} />
                                            <Bar dataKey="value" fill="#2563eb" radius={[0, 8, 8, 0]} barSize={30} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                );
                            })()}
                        </div>

                        <div className="space-y-3">
                            {(() => {
                                const groupSales = new Map<string, number>();
                                totalDataStore.vendasProdutosMes.forEach(s => {
                                    if (s.usuario_id === userId && s.ano === selectedYear && selectedMonths.includes(s.mes)) {
                                        const val = groupSales.get(s.grupo) || 0;
                                        groupSales.set(s.grupo, val + Number(s.faturamento_total));
                                    }
                                });
                                return Array.from(groupSales.entries())
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 15)
                                    .map(([name, val], i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-blue-50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-slate-400 font-black text-[10px] border border-slate-100 shadow-sm">
                                                    {String(i + 1).padStart(2, '0')}
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                                                        <span className="text-[8px] font-black text-emerald-600 uppercase">Alta Performance</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-900">{formatBRL(val)}</p>
                                            </div>
                                        </div>
                                    ));
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'clientes' && (
                <div className="px-2 md:px-4 space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 md:p-10 rounded-[32px] border border-slate-200 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                                <div className="flex items-center gap-3">
                                    <Users className="w-5 h-5 text-blue-600" />
                                    <h3 className="text-sm md:text-lg font-black text-slate-900 uppercase tracking-widest">Clientes mais Assíduos</h3>
                                </div>
                                {(() => {
                                    const periodSales = totalDataStore.vendasClientesMes.filter(s => s.usuario_id === userId && s.ano === selectedYear && selectedMonths.includes(s.mes));
                                    const activeCount = new Set(periodSales.map(s => s.cnpj)).size;
                                    return (
                                        <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                                            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Clientes Ativos</p>
                                            <p className="text-sm font-black text-emerald-600">{activeCount} no período</p>
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="space-y-3">
                                {(() => {
                                    const clientFrequency = new Map<string, { name: string; count: number; total: number }>();
                                    totalDataStore.vendasClientesMes.forEach(s => {
                                        if (s.usuario_id === userId && s.ano === selectedYear && selectedMonths.includes(s.mes)) {
                                            const current = clientFrequency.get(s.cnpj) || { name: s.cliente_nome, count: 0, total: 0 };
                                            clientFrequency.set(s.cnpj, {
                                                name: s.cliente_nome,
                                                count: current.count + 1,
                                                total: current.total + Number(s.faturamento_total)
                                            });
                                        }
                                    });
                                    return Array.from(clientFrequency.entries())
                                        .sort((a, b) => b[1].count - a[1].count || b[1].total - a[1].total)
                                        .slice(0, 8)
                                        .map(([cnpj, client], i) => (
                                            <div 
                                                key={i} 
                                                onClick={() => setSelectedClientForDetail({ cnpj, name: client.name })}
                                                className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-blue-50 transition-colors group"
                                            >
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p className="text-[10px] font-black text-slate-900 uppercase truncate group-hover:text-blue-600 transition-colors">{client.name}</p>
                                                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{client.count} meses com compra</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-blue-600">{formatBRL(client.total)}</p>
                                                </div>
                                            </div>
                                        ));
                                })()}
                            </div>
                        </div>

                        <div className="bg-white p-6 md:p-10 rounded-[32px] border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-8">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                                <h3 className="text-sm md:text-lg font-black text-slate-900 uppercase tracking-widest">Sem compra no período filtrado</h3>
                            </div>
                            <div className="space-y-3">
                                {(() => {
                                    const salesInPeriod = new Set(totalDataStore.vendasClientesMes
                                        .filter(s => s.usuario_id === userId && s.ano === selectedYear && selectedMonths.includes(s.mes))
                                        .map(s => String(s.cnpj || '').replace(/\D/g, '')));
                                    
                                    return totalDataStore.clients
                                        .filter(c => c.usuario_id === userId && !salesInPeriod.has(String(c.cnpj || '').replace(/\D/g, '')))
                                        .slice(0, 8)
                                        .map((client, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 bg-red-50/30 rounded-2xl border border-red-100/50">
                                                <div className="flex-1 min-w-0 pr-4">
                                                    <p className="text-[10px] font-black text-slate-900 uppercase truncate">{client.nome_fantasia}</p>
                                                    <p className="text-[8px] font-bold text-red-400 uppercase mt-1">Sem compras no período</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[8px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-lg uppercase">Atenção</span>
                                                </div>
                                            </div>
                                        ));
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Detalhe do Cliente */}
            {selectedClientForDetail && (
                <ClientDetailModal 
                    client={selectedClientForDetail}
                    year={selectedYear}
                    userId={userId}
                    onClose={() => setSelectedClientForDetail(null)}
                    formatBRL={formatBRL}
                    monthNames={monthNames}
                />
            )}

            {/* Modal de Detalhamento Mensal - Ajustado para mobile */}
            {selectedMonthIdx !== null && createPortal(
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-4xl rounded-[28px] md:rounded-[40px] shadow-2xl overflow-hidden animate-slideUp border border-white/20 flex flex-col max-h-[95vh] md:max-h-[90vh]">
                        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Resumo Performance</h3>
                                <p className="text-[8px] md:text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 flex items-center gap-2">
                                    {monthNames[selectedMonthIdx]} • {selectedYear}
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedMonthIdx(null)}
                                className="p-2 hover:bg-white hover:shadow-md rounded-full transition-all text-slate-400 hover:text-slate-900"
                            >
                                <X className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar bg-white">
                            {selectedMonthIdx !== null && (
                                <>
                                    {/* Resumo no Modal - Grid 2x2 no mobile */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                                        <div className="bg-slate-50 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center">
                                            <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Real</p>
                                            <p className="text-xs md:text-xl font-black text-blue-600 tabular-nums">{formatBRL(stats.monthly[selectedMonthIdx].sales)}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center">
                                            <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta</p>
                                            <p className="text-xs md:text-xl font-black text-slate-900 tabular-nums">{formatBRL(stats.monthly[selectedMonthIdx].target)}</p>
                                        </div>
                                        <div className="bg-slate-50 p-4 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center">
                                            <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Atingimento</p>
                                            <p className={`text-xs md:text-xl font-black tabular-nums ${stats.monthly[selectedMonthIdx].sales >= stats.monthly[selectedMonthIdx].target ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {(stats.monthly[selectedMonthIdx].target > 0 ? (stats.monthly[selectedMonthIdx].sales / stats.monthly[selectedMonthIdx].target) * 100 : 0).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div className="bg-slate-900 p-4 md:p-5 rounded-2xl md:rounded-3xl text-white shadow-lg flex flex-col justify-center">
                                            <p className="text-[7px] md:text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Positivação</p>
                                            <p className="text-xs md:text-xl font-black text-white">{stats.monthly[selectedMonthIdx].positive} Clts</p>
                                        </div>
                                    </div>

                                    <MonthlyChannelBreakdown 
                                        monthIdx={selectedMonthIdx} 
                                        year={selectedYear} 
                                        userId={userId} 
                                        formatBRL={formatBRL} 
                                    />
                                </>
                            )}
                        </div>

                        <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button onClick={() => setSelectedMonthIdx(null)} className="w-full md:w-auto rounded-xl md:rounded-2xl px-10 h-12 md:h-auto font-black text-[10px] uppercase tracking-widest">
                                Fechar Detalhamento
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isLoading && <LoadingOverlay />}
        </div>
    );
};
