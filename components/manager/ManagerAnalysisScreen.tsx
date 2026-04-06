
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, ChevronRight, BarChart3, AlertCircle, X, Tag, ArrowUpRight, ArrowDownRight, Trophy } from 'lucide-react';
import { totalDataStore } from '../../lib/dataStore';
import { createPortal } from 'react-dom';
import { Button } from '../Button';
import { RepPerformanceModal } from './RepPerformanceModal';
import { useSalesData } from '../../hooks/useSalesData';
import { Skeleton } from './Skeleton';

import { LoadingOverlay } from '../LoadingOverlay';

interface RepData {
    id: string;
    nome: string;
    role: string;
}

interface Target {
    id: string;
    usuario_id: string;
    mes: number;
    ano: number;
    valor: number | string;
}

interface Client {
    id: string;
    cnpj: string;
    nome_fantasia: string;
    usuario_id: string;
}

interface PerformanceItem {
    month: number;
    sales: number;
    target: number;
}

interface RepAnalysisItem {
    rep: RepData;
    sales: number;
    target: number;
    pct: number;
    yearlyHistory?: number[];
    projection?: number;
    totalClients?: number;
    positivatedClients?: number;
    yearlyPositivatedClients?: number;
}

interface Stats {
    globalPerformance: PerformanceItem[];
    repData: RepAnalysisItem[];
}

interface ClientBreakdown {
    name: string;
    total: number;
    shareInChannel: number;
}

interface ChannelBreakdown {
    label: string;
    total: number;
    shareInMonth: number;
    clients: ClientBreakdown[];
}

// --- COMPONENTE DE DECOMPOSIÇÃO POR CANAL (IGUAL AO DO REP) ---
const MonthlyChannelBreakdown: React.FC<{
    monthIdx: number;
    year: number;
    userId: string;
    formatBRL: (v: number) => string;
}> = ({ monthIdx, year, userId, formatBRL }) => {
    const breakdown = useMemo(() => {
        const clientNameLookup = new Map<string, string>();
        totalDataStore.clients.forEach(c => {
            const clean = String(c.cnpj || '').replace(/\D/g, '');
            clientNameLookup.set(clean, c.nome_fantasia);
        });

        const vendasCanaisMes = totalDataStore.vendasCanaisMes.filter(s => {
            return s.usuario_id === userId && s.mes === monthIdx + 1 && s.ano === year;
        });

        const monthTotal = vendasCanaisMes.reduce((a, b) => a + Number(b.faturamento_total), 0);
        const channelMap = new Map<string, { label: string; total: number; clients: Map<string, { name: string; total: number }> }>();

        vendasCanaisMes.forEach(s => {
            const cName = s.canal_vendas || 'GERAL / OUTROS';
            if (!channelMap.has(cName)) {
                channelMap.set(cName, { label: cName, total: 0, clients: new Map() });
            }
            const channel = channelMap.get(cName)!;
            channel.total += Number(s.faturamento_total);

            const cnpjClean = String(s.cnpj || '').replace(/\D/g, '');
            if (!channel.clients.has(cnpjClean)) {
                channel.clients.set(cnpjClean, { 
                    name: (s.cliente_nome || clientNameLookup.get(cnpjClean) || `CNPJ: ${s.cnpj}`).trim().toUpperCase(), 
                    total: 0 
                });
            }
            channel.clients.get(cnpjClean)!.total += Number(s.faturamento_total);
        });

        return Array.from(channelMap.values())
            .sort((a, b) => b.total - a.total)
            .map(ch => ({
                label: ch.label,
                total: ch.total,
                shareInMonth: monthTotal > 0 ? (ch.total / monthTotal) * 100 : 0,
                clients: Array.from(ch.clients.values())
                    .sort((a, b) => b.total - a.total)
                    .map(c => ({
                        ...c,
                        shareInChannel: ch.total > 0 ? (c.total / ch.total) * 100 : 0
                    }))
            })) as ChannelBreakdown[];
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
                                {channel.clients.map((client: ClientBreakdown, clIdx: number) => (
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
    onSelectRep: (rep: RepData) => void,
    formatBRL: (v: number) => string 
}> = ({ monthIdx, year, onClose, onSelectRep, formatBRL }) => {
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    const data = useMemo(() => {
        const vendasClientesMes = totalDataStore.vendasClientesMes;
        const targets = totalDataStore.targets as Target[];
        const reps = totalDataStore.users as RepData[];
        const allClients = totalDataStore.clients as Client[];

        return reps.map(rep => {
            const repSales = vendasClientesMes.filter(s => {
                return s.usuario_id === rep.id && s.mes === monthIdx + 1 && s.ano === year;
            });
            const billed = repSales.reduce((a, b) => a + Number(b.faturamento_total), 0);
            const target = Number(targets.find(t => t.usuario_id === rep.id && t.mes === monthIdx + 1 && t.ano === year)?.valor || 0);
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
                                        onClick={() => onSelectRep({ id: rep.id, nome: rep.nome, role: rep.role })}
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
    rep: RepData;
    monthIdx: number;
    year: number;
    onClose: () => void;
    formatBRL: (v: number) => string;
}> = ({ rep, monthIdx, year, onClose, formatBRL }) => {
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const summary = useMemo(() => {
        const vendasClientesMes = totalDataStore.vendasClientesMes.filter(s => {
            return s.usuario_id === rep.id && s.mes === monthIdx + 1 && s.ano === year;
        });
        const target = Number((totalDataStore.targets as Target[]).find((t) => t.usuario_id === rep.id && t.mes === monthIdx + 1 && t.ano === year)?.valor || 0);
        const billed = vendasClientesMes.reduce((a, b) => a + Number(b.faturamento_total), 0);
        const positivados = new Set(vendasClientesMes.map(s => String(s.cnpj || '').replace(/\D/g, ''))).size;
        
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

interface ManagerAnalysisScreenProps {
    updateTrigger?: number;
}

export const ManagerAnalysisScreen: React.FC<ManagerAnalysisScreenProps> = ({ updateTrigger = 0 }) => {
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [, setForceUpdate] = useState(0);
    
    // Agora o gerente pode escolher os meses
    const [selectedMonths, setSelectedMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    
    useSalesData(selectedYear, selectedMonths, updateTrigger, () => setForceUpdate(prev => prev + 1));

    const [selectedMonthForDetail, setSelectedMonthForDetail] = useState<number | null>(null);
    const [selectedRepForMonthlyDetail, setSelectedRepForMonthlyDetail] = useState<RepData | null>(null);
    const [selectedRepForPerformance, setSelectedRepForPerformance] = useState<RepData | null>(null);
    const [sortOrder, setSortOrder] = useState<'sales' | 'gap' | 'efficiency'>('sales');
    const [stats, setStats] = useState<Stats>({ globalPerformance: [], repData: [] });
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    const processAnalysisData = useCallback(() => {
        void updateTrigger;
        // Usar as views pré-agregadas do totalDataStore
        const vendasConsolidadas = totalDataStore.vendasConsolidadas;
        const targets = totalDataStore.targets as Target[];
        const reps = (totalDataStore.users as { id: string; nivel_acesso?: string; role: string; nome: string }[]).filter(u => {
            const role = (u.nivel_acesso || u.role || '').toLowerCase();
            // Excluir cargos de gestão/admin para sobrar apenas representantes
            const isManagement = role.includes('diretor') || 
                               role.includes('gerente') || 
                               role.includes('admin') || 
                               role.includes('director') || 
                               role.includes('manager') ||
                               role.includes('gestor');
            return !isManagement && u.nome; // Garantir que tem nome
        });
        const clients = totalDataStore.clients as Client[];

        // Performance global por mês (usando dados consolidados das views)
        const performance: PerformanceItem[] = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const monthSales = vendasConsolidadas
                .filter(s => s.mes === month && s.ano === selectedYear)
                .reduce((a, b) => a + Number(b.faturamento_total), 0);
            
            const monthTarget = targets
                .filter(t => t.mes === month && t.ano === selectedYear)
                .reduce((a, b) => a + Number(b.valor), 0);
            
            return { month, sales: monthSales, target: monthTarget };
        });

        // Análise por representante (usando dados consolidados das views)
        const repAnalysis: RepAnalysisItem[] = reps.map(rep => {
            const rSales = vendasConsolidadas
                .filter(s => s.usuario_id === rep.id && s.ano === selectedYear)
                .reduce((a, b) => a + Number(b.faturamento_total), 0);

            const rTarget = targets
                .filter(t => t.usuario_id === rep.id && t.ano === selectedYear)
                .reduce((a, b) => a + Number(b.valor), 0);

            // Dados anuais para o mini-gráfico
            const yearlyHistory = Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                return vendasConsolidadas
                    .filter(s => s.usuario_id === rep.id && s.ano === selectedYear && s.mes === m)
                    .reduce((a, b) => a + Number(b.faturamento_total), 0);
            });

            // NOVA LÓGICA DE PROJEÇÃO: Média de meses fechados
            const currentMonth = new Date().getUTCMonth() + 1;
            const currentYear = new Date().getUTCFullYear();
            
            // Meses fechados (anteriores ao atual no ano selecionado, ou todos se ano for passado)
            const closedMonths = Array.from({ length: 12 }, (_, i) => i + 1).filter(m => {
                if (selectedYear < currentYear) return true;
                if (selectedYear > currentYear) return false;
                return m < currentMonth;
            });

            const salesInClosedMonths = vendasConsolidadas
                .filter(s => s.usuario_id === rep.id && s.ano === selectedYear && closedMonths.includes(s.mes))
                .reduce((a, b) => a + Number(b.faturamento_total), 0);
            
            const avgSalesClosed = closedMonths.length > 0 ? salesInClosedMonths / closedMonths.length : 0;
            const projection = avgSalesClosed * 12;

            // Análise de Clientes
            const repClients = clients.filter(c => c.usuario_id === rep.id);
            const positivatedInYear = new Set(
                vendasConsolidadas
                    .filter(s => s.usuario_id === rep.id && s.ano === selectedYear)
                    .map(s => s.cnpj)
            ).size;
            
            return { 
                rep, 
                sales: rSales, 
                target: rTarget, 
                pct: rTarget > 0 ? (rSales / rTarget) * 100 : 0,
                yearlyHistory,
                projection,
                totalClients: repClients.length,
                positivatedClients: positivatedInYear,
                yearlyPositivatedClients: positivatedInYear
            };
        });

        setStats({ globalPerformance: performance, repData: repAnalysis });
    }, [selectedYear, updateTrigger]);

    useEffect(() => {
        const timer = setTimeout(() => {
            processAnalysisData();
        }, 0);
        return () => clearTimeout(timer);
    }, [processAnalysisData]);

    useEffect(() => {
        const loadData = async () => {
            // Se já temos dados básicos, não mostramos o loading inicial pesado
            if (totalDataStore.users.length === 0) {
                setIsInitialLoading(true);
            }
            
            try {
                const { fetchClients, fetchSalesForMonths, fetchUsers } = await import('../../lib/dataService');
                
                await Promise.all([
                    fetchUsers(),
                    fetchClients(),
                    fetchSalesForMonths(selectedYear, selectedMonths)
                ]);

                processAnalysisData();
            } catch (e) {
                console.error('Error loading analysis data:', e);
            } finally {
                setIsInitialLoading(false);
            }
        };
        loadData();

        const handleUpdate = () => {
            processAnalysisData();
        };
        window.addEventListener('pcn_data_update', handleUpdate);
        return () => window.removeEventListener('pcn_data_update', handleUpdate);
    }, [selectedYear, selectedMonths, processAnalysisData]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    const filteredGlobalPerformance = useMemo(() => {
        return stats.globalPerformance.filter((item: PerformanceItem) => selectedMonths.includes(item.month));
    }, [stats.globalPerformance, selectedMonths]);

    const isDataLoading = Object.values(totalDataStore.loading).some(v => v === true) || isInitialLoading;

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-12">
            <header className="flex flex-col md:flex-row justify-between items-end gap-6 px-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Score Card da Regional</h2>
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('pcn_navigate', { detail: 'admin-scorecard' }))}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                    >
                        <Trophy className="w-3.5 h-3.5" />
                        Score Card da Regional
                    </button>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="relative">
                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-white border border-slate-200 rounded-xl px-6 py-2.5 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer min-w-[120px]">
                            <option value={2024}>ANO 2024</option>
                            <option value={2025}>ANO 2025</option>
                            <option value={2026}>ANO 2026</option>
                        </select>
                    </div>

                    <div className="relative">
                        <button 
                            onClick={() => {
                                setTempSelectedMonths([...selectedMonths]);
                                setShowMonthDropdown(!showMonthDropdown);
                            }}
                            className="bg-white border border-slate-200 rounded-xl px-6 py-2.5 text-[10px] font-black uppercase flex items-center gap-3 shadow-sm hover:bg-slate-50 min-w-[140px]"
                        >
                            <span>{selectedMonths.length === 12 ? 'TODOS OS MESES' : `${selectedMonths.length} MESES`}</span>
                            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMonthDropdown ? 'rotate-90' : ''}`} />
                        </button>

                        {showMonthDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
                                    <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[9px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all">Todos</button>
                                    <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[9px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-all">Limpar</button>
                                </div>
                                <div className="p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                    {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => {
                                                const month = i + 1;
                                                setTempSelectedMonths(prev => prev.includes(month) ? prev.filter(x => x !== month) : [...prev, month]);
                                            }}
                                            className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                                {tempSelectedMonths.includes(i + 1) && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                            </div>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-3 border-t border-slate-100 bg-slate-50">
                                    <button 
                                        onClick={() => {
                                            setSelectedMonths([...tempSelectedMonths]);
                                            setShowMonthDropdown(false);
                                        }}
                                        className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                                    >
                                        Aplicar Filtro
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-200 shadow-sm relative overflow-hidden max-w-6xl mx-auto">
                {isDataLoading ? (
                    <div className="space-y-8">
                        <div className="flex justify-between items-start">
                            <Skeleton className="h-8 w-64" />
                            <Skeleton className="h-8 w-48" />
                        </div>
                        <div className="h-[350px] flex items-end justify-between gap-4">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <Skeleton key={i} className="flex-1" style={{ height: `${20 + Math.random() * 60}%` }} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
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
                            {filteredGlobalPerformance.map((item: PerformanceItem, idx: number) => {
                                const maxInChart = Math.max(...stats.globalPerformance.flatMap((d: PerformanceItem) => [d.sales, d.target])) * 1.2 || 1;
                                const salesHeight = (item.sales / maxInChart) * 100;
                                const targetHeight = (item.target / maxInChart) * 100;
                                const achievement = item.target > 0 ? (item.sales / item.target) * 100 : 0;
                                const isSuccess = achievement >= 100;

                                return (
                                    <div 
                                        key={idx} 
                                        className="flex-1 flex flex-col items-center group h-full relative"
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
                    </>
                )}
            </div>

            <div className="space-y-6 px-4">
                {/* Bento Grid de Destaques */}
                {!isDataLoading && stats.repData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        {/* Líder em Alcance */}
                        {(() => {
                            const bestPct = [...stats.repData].sort((a, b) => b.pct - a.pct)[0];
                            return (
                                <div className="bg-blue-600 rounded-[32px] text-white shadow-xl shadow-blue-100 overflow-hidden flex flex-col">
                                    <div className="p-8 flex-1 flex flex-col justify-center">
                                        <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Líder em Alcance (%)</p>
                                        <h4 className="text-xl font-black uppercase truncate">{bestPct.rep.nome}</h4>
                                        <p className="text-4xl font-black mt-2">{bestPct.pct.toFixed(1)}%</p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Menor Alcance */}
                        {(() => {
                            const worstPct = [...stats.repData].sort((a, b) => a.pct - b.pct)[0];
                            return (
                                <div className="bg-white rounded-[32px] border border-red-100 shadow-sm overflow-hidden flex flex-col">
                                    <div className="p-8 flex-1 flex flex-col justify-center">
                                        <p className="text-[9px] font-black text-red-400 uppercase tracking-[0.2em] mb-2">Menor Alcance (%)</p>
                                        <h4 className="text-xl font-black text-slate-900 uppercase truncate">{worstPct.rep.nome}</h4>
                                        <p className="text-4xl font-black text-red-600 mt-2">{worstPct.pct.toFixed(1)}%</p>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Projeção Regional */}
                                        {(() => {
                                            const totalProjection = stats.repData.reduce((a, b) => a + (b.projection || 0), 0);
                                            const totalTarget = stats.repData.reduce((a, b) => a + b.target, 0);
                                            const reachPct = totalTarget > 0 ? (totalProjection / totalTarget) * 100 : 0;
                                            
                                            const currentMonth = new Date().getUTCMonth() + 1;
                                            const currentYear = new Date().getUTCFullYear();
                                            const closedMonths = Array.from({ length: 12 }, (_, i) => i + 1).filter(m => {
                                                if (selectedYear < currentYear) return true;
                                                if (selectedYear > currentYear) return false;
                                                return m < currentMonth;
                                            });
                                            const monthsLabel = closedMonths.length > 0 
                                                ? `Jan a ${monthShort[closedMonths[closedMonths.length - 1] - 1]} de ${selectedYear}`
                                                : `Sem meses fechados em ${selectedYear}`;

                                            return (
                                                <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl relative group flex flex-col justify-between">
                                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none"><BarChart3 className="w-16 h-16" /></div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.2em]">Projeção de Fechamento Anual</p>
                                                        </div>
                                                        <h4 className="text-lg font-black uppercase relative z-10">Total Regional</h4>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 mb-2 tracking-widest">{monthsLabel}</p>
                                                        <p className="text-3xl font-black text-blue-400 mt-2 relative z-10">{formatBRL(totalProjection)}</p>
                                                    </div>
                                                    <div className="mt-6 pt-6 border-t border-white/10">
                                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase ${reachPct >= 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                            {reachPct >= 100 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                            {reachPct.toFixed(1)}% da Meta
                                                        </div>
                                                        <p className="text-[8px] font-black text-slate-500 uppercase mt-3 tracking-widest">Baseado na média de meses fechados</p>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                    </div>
                )}

                <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-200 pb-5 gap-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-600" /> Desempenho Regional por Representante
                    </h3>
                    
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl">
                        <div className="group relative">
                            <button 
                                onClick={() => setSortOrder('sales')}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${sortOrder === 'sales' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Faturamento
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-slate-900 text-white text-[7px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                                Ordenar pelo maior valor vendido (R$).
                            </div>
                        </div>
                        <div className="group relative">
                            <button 
                                onClick={() => setSortOrder('gap')}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${sortOrder === 'gap' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Menor Alcance
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-slate-900 text-white text-[7px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                                Ordenar por quem está com menor % de meta batida.
                            </div>
                        </div>
                        <div className="group relative">
                            <button 
                                onClick={() => setSortOrder('efficiency')}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${sortOrder === 'efficiency' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Eficiência
                            </button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-slate-900 text-white text-[7px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center">
                                Ordenar pela maior % de meta batida.
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                    {isDataLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="p-6 flex items-center gap-6">
                                <Skeleton className="w-12 h-12 rounded-2xl" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-1/4" />
                                    <Skeleton className="h-3 w-1/6" />
                                </div>
                                <Skeleton className="w-32 h-10 rounded-full" />
                            </div>
                        ))
                    ) : stats.repData.length === 0 ? (
                        <div className="p-20 text-center text-slate-400">
                            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum representante encontrado para este ano.</p>
                            <p className="text-[8px] font-bold uppercase mt-2">Verifique se os usuários estão cadastrados corretamente.</p>
                        </div>
                    ) : (
                        stats.repData
                            .sort((a: RepAnalysisItem, b: RepAnalysisItem) => {
                                if (sortOrder === 'sales') return b.sales - a.sales;
                                if (sortOrder === 'gap') return a.pct - b.pct;
                                return b.pct - a.pct;
                            })
                            .map((row: RepAnalysisItem) => {
                                const efficiency = row.target > 0 ? (row.projection! / row.target) * 100 : 0;
                                const isSuccess = efficiency >= 100;
                                
                                return (
                                    <div 
                                        key={row.rep.id} 
                                        onClick={() => setSelectedRepForPerformance(row.rep)}
                                        className="p-6 flex flex-col lg:flex-row items-center gap-8 hover:bg-slate-50/50 transition-all group cursor-pointer border-b border-slate-50 last:border-0"
                                    >
                                        {/* Identificação */}
                                        <div className="flex items-center gap-5 w-full lg:w-64 shrink-0">
                                            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                                                {row.rep.nome.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-black text-slate-900 uppercase text-xs tracking-tight truncate group-hover:text-blue-600 transition-colors">{row.rep.nome}</h4>
                                            </div>
                                        </div>

                                        {/* Métricas Principais */}
                                        <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-6 w-full">
                                            <div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado</p>
                                                <p className="text-sm font-black text-slate-900 tabular-nums">{formatBRL(row.sales)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Anual</p>
                                                <p className="text-sm font-black text-slate-400 tabular-nums">{formatBRL(row.target)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Alcance Atual</p>
                                                <p className={`text-sm font-black tabular-nums ${row.pct >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {row.pct.toFixed(1)}%
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Projeção</p>
                                                <p className="text-sm font-black text-blue-600 tabular-nums">{formatBRL(row.projection || 0)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Eficiência</p>
                                                <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black border transition-all ${isSuccess ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                    {efficiency.toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="text-right flex items-center justify-end">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedRepForPerformance(row.rep);
                                                    }}
                                                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg"
                                                >
                                                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                                    SCORE CARD
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                    )}
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

            {isDataLoading && <LoadingOverlay />}
        </div>
    );
};
