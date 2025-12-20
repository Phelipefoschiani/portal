
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Loader2, Target, BarChart, LineChart, Award } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import html2canvas from 'html2canvas';

interface RepPerformanceModalProps {
    rep: any;
    year: number;
    onClose: () => void;
}

export const RepPerformanceModal: React.FC<RepPerformanceModalProps> = ({ rep, year, onClose }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [data, setData] = useState<any>(null);
    const exportRef = useRef<HTMLDivElement>(null);

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

            const monthsDone = monthly.filter(m => m.sales > 0);
            const avgAchievement = monthsDone.length > 0 ? monthsDone.reduce((a, b) => a + (b.target > 0 ? b.sales / b.target : 0), 0) / monthsDone.length : 0;
            
            setData({ monthly, avgAchievement });
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const handleDownload = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        try {
            const element = exportRef.current;
            
            // Forçamos a captura do scrollHeight total para evitar cortes
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: element.scrollWidth,
                height: element.scrollHeight,
                windowWidth: element.scrollWidth,
                windowHeight: element.scrollHeight,
                onclone: (clonedDoc) => {
                    // No documento clonado que o html2canvas usa, removemos restrições de scroll
                    const el = clonedDoc.getElementById('raio-x-export-root');
                    if (el) {
                        el.style.height = 'auto';
                        el.style.overflow = 'visible';
                        el.style.maxHeight = 'none';
                    }
                }
            });
            
            const link = document.createElement('a');
            link.download = `RaioX_${rep.nome.replace(/\s/g, '_')}_${year}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
        } catch (e) { 
            console.error('Erro ao exportar:', e); 
        } finally { 
            setIsExporting(false); 
        }
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    if (isLoading || !data) return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-white" />
                <p className="text-white font-black text-[10px] uppercase tracking-[0.3em]">Gerando inteligência comercial...</p>
            </div>
        </div>
    );

    const totalMeta = data.monthly.reduce((a: number, b: any) => a + b.target, 0);
    const totalSales = data.monthly.reduce((a: number, b: any) => a + b.sales, 0);
    const pctTotal = totalMeta > 0 ? (totalSales / totalMeta) * 100 : 0;

    const getPoints = (type: 'sales' | 'target' | 'proj') => {
        const max = Math.max(...data.monthly.flatMap((d: any) => [d.sales, d.target])) * 1.2 || 1;
        return data.monthly.map((m: any, i: number) => {
            const val = type === 'sales' ? (m.sales || 0) : 
                        type === 'target' ? m.target : 
                        (m.sales > 0 ? m.sales : m.target * data.avgAchievement);
            const x = (i / 11) * 100;
            const y = 100 - (val / max) * 100;
            return `${x},${y}`;
        }).join(' ');
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 bg-slate-900/80 backdrop-blur-xl animate-fadeIn">
            <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-white/20">
                
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                            <Award className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{rep.nome}</h2>
                            <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mt-1">Visualização Executiva de Performance</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleDownload} isLoading={isExporting} className="rounded-xl px-6 h-10 text-[9px] font-black uppercase tracking-widest bg-slate-50 border-slate-200">
                             <Download className="w-3.5 h-3.5 mr-2" /> Salvar Relatório Completo
                        </Button>
                        <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 bg-white">
                    <div id="raio-x-export-root" ref={exportRef} className="p-8 space-y-8 bg-white">
                        <div className="pb-8 border-b-2 border-slate-900 flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-2">Raio-X de Performance Comercial</p>
                                <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">{rep.nome}</h1>
                                <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest">Ano de Referência: {year}</p>
                            </div>
                            <div className="text-right">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data do Relatório</p>
                                 <p className="text-lg font-black text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Anual</p>
                                <p className="text-xl font-black text-slate-900">{formatBRL(totalMeta)}</p>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Faturado</p>
                                <p className="text-xl font-black text-emerald-600">{formatBRL(totalSales)}</p>
                            </div>
                            <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Alcance Geral</p>
                                <p className={`text-xl font-black ${pctTotal >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{pctTotal.toFixed(1)}%</p>
                            </div>
                            <div className="bg-slate-900 p-5 rounded-3xl text-white shadow-xl">
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Projeção Final</p>
                                <p className="text-xl font-black text-white tabular-nums">
                                    {formatBRL(totalSales + (data.monthly.filter((m: any) => m.sales === 0 && m.month > new Date().getUTCMonth() + 1).reduce((a: number, b: any) => a + (b.target * data.avgAchievement), 0)))}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2"><LineChart className="w-4 h-4 text-blue-600" /> Histórico de Vendas vs Meta</h4>
                            </div>
                            <div className="h-[220px] w-full relative px-2">
                                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                                    <polyline points={getPoints('target')} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2.5" />
                                    <polyline points={getPoints('proj')} fill="none" stroke="#bfdbfe" strokeWidth="2.5" />
                                    <polyline points={getPoints('sales')} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                                    {data.monthly.map((m: any, i: number) => {
                                        if (m.sales === 0) return null;
                                        const max = Math.max(...data.monthly.flatMap((d: any) => [d.sales, d.target])) * 1.2 || 1;
                                        const x = (i / 11) * 100;
                                        const y = 100 - (m.sales / max) * 100;
                                        return <circle key={i} cx={x} cy={y} r="1.5" fill="#2563eb" />;
                                    })}
                                </svg>
                                <div className="flex justify-between mt-6 px-1">
                                    {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map(m => (
                                        <span key={m} className="text-[10px] font-black text-slate-400 uppercase">{m}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                        <th className="px-6 py-5">Mês</th>
                                        <th className="px-6 py-5">Meta</th>
                                        <th className="px-6 py-5">Faturado</th>
                                        <th className="px-6 py-5 text-center">% Meta</th>
                                        <th className="px-6 py-5 text-center">Cresc. YoY</th>
                                        <th className="px-6 py-5 text-right">Invest. (R$)</th>
                                        <th className="px-6 py-5 text-center">% Inv.</th>
                                        <th className="px-6 py-5 text-right">Positivação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-bold text-[11px]">
                                    {data.monthly.map((m: any, idx: number) => {
                                        const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                                        const growth = m.prevSales > 0 ? ((m.sales / m.prevSales) - 1) * 100 : 0;
                                        const invPct = m.sales > 0 ? (m.investment / m.sales) * 100 : 0;
                                        const monthsNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 text-slate-700 uppercase">{monthsNames[idx]}</td>
                                                <td className="px-6 py-4 text-slate-400 font-medium tabular-nums">{formatBRL(m.target)}</td>
                                                <td className="px-6 py-4 text-slate-900 font-black tabular-nums">{formatBRL(m.sales)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black border ${achievement >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                        {achievement.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {m.sales > 0 ? (
                                                        <div className={`flex items-center justify-center gap-1 text-[10px] font-black ${growth >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                            {growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                            {Math.abs(growth).toFixed(1)}%
                                                        </div>
                                                    ) : <span className="text-slate-200">--</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right text-amber-600 font-black tabular-nums">{formatBRL(m.investment)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-[10px] font-black text-slate-500">{invPct > 0 ? `${invPct.toFixed(1)}%` : '--'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">
                                                        {m.positive} Clts
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="pt-20 pb-10 flex justify-between items-center opacity-30 border-t border-slate-100">
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 italic">Portal Centro-Norte • Inteligência e Performance Comercial</p>
                            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xs">CN</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
