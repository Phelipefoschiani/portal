
import React, { useState, useEffect, useRef } from 'react';
import { Target, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Loader2, Award, BarChart3, RefreshCw, Download, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import html2canvas from 'html2canvas';

export const RepAnalysisScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [data, setData] = useState<any>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
    const userId = session.id;
    const userName = session.name;

    useEffect(() => {
        if (userId) fetchPerformanceData();
    }, [selectedYear, userId]);

    const cleanCnpj = (val: string) => String(val || '').replace(/\D/g, '');

    const fetchAllSales = async (start: string, end: string) => {
        let allData: any[] = [];
        let pageSize = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('dados_vendas')
                .select('faturamento, data, cnpj')
                .eq('usuario_id', userId)
                .gte('data', start)
                .lte('data', end)
                .range(from, from + pageSize - 1);

            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += pageSize;
                if (data.length < pageSize) hasMore = false;
            } else { hasMore = false; }
        }
        return allData;
    };

    const fetchPerformanceData = async () => {
        setIsLoading(true);
        try {
            const sales = await fetchAllSales(`${selectedYear}-01-01`, `${selectedYear}-12-31`);
            const prevSales = await fetchAllSales(`${selectedYear - 1}-01-01`, `${selectedYear - 1}-12-31`);

            const { data: targets } = await supabase
                .from('metas_usuarios')
                .select('valor, mes')
                .eq('usuario_id', userId)
                .eq('ano', selectedYear);

            const { data: investments } = await supabase
                .from('investimentos')
                .select('valor_total_investimento, data')
                .eq('usuario_id', userId)
                .eq('status', 'approved')
                .gte('data', `${selectedYear}-01-01`)
                .lte('data', `${selectedYear}-12-31`);

            const monthly = Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                const mSalesList = sales.filter(s => {
                    const d = new Date(s.data + 'T00:00:00');
                    return d.getUTCMonth() + 1 === month;
                }) || [];

                const mSales = mSalesList.reduce((a, b) => a + Number(b.faturamento), 0);
                const mTarget = targets?.find(t => t.mes === month)?.valor || 0;
                
                const mPrevSales = prevSales.filter(s => {
                    const d = new Date(s.data + 'T00:00:00');
                    return d.getUTCMonth() + 1 === month;
                }).reduce((a, b) => a + Number(b.faturamento), 0) || 0;

                const mInv = investments?.filter(inv => {
                    const d = new Date(inv.data + 'T00:00:00');
                    return d.getUTCMonth() + 1 === month;
                }).reduce((a, b) => a + Number(b.valor_total_investimento), 0) || 0;

                const mPositive = new Set(mSalesList.map(s => cleanCnpj(s.cnpj))).size;

                return { month, sales: mSales, target: mTarget, prevSales: mPrevSales, investment: mInv, positive: mPositive };
            });

            const monthsWithSales = monthly.filter(m => m.sales > 0);
            const avgAchievement = monthsWithSales.length > 0 
                ? monthsWithSales.reduce((a, b) => a + (b.target > 0 ? b.sales / b.target : 0), 0) / monthsWithSales.length 
                : 0;
            
            setData({ monthly, avgAchievement });
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const handleDownload = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(exportRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = `Performance_${userName.replace(/\s/g, '_')}_${selectedYear}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) { console.error(e); } finally { setIsExporting(false); }
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    if (isLoading || !data) return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
            <p className="font-black text-[10px] uppercase tracking-[0.3em]">Consolidando seu faturamento...</p>
        </div>
    );

    const totalMeta = data.monthly.reduce((a: number, b: any) => a + b.target, 0);
    const totalSales = data.monthly.reduce((a: number, b: any) => a + b.sales, 0);
    const pctTotal = totalMeta > 0 ? (totalSales / totalMeta) * 100 : 0;
    const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-20">
            <header className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Análise de Performance</h2>
                    <p className="text-[10px] font-black text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-widest">
                        <BarChart3 className="w-3.5 h-3.5 text-blue-500" /> 
                        Comparativo de Metas e Realizado
                    </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={fetchPerformanceData} className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <select 
                        value={selectedYear} 
                        onChange={e => setSelectedYear(Number(e.target.value))} 
                        className="bg-white border border-slate-200 rounded-xl px-6 py-2.5 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer flex-1 md:flex-none"
                    >
                        <option value={2024}>ANO 2024</option>
                        <option value={2025}>ANO 2025</option>
                        <option value={2026}>ANO 2026</option>
                    </select>
                    <Button onClick={handleDownload} isLoading={isExporting} variant="outline" className="rounded-xl px-6 h-11 text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white border-blue-600 hover:bg-blue-700">
                         <Download className="w-3.5 h-3.5 mr-2" /> Salvar Raio-X
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cota do Ano</p>
                    <h3 className="text-2xl font-black text-slate-900">{formatBRL(totalMeta)}</h3>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado Real</p>
                    <h3 className="text-2xl font-black text-blue-600">{formatBRL(totalSales)}</h3>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Atingimento</p>
                    <h3 className={`text-2xl font-black ${pctTotal >= 100 ? 'text-blue-600' : 'text-blue-500'}`}>{pctTotal.toFixed(1)}%</h3>
                </div>
                <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Projeção Final</p>
                    <p className="text-2xl font-black tabular-nums">
                        {formatBRL(totalSales + (data.monthly.filter((m: any) => m.sales === 0 && m.month > new Date().getUTCMonth() + 1).reduce((a: number, b: any) => a + (b.target * data.avgAchievement), 0)))}
                    </p>
                </div>
            </div>

            <div className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-200 shadow-sm relative overflow-hidden" ref={exportRef}>
                <div className="flex justify-between items-center mb-16">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Evolução Mensal {selectedYear}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Comparativo Faturado vs Meta</p>
                    </div>
                    <div className="flex gap-6">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta Atingida</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Abaixo da Meta</span>
                        </div>
                    </div>
                </div>

                <div className="h-[350px] w-full flex items-end justify-between gap-3 md:gap-6 px-2">
                    {data.monthly.map((item: any, idx: number) => {
                        const maxVal = Math.max(...data.monthly.flatMap((d: any) => [d.sales, d.target])) * 1.1 || 1;
                        const salesHeight = (item.sales / maxVal) * 100;
                        const targetHeight = (item.target / maxVal) * 100;
                        const achievement = item.target > 0 ? (item.sales / item.target) * 100 : 0;
                        const isSuccess = achievement >= 100;

                        return (
                            <div key={idx} className="flex-1 flex flex-col items-center group h-full relative">
                                <div className="absolute top-[-90px] opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 z-30 pointer-events-none w-[160px]">
                                    <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-2xl text-center relative">
                                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">{achievement.toFixed(1)}%</p>
                                        <div className="space-y-0.5 mb-2">
                                            <p className="text-[11px] font-black leading-none">{formatBRL(item.sales)}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase">Meta: {formatBRL(item.target)}</p>
                                        </div>
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                    </div>
                                </div>

                                <div className="relative w-full flex-1 flex flex-col justify-end">
                                    <div className="w-full bg-slate-100 rounded-2xl border border-slate-200/50 absolute bottom-0 transition-all" style={{ height: `${Math.max(targetHeight, 2)}%` }}></div>
                                    <div className={`w-full rounded-2xl transition-all duration-1000 ease-out relative z-10 shadow-lg ${isSuccess ? 'bg-blue-600 shadow-blue-200' : 'bg-red-500 shadow-red-100'}`} style={{ height: `${Math.max(salesHeight, 2)}%` }}>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent rounded-2xl"></div>
                                        {isSuccess && (
                                            <div className="absolute -top-7 left-1/2 -translate-x-1/2">
                                                <div className="p-1 bg-blue-100 rounded-full shadow-sm">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <span className="mt-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">{monthsNames[idx]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                            <th className="px-8 py-5">Mês de Referência</th>
                            <th className="px-8 py-5">Meta Planejada</th>
                            <th className="px-8 py-5">Faturado Real</th>
                            <th className="px-8 py-5 text-center">% Atingimento</th>
                            <th className="px-8 py-5 text-center">Cresc. YoY</th>
                            <th className="px-8 py-5 text-right">Positivação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {data.monthly.map((m: any, idx: number) => {
                            const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                            const growth = m.prevSales > 0 ? ((m.sales / m.prevSales) - 1) * 100 : 0;
                            const fullMonthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

                            return (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-4 font-bold text-slate-700 uppercase text-xs">{fullMonthNames[idx]}</td>
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
        </div>
    );
};
