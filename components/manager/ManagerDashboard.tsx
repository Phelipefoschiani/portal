
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Target, TrendingUp, Users, Wallet, Calendar, RefreshCw, Loader2, DollarSign, CheckCircle2, X, ChevronRight, Database, RotateCcw, ChevronDown, CheckSquare, Square, Filter, Download, User, FileText, BarChart3 as BarIcon, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { totalDataStore } from '../../lib/dataStore';

type KpiDetailType = 'meta' | 'faturado' | 'positivacao' | 'verba' | null;

const KpiDetailModal: React.FC<{ 
    type: KpiDetailType; 
    details: any[]; 
    onClose: () => void; 
    formatBRL: (v: number) => string;
    periodLabel: string;
}> = ({ type, details, onClose, formatBRL, periodLabel }) => {
    const [isExporting, setIsExporting] = useState<'photo' | 'pdf' | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    const titles = {
        meta: `RELATÓRIO ESTRATÉGICO DE METAS`,
        faturado: 'RELATÓRIO DE FATURAMENTO REALIZADO',
        positivacao: 'RELATÓRIO DE POSITIVAÇÃO DE CARTEIRA',
        verba: 'RELATÓRIO DE UTILIZAÇÃO DE VERBAS'
    };

    const totalMeta = details.reduce((acc, curr) => acc + (curr.meta || 0), 0);
    const totalFaturado = details.reduce((acc, curr) => acc + (curr.faturado || 0), 0);

    const handleExport = async (mode: 'photo' | 'pdf') => {
        if (!exportRef.current) return;
        setIsExporting(mode);
        try {
            await new Promise(r => setTimeout(r, 400));
            
            const element = exportRef.current;
            
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('modal-export-area-content');
                    if (el) {
                        el.style.height = 'auto';
                        el.style.maxHeight = 'none';
                        el.style.overflow = 'visible';
                    }
                }
            });

            const imgData = canvas.toDataURL('image/png', 1.0);

            if (mode === 'photo') {
                const link = document.createElement('a');
                link.download = `CN_${type}_${periodLabel.replace(/\s/g, '_')}.png`;
                link.href = imgData;
                link.click();
            } else {
                const imgProps = canvas;
                const pdfWidth = 210; 
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
                pdf.save(`CN_${type}_${periodLabel.replace(/\s/g, '_')}.pdf`);
            }
        } catch (e) {
            console.error('Erro ao exportar:', e);
            alert('Falha na geração do arquivo. Tente novamente.');
        } finally {
            setIsExporting(null);
        }
    };

    const sortedDetails = [...details].sort((a, b) => {
        if (type === 'meta') return b.meta - a.meta;
        if (type === 'faturado') return b.faturado - a.faturado;
        if (type === 'positivacao') return (b.positivacao / (b.totalClientes || 1)) - (a.positivacao / (a.totalClientes || 1));
        if (type === 'verba') return b.verba - a.verba;
        return 0;
    });

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp border border-white/20 flex flex-col max-h-[90vh]">
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight truncate">{type ? titles[type] : ''}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Portal Centro-Norte • {periodLabel}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        <button 
                            onClick={() => handleExport('pdf')}
                            disabled={isExporting !== null}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
                        >
                            {isExporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">PDF</span>
                        </button>
                        <button 
                            onClick={() => handleExport('photo')}
                            disabled={isExporting !== null}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
                        >
                            {isExporting === 'photo' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Foto</span>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white" id="modal-export-area-content" ref={exportRef}>
                    <div className="p-10">
                        <div className="mb-10 pb-8 border-b-4 border-slate-900 flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-2">Portal de Inteligência Comercial</p>
                                <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{type ? titles[type] : ''}</h1>
                                <div className="flex gap-4 mt-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Período: {periodLabel}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Emitido em: {new Date().toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-xl">CN</div>
                        </div>

                        {(type === 'meta' || type === 'faturado') && (
                            <div className="mb-8 p-8 bg-slate-900 rounded-[32px] text-white flex justify-between items-center shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 opacity-10"><BarIcon className="w-24 h-24" /></div>
                                <div>
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Cota Regional Planejada</p>
                                    <p className="text-3xl font-black">{formatBRL(totalMeta)}</p>
                                </div>
                                {type === 'faturado' && (
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Total Realizado</p>
                                        <p className="text-3xl font-black">{formatBRL(totalFaturado)}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="divide-y divide-slate-100">
                            {sortedDetails.map((rep) => {
                                const achievement = rep.meta > 0 ? (rep.faturado / rep.meta) * 100 : 0;
                                const isSuccess = achievement >= 100;
                                return (
                                    <div key={rep.id} className="py-6 flex justify-between items-center group">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-400 uppercase text-xl border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                                {rep.nome.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase text-base tracking-tight">{rep.nome}</p>
                                                {type === 'faturado' && (
                                                    <p className="text-[11px] font-bold text-slate-400 uppercase mt-1">
                                                        Meta Individual: <span className="text-slate-600">{formatBRL(rep.meta)}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-slate-900 text-xl tabular-nums">
                                                {type === 'meta' && formatBRL(rep.meta)}
                                                {type === 'faturado' && formatBRL(rep.faturado)}
                                                {type === 'verba' && formatBRL(rep.verba)}
                                                {type === 'positivacao' && `${((rep.positivacao / (rep.totalClientes || 1)) * 100).toFixed(1)}%`}
                                            </p>
                                            {type === 'faturado' && rep.meta > 0 && (
                                                <p className={`text-[10px] font-black uppercase mt-1.5 px-2 py-0.5 rounded inline-block border ${isSuccess ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                    {achievement.toFixed(1)}% atingido
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="bg-slate-900 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all">Sair da Visualização</button>
                </div>
            </div>
        </div>
    );
};

export const ManagerDashboard: React.FC = () => {
    const now = new Date();
    const rankingRef = useRef<HTMLDivElement>(null);
    const [isExportingRanking, setIsExportingRanking] = useState(false);
    const [activeKpiDetail, setActiveKpiDetail] = useState<KpiDetailType>(null);
    const [teamDetails, setTeamDetails] = useState<any[]>([]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    const [selectedRepId, setSelectedRepId] = useState<string>('all');
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    useEffect(() => {
        processConsolidatedData();
    }, [selectedMonths, selectedYear]);

    const processConsolidatedData = () => {
        const reps = totalDataStore.users;
        const sales = totalDataStore.sales;
        const targets = totalDataStore.targets;
        const invs = totalDataStore.investments;
        const portfolio = totalDataStore.clients;

        const details = reps.map(rep => {
            const repMeta = targets.filter(t => t.usuario_id === rep.id && selectedMonths.includes(t.mes) && t.ano === selectedYear).reduce((a, b) => a + Number(b.valor), 0);
            
            const repSalesList = sales.filter(s => {
                const d = new Date(s.data + 'T00:00:00');
                const m = d.getUTCMonth() + 1;
                const y = d.getUTCFullYear();
                return s.usuario_id === rep.id && selectedMonths.includes(m) && y === selectedYear;
            });

            const repSales = repSalesList.reduce((a, b) => a + Number(b.faturamento), 0);
            
            const repInv = invs.filter(inv => {
                const d = new Date(inv.data + 'T00:00:00');
                const m = d.getUTCMonth() + 1;
                const y = d.getUTCFullYear();
                return inv.usuario_id === rep.id && selectedMonths.includes(m) && y === selectedYear && inv.status === 'approved';
            }).reduce((a, b) => a + Number(b.valor_total_investimento), 0);

            const repClients = portfolio.filter(c => c.usuario_id === rep.id);
            const salesCnpjs = new Set(repSalesList.map(s => String(s.cnpj || '').replace(/\D/g, '')));
            const repPosit = repClients.filter(c => salesCnpjs.has(String(c.cnpj || '').replace(/\D/g, ''))).length;

            return { id: rep.id, nome: rep.nome, meta: repMeta, faturado: repSales, positivacao: repPosit, totalClientes: repClients.length, verba: repInv };
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
                investimentoMes: acc.investimentoMes + curr.verba
            }), { totalMeta: 0, totalFaturado: 0, totalClientes: 0, clientesPositivados: 0, investimentoMes: 0 });
        } else {
            const rep = teamDetails.find(r => r.id === selectedRepId);
            if (!rep) return { totalMeta: 0, totalFaturado: 0, totalClientes: 0, clientesPositivados: 0, investimentoMes: 0 };
            return {
                totalMeta: rep.meta,
                totalFaturado: rep.faturado,
                totalClientes: rep.totalClientes,
                clientesPositivados: rep.positivacao,
                investimentoMes: rep.verba
            };
        }
    }, [teamDetails, selectedRepId]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    const pctMeta = displayData.totalMeta > 0 ? (displayData.totalFaturado / displayData.totalMeta) * 100 : 0;
    const diff = displayData.totalFaturado - displayData.totalMeta;

    const toggleTempMonth = (m: number) => {
        setTempSelectedMonths(prev => 
            prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
        );
    };

    const handleApplyFilter = () => {
        setSelectedMonths([...tempSelectedMonths]);
        setShowMonthDropdown(false);
    };

    const getMonthsLabel = () => {
        if (selectedMonths.length === 0) return "Nenhum Selecionado";
        if (selectedMonths.length === 1) return monthNames[selectedMonths[0] - 1].toUpperCase();
        if (selectedMonths.length === 12) return "ANO COMPLETO";
        return `${selectedMonths.length} MESES SELECIONADOS`;
    };

    const rankingData = useMemo(() => {
        return [...teamDetails]
            .map(r => ({ ...r, pct: r.meta > 0 ? (r.faturado / r.meta) * 100 : 0 }))
            .sort((a, b) => b.pct - a.pct);
    }, [teamDetails]);

    const chartMaxPct = useMemo(() => {
        const max = Math.max(...rankingData.map(r => r.pct), 100);
        return max * 1.15;
    }, [rankingData]);

    const handleExportRanking = async () => {
        if (!rankingRef.current) return;
        setIsExportingRanking(true);
        try {
            await new Promise(r => setTimeout(r, 600));
            const canvas = await html2canvas(rankingRef.current, {
                scale: 3, 
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    const header = clonedDoc.getElementById('export-header-ranking');
                    if (header) header.style.display = 'block';
                    
                    const pctLabels = clonedDoc.querySelectorAll('.pct-label-export');
                    pctLabels.forEach((el: any) => {
                        const success = el.getAttribute('data-success') === 'true';
                        el.style.color = success ? '#093c9e' : '#b91c1c';
                        el.style.fontWeight = '900';
                        el.style.opacity = '1';
                    });

                    const legendIcons = clonedDoc.querySelectorAll('.legend-dot-export');
                    legendIcons.forEach((el: any) => {
                        el.style.marginTop = '2px';
                    });
                }
            });
            const link = document.createElement('a');
            link.download = `CN_Ranking_Eficiencia_${getMonthsLabel().replace(/\s/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
        } catch (e) {
            console.error(e);
            alert('Erro ao exportar ranking.');
        } finally {
            setIsExportingRanking(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-12">
            <header className="flex flex-col lg:flex-row justify-between items-end gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Análise Regional</h2>
                    <p className="text-[10px] font-black text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-widest text-left">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" /> 
                        Período: {selectedMonths.sort((a,b) => a-b).map(m => monthShort[m-1]).join(', ')} de {selectedYear}
                    </p>
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
                            <option value="all">Equipe Completa (Total)</option>
                            {teamDetails.sort((a,b) => a.nome.localeCompare(b.nome)).map(rep => (
                                <option key={rep.id} value={rep.id}>{rep.nome.toUpperCase()}</option>
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
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selecionar Período</span>
                                    <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="text-[9px] font-black text-blue-600 uppercase hover:underline transition-all">Todos</button>
                                </div>
                                <div className="p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
                                    {monthNames.map((m, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => toggleTempMonth(i + 1)}
                                            className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                            {pctMeta.toFixed(1)}% Alcançado
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
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Verba Utilizada</p>
                    <h3 className="text-2xl font-black text-amber-600">{formatBRL(displayData.investimentoMes)}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 p-12 opacity-10"><TrendingUp className="w-48 h-48" /></div>
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">
                        {diff < 0 ? 'Déficit para Meta' : 'Superávit Acumulado'}
                    </h4>
                    <p className={`text-5xl font-black tabular-nums ${diff < 0 ? 'text-red-500' : 'text-blue-400'}`}>
                        {diff < 0 ? `- ${formatBRL(Math.abs(diff))}` : `+ ${formatBRL(diff)}`}
                    </p>
                </div>

                <div className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-200 shadow-sm" ref={rankingRef}>
                    <div id="export-header-ranking" className="hidden mb-12 pb-8 border-b-4 border-slate-900">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-2">Portal de Inteligência Comercial</p>
                        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Ranking de Eficiência Regional</h1>
                        <div className="flex gap-4 mt-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Portal Centro-Norte • {getMonthsLabel()}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-start mb-16">
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Ranking de Eficiência Regional</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Comparativo de batimento de meta por representante</p>
                            <p className="text-[8px] font-black text-blue-600 uppercase mt-2">Portal Centro-Norte • {getMonthsLabel()}</p>
                        </div>
                        <div className="flex items-center gap-3">
                             <div className="flex flex-col items-end gap-3 mr-4 border-r border-slate-100 pr-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-600 rounded-full legend-dot-export shrink-0"></div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Meta OK (&gt;= 100%)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-red-500 rounded-full legend-dot-export shrink-0"></div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Abaixo (&lt; 100%)</span>
                                </div>
                             </div>
                             <button 
                                onClick={handleExportRanking}
                                disabled={isExportingRanking}
                                data-html2canvas-ignore="true"
                                className="bg-blue-600 text-white p-3 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 group"
                             >
                                {isExportingRanking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                             </button>
                        </div>
                    </div>

                    <div className="h-[450px] w-full flex items-end justify-between gap-2 sm:gap-4 px-2 overflow-x-auto no-scrollbar pt-20">
                        {rankingData.map((rep) => {
                            const isSuccess = rep.pct >= 100;
                            const barHeightPct = (rep.pct / chartMaxPct) * 100;
                            
                            return (
                                <div key={rep.id} className="flex-1 flex flex-col items-center group h-full min-w-[70px]">
                                    <div className="relative w-full flex-1 flex flex-col justify-end items-center">
                                        
                                        <div className="absolute -top-16 flex flex-col items-center animate-fadeIn transition-transform group-hover:-translate-y-1">
                                            <span 
                                                className={`text-[11px] font-black tabular-nums pct-label-export ${isSuccess ? 'text-blue-700' : 'text-red-700'}`}
                                                data-success={isSuccess ? 'true' : 'false'}
                                                style={{ opacity: 1 }}
                                            >
                                                {rep.pct.toFixed(1)}%
                                            </span>
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter whitespace-nowrap">{formatBRL(rep.faturado)}</span>
                                        </div>

                                        <div 
                                            className={`w-full max-w-[44px] rounded-t-2xl transition-all duration-1000 ease-out shadow-lg relative ${isSuccess ? 'bg-blue-600 shadow-blue-100' : 'bg-red-50 shadow-red-100'}`}
                                            style={{ height: `${barHeightPct}%` }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-t-2xl"></div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-6 h-20 flex items-start justify-center">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight text-center leading-tight transform -rotate-45 origin-top mt-3 group-hover:text-slate-900 transition-colors whitespace-nowrap">
                                            {rep.nome.split(' ')[0]} {rep.nome.split(' ')[1] ? rep.nome.split(' ')[1].charAt(0) + '.' : ''}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="mt-12 pt-6 border-t border-slate-100 flex justify-center">
                        <div className="bg-slate-50 px-8 py-3 rounded-2xl border border-slate-100 shadow-sm">
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Eficiência Média Regional: <span className="text-blue-600 ml-1 text-xs">{pctMeta.toFixed(1)}%</span>
                             </p>
                        </div>
                    </div>
                </div>
            </div>

            {activeKpiDetail && createPortal(
                <KpiDetailModal 
                    type={activeKpiDetail} 
                    details={teamDetails} 
                    onClose={() => setActiveKpiDetail(null)} 
                    formatBRL={formatBRL}
                    periodLabel={getMonthsLabel()}
                />,
                document.body
            )}
        </div>
    );
};
