
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Target, TrendingUp, Users, Calendar, DollarSign, Wallet, Loader2, ChevronRight, BarChart3, Filter, Award, RefreshCw, BarChart, CheckCircle2, AlertCircle, User, X, CheckSquare, Square, ChevronDown, Building2, Layers, Briefcase, Tag, Quote } from 'lucide-react';
import { totalDataStore } from '../../lib/dataStore';
import { createPortal } from 'react-dom';
import { Button } from '../Button';
import { RepPerformanceModal } from './RepPerformanceModal';

// --- COMPONENTE DE DECOMPOSIÇÃO POR CANAL (IGUAL AO DO REP) ---
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

// --- MODAL DE DETALHAMENTO MENSAL (NÍVEL 1: EQUIPE NO MÊS) ---
const MonthRepDetailModal: React.FC<{ 
    monthIdx: number, 
    year: number, 
    onClose: () => void,
    onSelectRep: (rep: any) => void,
    formatBRL: (v: number) => string 
}> = ({ monthIdx, year, onClose, onSelectRep, formatBRL }) => {
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    const data = useMemo(() => {
        const sales = totalDataStore.sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return d.getUTCMonth() === monthIdx && d.getUTCFullYear() === year;
        });
        const targets = totalDataStore.targets.filter(t => t.mes === monthIdx + 1 && t.ano === year);
        const reps = totalDataStore.users;
        const allClients = totalDataStore.clients;

        return reps.map(rep => {
            const repSales = sales.filter(s => s.usuario_id === rep.id);
            const billed = repSales.reduce((a, b) => a + Number(b.faturamento), 0);
            const target = targets.find(t => t.usuario_id === rep.id)?.valor || 0;
            const positivados = new Set(repSales.map(s => String(s.cnpj || '').replace(/\D/g, ''))).size;
            
            const totalRepClients = allClients.filter(c => c.usuario_id === rep.id).length || 1;
            const coverage = (positivados / totalRepClients) * 100;
            const reach = target > 0 ? (billed / target) * 100 : 0;

            return { 
                ...rep, 
                billed, 
                target, 
                positivados, 
                reach,
                coverage 
            };
        }).sort((a, b) => b.billed - a.billed);
    }, [monthIdx, year]);

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-5xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Performance Mensal da Equipe</h3>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Período: {monthNames[monthIdx]} {year}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5">Representante</th>
                                    <th className="px-4 py-5 text-right">Meta</th>
                                    <th className="px-4 py-5 text-right">Faturado</th>
                                    <th className="px-4 py-5 text-center">% Alcance</th>
                                    <th className="px-4 py-5 text-center">Positiv.</th>
                                    <th className="px-8 py-5 text-right">Cobertura Carteira (%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.map((rep, idx) => (
                                    <tr 
                                        key={idx} 
                                        onClick={() => onSelectRep(rep)}
                                        className="hover:bg-blue-50/50 transition-all cursor-pointer group"
                                    >
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs group-hover:bg-blue-600 transition-colors">{rep.nome.charAt(0)}</div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-800 uppercase text-xs tracking-tight group-hover:text-blue-600 transition-colors">{rep.nome}</span>
                                                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right font-bold text-slate-400 text-xs tabular-nums">{formatBRL(rep.target)}</td>
                                        <td className="px-4 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{formatBRL(rep.billed)}</td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${rep.reach >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                {rep.reach.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[9px] font-black">{rep.positivados} Clts</span>
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[11px] font-black text-blue-600">{rep.coverage.toFixed(1)}%</span>
                                                <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={`h-full bg-blue-600`} style={{ width: `${Math.min(rep.coverage, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Clique no representante para ver a decomposição de canais e clientes do mês.</p>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- NOVO MODAL: DETALHAMENTO INDIVIDUAL DO REP (IGUAL AO QUE O REP VÊ) ---
const IndividualRepMonthlyDetailModal: React.FC<{
    rep: any;
    monthIdx: number;
    year: number;
    onClose: () => void;
    formatBRL: (v: number) => string;
}> = ({ rep, monthIdx, year, onClose, formatBRL }) => {
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const summary = useMemo(() => {
        const sales = totalDataStore.sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return s.usuario_id === rep.id && d.getUTCMonth() === monthIdx && d.getUTCFullYear() === year;
        });
        const target = totalDataStore.targets.find(t => t.usuario_id === rep.id && t.mes === monthIdx + 1 && t.ano === year)?.valor || 0;
        const billed = sales.reduce((a, b) => a + Number(b.faturamento), 0);
        const positivados = new Set(sales.map(s => String(s.cnpj || '').replace(/\D/g, ''))).size;
        
        return { billed, target, positivados };
    }, [rep.id, monthIdx, year]);

    return createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
            <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden animate-slideUp border border-white/20 flex flex-col max-h-[90vh]">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Resumo de Performance</h3>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 flex items-center gap-2">
                            Rep: {rep.nome} • {monthNames[monthIdx]} {year}
                        </p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white hover:shadow-md rounded-full transition-all text-slate-400 hover:text-slate-900"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado Real</p>
                            <p className="text-xl font-black text-blue-600 tabular-nums">{formatBRL(summary.billed)}</p>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta do Mês</p>
                            <p className="text-xl font-black text-slate-900 tabular-nums">{formatBRL(summary.target)}</p>
                        </div>
                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Atingimento %</p>
                            <p className={`text-xl font-black tabular-nums ${summary.billed >= summary.target && summary.target > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {(summary.target > 0 ? (summary.billed / summary.target) * 100 : 0).toFixed(1)}%
                            </p>
                        </div>
                        <div className="bg-slate-900 p-5 rounded-3xl text-white shadow-lg flex flex-col justify-center">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Positivação</p>
                            <p className="text-xl font-black text-white">{summary.positivados} Clts</p>
                        </div>
                    </div>

                    <MonthlyChannelBreakdown 
                        monthIdx={monthIdx} 
                        year={year} 
                        userId={rep.id} 
                        formatBRL={formatBRL} 
                    />
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <Button onClick={onClose} className="rounded-2xl px-10 font-black text-[10px] uppercase tracking-widest">
                        Voltar para Lista
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const ManagerAnalysisScreen: React.FC = () => {
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    const [selectedMonthForDetail, setSelectedMonthForDetail] = useState<number | null>(null);
    const [selectedRepForMonthlyDetail, setSelectedRepForMonthlyDetail] = useState<any | null>(null);
    const [selectedRepForPerformance, setSelectedRepForPerformance] = useState<any | null>(null);
    const [stats, setStats] = useState<any>({ globalPerformance: [], repData: [] });

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
        processAnalysisData();
    }, [selectedYear, selectedMonths]);

    const processAnalysisData = () => {
        const sales = totalDataStore.sales;
        const targets = totalDataStore.targets;
        const reps = totalDataStore.users;

        const performance = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const monthSales = sales.filter(s => {
                const d = new Date(s.data + 'T00:00:00');
                return d.getUTCMonth() + 1 === month && d.getUTCFullYear() === selectedYear;
            }).reduce((a, b) => a + Number(b.faturamento), 0);
            
            const monthTarget = targets.filter(t => t.mes === month && t.ano === selectedYear).reduce((a, b) => a + Number(b.valor), 0);
            return { month, sales: monthSales, target: monthTarget };
        });

        const repAnalysis = reps.map(rep => {
            const rSales = sales.filter(s => {
                const d = new Date(s.data + 'T00:00:00');
                const m = d.getUTCMonth() + 1;
                return s.usuario_id === rep.id && d.getUTCFullYear() === selectedYear && selectedMonths.includes(m);
            }).reduce((a, b) => a + Number(b.faturamento), 0);

            const rTarget = targets.filter(t => t.usuario_id === rep.id && t.ano === selectedYear && selectedMonths.includes(t.mes)).reduce((a, b) => a + Number(b.valor), 0);
            
            return { rep, sales: rSales, target: rTarget, pct: rTarget > 0 ? (rSales / rTarget) * 100 : 0 };
        });

        setStats({ globalPerformance: performance, repData: repAnalysis });
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

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

    const filteredGlobalPerformance = useMemo(() => {
        return stats.globalPerformance.filter((item: any) => selectedMonths.includes(item.month));
    }, [stats.globalPerformance, selectedMonths]);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-12">
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 px-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Análise de Performance</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-2 flex items-center gap-2 uppercase tracking-widest">
                        <BarChart3 className="w-3.5 h-3.5 text-blue-500" /> Evolução de Metas Regional
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
                                            {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
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

            <div className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-200 shadow-sm relative overflow-hidden max-w-6xl mx-auto">
                <div className="flex justify-between items-start mb-16">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Realizado vs Meta Regional</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Clique em uma barra para detalhar o mês</p>
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
                    {filteredGlobalPerformance.map((item: any, idx: number) => {
                        const maxInChart = Math.max(...stats.globalPerformance.flatMap((d: any) => [d.sales, d.target])) * 1.2 || 1;
                        const salesHeight = (item.sales / maxInChart) * 100;
                        const targetHeight = (item.target / maxInChart) * 100;
                        const achievement = item.target > 0 ? (item.sales / item.target) * 100 : 0;
                        const isSuccess = achievement >= 100;

                        return (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedMonthForDetail(item.month - 1)}
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
                                        className={`w-full max-w-[32px] rounded-t-xl transition-all duration-1000 ease-out relative z-10 shadow-lg ${isSuccess ? 'bg-blue-600 shadow-blue-100' : 'bg-red-600 shadow-red-100'}`} 
                                        style={{ height: `${Math.max(salesHeight, 2)}%` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-t-xl group-hover:bg-white/10 transition-all"></div>
                                    </div>
                                </div>
                                <span className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900 transition-colors">{monthShort[item.month - 1]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-4 px-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-5">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-600" /> Desempenho Regional por Representante
                    </h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Clique no representante para ver o Raio-X Anual</p>
                </div>
                
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                    {stats.repData.sort((a: any, b: any) => b.sales - a.sales).map((row: any) => (
                        <div 
                            key={row.rep.id} 
                            onClick={() => setSelectedRepForPerformance(row.rep)}
                            className="p-5 flex flex-col md:flex-row items-center justify-between hover:bg-slate-50/50 transition-all group cursor-pointer"
                        >
                            <div className="flex items-center gap-5 w-full md:w-1/3">
                                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    {row.rep.nome.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-black text-slate-900 uppercase text-xs tracking-tight truncate">{row.rep.nome}</h4>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Vendas Regional</p>
                                </div>
                            </div>

                            <div className="flex-1 w-full md:w-auto mt-4 md:mt-0 flex items-center justify-between md:justify-around gap-8">
                                <div className="text-center md:text-left">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado</p>
                                    <p className="text-sm font-black text-slate-900 tabular-nums">{formatBRL(row.sales)}</p>
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta</p>
                                    <p className="text-sm font-bold text-slate-600 tabular-nums">{formatBRL(row.target)}</p>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border transition-all ${row.pct >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                        {row.pct >= 100 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                        {row.pct.toFixed(1)}%
                                    </span>
                                    <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-blue-500 transition-colors" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedMonthForDetail !== null && (
                <MonthRepDetailModal 
                    monthIdx={selectedMonthForDetail} 
                    year={selectedYear} 
                    onClose={() => setSelectedMonthForDetail(null)}
                    onSelectRep={(rep) => setSelectedRepForMonthlyDetail(rep)}
                    formatBRL={formatBRL}
                />
            )}

            {selectedRepForMonthlyDetail && (
                <IndividualRepMonthlyDetailModal 
                    rep={selectedRepForMonthlyDetail}
                    monthIdx={selectedMonthForDetail!}
                    year={selectedYear}
                    onClose={() => setSelectedRepForMonthlyDetail(null)}
                    formatBRL={formatBRL}
                />
            )}

            {selectedRepForPerformance && (
                <RepPerformanceModal 
                    rep={selectedRepForPerformance} 
                    year={selectedYear} 
                    selectedMonths={selectedMonths}
                    onClose={() => setSelectedRepForPerformance(null)} 
                />
            )}
        </div>
    );
};
