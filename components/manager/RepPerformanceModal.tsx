import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ArrowUpRight, ArrowDownRight, Loader2, Award, LineChart, BarChart3, Trophy, Medal, Info, Briefcase, Tag, Package, ShoppingBag, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import html2canvas from 'html2canvas';

interface RepData {
    id: string;
    nome: string;
    role?: string;
}

interface MonthlyPerformance {
    month: number;
    sales: number;
    target: number;
    prevSales: number;
    investment: number;
    positive: number;
    skus: Set<string>;
    prevSkus: Set<string>;
}

interface PerformanceData {
    monthly: MonthlyPerformance[];
    avgAchievement: number;
    clients: { id: string; cnpj: string; lastPurchaseDate?: string; nome_fantasia?: string }[];
    salesRaw: { faturamento: number | string; data: string; cnpj: string; produto: string; codigo_produto: string; canal_vendas: string; cliente_nome: string }[];
    prevSalesRaw: { faturamento: number | string; data: string; cnpj: string; produto: string; codigo_produto: string; canal_vendas: string; cliente_nome: string }[];
}

interface RepPerformanceModalProps {
    rep: RepData;
    year: number;
    selectedMonths?: number[];
    onClose: () => void;
}

export const RepPerformanceModal: React.FC<RepPerformanceModalProps> = ({ rep, year, selectedMonths, onClose }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [data, setData] = useState<PerformanceData | null>(null);
    const [selectedScoreCardMonths, setSelectedScoreCardMonths] = useState<number[]>(selectedMonths && selectedMonths.length > 0 ? selectedMonths : [new Date().getUTCMonth() + 1]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>(selectedMonths && selectedMonths.length > 0 ? selectedMonths : [new Date().getUTCMonth() + 1]);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowMonthDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleTempMonth = (m: number) => {
        setTempSelectedMonths(prev => 
            prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
        );
    };

    const handleApplyFilter = () => {
        setSelectedScoreCardMonths([...tempSelectedMonths]);
        setShowMonthDropdown(false);
    };

    const getMonthsLabel = () => {
        if (selectedScoreCardMonths.length === 0) return "Mês";
        if (selectedScoreCardMonths.length === 1) return monthNames[selectedScoreCardMonths[0] - 1].toUpperCase();
        if (selectedScoreCardMonths.length === 12) return "ANO TODO";
        return `${selectedScoreCardMonths.length} MESES`;
    };

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    const cleanCnpj = (val: string) => String(val || '').replace(/\D/g, '');

    const fetchAllSales = async (userId: string, start: string, end: string) => {
        let allData: { faturamento: number | string; data: string; cnpj: string; produto: string; codigo_produto: string; canal_vendas: string; cliente_nome: string }[] = [];
        const pageSize = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('dados_vendas')
                .select('faturamento, data, cnpj, produto, codigo_produto, canal_vendas, cliente_nome')
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

    const fetchRepData = useCallback(async () => {
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

            const { data: repClients } = await supabase
                .from('clientes')
                .select('*')
                .eq('usuario_id', rep.id);

            const monthly = Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                const mSalesList = sales.filter(s => {
                    const d = new Date(s.data + 'T00:00:00');
                    return d.getUTCMonth() + 1 === month;
                }) || [];

                const mPrevSalesList = prevSales.filter(s => {
                    const d = new Date(s.data + 'T00:00:00');
                    return d.getUTCMonth() + 1 === month;
                }) || [];

                const mSales = mSalesList.reduce((a: number, b: { faturamento: number | string }) => a + Number(b.faturamento), 0);
                const mTarget = targets?.find(t => t.mes === month)?.valor || 0;
                
                const mPrevSales = mPrevSalesList.reduce((a: number, b: { faturamento: number | string }) => a + Number(b.faturamento), 0) || 0;

                const mInv = investments?.filter(inv => {
                    const d = new Date(inv.data + 'T00:00:00');
                    return d.getUTCMonth() + 1 === month;
                }).reduce((a: number, b: { valor_total_investimento: number | string }) => a + Number(b.valor_total_investimento), 0) || 0;

                const mPositive = new Set(mSalesList.map(s => cleanCnpj(s.cnpj))).size;
                const mSkus = new Set(mSalesList.map(s => s.codigo_produto));
                const mPrevSkus = new Set(mPrevSalesList.map(s => s.codigo_produto));

                return { month, sales: mSales, target: mTarget, prevSales: mPrevSales, investment: mInv, positive: mPositive, skus: mSkus, prevSkus: mPrevSkus };
            });

            const monthsDone = monthly.filter((m: MonthlyPerformance) => m.sales > 0);
            const avgAchievement = monthsDone.length > 0 ? monthsDone.reduce((a: number, b: MonthlyPerformance) => a + (b.target > 0 ? b.sales / b.target : 0), 0) / monthsDone.length : 0;
            
            setData({ monthly, avgAchievement, clients: repClients || [], salesRaw: sales, prevSalesRaw: prevSales });
        } catch (e: unknown) { 
            console.error(e); 
        } finally { 
            setIsLoading(false); 
        }
    }, [rep.id, year]);

    useEffect(() => { 
        fetchRepData(); 
    }, [fetchRepData]);

    const filteredMonthlyData = useMemo(() => {
        if (!data) return [];
        if (!selectedMonths || selectedMonths.length === 0) return data.monthly;
        return data.monthly.filter((m: MonthlyPerformance) => selectedMonths.includes(m.month));
    }, [data, selectedMonths]);

    const totalMeta = useMemo(() => data?.monthly.reduce((a: number, b: MonthlyPerformance) => a + b.target, 0) || 0, [data]);
    const totalSales = useMemo(() => data?.monthly.reduce((a: number, b: MonthlyPerformance) => a + b.sales, 0) || 0, [data]);
    
    // Lógica de Projeção Anual: Média de meses fechados * 12
    const projectionData = useMemo(() => {
        if (!data) return { value: 0, pct: 0 };
        const currentMonth = new Date().getUTCMonth() + 1;
        const currentYear = new Date().getUTCFullYear();
        
        const closedMonths = data.monthly.filter(m => {
            if (year < currentYear) return true;
            if (year > currentYear) return false;
            return m.month < currentMonth;
        });

        const salesInClosedMonths = closedMonths.reduce((a, b) => a + b.sales, 0);
        const avgSalesClosed = closedMonths.length > 0 ? salesInClosedMonths / closedMonths.length : 0;
        const projectionValue = avgSalesClosed * 12;
        const projectionPct = totalMeta > 0 ? (projectionValue / totalMeta) * 100 : 0;
        
        return { value: projectionValue, pct: projectionPct };
    }, [data, year, totalMeta]);

    // Crescimento: Meses fechados deste ano vs mesmos meses do ano anterior
    const growthData = useMemo(() => {
        if (!data) return 0;
        const currentMonth = new Date().getUTCMonth() + 1;
        const currentYear = new Date().getUTCFullYear();
        
        const closedMonths = data.monthly.filter(m => {
            if (year < currentYear) return true;
            if (year > currentYear) return false;
            return m.month < currentMonth;
        });

        const salesThisYear = closedMonths.reduce((a, b) => a + b.sales, 0);
        const salesPrevYear = closedMonths.reduce((a, b) => a + b.prevSales, 0);
        
        return salesPrevYear > 0 ? ((salesThisYear / salesPrevYear) - 1) * 100 : 0;
    }, [data, year]);

    // Métricas do Score Card (Filtro de Mês Interno)
    const scoreCardMetrics = useMemo(() => {
        if (!data) return null;
        
        const sales = data.salesRaw.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return selectedScoreCardMonths.includes(d.getUTCMonth() + 1);
        });
        const prevSales = data.prevSalesRaw.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return selectedScoreCardMonths.includes(d.getUTCMonth() + 1);
        });

        const totalFaturado = sales.reduce((a, b) => a + Number(b.faturamento || 0), 0);
        
        // Meta proporcional aos meses selecionados
        const totalMeta = data.monthly
            .filter(m => selectedScoreCardMonths.includes(m.month))
            .reduce((a, b) => a + b.target, 0);

        const pctMeta = totalMeta > 0 ? (totalFaturado / totalMeta) * 100 : 0;
        const scoreFinanceiro = Math.min((totalFaturado / (totalMeta || 1)), 1.0) * 60;

        const activeCnpjs = new Set(sales.map(s => cleanCnpj(s.cnpj)));
        
        // Cobertura de Carteira: Clientes positivados no período vs Total da Carteira
        const totalPortfolio = data.clients.length || 1;
        const positivacaoCount = data.clients.filter(c => activeCnpjs.has(cleanCnpj(c.cnpj))).length;
        const pctPositivacao = (positivacaoCount / totalPortfolio);
        const scoreCarteira = Math.min(pctPositivacao, 1.0) * 25;

        // Mix de Produtos
        const currentSkus = new Set(sales.map(s => s.codigo_produto));
        const prevSkus = new Set(prevSales.map(s => s.codigo_produto));
        
        const uniqueSkus = currentSkus.size;
        const uniqueSkusPrev = prevSkus.size;
        let mixRatio = 0;
        if (uniqueSkusPrev > 0) {
            mixRatio = uniqueSkus / uniqueSkusPrev;
        } else {
            mixRatio = uniqueSkus / 20; // Target default
        }
        const scoreMix = Math.min(mixRatio, 1.0) * 15;

        const finalScore = Math.round(scoreFinanceiro + scoreCarteira + scoreMix);

        // Segmentation
        const segmentMap = new Map<string, number>();
        sales.forEach(s => {
            const seg = s.canal_vendas || 'GERAL / OUTROS';
            segmentMap.set(seg, (segmentMap.get(seg) || 0) + Number(s.faturamento || 0));
        });
        const segmentationData = Array.from(segmentMap.entries())
            .map(([label, value]) => ({ label, value, percent: totalFaturado > 0 ? (value / totalFaturado) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);

        // Top Products
        const productMap = new Map<string, number>();
        sales.forEach(s => {
            const prod = s.produto || 'PRODUTO N/I';
            productMap.set(prod, (productMap.get(prod) || 0) + Number(s.faturamento || 0));
        });
        const topProducts = Array.from(productMap.entries())
            .map(([name, value]) => ({ name, value, percent: totalFaturado > 0 ? (value / totalFaturado) * 100 : 0 }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // Top Clients
        const clientMap = new Map<string, { current: number, prev: number }>();
        const clientNameMap = new Map<string, string>();
        sales.forEach(s => {
            const cnpj = cleanCnpj(s.cnpj);
            if (!cnpj) return;
            if (!clientNameMap.has(cnpj)) clientNameMap.set(cnpj, s.cliente_nome || `CNPJ ${s.cnpj}`);
            const d = clientMap.get(cnpj) || { current: 0, prev: 0 };
            d.current += Number(s.faturamento || 0);
            clientMap.set(cnpj, d);
        });
        prevSales.forEach(s => {
            const cnpj = cleanCnpj(s.cnpj);
            if (!cnpj) return;
            if (!clientNameMap.has(cnpj)) clientNameMap.set(cnpj, s.cliente_nome || `CNPJ ${s.cnpj}`);
            const d = clientMap.get(cnpj) || { current: 0, prev: 0 };
            d.prev += Number(s.faturamento || 0);
            clientMap.set(cnpj, d);
        });
        const topClients = Array.from(clientMap.entries())
            .map(([cnpj, d]) => ({
                cnpj,
                name: clientNameMap.get(cnpj) || 'Cliente',
                value: d.current,
                prevValue: d.prev,
                percent: totalFaturado > 0 ? (d.current / totalFaturado) * 100 : 0,
                achievement: d.prev > 0 ? (d.current / d.prev) * 100 : (d.current > 0 ? 100 : 0)
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        return { 
            achievement: pctMeta, 
            sales: totalFaturado, 
            target: totalMeta, 
            positive: positivacaoCount,
            finalScore,
            scoreFinanceiro,
            scoreCarteira,
            scoreMix,
            segmentationData,
            topProducts,
            topClients,
            totalPortfolio,
            pctPositivacao: pctPositivacao * 100,
            mixEvolutionPct: mixRatio * 100,
            uniqueSkus,
            uniqueSkusPrev
        };
    }, [data, selectedScoreCardMonths]);

    const getScoreLabel = (score: number) => {
        if (score >= 90) return { label: 'ELITE', color: 'text-blue-500', bg: 'bg-blue-500', border: 'border-blue-200', hex: '#3b82f6', bgHex: '#eff6ff' };
        if (score >= 80) return { label: 'ALTA PERFORMANCE', color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-200', hex: '#10b981', bgHex: '#ecfdf5' };
        if (score >= 60) return { label: 'REGULAR', color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-200', hex: '#f59e0b', bgHex: '#fffbeb' };
        return { label: 'CRÍTICO', color: 'text-red-500', bg: 'bg-red-500', border: 'border-red-200', hex: '#ef4444', bgHex: '#fef2f2' };
    };

    const handleDownload = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        try {
            const element = exportRef.current;
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true,
                backgroundColor: '#f8fafc',
                logging: false,
                width: 1280,
                windowWidth: 1280,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('raio-x-export-root');
                    if (el) {
                        el.style.height = 'auto';
                        el.style.overflow = 'visible';
                        el.style.maxHeight = 'none';
                        el.style.width = '1280px';
                        el.style.padding = '40px';
                        el.style.backgroundColor = '#f8fafc';

                        // Forçar visibilidade de todos os elementos
                        const allElements = el.querySelectorAll('*');
                        allElements.forEach((node: Element) => {
                            const htmlNode = node as HTMLElement;
                            const style = clonedDoc.defaultView?.getComputedStyle(htmlNode);
                            if (style?.opacity === '0') htmlNode.style.opacity = '1';
                        });

                        // Ajustar textos truncados
                        const textElements = el.querySelectorAll('.truncate');
                        textElements.forEach((t: Element) => {
                            const htmlT = t as HTMLElement;
                            htmlT.style.whiteSpace = 'normal';
                            htmlT.style.overflow = 'visible';
                            htmlT.style.textOverflow = 'clip';
                            htmlT.classList.remove('truncate');
                        });
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
        if (!data) return "";
        const max = Math.max(...data.monthly.flatMap((d: MonthlyPerformance) => [d.sales, d.target])) * 1.2 || 1;
        return data.monthly.map((m: MonthlyPerformance, i: number) => {
            const val = type === 'sales' ? (m.sales || 0) : 
                        type === 'target' ? m.target : 
                        (m.sales > 0 ? m.sales : m.target * data.avgAchievement);
            const x = (i / (data.monthly.length - 1 || 1)) * 100;
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 bg-slate-900/90 backdrop-blur-xl animate-fadeIn">
            <div className="bg-[#f8fafc] w-full max-w-7xl rounded-[32px] md:rounded-[48px] shadow-2xl flex flex-col max-h-[95vh] md:max-h-[92vh] overflow-hidden border border-white/20">
                
                {/* Header Moderno */}
                <div className="px-6 md:px-10 py-5 md:py-8 flex justify-between items-center bg-white shrink-0 border-b border-slate-100">
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-600 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-200 shrink-0 transform -rotate-3">
                            <Award className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-lg md:text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">{rep.nome}</h2>
                                <span className="hidden md:inline-block px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-widest border border-blue-100">
                                    Performance {year}
                                </span>
                            </div>
                            <p className="text-[8px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                                <LineChart className="w-3 h-3 text-blue-500" /> Score Card de Inteligência Comercial
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2 md:gap-3">
                        <button 
                            onClick={handleDownload} 
                            disabled={isExporting} 
                            className="flex items-center gap-2 px-4 py-2.5 md:px-6 md:py-3 bg-slate-900 text-white rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg disabled:opacity-50"
                        >
                             <Download className="w-4 h-4" /> <span className="hidden md:inline">Exportar PNG</span>
                        </button>
                        <button onClick={onClose} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all border border-slate-100">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    <div id="raio-x-export-root" ref={exportRef} className="p-6 md:p-10 space-y-6 md:space-y-10 bg-[#f8fafc]">
                        
                        {/* Seção Score Card (Filtro de Mês) */}
                        <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Trophy className="w-6 h-6 text-amber-500" />
                                        <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">SCORE CARD</h4>
                                    </div>
                                </div>
                                <div className="relative" ref={dropdownRef}>
                                    <button 
                                        onClick={() => {
                                            setTempSelectedMonths([...selectedScoreCardMonths]);
                                            setShowMonthDropdown(!showMonthDropdown);
                                        }}
                                        className="min-w-[160px] bg-white border border-slate-200 rounded-2xl px-5 py-3 text-[11px] font-black uppercase flex items-center justify-between shadow-sm hover:border-blue-300 transition-all"
                                    >
                                        <span className="truncate mr-2">{getMonthsLabel()}</span>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showMonthDropdown && (
                                        <div className="absolute top-full right-0 mt-3 w-72 bg-white border border-slate-200 rounded-3xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                                            <div className="p-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selecionar Período</p>
                                                <div className="flex gap-2">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setTempSelectedMonths(Array.from({ length: 12 }, (_, i) => i + 1))}
                                                        className="text-[8px] font-black text-blue-600 uppercase hover:underline"
                                                    >
                                                        Todos
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => setTempSelectedMonths([])}
                                                        className="text-[8px] font-black text-slate-400 uppercase hover:underline"
                                                    >
                                                        Limpar
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="p-2 grid grid-cols-1 gap-0.5 max-h-72 overflow-y-auto custom-scrollbar">
                                                {monthNames.map((m, i) => (
                                                    <button 
                                                        key={i} 
                                                        type="button"
                                                        onClick={() => toggleTempMonth(i + 1)}
                                                        className={`flex items-center gap-3 p-3 rounded-xl text-[10px] font-bold uppercase transition-all ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                                    >
                                                        {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                                        {m}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="p-4 border-t border-slate-100 bg-white">
                                                <button 
                                                    type="button"
                                                    onClick={handleApplyFilter} 
                                                    className="w-full bg-blue-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                                                >
                                                    Aplicar Filtro
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {scoreCardMetrics ? (
                                <div className="space-y-8">
                                    {/* Grid de Métricas Principais do Score Card */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        {/* Pontuação Geral */}
                                        <div className="bg-slate-900 p-8 rounded-[40px] relative overflow-hidden group shadow-2xl shadow-slate-200">
                                            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                                                <Award className="w-32 h-32 text-white" />
                                            </div>
                                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                <Award className="w-4 h-4" /> Pontuação Geral
                                            </p>
                                            <div className="flex items-center gap-6">
                                                <div className={`w-20 h-20 rounded-[28px] ${getScoreLabel(scoreCardMetrics.finalScore).bg} flex items-center justify-center text-white shadow-xl ring-4 ring-white/10`}>
                                                    <span className="text-3xl font-black">{scoreCardMetrics.finalScore}</span>
                                                </div>
                                                <div>
                                                    <p className={`text-xs font-black uppercase tracking-widest ${getScoreLabel(scoreCardMetrics.finalScore).color}`}>
                                                        {getScoreLabel(scoreCardMetrics.finalScore).label}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Status de Performance</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Performance Financeira */}
                                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <LineChart className="w-3 h-3 text-emerald-500" /> Performance Financeira
                                            </p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-2xl font-black text-slate-900">{scoreCardMetrics.achievement.toFixed(1)}%</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">da Meta</span>
                                                </div>
                                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${scoreCardMetrics.achievement >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${Math.min(scoreCardMetrics.achievement, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Score: {scoreCardMetrics.scoreFinanceiro.toFixed(1)} / 60.0</p>
                                            </div>
                                        </div>

                                        {/* Cobertura de Carteira */}
                                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Briefcase className="w-3 h-3 text-purple-500" /> Cobertura de Carteira
                                            </p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-2xl font-black text-slate-900">{scoreCardMetrics.pctPositivacao.toFixed(1)}%</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">{scoreCardMetrics.positive}/{scoreCardMetrics.totalPortfolio}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-purple-500 transition-all duration-1000"
                                                        style={{ width: `${scoreCardMetrics.pctPositivacao}%` }}
                                                    ></div>
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Score: {scoreCardMetrics.scoreCarteira.toFixed(1)} / 25.0</p>
                                            </div>
                                        </div>

                                        {/* Evolução de Mix */}
                                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <Tag className="w-3 h-3 text-amber-500" /> Evolução de Mix
                                            </p>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-2xl font-black text-slate-900">{scoreCardMetrics.mixEvolutionPct.toFixed(1)}%</span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">{scoreCardMetrics.uniqueSkus} SKUs</span>
                                                </div>
                                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                                    <div 
                                                        className="h-full bg-amber-500 transition-all duration-1000"
                                                        style={{ width: `${Math.min(scoreCardMetrics.mixEvolutionPct, 100)}%` }}
                                                    ></div>
                                                </div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Score: {scoreCardMetrics.scoreMix.toFixed(1)} / 15.0</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grid de Listas (Top 5 e Segmentação) */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Top 5 Clientes */}
                                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                            <div className="flex items-center justify-between mb-6">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Medal className="w-3 h-3 text-blue-500" /> Top 5 Clientes
                                                </p>
                                                <Info className="w-3 h-3 text-slate-300" />
                                            </div>
                                            <div className="space-y-4">
                                                {scoreCardMetrics.topClients.map((client, idx) => (
                                                    <div key={idx} className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                                {idx + 1}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black text-slate-900 uppercase truncate">{client.name}</p>
                                                                <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">{client.percent.toFixed(1)}% de Participação</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-black text-slate-900">{formatBRL(client.value)}</p>
                                                            <div className={`flex items-center justify-end gap-0.5 text-[8px] font-black ${client.achievement >= 100 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                {client.achievement >= 100 ? <ArrowUpRight className="w-2 h-2" /> : <ArrowDownRight className="w-2 h-2" />}
                                                                {client.achievement.toFixed(1)}% vs Ano Ant.
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Top 5 Produtos */}
                                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                            <div className="flex items-center justify-between mb-6">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Package className="w-3 h-3 text-emerald-500" /> Top 5 Produtos
                                                </p>
                                                <Info className="w-3 h-3 text-slate-300" />
                                            </div>
                                            <div className="space-y-4">
                                                {scoreCardMetrics.topProducts.map((prod, idx) => (
                                                    <div key={idx} className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                                                {idx + 1}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black text-slate-900 uppercase truncate">{prod.name}</p>
                                                                <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">{prod.percent.toFixed(1)}% de Participação</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-black text-slate-900">{formatBRL(prod.value)}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Segmentações */}
                                        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                            <div className="flex items-center justify-between mb-6">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                    <ShoppingBag className="w-3 h-3 text-purple-500" /> Segmentações
                                                </p>
                                                <Info className="w-3 h-3 text-slate-300" />
                                            </div>
                                            <div className="space-y-4">
                                                {scoreCardMetrics.segmentationData.map((seg, idx) => (
                                                    <div key={idx} className="space-y-1.5">
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-[9px] font-black text-slate-900 uppercase truncate max-w-[70%]">{seg.label}</p>
                                                            <p className="text-[9px] font-black text-slate-900">{formatBRL(seg.value)}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 bg-slate-200 h-1 rounded-full overflow-hidden">
                                                                <div 
                                                                    className="h-full bg-purple-500 transition-all duration-1000"
                                                                    style={{ width: `${seg.percent}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-[8px] font-black text-slate-400 min-w-[25px]">{seg.percent.toFixed(0)}%</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                                    <Loader2 className="w-8 h-8 animate-spin mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Calculando Score Card...</p>
                                </div>
                            )}
                        </div>

                        {/* Bento Grid Superior (Dados Anuais) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
                            {/* Card Principal de Eficiência */}
                            <div className="md:col-span-2 bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-between relative group">
                                <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition-transform pointer-events-none"></div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4 md:mb-6">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Eficiência Anual Acumulada</p>
                                    </div>
                                    <div className="flex items-end gap-3 md:gap-4">
                                        <h3 className={`text-5xl md:text-7xl font-black tracking-tighter ${(totalSales/totalMeta*100) >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                                            {(totalSales/totalMeta*100).toFixed(0)}<span className="text-2xl md:text-3xl">%</span>
                                        </h3>
                                    </div>
                                </div>
                                <div className="relative z-10 mt-6 md:mt-8 grid grid-cols-2 gap-4 border-t border-slate-50 pt-6">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Acumulado Faturado</p>
                                        <p className="text-base md:text-lg font-black text-slate-900">{formatBRL(totalSales)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Total Ano</p>
                                        <p className="text-base md:text-lg font-black text-slate-900">{formatBRL(totalMeta)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Card de Crescimento */}
                            <div className="bg-white p-6 md:p-8 rounded-[32px] md:rounded-[40px] border border-slate-100 shadow-sm flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Crescimento vs {year - 1}</p>
                                    </div>
                                    <div className={`flex items-center gap-2 ${growthData >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                        {growthData >= 0 ? <ArrowUpRight className="w-6 h-6 md:w-8 md:h-8" /> : <ArrowDownRight className="w-6 h-6 md:w-8 md:h-8" />}
                                        <span className="text-3xl md:text-4xl font-black tracking-tighter">{Math.abs(growthData).toFixed(1)}%</span>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <p className="text-[9px] font-black text-slate-400 uppercase leading-relaxed">
                                        Comparação baseada nos meses fechados do ano.
                                    </p>
                                </div>
                            </div>

                            {/* Card de Projeção */}
                            <div className="bg-slate-900 p-6 md:p-8 rounded-[32px] md:rounded-[40px] text-white shadow-2xl flex flex-col justify-between relative group">
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform pointer-events-none"><BarChart3 className="w-16 h-16 md:w-20 md:h-20" /></div>
                                <div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Projeção Final {year}</p>
                                    </div>
                                    <p className="text-2xl md:text-3xl font-black tracking-tighter text-white">
                                        {formatBRL(projectionData.value)}
                                    </p>
                                    <p className={`text-[10px] font-black uppercase mt-1 ${projectionData.pct >= 100 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {projectionData.pct.toFixed(1)}% da Meta
                                    </p>
                                </div>
                                <div className="mt-6">
                                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${Math.min(projectionData.pct, 100)}%` }}></div>
                                    </div>
                                    <p className="text-[8px] font-black text-slate-500 uppercase mt-3 tracking-widest">Expectativa de Fechamento</p>
                                </div>
                            </div>
                        </div>

                        {/* Gráfico e Destaques */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Gráfico de Tendência */}
                            <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-center mb-10">
                                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-3">
                                        <LineChart className="w-5 h-5 text-blue-600" /> Tendência de Performance Mensal
                                    </h4>
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-blue-600 rounded-full shadow-sm shadow-blue-200"></div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Faturado</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 border-2 border-red-400 rounded-full border-dashed"></div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Meta</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[280px] w-full relative px-2">
                                    <div className="absolute inset-0 flex justify-between px-2 pointer-events-none">
                                        {data.monthly.map((m, i) => {
                                            const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                                            const max = Math.max(...data.monthly.flatMap((d: MonthlyPerformance) => [d.sales, d.target])) * 1.2 || 1;
                                            const x = (i / (data.monthly.length - 1 || 1)) * 100;
                                            const y = 100 - (m.sales / max) * 100;
                                            
                                            return (
                                                <div key={i} className="absolute flex flex-col items-center" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -120%)' }}>
                                                    {m.sales > 0 && (
                                                        <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                                                            {achievement.toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                                        <path 
                                            d={`M ${getPoints('sales')} L 100,100 L 0,100 Z`} 
                                            fill="url(#gradient-sales)" 
                                            className="opacity-30"
                                        />
                                        <defs>
                                            <linearGradient id="gradient-sales" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#2563eb" />
                                                <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>
                                        <polyline points={getPoints('target')} fill="none" stroke="#f87171" strokeWidth="1.5" strokeDasharray="4,3" />
                                        <polyline points={getPoints('sales')} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-lg" />
                                        {data.monthly.map((m: MonthlyPerformance, i: number) => {
                                            if (m.sales === 0) return null;
                                            const max = Math.max(...data.monthly.flatMap((d: MonthlyPerformance) => [d.sales, d.target])) * 1.2 || 1;
                                            const x = (i / (data.monthly.length - 1 || 1)) * 100;
                                            const y = 100 - (m.sales / max) * 100;
                                            return (
                                                <g key={i} className="group/point">
                                                    <circle cx={x} cy={y} r="4" fill="#2563eb" className="stroke-white stroke-2" />
                                                </g>
                                            );
                                        })}
                                    </svg>
                                    <div className="flex justify-between mt-8 px-2 border-t border-slate-50 pt-4">
                                        {data.monthly.map((m: MonthlyPerformance) => (
                                            <div key={m.month} className="flex flex-col items-center gap-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{monthShort[m.month - 1]}</span>
                                                {m.sales > 0 && <span className="text-[7px] font-black text-blue-600">{(m.sales / 1000).toFixed(0)}k</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Destaques do Ano */}
                            <div className="space-y-4">
                                {(() => {
                                    const bestMonth = [...filteredMonthlyData].sort((a, b) => b.sales - a.sales)[0];
                                    return (
                                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Melhor Mês do Ano</p>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xs uppercase">
                                                    {monthShort[bestMonth.month - 1]}
                                                </div>
                                                <div>
                                                    <p className="text-xl font-black text-slate-900">{formatBRL(bestMonth.sales)}</p>
                                                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Recorde de Faturamento</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {(() => {
                                    const bestGrowth = [...filteredMonthlyData].filter(m => m.prevSales > 0).sort((a, b) => (b.sales/b.prevSales) - (a.sales/a.prevSales))[0];
                                    if (!bestGrowth) return null;
                                    const growth = ((bestGrowth.sales / bestGrowth.prevSales) - 1) * 100;
                                    return (
                                        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">Maior Salto vs {year - 1}</p>
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 font-black text-xs uppercase">
                                                    {monthShort[bestGrowth.month - 1]}
                                                </div>
                                                <div>
                                                    <p className="text-xl font-black text-emerald-600">+{growth.toFixed(1)}%</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Em relação ao mesmo mês</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="bg-blue-600 p-6 rounded-[32px] text-white shadow-xl shadow-blue-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest mb-4 opacity-80">Média de Positivação</p>
                                    <div className="flex items-end gap-2">
                                        <p className="text-3xl font-black">{(filteredMonthlyData.reduce((a, b) => a + b.positive, 0) / filteredMonthlyData.filter(m => m.sales > 0).length || 0).toFixed(0)}</p>
                                        <p className="text-[10px] font-black uppercase mb-1 opacity-80">Clientes / Mês</p>
                                    </div>
                                    <p className="text-[8px] font-black uppercase mt-4 tracking-widest opacity-60 leading-relaxed">
                                        Frequência média de atendimento mensal no período.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tabela Detalhada */}
                        <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-8 py-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Detalhamento Mensal</h4>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valores Consolidados</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-slate-400 text-[9px] font-black uppercase tracking-widest border-b border-slate-50">
                                            <th className="px-8 py-6">Mês</th>
                                            <th className="px-8 py-6">Meta</th>
                                            <th className="px-8 py-6">Faturado</th>
                                            <th className="px-8 py-6 text-center">Alcance</th>
                                            <th className="px-8 py-6 text-center">Evolução</th>
                                            <th className="px-8 py-6 text-right">Positivação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredMonthlyData.map((m: MonthlyPerformance, idx: number) => {
                                            const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                                            const growth = m.prevSales > 0 ? ((m.sales / m.prevSales) - 1) * 100 : 0;
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-8 py-5 font-black text-slate-900 uppercase text-[11px] tracking-tight">{monthNames[m.month - 1]}</td>
                                                    <td className="px-8 py-5 text-slate-400 font-bold text-[11px]">{formatBRL(m.target)}</td>
                                                    <td className="px-8 py-5 text-slate-900 font-black text-[11px]">{formatBRL(m.sales)}</td>
                                                    <td className="px-8 py-5 text-center">
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black border ${achievement >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                            {achievement.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        {m.sales > 0 ? (
                                                            <div className={`flex items-center justify-center gap-1 text-[10px] font-black ${growth >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                                                {growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                                {Math.abs(growth).toFixed(1)}%
                                                            </div>
                                                        ) : <span className="text-slate-200">--</span>}
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-xl text-[10px] font-black group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                            {m.positive} Clientes
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
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