import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Target, TrendingUp, Users, Wallet, Calendar, RefreshCw, Loader2, DollarSign, CheckCircle2, X, ChevronRight, Database, RotateCcw, ChevronDown, CheckSquare, Square, Filter, Download, User, FileText, BarChart3 as BarIcon, Share2, CalendarDays, BarChart4, ArrowUpRight, ArrowDownRight, Table, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { totalDataStore } from '../../lib/dataStore';
import { Button } from '../Button';
import { RepPerformanceModal } from './RepPerformanceModal';
import * as XLSX from 'xlsx';

type KpiDetailType = 'meta' | 'faturado' | 'positivacao' | 'verba' | null;

// --- NOVO SUB-MODAL: DETALHAMENTO DE INVESTIMENTO POR CLIENTE (DRILL-DOWN) ---
const RepVerbaDetailModal: React.FC<{
    rep: any;
    selectedYear: number;
    onClose: () => void;
    formatBRL: (v: number) => string;
}> = ({ rep, selectedYear, onClose, formatBRL }) => {
    const clientData = useMemo(() => {
        // Busca faturamento anual do cliente para este representante
        const sales = totalDataStore.sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return s.usuario_id === rep.id && d.getUTCFullYear() === selectedYear;
        });

        // Busca investimentos aprovados anuais
        const invs = totalDataStore.investments.filter(inv => {
            const d = new Date(inv.data + 'T00:00:00');
            return inv.usuario_id === rep.id && inv.status === 'approved' && d.getUTCFullYear() === selectedYear;
        });

        const clientMap = new Map<string, { name: string; purchased: number; invested: number }>();
        const clientLookup = new Map(totalDataStore.clients.map(c => [c.id, c.nome_fantasia]));

        // Acumular faturamento por cliente
        sales.forEach(s => {
            const cId = s.cliente_id;
            if (!cId) return;
            const current = clientMap.get(cId) || { name: clientLookup.get(cId) || s.cliente_nome || 'CLIENTE N/I', purchased: 0, invested: 0 };
            current.purchased += Number(s.faturamento);
            clientMap.set(cId, current);
        });

        // Acumular investimento por cliente
        invs.forEach(inv => {
            const cId = inv.cliente_id;
            if (!cId) return;
            const current = clientMap.get(cId) || { name: clientLookup.get(cId) || 'CLIENTE N/I', purchased: 0, invested: 0 };
            current.invested += Number(inv.valor_total_investimento);
            clientMap.set(cId, current);
        });

        return Array.from(clientMap.values())
            .filter(c => c.invested > 0)
            .sort((a, b) => b.invested - a.invested);
    }, [rep.id, selectedYear]);

    return createPortal(
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/20">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Investimento por Cliente ({selectedYear})</h3>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Rep: {rep.nome}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                <tr>
                                    <th className="px-8 py-5">Cliente</th>
                                    <th className="px-6 py-5 text-right">Total Comprado no Ano</th>
                                    <th className="px-6 py-5 text-right">Total Investimento</th>
                                    <th className="px-8 py-5 text-right">% de Ref</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {clientData.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-10 text-center text-slate-300 font-bold uppercase text-[10px]">Sem investimentos registrados</td>
                                    </tr>
                                ) : (
                                    clientData.map((c, i) => {
                                        const refPct = c.purchased > 0 ? (c.invested / c.purchased) * 100 : 100;
                                        return (
                                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-8 py-4">
                                                    <span className="font-black text-slate-700 uppercase text-[11px] truncate block max-w-[300px]">{c.name}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-400 text-xs tabular-nums">{formatBRL(c.purchased)}</td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{formatBRL(c.invested)}</td>
                                                <td className="px-8 py-4 text-right">
                                                    <span className={`text-[11px] font-black tabular-nums ${refPct > 7 ? 'text-red-500' : 'text-blue-600'}`}>
                                                        {refPct.toFixed(2)}%
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <Button onClick={onClose} className="rounded-2xl px-10 font-black text-[10px] uppercase">Fechar Detalhe</Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- MODAL DE ANÁLISE DE METAS ---
const TargetsAnalysisModal: React.FC<{
    year: number;
    repId: string;
    repName: string;
    periodLabel: string;
    onClose: () => void;
    formatBRL: (v: number) => string;
}> = ({ year, repId, repName, periodLabel, onClose, formatBRL }) => {
    const [isExporting, setIsExporting] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const analysisData = useMemo(() => {
        const targets = totalDataStore.targets;
        const sales = totalDataStore.sales;
        
        const filterByRep = (t: any) => repId === 'all' ? true : t.usuario_id === repId;

        const currentYearTargets = targets.filter(t => t.ano === year && filterByRep(t));
        const prevYearTargets = targets.filter(t => t.ano === (year - 1) && filterByRep(t));
        
        const prevYearRealSales = sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return d.getUTCFullYear() === (year - 1) && (repId === 'all' ? true : s.usuario_id === repId);
        });

        const annualTotal = currentYearTargets.reduce((acc, curr) => acc + Number(curr.valor), 0);
        const prevAnnualTotal = prevYearTargets.reduce((acc, curr) => acc + Number(curr.valor), 0);
        const prevAnnualRealSalesTotal = prevYearRealSales.reduce((acc, curr) => acc + Number(curr.faturamento), 0);

        const rows = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const mTarget = currentYearTargets.filter(t => t.mes === month).reduce((a, b) => a + Number(b.valor), 0);
            const mPrevTarget = prevYearTargets.filter(t => t.mes === month).reduce((a, b) => a + Number(b.valor), 0);
            
            const mPrevRealSales = prevYearRealSales.filter(s => {
                const d = new Date(s.data + 'T00:00:00');
                return (d.getUTCMonth() + 1) === month;
            }).reduce((a, b) => a + Number(b.faturamento), 0);
            
            return {
                monthName: monthNames[i],
                value: mTarget,
                prevValue: mPrevTarget,
                prevRealSales: mPrevRealSales,
                refPercent: annualTotal > 0 ? (mTarget / annualTotal) * 100 : 0,
                refVsPrevSales: mPrevRealSales > 0 ? ((mTarget / mPrevRealSales) - 1) * 100 : 0,
                vsPrev: mPrevTarget > 0 ? ((mTarget / mPrevTarget) - 1) * 100 : 0,
                hasPrev: mPrevTarget > 0,
                hasPrevSales: mPrevRealSales > 0
            };
        });

        return { rows, annualTotal, prevAnnualTotal, prevAnnualRealSalesTotal };
    }, [year, repId]);

    const handleDownloadPng = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        try {
            await new Promise(r => setTimeout(r, 400));
            const canvas = await html2canvas(exportRef.current, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                scrollX: 0,
                scrollY: -window.scrollY,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('targets-analysis-export-root');
                    if (el) {
                        el.style.height = 'auto';
                        el.style.maxHeight = 'none';
                        el.style.overflow = 'visible';
                        el.style.padding = '40px';
                        const scrollArea = el.querySelector('.custom-scrollbar') as HTMLElement;
                        if (scrollArea) {
                            scrollArea.style.maxHeight = 'none';
                            scrollArea.style.overflow = 'visible';
                            scrollArea.style.height = 'auto';
                        }
                    }
                }
            });
            const link = document.createElement('a');
            link.download = `Analise_Estrategica_${repName.replace(/\s/g, '_')}_${year}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
        } catch (e) {
            console.error(e);
        } finally {
            setIsExporting(false);
        }
    };

    const growthTotal = analysisData.prevAnnualTotal > 0 
        ? ((analysisData.annualTotal / analysisData.prevAnnualTotal) - 1) * 100 
        : 0;

    const growthVsRealTotal = analysisData.prevAnnualRealSalesTotal > 0
        ? ((analysisData.annualTotal / analysisData.prevAnnualRealSalesTotal) - 1) * 100
        : 0;

    return createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-2 md:p-6 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
            <div className="bg-white w-full max-w-[1300px] rounded-[40px] shadow-2xl overflow-hidden animate-slideUp border border-white/20 flex flex-col max-h-[92vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
                            <BarChart4 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Visão Analítica de Metas</h3>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1.5">{periodLabel}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleDownloadPng}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg text-[10px] font-black uppercase tracking-widest"
                        >
                            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            Salvar PNG Full
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar" ref={exportRef} id="targets-analysis-export-root">
                    <div className="p-8 space-y-8 h-fit">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-2 border-slate-900 pb-6 gap-4">
                            <div>
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] block mb-2">Painel Estratégico de Planejamento Regional</span>
                                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{repName}</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Exercício Fiscal: {year} • Filtro: {periodLabel}</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 text-right min-w-[190px]">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cota Projetada {year}</p>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">{formatBRL(analysisData.annualTotal)}</p>
                                </div>
                                <div className="bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100 text-right min-w-[190px]">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Realizado {year - 1}</p>
                                    <p className="text-xl font-black text-slate-500 tabular-nums">{formatBRL(analysisData.prevAnnualRealSalesTotal)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr className="border-b border-slate-200">
                                        <th colSpan={3} className="px-8 py-3 text-left bg-white/50 border-r border-slate-100">Visão Planejada {year}</th>
                                        <th colSpan={2} className="px-6 py-3 text-center bg-blue-100/30 text-blue-600 border-r border-slate-200 ring-inset ring-1 ring-blue-100">Referência Faturamento Ano Anterior</th>
                                        <th colSpan={2} className="px-6 py-3 text-center bg-slate-100 text-slate-600">Referência Meta Ano Anterior</th>
                                    </tr>
                                    <tr className="border-b border-slate-200">
                                        <th className="px-8 py-4">Mês Ref.</th>
                                        <th className="px-6 py-4 text-right">Meta {year}</th>
                                        <th className="px-6 py-4 text-center border-r border-slate-100">Ref. % Anual</th>
                                        <th className="px-6 py-4 text-center bg-blue-50/50 text-blue-700">Ref. Meta vs Ano ant</th>
                                        <th className="px-6 py-4 text-right bg-blue-50/50 text-blue-700 border-r border-slate-200">Fat. Ano Ant.</th>
                                        <th className="px-6 py-4 text-center">Vs Meta Ant.</th>
                                        <th className="px-8 py-4 text-right">Cota {year - 1}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {analysisData.rows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-8 py-4">
                                                <span className="font-black text-slate-700 uppercase text-[11px] tracking-tight group-hover:text-blue-600">{row.monthName}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-black text-slate-900 text-xs tabular-nums">{formatBRL(row.value)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center border-r border-slate-100">
                                                <span className="text-[11px] font-black text-slate-400 tabular-nums">{row.refPercent.toFixed(2)}%</span>
                                            </td>
                                            <td className="px-6 py-4 text-center bg-blue-50/10">
                                                {row.hasPrevSales ? (
                                                    <div className={`inline-flex items-center gap-1 font-black text-[10px] tabular-nums ${row.refVsPrevSales >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                                        {row.refVsPrevSales >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {Math.abs(row.refVsPrevSales).toFixed(2)}%
                                                    </div>
                                                ) : <span className="text-slate-200">--</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right bg-blue-50/10 border-r border-slate-200">
                                                <span className="font-bold text-slate-500 text-xs tabular-nums">{formatBRL(row.prevRealSales)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {row.hasPrev ? (
                                                    <div className={`inline-flex items-center gap-1 font-black text-[10px] tabular-nums ${row.vsPrev >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {row.vsPrev >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {Math.abs(row.vsPrev).toFixed(2)}%
                                                    </div>
                                                ) : <span className="text-slate-200">--</span>}
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <span className="font-bold text-slate-300 text-xs tabular-nums">{formatBRL(row.prevValue)}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-900 text-white border-t-4 border-blue-600">
                                    <tr className="text-[11px] font-black uppercase tracking-widest">
                                        <td className="px-8 py-6 text-blue-400">Total Acumulado</td>
                                        <td className="px-6 py-6 text-right tabular-nums font-black">{formatBRL(analysisData.annualTotal)}</td>
                                        <td className="px-6 py-6 text-center border-r border-white/5">100.00%</td>
                                        <td className="px-6 py-6 text-center bg-blue-600/10">
                                            <div className={`font-black tabular-nums ${growthVsRealTotal >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                                {growthVsRealTotal.toFixed(2)}% VS REAL
                                            </div>
                                        </td>
                                        <td className="px-6 py-6 text-right bg-blue-600/10 border-r border-white/5 text-slate-400 tabular-nums">{formatBRL(analysisData.prevAnnualRealSalesTotal)}</td>
                                        <td className="px-6 py-6 text-center">
                                            <div className={`flex items-center justify-center gap-1 tabular-nums ${growthTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {growthTotal.toFixed(2)}% VARIAÇÃO
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right tabular-nums text-slate-400">{formatBRL(analysisData.prevAnnualTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- MODAL DE DETALHAMENTO DE KPI ---
const KpiDetailModal: React.FC<{ 
    type: KpiDetailType; 
    details: any[]; 
    onClose: () => void; 
    formatBRL: (v: number) => string;
    periodLabel: string;
    selectedYear: number;
}> = ({ type, details, onClose, formatBRL, periodLabel, selectedYear }) => {
    const [selectedRepForVerba, setSelectedRepForVerba] = useState<any | null>(null);

    const titles = {
        meta: `RELATÓRIO ESTRATÉGICO DE METAS`,
        faturado: 'RELATÓRIO DE FATURAMENTO REALIZADO',
        positivacao: 'RELATÓRIO DE POSITIVAÇÃO DE CARTEIRA',
        verba: 'RELATÓRIO DE UTILIZAÇÃO DE VERBAS (TETO ANUAL 5%)'
    };

    const sortedDetails = [...details].sort((a, b) => {
        if (type === 'meta') return b.meta - a.meta;
        if (type === 'faturado') return b.faturado - a.faturado;
        if (type === 'verba') return b.verbaAnnualUsed - a.verbaAnnualUsed;
        return 0;
    });

    return (
        <>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white w-full max-w-7xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[95vh]">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="min-w-0">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{type ? titles[type] : ''}</h3>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Portal Centro-Norte • {periodLabel}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-10 bg-white custom-scrollbar">
                        <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    {type === 'verba' ? (
                                        <tr>
                                            <th className="px-6 py-4">Representante</th>
                                            <th className="px-6 py-4 text-right">Investimento Total (5% Meta Anual)</th>
                                            <th className="px-6 py-4 text-right">Investimento Usado</th>
                                            <th className="px-6 py-4 text-right">Investimento Restante</th>
                                            <th className="px-6 py-4 text-center">% Utilizado</th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <th className="px-6 py-4">#</th>
                                            <th className="px-6 py-4">Representante</th>
                                            <th className="px-6 py-4 text-right">Planejado</th>
                                            <th className="px-6 py-4 text-right">Realizado</th>
                                            <th className="px-6 py-4 text-center">Eficiência</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-bold">
                                    {sortedDetails.map((rep, idx) => {
                                        const achievement = rep.meta > 0 ? (rep.faturado / rep.meta) * 100 : 0;
                                        
                                        // Lógica da Verba Anual (5% da Meta de Janeiro a Dezembro)
                                        const budgetTotal = (rep.annualMeta || 0) * 0.05;
                                        const budgetUsed = rep.verbaAnnualUsed || 0;
                                        const budgetRemaining = budgetTotal - budgetUsed;
                                        const budgetPct = budgetTotal > 0 ? (budgetUsed / budgetTotal) * 100 : 0;

                                        return (
                                            <tr 
                                                key={rep.id} 
                                                className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                onClick={() => type === 'verba' && setSelectedRepForVerba(rep)}
                                            >
                                                {type === 'verba' ? (
                                                    <>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center font-black text-amber-600 uppercase text-xs border border-amber-100 group-hover:bg-amber-600 group-hover:text-white transition-all">
                                                                    {rep.nome.charAt(0)}
                                                                </div>
                                                                <span className="font-black text-slate-700 uppercase text-[11px] tracking-tight">{rep.nome}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-400 text-xs tabular-nums">{formatBRL(budgetTotal)}</td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{formatBRL(budgetUsed)}</td>
                                                        <td className="px-6 py-4 text-right font-black text-xs tabular-nums">
                                                            <span className={budgetRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                                {formatBRL(budgetRemaining)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${budgetPct <= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                                    {budgetPct.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-6 py-4 text-[10px] font-black text-slate-300">{idx + 1}</td>
                                                        <td className="px-6 py-4 font-black text-slate-700 uppercase text-[11px]">{rep.nome}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-400 text-xs tabular-nums">{formatBRL(rep.meta)}</td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{formatBRL(rep.faturado)}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${achievement >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                                {achievement.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button onClick={onClose} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl">Fechar Relatório</button>
                    </div>
                </div>
            </div>

            {selectedRepForVerba && (
                <RepVerbaDetailModal 
                    rep={selectedRepForVerba}
                    selectedYear={selectedYear}
                    onClose={() => setSelectedRepForVerba(null)}
                    formatBRL={formatBRL}
                />
            )}
        </>
    );
};

export const ManagerDashboard: React.FC = () => {
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [showTargetsAnalysis, setShowTargetsAnalysis] = useState(false);
    const [activeKpiDetail, setActiveKpiDetail] = useState<KpiDetailType>(null);
    const [teamDetails, setTeamDetails] = useState<any[]>([]);
    const [selectedRepId, setSelectedRepId] = useState<string>('all');
    const [selectedRepForPerformance, setSelectedRepForPerformance] = useState<any | null>(null);
    const [isExportingMatrix, setIsExportingMatrix] = useState(false);
    
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => { processConsolidatedData(); }, [selectedMonths, selectedYear, selectedRepId]);

    const processConsolidatedData = () => {
        const reps = totalDataStore.users;
        const sales = totalDataStore.sales;
        const targets = totalDataStore.targets;
        const invs = totalDataStore.investments;
        const portfolio = totalDataStore.clients;

        const details = reps.map(rep => {
            const repMeta = targets.filter(t => t.usuario_id === rep.id && selectedMonths.includes(t.mes) && Number(t.ano) === selectedYear).reduce((a, b) => a + Number(b.valor), 0);
            const annualMeta = targets.filter(t => t.usuario_id === rep.id && Number(t.ano) === selectedYear).reduce((a, b) => a + Number(b.valor), 0);
            
            const repSalesList = sales.filter(s => {
                const d = new Date(s.data + 'T00:00:00');
                const m = d.getUTCMonth() + 1;
                const y = d.getUTCFullYear();
                return s.usuario_id === rep.id && selectedMonths.includes(m) && y === selectedYear;
            });

            const repSales = repSalesList.reduce((a, b) => a + Number(b.faturamento), 0);
            
            const verbaAnnualUsed = invs.filter(inv => {
                const d = new Date(inv.data + 'T00:00:00');
                return inv.usuario_id === rep.id && d.getUTCFullYear() === selectedYear && inv.status === 'approved';
            }).reduce((a, b) => a + Number(b.valor_total_investimento), 0);

            const repClients = portfolio.filter(c => c.usuario_id === rep.id);
            const salesCnpjs = new Set(repSalesList.map(s => String(s.cnpj || '').replace(/\D/g, '')));
            const repPosit = repClients.filter(c => salesCnpjs.has(String(c.cnpj || '').replace(/\D/g, ''))).length;

            return { id: rep.id, nome: rep.nome, meta: repMeta, annualMeta, faturado: repSales, verbaAnnualUsed, positivacao: repPosit, totalClientes: repClients.length };
        });

        setTeamDetails(details);
    };

    const displayData = useMemo(() => {
        if (selectedRepId === 'all') {
            return teamDetails.reduce((acc, curr) => ({
                totalMeta: acc.totalMeta + curr.meta,
                totalFaturado: acc.totalFaturado + curr.faturado,
                totalClientes: acc.totalClientes + curr.totalClientes,
                clientesPositivados: acc.clientesPositivados + curr.positivacao,
                investimentoAno: acc.investimentoAno + curr.verbaAnnualUsed
            }), { totalMeta: 0, totalFaturado: 0, totalClientes: 0, clientesPositivados: 0, investimentoAno: 0 });
        } else {
            const rep = teamDetails.find(r => r.id === selectedRepId);
            if (!rep) return { totalMeta: 0, totalFaturado: 0, totalClientes: 0, clientesPositivados: 0, investimentoAno: 0 };
            return {
                totalMeta: rep.meta,
                totalFaturado: rep.faturado,
                totalClientes: rep.totalClientes,
                clientesPositivados: rep.positivacao,
                investimentoAno: rep.verbaAnnualUsed
            };
        }
    }, [teamDetails, selectedRepId]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    
    const pctMeta = displayData.totalMeta > 0 ? (displayData.totalFaturado / displayData.totalMeta) * 100 : 0;
    const diff = displayData.totalFaturado - displayData.totalMeta;

    const toggleTempMonth = (m: number) => {
        setTempSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    };

    const handleApplyFilter = () => {
        setSelectedMonths([...tempSelectedMonths]);
        setShowMonthDropdown(false);
    };

    const getMonthsLabel = () => {
        if (selectedMonths.length === 0) return "Nenhum Selecionado";
        if (selectedMonths.length === 12) return "ANO COMPLETO";
        const sorted = [...selectedMonths].sort((a,b) => a-b);
        const monthNamesArr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        if (selectedMonths.length === 1) return monthNamesArr[selectedMonths[0] - 1].toUpperCase();
        return `${selectedMonths.length} MESES SELECIONADOS`;
    };

    const monthNamesArr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // Cálculo da Matriz de Metas Anuais
    const matrixData = useMemo(() => {
        const reps = totalDataStore.users.sort((a, b) => a.nome.localeCompare(b.nome));
        const allTargets = totalDataStore.targets.filter(t => t.ano === selectedYear);

        const rows = reps.map(rep => {
            const monthlyTargets = Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                return allTargets.find(t => t.usuario_id === rep.id && t.mes === month)?.valor || 0;
            });
            const totalRep = monthlyTargets.reduce((a, b) => a + b, 0);
            return { rep, monthlyTargets, totalRep };
        });

        const columnTotals = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            return allTargets.filter(t => t.mes === month).reduce((a, b) => a + Number(b.valor), 0);
        });

        const grandTotal = columnTotals.reduce((a, b) => a + b, 0);

        return { rows, columnTotals, grandTotal };
    }, [selectedYear]);

    const handleDownloadMatrixExcel = () => {
        if (matrixData.rows.length === 0) return;
        setIsExportingMatrix(true);
        try {
            const X = (XLSX as any).utils ? XLSX : (XLSX as any).default;
            if (!X || !X.utils) throw new Error("XLSX lib not found");

            const dataToExport = matrixData.rows.map(row => {
                const obj: any = { "Representante": row.rep.nome };
                monthNamesArr.forEach((m, idx) => {
                    obj[m] = row.monthlyTargets[idx];
                });
                obj["Total Anual"] = row.totalRep;
                return obj;
            });

            // Adicionar linha de totais
            const totalsObj: any = { "Representante": "META REGIONAL TOTAL" };
            monthNamesArr.forEach((m, idx) => {
                totalsObj[m] = matrixData.columnTotals[idx];
            });
            totalsObj["Total Anual"] = matrixData.grandTotal;
            dataToExport.push(totalsObj);

            const ws = X.utils.json_to_sheet(dataToExport);

            // Formatação financeira para as colunas de valor
            const range = X.utils.decode_range(ws['!ref']!);
            for (let C = 1; C <= range.e.c; ++C) {
                for (let R = 1; R <= range.e.r; ++R) {
                    const cell = ws[X.utils.encode_cell({ r: R, c: C })];
                    if (cell && typeof cell.v === 'number') {
                        cell.t = 'n';
                        cell.z = '"R$" #,##0.00';
                    }
                }
            }

            const wb = X.utils.book_new();
            X.utils.book_append_sheet(wb, ws, "Cotas_Anuais");
            X.writeFile(wb, `Cota_Anual_Regional_${selectedYear}.xlsx`);
        } catch (e) {
            console.error(e);
            alert('Falha ao exportar excel.');
        } finally {
            setIsExportingMatrix(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-12">
            <header className="flex flex-col lg:flex-row justify-between items-end gap-6 px-4">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="min-w-[200px]">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Análise Regional</h2>
                        <p className="text-[10px] font-black text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-widest text-left truncate max-w-[250px]">
                            <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" /> 
                            {getMonthsLabel()} de {selectedYear}
                        </p>
                    </div>
                    <button 
                        onClick={() => setShowTargetsAnalysis(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 text-[10px] font-black uppercase tracking-widest"
                    >
                        <Target className="w-4 h-4" />
                        Análise de Metas
                    </button>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:flex-none">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <User className="w-3.5 h-3.5" />
                        </div>
                        <select 
                            value={selectedRepId}
                            onChange={(e) => setSelectedRepId(e.target.value)}
                            className="w-full lg:w-auto pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer transition-all"
                        >
                            <option value="all">Equipe Completa</option>
                            {teamDetails.map(rep => (
                                <option key={rep.id} value={rep.id}>{rep.nome.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative flex-1 lg:flex-none">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <CalendarDays className="w-3.5 h-3.5" />
                        </div>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-full lg:w-auto pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer transition-all"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
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
                            <div className="absolute top-full left-0 lg:left-auto lg:right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
                                    <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[9px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all">Todos</button>
                                    <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[9px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-all">Limpar</button>
                                </div>
                                <div className="p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                    {monthNamesArr.map((m, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => toggleTempMonth(i + 1)}
                                            className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
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
                                        <Filter className="w-3 h-3" /> Aplicar Filtro
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                <div onClick={() => setActiveKpiDetail('meta')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-blue-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Target className="w-20 h-20 text-blue-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta do Período</p>
                    <h3 className="text-2xl font-black text-slate-900">{formatBRL(displayData.totalMeta)}</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-4 tracking-widest">Clique para ver metas</p>
                </div>

                <div onClick={() => setActiveKpiDetail('faturado')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-blue-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="w-20 h-20 text-blue-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado Real</p>
                    <h3 className={`text-2xl font-black ${pctMeta >= 100 ? 'text-blue-600' : 'text-red-600'}`}>{formatBRL(displayData.totalFaturado)}</h3>
                    <div className="mt-4 flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase ${pctMeta >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                            {pctMeta.toFixed(2)}% Alcançado
                        </span>
                    </div>
                </div>

                <div onClick={() => setActiveKpiDetail('positivacao')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-purple-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Users className="w-20 h-20 text-purple-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Positivação</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-black text-slate-900">{displayData.clientesPositivados}</h3>
                        <span className="text-xs text-slate-400 font-bold">/ {displayData.totalClientes}</span>
                    </div>
                </div>

                <div onClick={() => setActiveKpiDetail('verba')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-amber-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Wallet className="w-20 h-20 text-amber-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Verba Utilizada (Ano)</p>
                    <h3 className="text-2xl font-black text-amber-600">{formatBRL(displayData.investimentoAno)}</h3>
                </div>
            </div>

            <div className="px-4">
                <div className="bg-slate-900 p-12 rounded-[40px] text-white shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center">
                    <div className="absolute bottom-0 right-0 p-12 opacity-10"><TrendingUp className="w-48 h-48" /></div>
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-6">
                        {diff < 0 ? 'Déficit para Meta' : 'Superávit Acumulado'}
                    </h4>
                    <p className={`text-6xl font-black tabular-nums ${diff < 0 ? 'text-red-500' : 'text-blue-400'}`}>
                        {diff < 0 ? `- ${formatBRL(Math.abs(diff))}` : `+ ${formatBRL(diff)}`}
                    </p>
                </div>
            </div>

            <div className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-200 shadow-sm mx-4">
                <div className="flex justify-between items-start mb-16">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Ranking de Eficiência Regional</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Ordenado do maior superávit percentual para o menor</p>
                        <p className="text-[8px] font-black text-blue-600 uppercase mt-2">Clique na barra para ver o detalhamento mensal</p>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end gap-2 border-r border-slate-100 pr-6">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Meta OK ({`&gt;=`} 100%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Abaixo (&lt; 100%)</span>
                            </div>
                        </div>
                        <button className="bg-blue-600 text-white p-3.5 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                            <Share2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="h-[400px] w-full flex items-end justify-between gap-4 px-2 overflow-x-auto no-scrollbar pt-20">
                    {teamDetails
                        .sort((a, b) => {
                            const pctA = a.meta > 0 ? a.faturado / a.meta : 0;
                            const pctB = b.meta > 0 ? b.faturado / b.meta : 0;
                            return pctB - pctA;
                        })
                        .map((rep) => {
                            const pct = rep.meta > 0 ? (rep.faturado / rep.meta) * 100 : 0;
                            const isSuccess = pct >= 100;
                            return (
                                <div 
                                    key={rep.id} 
                                    onClick={() => setSelectedRepForPerformance(rep)}
                                    className="flex-1 flex flex-col items-center group h-full min-w-[70px] cursor-pointer hover:opacity-80 transition-all"
                                >
                                    <div className="relative w-full flex-1 flex flex-col justify-end items-center">
                                        <div className="absolute -top-12 flex flex-col items-center">
                                            <span className={`text-[11px] font-black tabular-nums ${isSuccess ? 'text-blue-700' : 'text-red-700'}`}>{pct.toFixed(2)}%</span>
                                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">{formatBRL(rep.faturado)}</span>
                                        </div>
                                        <div className={`w-full max-w-[36px] rounded-t-xl transition-all duration-1000 shadow-lg ${isSuccess ? 'bg-blue-600 shadow-blue-100' : 'bg-red-600 shadow-red-100'}`} style={{ height: `${Math.min(pct, 100)}%` }}>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-t-xl"></div>
                                        </div>
                                    </div>
                                    <span className="mt-6 text-[9px] font-black text-slate-400 uppercase tracking-tight text-center leading-tight truncate w-full">{rep.nome.split(' ')[0]}</span>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* TABELA MATRIZ DE METAS POR EQUIPE */}
            <div className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-200 shadow-sm mx-4 animate-slideUp">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-100 text-slate-900 rounded-2xl">
                            <Table className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Cota Anual Consolidada</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Grade de objetivos mensais por representante em {selectedYear}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleDownloadMatrixExcel}
                        disabled={isExportingMatrix}
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 text-[10px] font-black uppercase tracking-widest h-14"
                    >
                        {isExportingMatrix ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                        Exportar Excel
                    </button>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">
                            <tr>
                                <th className="px-6 py-5 sticky left-0 bg-slate-50 z-10 border-r border-slate-100">Representante</th>
                                {monthNamesArr.map(m => (
                                    <th key={m} className="px-4 py-5 text-right">{m.slice(0, 3)}</th>
                                ))}
                                <th className="px-6 py-5 text-right bg-blue-50 text-blue-600 border-l border-blue-100">Total Ano</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {matrixData.rows.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 font-black text-slate-700 uppercase text-[10px] truncate max-w-[150px]">
                                        {row.rep.nome}
                                    </td>
                                    {row.monthlyTargets.map((val, midx) => (
                                        <td key={midx} className="px-4 py-4 text-right font-bold text-slate-400 text-[10px] tabular-nums">
                                            {val > 0 ? formatBRL(val) : '-'}
                                        </td>
                                    ))}
                                    <td className="px-6 py-4 text-right bg-blue-50/20 font-black text-blue-700 text-[10px] tabular-nums border-l border-blue-50">
                                        {formatBRL(row.totalRep)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white border-t-2 border-blue-600">
                            <tr className="text-[10px] font-black uppercase tracking-[0.15em]">
                                <td className="px-6 py-5 border-r border-white/5">Meta Regional</td>
                                {matrixData.columnTotals.map((tot, idx) => (
                                    <td key={idx} className="px-4 py-5 text-right tabular-nums text-blue-400">
                                        {formatBRL(tot)}
                                    </td>
                                ))}
                                <td className="px-6 py-5 text-right bg-blue-600 text-white tabular-nums">
                                    {formatBRL(matrixData.grandTotal)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {showTargetsAnalysis && (
                <TargetsAnalysisModal 
                    year={selectedYear}
                    repId={selectedRepId}
                    repName={selectedRepId === 'all' ? 'EQUIPE TODA' : teamDetails.find(r => r.id === selectedRepId)?.nome || ''}
                    periodLabel={getMonthsLabel()}
                    onClose={() => setShowTargetsAnalysis(false)}
                    formatBRL={formatBRL}
                />
            )}

            {activeKpiDetail && createPortal(
                <KpiDetailModal 
                    type={activeKpiDetail} 
                    details={teamDetails} 
                    selectedYear={selectedYear}
                    periodLabel={getMonthsLabel()}
                    onClose={() => setActiveKpiDetail(null)} 
                    formatBRL={formatBRL}
                />,
                document.body
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