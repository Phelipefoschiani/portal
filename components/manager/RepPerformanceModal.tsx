
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Loader2, Target, BarChart, LineChart, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import html2canvas from 'html2canvas';

interface RepPerformanceModalProps {
    rep: any;
    year: number;
    selectedMonths?: number[];
    onClose: () => void;
}

export const RepPerformanceModal: React.FC<RepPerformanceModalProps> = ({ rep, year, selectedMonths, onClose }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [data, setData] = useState<any>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    useEffect(() => { fetchRepData(); }, [year, rep.id]);

    const cleanCnpj = (val: string) => String(val || '').replace(/\D/g, '');

    const fetchAllSales = async (userId: string, start: string, end: string) => {
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
            } else {
                hasMore = false;
            }
        }
        return allData;
    };

    const fetchRepData = async () => {
        setIsLoading(true);
        try {
            const sales = await fetchAllSales(rep.id, `${year}-01-01`, `${year}-12-31`);
            const prevSales = await fetchAllSales(rep.id, `${year-1}-01-01`, `${year-1}-12-31`);

            const { data: targets } = await supabase
                .from('metas_usuarios')
                .select('valor, mes')
                .eq('usuario_id', rep.id)
                .eq('ano', year);

            const { data: investments } = await supabase
                .from('investimentos')
                .select('valor_total_investimento, data')
                .eq('usuario_id', rep.id)
                .eq('status', 'approved')
                .gte('data', `${year}-01-01`)
                .lte('data', `${year}-12-31`);

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

            const monthsDone = monthly.filter((m: any) => m.sales > 0);
            const avgAchievement = monthsDone.length > 0 ? monthsDone.reduce((a: number, b: any) => a + (b.target > 0 ? b.sales / b.target : 0), 0) / monthsDone.length : 0;
            
            setData({ monthly, avgAchievement });
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const filteredMonthlyData = useMemo(() => {
        if (!data) return [];
        if (!selectedMonths || selectedMonths.length === 0) return data.monthly;
        return data.monthly.filter((m: any) => selectedMonths.includes(m.month));
    }, [data, selectedMonths]);

    const totalMeta = useMemo(() => filteredMonthlyData.reduce((a: number, b: any) => a + b.target, 0), [filteredMonthlyData]);
    const totalSales = useMemo(() => filteredMonthlyData.reduce((a: number, b: any) => a + b.sales, 0), [filteredMonthlyData]);
    const totalPrevSales = useMemo(() => filteredMonthlyData.reduce((a: number, b: any) => a + b.prevSales, 0), [filteredMonthlyData]);
    const totalInv = useMemo(() => filteredMonthlyData.reduce((a: number, b: any) => a + b.investment, 0), [filteredMonthlyData]);
    const pctTotal = totalMeta > 0 ? (totalSales / totalMeta) * 100 : 0;
    const growthTotal = totalPrevSales > 0 ? ((totalSales / totalPrevSales) - 1) * 100 : 0;

    const handleDownload = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        try {
            const element = exportRef.current;
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('raio-x-export-root');
                    if (el) {
                        el.style.height = 'auto';
                        el.style.overflow = 'visible';
                        el.style.maxHeight = 'none';
                    }
                }
            });
            const link = document.createElement('a');
            link.download = `Performance_${rep.nome.replace(/\s/g, '_')}_${year}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
        } catch (e) { console.error('Erro ao exportar:', e); } finally { setIsExporting(false); }
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    const getPoints = (type: 'sales' | 'target' | 'proj') => {
        if (filteredMonthlyData.length === 0) return "";
        const max = Math.max(...filteredMonthlyData.flatMap((d: any) => [d.sales, d.target])) * 1.2 || 1;
        return filteredMonthlyData.map((m: any, i: number) => {
            const val = type === 'sales' ? (m.sales || 0) : 
                        type === 'target' ? m.target : 
                        (m.sales > 0 ? m.sales : m.target * data.avgAchievement);
            const x = (i / (filteredMonthlyData.length - 1 || 1)) * 100;
            const y = 100 - (val / max) * 100;
            return `${x},${y}`;
        }).join(' ');
    };

    if (isLoading || !data) return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-white" />
                <p className="text-white font-black text-[10px] uppercase tracking-[0.3em]">Consolidando...</p>
            </div>
        </div>
    );

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 bg-slate-900/80 backdrop-blur-xl animate-fadeIn">
            <div className="bg-white w-full max-w-6xl rounded-[24px] md:rounded-[40px] shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden border border-white/20">
                
                <div className="px-4 md:px-8 py-4 md:py-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-lg shrink-0">
                            <Award className="w-4 h-4 md:w-6 md:h-6" />
                        </div>
                        <div className="truncate">
                            <h2 className="text-sm md:text-xl font-black text-slate-900 uppercase tracking-tighter leading-none truncate">{rep.nome}</h2>
                            <p className="text-[7px] md:text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Análise de Desempenho</p>
                        </div>
                    </div>
                    <div className="flex gap-1 md:gap-2 shrink-0">
                        <button onClick={handleDownload} disabled={isExporting} className="p-2 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl text-slate-500 hover:text-blue-600 transition-all">
                             <Download className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all">
                            <X className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 bg-white custom-scrollbar">
                    <div id="raio-x-export-root" ref={exportRef} className="p-4 md:p-8 space-y-4 md:space-y-8 bg-white">
                        
                        <div className="hidden pb-8 border-b-2 border-slate-900 md:flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-2">Relatório Executivo de Vendas</p>
                                <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">{rep.nome}</h1>
                                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Ano: {year}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                            <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center">
                                <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta</p>
                                <p className="text-sm md:text-xl font-black text-slate-900 truncate">{formatBRL(totalMeta)}</p>
                            </div>
                            <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center">
                                <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado</p>
                                <p className="text-sm md:text-xl font-black text-blue-600 truncate">{formatBRL(totalSales)}</p>
                            </div>
                            <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center">
                                <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Alcance</p>
                                <p className={`text-sm md:text-xl font-black ${pctTotal >= 100 ? 'text-blue-600' : 'text-red-600'}`}>{pctTotal.toFixed(1)}%</p>
                            </div>
                            <div className="bg-slate-900 p-3 md:p-5 rounded-2xl md:rounded-3xl text-white shadow-xl flex flex-col justify-center">
                                <p className="text-[7px] md:text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Projeção</p>
                                <p className="text-sm md:text-xl font-black text-white truncate tabular-nums">
                                    {formatBRL(totalSales + (data.monthly.filter((m: any) => m.sales === 0 && m.month > new Date().getUTCMonth() + 1).reduce((a: number, b: any) => a + (b.target * data.avgAchievement), 0)))}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-3">
                                <h4 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 shrink-0">
                                    <LineChart className="w-3 h-3 md:w-4 md:h-4 text-blue-600" /> Vendas vs Meta
                                </h4>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-0.5 bg-red-500 rounded-full"></div>
                                        <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">Meta</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-0.5 bg-blue-600 rounded-full"></div>
                                        <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">Real</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-[140px] md:h-[220px] w-full relative px-1">
                                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                                    <polyline points={getPoints('target')} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="3,2" />
                                    <polyline points={getPoints('sales')} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                    {filteredMonthlyData.map((m: any, i: number) => {
                                        if (m.sales === 0) return null;
                                        const max = Math.max(...filteredMonthlyData.flatMap((d: any) => [d.sales, d.target])) * 1.2 || 1;
                                        const x = (i / (filteredMonthlyData.length - 1 || 1)) * 100;
                                        const y = 100 - (m.sales / max) * 100;
                                        return <circle key={i} cx={x} cy={y} r="2" fill="#2563eb" />;
                                    })}
                                </svg>
                                <div className="flex justify-between mt-4 md:mt-6 px-1">
                                    {filteredMonthlyData.map((m: any) => (
                                        <span key={m.month} className="text-[7px] md:text-[10px] font-black text-slate-300 uppercase">{monthShort[m.month - 1]}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl md:rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                            <th className="px-6 py-5">Mês</th>
                                            <th className="px-6 py-5">Meta</th>
                                            <th className="px-6 py-5">Faturado</th>
                                            <th className="px-6 py-5 text-center">% Meta</th>
                                            <th className="px-6 py-5 text-center">Ano/Ano</th>
                                            <th className="px-6 py-5 text-right">Invest. (R$)</th>
                                            <th className="px-6 py-5 text-right">Posit.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 font-bold text-[11px]">
                                        {filteredMonthlyData.map((m: any, idx: number) => {
                                            const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                                            const growth = m.prevSales > 0 ? ((m.sales / m.prevSales) - 1) * 100 : 0;
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 text-slate-700 uppercase">{monthNames[m.month - 1]}</td>
                                                    <td className="px-6 py-4 text-slate-400 font-medium">{formatBRL(m.target)}</td>
                                                    <td className="px-6 py-4 text-slate-900 font-black">{formatBRL(m.sales)}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border ${achievement >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                            {achievement.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {m.sales > 0 ? (
                                                            <div className={`flex items-center justify-center gap-1 text-[10px] font-black ${growth >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                                                {growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                                {Math.abs(growth).toFixed(1)}%
                                                            </div>
                                                        ) : <span className="text-slate-200">--</span>}
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-amber-600">{formatBRL(m.investment)}</td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black">{m.positive} Clts</span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-900 text-white border-t-2 border-blue-600">
                                        <tr className="text-[10px] font-black uppercase tracking-widest">
                                            <td className="px-6 py-6 text-blue-400 font-black">{filteredMonthlyData.length} MESES</td>
                                            <td className="px-6 py-6 tabular-nums">{formatBRL(totalMeta)}</td>
                                            <td className="px-6 py-6 tabular-nums text-blue-400">{formatBRL(totalSales)}</td>
                                            <td className="px-6 py-6 text-center">
                                                <span className={`px-2 py-0.5 rounded-md border ${pctTotal >= 100 ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'}`}>
                                                    {pctTotal.toFixed(1)}% PERÍODO
                                                </span>
                                            </td>
                                            <td className="px-6 py-6 text-center">
                                                <div className={`flex items-center justify-center gap-1 font-black ${growthTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {growthTotal >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                    {Math.abs(growthTotal).toFixed(1)}% VS ANO ANT.
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-right text-amber-400 tabular-nums">{formatBRL(totalInv)}</td>
                                            <td className="px-6 py-6 text-right">
                                                <span className="text-slate-400">{filteredMonthlyData.reduce((acc, curr) => acc + curr.positive, 0)} TOTAL</span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="md:hidden divide-y divide-slate-100">
                                {filteredMonthlyData.map((m: any, idx: number) => {
                                    const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                                    return (
                                        <div key={idx} className="p-4 bg-white active:bg-slate-50">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="font-black text-slate-800 uppercase text-[10px] tracking-widest">{monthNames[m.month - 1]}</span>
                                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-black border ${achievement >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                    {achievement.toFixed(1)}% ALCANCE
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Realizado</p>
                                                    <p className="text-xs font-black text-slate-900">{formatBRL(m.sales)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Positivação</p>
                                                    <p className="text-xs font-black text-blue-600">{m.positive} Clientes</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="md:hidden pt-4 pb-10 text-center border-t border-slate-50">
                             <p className="text-[7px] font-black uppercase tracking-[0.4em] text-slate-300">Portal Centro-Norte Inteligência</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
