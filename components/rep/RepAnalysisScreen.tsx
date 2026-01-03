
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Target, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Loader2, Award, BarChart3, RefreshCw, Download, FileText, CheckCircle2, X, Users, DollarSign, ChevronRight, Tag, CheckSquare, Square, ChevronDown, Filter, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import html2canvas from 'html2canvas';
import { createPortal } from 'react-dom';
import { totalDataStore } from '../../lib/dataStore';

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

        // Filtrar vendas do Store Global para este mês e ano
        const sales = totalDataStore.sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return s.usuario_id === userId && d.getUTCMonth() === monthIdx && d.getUTCFullYear() === year;
        });

        const monthTotal = sales.reduce((a, b) => a + Number(b.faturamento), 0);
        const channelMap = new Map<string, any>();

        sales.forEach(s => {
            const cName = s.canal_vendas || 'GERAL / OUTROS';
            if (!channelMap.has(cName)) {
                channelMap.set(cName, { label: cName, total: 0, clients: new Map() });
            }
            const channel = channelMap.get(cName);
            channel.total += Number(s.faturamento);

            const cnpjClean = String(s.cnpj || '').replace(/\D/g, '');
            if (!channel.clients.has(cnpjClean)) {
                channel.clients.set(cnpjClean, { 
                    name: (s.cliente_nome || clientNameLookup.get(cnpjClean) || `CNPJ: ${s.cnpj}`).trim().toUpperCase(), 
                    total: 0 
                });
            }
            channel.clients.get(cnpjClean).total += Number(s.faturamento);
        });

        return Array.from(channelMap.values())
            .sort((a, b) => b.total - a.total)
            .map(ch => ({
                ...ch,
                shareInMonth: monthTotal > 0 ? (ch.total / monthTotal) * 100 : 0,
                clients: Array.from(ch.clients.values())
                    .sort((a: any, b: any) => b.total - a.total)
                    .map((c: any) => ({
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
        <div className="space-y-8 mt-8">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <Tag className="w-5 h-5 text-blue-600" />
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Distribuição por Canal</h4>
            </div>
            
            {breakdown.map((channel, cIdx) => (
                <div key={cIdx} className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-900 text-white p-5 rounded-2xl shadow-lg border-b-4 border-blue-600">
                        <span className="font-black uppercase tracking-tight text-sm">{channel.label}</span>
                        <div className="text-right">
                            <p className="text-lg font-black">{formatBRL(channel.total)}</p>
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{channel.shareInMonth.toFixed(1)}% do mês</p>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3">Cliente Positivado</th>
                                    <th className="px-6 py-3 text-right">Faturado</th>
                                    <th className="px-6 py-3 text-right">Part. no Canal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {channel.clients.map((client: any, clIdx: number) => (
                                    <tr key={clIdx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3 text-[11px] font-bold text-slate-700 uppercase truncate max-w-[300px]">{client.name}</td>
                                        <td className="px-6 py-3 text-right font-black text-slate-900 text-[11px] tabular-nums">{formatBRL(client.total)}</td>
                                        <td className="px-6 py-3 text-right">
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

export const RepAnalysisScreen: React.FC = () => {
    const now = new Date();
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [stats, setStats] = useState<any>(null);
    const [selectedMonthIdx, setSelectedMonthIdx] = useState<number | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        processPerformanceData();
    }, [selectedYear, selectedMonths, userId]);

    const processPerformanceData = () => {
        setIsLoading(true);
        try {
            const sales = totalDataStore.sales;
            const targets = totalDataStore.targets;

            const monthly = Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                
                // Filtrar vendas deste representante no mês/ano específico direto do Store
                const mSalesList = sales.filter(s => {
                    const d = new Date(s.data + 'T00:00:00');
                    return s.usuario_id === userId && d.getUTCFullYear() === selectedYear && (d.getUTCMonth() + 1) === month;
                });

                const mSales = mSalesList.reduce((acc, curr) => acc + (Number(curr.faturamento) || 0), 0);
                
                // Vendas do ano anterior para cálculo de crescimento
                const mPrevSales = sales.filter(s => {
                    const d = new Date(s.data + 'T00:00:00');
                    return s.usuario_id === userId && d.getUTCFullYear() === (selectedYear - 1) && (d.getUTCMonth() + 1) === month;
                }).reduce((acc, curr) => acc + (Number(curr.faturamento) || 0), 0);
                
                const mTarget = targets.find(t => 
                    t.usuario_id === userId && t.ano === selectedYear && t.mes === month
                )?.valor || 0;

                const mPositive = new Set(mSalesList.map(s => String(s.cnpj || '').replace(/\D/g, ''))).size;

                return { month, sales: mSales, target: mTarget, prevSales: mPrevSales, positive: mPositive };
            });

            setStats({ monthly });
        } catch (e) {
            console.error('Erro ao processar performance:', e);
        } finally {
            setIsLoading(false);
        }
    };

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

    const kpis = useMemo(() => {
        if (!stats) return { meta: 0, faturado: 0, reach: 0 };
        const filtered = stats.monthly.filter((m: any) => selectedMonths.includes(m.month));
        const meta = filtered.reduce((a: number, b: any) => a + b.target, 0);
        const faturado = filtered.reduce((a: number, b: any) => a + b.sales, 0);
        return {
            meta,
            faturado,
            reach: meta > 0 ? (faturado / meta) * 100 : 0
        };
    }, [stats, selectedMonths]);

    if (!stats) return (
        <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
            <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Processando Inteligência...</p>
        </div>
    );

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-20">
            <header className="flex flex-col md:flex-row justify-between items-end gap-4 px-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Análise de Performance</h2>
                    <p className="text-[10px] font-black text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-widest">
                        <BarChart3 className="w-3.5 h-3.5 text-blue-500" /> Evolução de Metas Pessoal
                    </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative">
                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-white border border-slate-200 rounded-xl px-6 py-2.5 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer min-w-[120px]">
                            <option value={2024}>ANO 2024</option>
                            <option value={2025}>ANO 2025</option>
                            <option value={2026}>ANO 2026</option>
                        </select>
                    </div>

                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => {
                                setTempSelectedMonths([...selectedMonths]);
                                setShowMonthDropdown(!showMonthDropdown);
                            }}
                            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase flex items-center gap-3 shadow-sm hover:bg-slate-50 min-w-[180px] justify-between transition-all"
                        >
                            <span>{getMonthsLabel()}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showMonthDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
                                    <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[9px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all">Todos</button>
                                    <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[9px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-all">Limpar</button>
                                </div>
                                <div className="p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                    {monthNames.map((m, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => setTempSelectedMonths(prev => prev.includes(i+1) ? prev.filter(x => x !== i+1) : [...prev, i+1])}
                                            className={`flex items-center gap-2 p-2.5 rounded-xl text-[10px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-20" />}
                                            {m}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-3 border-t border-slate-100 bg-slate-50">
                                    <button 
                                        onClick={handleApplyFilter}
                                        className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Aplicar Filtro
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cota do Período</p>
                    <h3 className="text-2xl font-black text-slate-900">{formatBRL(kpis.meta)}</h3>
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Target className="w-16 h-16 text-blue-600" /></div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado Real</p>
                    <h3 className="text-2xl font-black text-blue-600">{formatBRL(kpis.faturado)}</h3>
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="w-16 h-16 text-blue-600" /></div>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Atingimento</p>
                    <h3 className={`text-2xl font-black ${kpis.reach >= 100 ? 'text-blue-600' : 'text-red-500'}`}>{kpis.reach.toFixed(1)}%</h3>
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><TrendingUp className="w-16 h-16 text-blue-600" /></div>
                </div>
                <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl flex items-center justify-center gap-3">
                    <Award className="w-8 h-8 text-blue-400" />
                    <div className="text-center">
                         <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Ranking Eficiência</p>
                         <p className="text-lg font-black text-white uppercase italic">Elite Regional</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-200 shadow-sm relative overflow-hidden max-w-6xl mx-auto">
                <div className="flex justify-between items-start mb-16">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Realizado vs Meta Mensal</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Clique em uma barra para decompor o mês</p>
                    </div>
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Realizado</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-slate-100 border border-slate-200 rounded-full"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta</span>
                        </div>
                    </div>
                </div>

                <div className="h-[350px] w-full flex items-end justify-between gap-3 md:gap-6 px-2 pt-10 border-b border-slate-100">
                    {stats.monthly.map((item: any, idx: number) => {
                        const maxInChart = Math.max(...stats.monthly.flatMap((d: any) => [d.sales, d.target])) * 1.2 || 1;
                        const salesHeight = (item.sales / maxInChart) * 100;
                        const targetHeight = (item.target / maxInChart) * 100;
                        const achievement = item.target > 0 ? (item.sales / item.target) * 100 : 0;
                        const isSuccess = achievement >= 100;

                        return (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedMonthIdx(idx)}
                                className="flex-1 flex flex-col items-center group h-full relative cursor-pointer"
                            >
                                <div className="absolute top-[-30px] flex flex-col items-center opacity-0 group-hover:opacity-100 transition-all">
                                    <span className={`text-[10px] font-black tabular-nums ${isSuccess ? 'text-blue-700' : 'text-red-700'}`}>
                                        {achievement.toFixed(1)}%
                                    </span>
                                </div>

                                <div className="relative w-full flex-1 flex flex-col justify-end items-center">
                                    <div className="w-full max-w-[32px] bg-slate-50 rounded-t-xl border border-slate-100 absolute bottom-0 transition-all duration-700" style={{ height: `${Math.max(targetHeight, 2)}%` }}></div>
                                    <div 
                                        className={`w-full max-w-[32px] rounded-t-xl transition-all duration-1000 ease-out relative z-10 shadow-lg ${isSuccess ? 'bg-blue-600 shadow-blue-100' : 'bg-red-500 shadow-red-50'}`} 
                                        style={{ height: `${Math.max(salesHeight, 2)}%` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-t-xl group-hover:bg-white/10 transition-all"></div>
                                    </div>
                                </div>
                                <span className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900 transition-colors">{monthShort[idx]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm mx-4">
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
                        {stats.monthly.filter((m: any) => selectedMonths.includes(m.month)).map((m: any, idx: number) => {
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
                                            <div className={`flex items-center justify-center gap-1 text-[10px] font-black ${growth >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
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

            {selectedMonthIdx !== null && createPortal(
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden animate-slideUp border border-white/20 flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Resumo de Performance</h3>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 flex items-center gap-2">
                                    {monthNames[selectedMonthIdx]} • {selectedYear}
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedMonthIdx(null)}
                                className="p-2 hover:bg-white hover:shadow-md rounded-full transition-all text-slate-400 hover:text-slate-900"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado Real</p>
                                    <p className="text-xl font-black text-blue-600 tabular-nums">{formatBRL(stats.monthly[selectedMonthIdx].sales)}</p>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta do Mês</p>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">{formatBRL(stats.monthly[selectedMonthIdx].target)}</p>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Atingimento %</p>
                                    <p className={`text-xl font-black tabular-nums ${stats.monthly[selectedMonthIdx].sales >= stats.monthly[selectedMonthIdx].target ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {(stats.monthly[selectedMonthIdx].target > 0 ? (stats.monthly[selectedMonthIdx].sales / stats.monthly[selectedMonthIdx].target) * 100 : 0).toFixed(1)}%
                                    </p>
                                </div>
                                <div className="bg-slate-900 p-5 rounded-3xl text-white shadow-lg flex flex-col justify-center">
                                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Positivação</p>
                                    <p className="text-xl font-black text-white">{stats.monthly[selectedMonthIdx].positive} Clts</p>
                                </div>
                            </div>

                            <MonthlyChannelBreakdown 
                                monthIdx={selectedMonthIdx} 
                                year={selectedYear} 
                                userId={userId} 
                                formatBRL={formatBRL} 
                            />
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button onClick={() => setSelectedMonthIdx(null)} className="rounded-2xl px-10 font-black text-[10px] uppercase tracking-widest">
                                Fechar Detalhamento
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
