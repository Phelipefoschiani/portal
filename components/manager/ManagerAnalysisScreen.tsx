
import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Users, Calendar, DollarSign, Wallet, Loader2, ChevronRight, BarChart3, Filter, Award, RefreshCw, BarChart, CheckCircle2, AlertCircle, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RepPerformanceModal } from './RepPerformanceModal';
import { totalDataStore } from '../../lib/dataStore';

export const ManagerAnalysisScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedRep, setSelectedRep] = useState<any | null>(null);
    const [stats, setStats] = useState<any>({
        globalPerformance: [],
        repData: []
    });

    useEffect(() => {
        processAnalysisData();
    }, [selectedYear]);

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
            const rSales = sales.filter(s => s.usuario_id === rep.id && new Date(s.data + 'T00:00:00').getUTCFullYear() === selectedYear).reduce((a, b) => a + Number(b.faturamento), 0);
            const rTarget = targets.filter(t => t.usuario_id === rep.id && t.ano === selectedYear).reduce((a, b) => a + Number(b.valor), 0);
            return { rep, sales: rSales, target: rTarget, pct: rTarget > 0 ? (rSales / rTarget) * 100 : 0 };
        });

        setStats({ globalPerformance: performance, repData: repAnalysis });
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-12">
            <header className="flex justify-between items-end px-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Análise de Performance</h2>
                    <p className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-2"><Filter className="w-3.5 h-3.5 text-blue-500" /> Consolidado Total Anual</p>
                </div>
                <div className="flex gap-4">
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-white border border-slate-200 rounded-xl px-6 py-2.5 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer">
                        <option value={2024}>ANO 2024</option>
                        <option value={2025}>ANO 2025</option>
                    </select>
                </div>
            </header>

            {/* GRÁFICO MAIS ESTREITO (max-w-5xl) */}
            <div className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-200 shadow-sm relative overflow-hidden max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-16">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Atingimento de Objetivos</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Comparativo Realizado vs Planejado</p>
                    </div>
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta OK</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Abaixo</span>
                        </div>
                    </div>
                </div>

                <div className="h-[350px] w-full flex items-end justify-between gap-3 md:gap-6 px-2 pt-10">
                    {stats.globalPerformance.map((item: any, idx: number) => {
                        const maxInChart = Math.max(...stats.globalPerformance.flatMap((d: any) => [d.sales, d.target])) * 1.2 || 1;
                        const salesHeight = (item.sales / maxInChart) * 100;
                        const targetHeight = (item.target / maxInChart) * 100;
                        const achievement = item.target > 0 ? (item.sales / item.target) * 100 : 0;
                        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                        const isSuccess = achievement >= 100;

                        return (
                            <div key={idx} className="flex-1 flex flex-col items-center group h-full relative">
                                <div className="relative w-full flex-1 flex flex-col justify-end items-center">
                                    {/* PORCENTAGEM NO TOPO DA BARRA */}
                                    <div className="absolute -top-10 flex flex-col items-center animate-fadeIn">
                                        <span className={`text-[10px] font-black tabular-nums ${isSuccess ? 'text-blue-700' : 'text-red-700'}`}>
                                            {achievement.toFixed(1)}%
                                        </span>
                                    </div>

                                    <div className="w-full max-w-[32px] bg-slate-100 rounded-t-xl border border-slate-200/50 absolute bottom-0 transition-all duration-700" style={{ height: `${Math.max(targetHeight, 2)}%` }}></div>
                                    <div className={`w-full max-w-[32px] rounded-t-xl transition-all duration-1000 ease-out relative z-10 shadow-lg ${isSuccess ? 'bg-blue-600 shadow-blue-100' : 'bg-red-500 shadow-red-50'}`} style={{ height: `${Math.max(salesHeight, 2)}%` }}>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-t-xl"></div>
                                    </div>
                                </div>
                                <span className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900 transition-colors">{months[idx]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* LISTA EM LINHAS EM VEZ DE CARDS */}
            <div className="space-y-4 px-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-5">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-600" /> Desempenho por Representante
                    </h3>
                </div>
                
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                    {stats.repData.sort((a: any, b: any) => b.sales - a.sales).map((row: any) => (
                        <div 
                            key={row.rep.id} 
                            onClick={() => setSelectedRep(row.rep)} 
                            className="p-5 flex flex-col md:flex-row items-center justify-between hover:bg-slate-50 transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-5 w-full md:w-1/3">
                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    {row.rep.nome.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-black text-slate-900 uppercase text-xs tracking-tight truncate">{row.rep.nome}</h4>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Representante Comercial</p>
                                </div>
                            </div>

                            <div className="flex-1 w-full md:w-auto mt-4 md:mt-0 flex items-center justify-between md:justify-around gap-8">
                                <div className="text-center md:text-left">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendas Acumuladas</p>
                                    <p className="text-sm font-black text-slate-900 tabular-nums">{formatBRL(row.sales)}</p>
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Objetivo Anual</p>
                                    <p className="text-sm font-bold text-slate-600 tabular-nums">{formatBRL(row.target)}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black border transition-all ${row.pct >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                        {row.pct >= 100 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                        {row.pct.toFixed(1)}%
                                    </span>
                                </div>
                            </div>

                            <div className="ml-8 hidden md:block">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {selectedRep && <RepPerformanceModal rep={selectedRep} year={selectedYear} onClose={() => setSelectedRep(null)} />}
        </div>
    );
};
