
import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Users, Calendar, DollarSign, Wallet, Loader2, ChevronRight, BarChart3, Filter, Award, RefreshCw, BarChart, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RepPerformanceModal } from './RepPerformanceModal';

export const ManagerAnalysisScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStatus, setLoadingStatus] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedRep, setSelectedRep] = useState<any | null>(null);
    const [stats, setStats] = useState<any>({
        globalPerformance: [],
        repData: []
    });

    const CACHE_KEY = `pcn_analysis_cache_${selectedYear}`;
    const CACHE_TIME = 4 * 60 * 60 * 1000;

    useEffect(() => {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const { timestamp, stats: cachedStats } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TIME) {
                setStats(cachedStats);
                setIsLoading(false);
                return;
            }
        }
        fetchAnalysisData();
    }, [selectedYear]);

    const fetchAllSalesYear = async (year: number) => {
        let allData: any[] = [];
        let from = 0;
        let pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase
                .from('dados_vendas')
                .select('faturamento, data, usuario_id')
                .gte('data', `${year}-01-01`)
                .lte('data', `${year}-12-31`)
                .range(from, from + pageSize - 1);
            
            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += pageSize;
                const p = Math.min(80, 30 + (allData.length / 15000) * 40);
                setLoadingProgress(Math.round(p));
                if (data.length < pageSize) hasMore = false;
            } else { hasMore = false; }
        }
        return allData;
    };

    const fetchAnalysisData = async () => {
        setIsLoading(true);
        setLoadingProgress(5);
        setLoadingStatus('Iniciando BI...');
        
        try {
            const { data: reps } = await supabase
                .from('usuarios')
                .select('id, nome, nivel_acesso')
                .not('nivel_acesso', 'ilike', 'admin')
                .not('nivel_acesso', 'ilike', 'gerente');

            const sales = await fetchAllSalesYear(selectedYear);
            const { data: targets } = await supabase.from('metas_usuarios').select('valor, mes, usuario_id').eq('ano', selectedYear);

            const performance = Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                const monthSales = sales?.filter(s => {
                    const d = new Date(s.data + 'T00:00:00');
                    return d.getUTCMonth() + 1 === month;
                }).reduce((a, b) => a + Number(b.faturamento), 0) || 0;
                
                const monthTarget = targets?.filter(t => t.mes === month).reduce((a, b) => a + Number(b.valor), 0) || 0;
                return { month, sales: monthSales, target: monthTarget };
            });

            const repAnalysis = reps?.map(rep => {
                const rSales = sales?.filter(s => s.usuario_id === rep.id).reduce((a, b) => a + Number(b.faturamento), 0) || 0;
                const rTarget = targets?.filter(t => t.usuario_id === rep.id).reduce((a, b) => a + Number(b.valor), 0) || 0;
                return { rep, sales: rSales, target: rTarget, pct: rTarget > 0 ? (rSales / rTarget) * 100 : 0 };
            }) || [];

            const newStats = { globalPerformance: performance, repData: repAnalysis };
            setStats(newStats);
            setLoadingProgress(100);
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), stats: newStats }));
            setTimeout(() => setIsLoading(false), 500);
        } catch (e) { 
            console.error(e); 
            setIsLoading(false);
        }
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-[70vh] text-slate-400 space-y-8 animate-fadeIn">
            <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-blue-600 opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <BarChart className="w-6 h-6 text-blue-600 animate-pulse" />
                </div>
            </div>
            <div className="w-full max-w-xs space-y-3">
                <div className="flex justify-between items-end">
                    <p className="font-black uppercase text-[10px] tracking-widest text-slate-500">{loadingStatus}</p>
                    <span className="text-sm font-black text-blue-600 tabular-nums">{loadingProgress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-0.5 shadow-inner">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out" style={{ width: `${loadingProgress}%` }} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-12">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Análise de Performance</h2>
                    <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-blue-500" /> Consolidado Global Anual</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => fetchAnalysisData()} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition-all">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-white border border-slate-200 rounded-xl px-6 py-2.5 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer">
                        <option value={2024}>ANO 2024</option>
                        <option value={2025}>ANO 2025</option>
                    </select>
                </div>
            </header>

            <div className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-center mb-16">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Atingimento de Objetivos</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Comparativo Realizado vs Planejado</p>
                    </div>
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta Superada</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Abaixo da Meta</span>
                        </div>
                    </div>
                </div>

                <div className="h-[350px] w-full flex items-end justify-between gap-3 md:gap-6 px-2">
                    {stats.globalPerformance.map((item: any, idx: number) => {
                        const maxInChart = Math.max(...stats.globalPerformance.flatMap((d: any) => [d.sales, d.target])) * 1.1 || 1;
                        const salesHeight = (item.sales / maxInChart) * 100;
                        const targetHeight = (item.target / maxInChart) * 100;
                        const achievement = item.target > 0 ? (item.sales / item.target) * 100 : 0;
                        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                        const isSuccess = achievement >= 100;
                        const gap = item.target - item.sales;

                        return (
                            <div key={idx} className="flex-1 flex flex-col items-center group h-full relative">
                                <div className="absolute top-[-90px] opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 z-30 pointer-events-none w-[160px]">
                                    <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-2xl text-center relative">
                                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">{achievement.toFixed(1)}%</p>
                                        <div className="space-y-0.5 mb-2">
                                            <p className="text-[11px] font-black leading-none">{formatBRL(item.sales)}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Meta: {formatBRL(item.target)}</p>
                                        </div>
                                        <div className="mt-1 pt-2 border-t border-white/10">
                                            <p className="text-[8px] font-black text-blue-300 uppercase">
                                                {gap > 0 ? `Faltam ${formatBRL(gap)}` : `Superou ${formatBRL(Math.abs(gap))}`}
                                            </p>
                                        </div>
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                    </div>
                                </div>

                                <div className="relative w-full flex-1 flex flex-col justify-end">
                                    <div 
                                        className="w-full bg-slate-100 rounded-2xl border border-slate-200/50 absolute bottom-0 transition-all duration-700"
                                        style={{ height: `${Math.max(targetHeight, 2)}%` }}
                                    >
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-[8px] font-black text-slate-400 uppercase">Meta</span>
                                        </div>
                                    </div>

                                    <div 
                                        className={`w-full rounded-2xl transition-all duration-1000 ease-out relative z-10 shadow-lg ${isSuccess ? 'bg-blue-600 shadow-blue-200' : 'bg-red-500 shadow-red-100'}`}
                                        style={{ height: `${Math.max(salesHeight, 2)}%` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-2xl"></div>
                                        {isSuccess && (
                                            <div className="absolute -top-7 left-1/2 -translate-x-1/2">
                                                <div className="p-1 bg-blue-100 rounded-full">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <span className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900 transition-colors">
                                    {months[idx]}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-5">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-600" /> Equipe de Vendas
                    </h3>
                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-4 py-1.5 rounded-full uppercase tracking-widest">{stats.repData.length} Representantes Ativos</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stats.repData.sort((a: any, b: any) => b.sales - a.sales).map((row: any) => (
                        <div key={row.rep.id} onClick={() => setSelectedRep(row.rep)} className="bg-white p-6 rounded-[40px] border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 transition-all cursor-pointer group flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-lg text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">{row.rep.nome.charAt(0)}</div>
                                    <div className={`text-[10px] font-black px-4 py-1.5 rounded-full border ${row.pct >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{row.pct.toFixed(1)}%</div>
                                </div>
                                <h4 className="font-black text-slate-900 uppercase text-sm truncate mb-1 tracking-tighter">{row.rep.nome}</h4>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5 text-blue-500" />
                                    Meta Anual: {formatBRL(row.target)}
                                </p>
                            </div>
                            <div className="flex items-center justify-between pt-5 border-t border-slate-50">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendas Acumuladas</p>
                                    <span className="text-xl font-black text-slate-900 tabular-nums">{formatBRL(row.sales)}</span>
                                </div>
                                <button className="bg-blue-600 text-white px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                                    <Award className="w-3.5 h-3.5" /> Desempenho
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedRep && <RepPerformanceModal rep={selectedRep} year={selectedYear} onClose={() => setSelectedRep(null)} />}
        </div>
    );
};
