
import React, { useState, useEffect } from 'react';
// Added RefreshCw to the imports from lucide-react
import { Target, TrendingUp, Users, Calendar, DollarSign, Wallet, Loader2, ChevronRight, BarChart3, Filter, Award, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RepPerformanceModal } from './RepPerformanceModal';

export const ManagerAnalysisScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedRep, setSelectedRep] = useState<any | null>(null);
    const [stats, setStats] = useState<any>({
        globalPerformance: [],
        repData: []
    });

    const CACHE_KEY = `pcn_analysis_cache_${selectedYear}`;
    const CACHE_TIME = 5 * 60 * 1000;

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
        let to = 999;
        let hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase
                .from('dados_vendas')
                .select('faturamento, data, usuario_id')
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

    const fetchAnalysisData = async () => {
        setIsLoading(true);
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
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), stats: newStats }));
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-96 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
            <p className="font-black uppercase text-[10px] tracking-widest animate-pulse text-center">Cruzando faturamentos anuais...</p>
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
                    <button onClick={() => fetchAnalysisData()} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-white border border-slate-200 rounded-xl px-6 py-2.5 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer">
                        <option value={2024}>ANO 2024</option>
                        <option value={2025}>ANO 2025</option>
                    </select>
                </div>
            </header>

            <div className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-12">Performance Mensal Equipe</h3>
                <div className="h-[300px] w-full relative flex items-end justify-between gap-4 px-4">
                    {stats.globalPerformance.map((item: any, idx: number) => {
                        const maxVal = Math.max(...stats.globalPerformance.flatMap((d: any) => [d.sales, d.target])) * 1.2 || 1;
                        const salesHeight = (item.sales / maxVal) * 100;
                        const targetHeight = (item.target / maxVal) * 100;
                        const achievement = item.target > 0 ? (item.sales / item.target) * 100 : 0;
                        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

                        return (
                            <div key={idx} className="flex-1 flex flex-col items-center group h-full relative">
                                <div className="absolute top-[-35px] opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 z-20 pointer-events-none">
                                    <div className={`flex flex-col items-center text-[9px] font-black px-3 py-1.5 rounded-lg shadow-xl ${achievement >= 100 ? 'bg-emerald-50 text-white' : 'bg-red-50 text-white'}`}>
                                        <span>{achievement.toFixed(1)}%</span>
                                        <span className="opacity-70 mt-0.5">{formatBRL(item.sales)}</span>
                                    </div>
                                </div>
                                
                                <div className="absolute w-full border-t-2 border-slate-300 border-dashed z-10 transition-all pointer-events-none" style={{ bottom: `${Math.min(targetHeight, 100)}%` }} />
                                
                                <div className={`w-full rounded-t-xl transition-all duration-1000 relative z-0 ${achievement >= 100 ? 'bg-blue-600' : 'bg-red-400'}`} style={{ height: `${Math.max(salesHeight, 2)}%` }}>
                                    {achievement >= 100 && (
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 animate-bounce">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                        </div>
                                    )}
                                </div>
                                
                                <span className="mt-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{months[idx]}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="mt-12 pt-8 border-t border-slate-50 flex gap-8 justify-center">
                    <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 bg-blue-600 rounded-md"></div><span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Atingiu Meta</span></div>
                    <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 bg-red-400 rounded-md"></div><span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Abaixo da Meta</span></div>
                    <div className="flex items-center gap-2"><div className="w-10 border-t-2 border-slate-400 border-dashed"></div><span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Linha de Meta</span></div>
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
                                    <div className={`text-[10px] font-black px-4 py-1.5 rounded-full border ${row.pct >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>{row.pct.toFixed(1)}%</div>
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
