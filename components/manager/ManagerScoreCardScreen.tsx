import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Trophy, Target, Users, ShoppingBag, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, AlertCircle, Search, User, Filter, Medal, Activity, BarChart3, Star, Percent, Info, ChevronDown, CheckSquare, Square, Tag, Package, X, Briefcase, CheckCircle2, XCircle, Download, Loader2, Sparkles } from 'lucide-react';
import { totalDataStore } from '../../lib/dataStore';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';

const ScoreRulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-slideUp border border-white/20">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Trophy className="w-5 h-5" /></div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Regras de Pontuação</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-slate-700 uppercase">1. Performance Financeira</span>
                            <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Peso 60%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                            Baseado no % de atingimento da meta financeira. A pontuação é limitada ao peso (60pts). Superar a meta não compensa perdas em outros pilares.
                        </p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="w-[60%] bg-blue-500 h-full"></div></div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">Peso 25%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                            Calculado pela taxa de positivação (Clientes que compraram no período / Total de clientes ativos na carteira).
                        </p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="w-[25%] bg-purple-500 h-full"></div></div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">Peso 15%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                            Compara a quantidade de SKUs distintos vendidos no período atual vs. mesmo período do ano anterior.
                        </p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="w-[15%] bg-emerald-500 h-full"></div></div>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                    <button onClick={onClose} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Fechar Entendimento</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const ManagerScoreCardScreen: React.FC = () => {
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState<number[]>([1,2,3,4,5,6,7,8,9,10,11,12]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([1,2,3,4,5,6,7,8,9,10,11,12]);
    const [selectedRepId, setSelectedRepId] = useState<string>('all');
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    const users = totalDataStore.users.sort((a, b) => a.nome.localeCompare(b.nome));
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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
        setTempSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    };

    const handleApplyFilter = () => {
        setSelectedMonths([...tempSelectedMonths]);
        setShowMonthDropdown(false);
    };

    const getMonthsLabel = () => {
        if (selectedMonths.length === 12) return "ANO COMPLETO";
        if (selectedMonths.length === 0) return "NENHUM MÊS";
        if (selectedMonths.length === 1) return monthNames[selectedMonths[0] - 1].toUpperCase();
        return `${selectedMonths.length} MESES`;
    };
    
    const scoreData = useMemo(() => {
        const sales = totalDataStore.sales;
        const targets = totalDataStore.targets;
        const clients = totalDataStore.clients;

        const filterSales = (s: any, yearToCheck: number) => {
            const d = new Date(s.data + 'T00:00:00');
            const m = d.getUTCMonth() + 1;
            const y = d.getUTCFullYear();
            return y === yearToCheck && selectedMonths.includes(m) && (selectedRepId === 'all' ? true : s.usuario_id === selectedRepId);
        };
        
        const currentSales = sales.filter(s => filterSales(s, selectedYear));
        const prevSales = sales.filter(s => filterSales(s, selectedYear - 1));
        const totalFaturado = currentSales.reduce((acc, curr) => acc + Number(curr.faturamento), 0);
        
        const currentTargets = targets.filter(t => t.ano === selectedYear && selectedMonths.includes(t.mes) && (selectedRepId === 'all' ? true : t.usuario_id === selectedRepId));
        const totalMeta = currentTargets.reduce((acc, curr) => acc + Number(curr.valor), 0);

        const activeCnpjs = new Set(currentSales.map(s => String(s.cnpj || '').replace(/\D/g, '')));
        const totalPortfolio = clients.filter(c => selectedRepId === 'all' ? true : c.usuario_id === selectedRepId).length || 1; 
        const positivacaoCount = activeCnpjs.size;
        
        const uniqueSkus = new Set(currentSales.map(s => s.codigo_produto)).size;
        const uniqueSkusPrev = new Set(prevSales.map(s => s.codigo_produto)).size;
        
        const monthsCount = selectedMonths.length || 1;
        const mediaMensal = totalFaturado / monthsCount;

        const pctMeta = totalMeta > 0 ? (totalFaturado / totalMeta) * 100 : 0;
        const scoreFinanceiro = Math.min((totalFaturado / (totalMeta || 1)), 1.0) * 60; 

        const pctPositivacao = (positivacaoCount / totalPortfolio);
        const scoreCarteira = Math.min(pctPositivacao, 1.0) * 25;

        let mixRatio = 0;
        if (uniqueSkusPrev > 0) {
            mixRatio = uniqueSkus / uniqueSkusPrev;
        } else {
            const targetMix = monthsCount * 20; 
            mixRatio = uniqueSkus / targetMix;
        }
        const scoreMix = Math.min(mixRatio, 1.0) * 15; 

        const finalScore = Math.round(scoreFinanceiro + scoreCarteira + scoreMix);

        const monthlyData = selectedMonths.sort((a,b) => a-b).map(month => {
            const mSales = currentSales.filter(s => {
                const d = new Date(s.data + 'T00:00:00');
                return d.getUTCMonth() + 1 === month;
            }).reduce((a, b) => a + Number(b.faturamento), 0);
            
            const mTarget = currentTargets.filter(t => t.mes === month).reduce((a, b) => a + Number(b.valor), 0);
            
            return { month, sales: mSales, target: mTarget };
        });

        const monthsHit = monthlyData.filter(m => m.target > 0 && m.sales >= m.target).length;

        const segmentMap = new Map<string, number>();
        currentSales.forEach(s => {
            const seg = s.canal_vendas || 'GERAL / OUTROS';
            segmentMap.set(seg, (segmentMap.get(seg) || 0) + Number(s.faturamento));
        });
        const segmentationData = Array.from(segmentMap.entries())
            .map(([label, value]) => ({ label, value, percent: totalFaturado > 0 ? (value / totalFaturado) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);

        const productMap = new Map<string, number>();
        currentSales.forEach(s => {
            const prod = s.produto || 'PRODUTO N/I';
            productMap.set(prod, (productMap.get(prod) || 0) + Number(s.faturamento));
        });
        const topProducts = Array.from(productMap.entries())
            .map(([name, value]) => ({ 
                name, 
                value,
                percent: totalFaturado > 0 ? (value / totalFaturado) * 100 : 0
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const clientMap = new Map<string, { current: number, prev: number }>();
        const clientNameMap = new Map<string, string>();
        
        currentSales.forEach(s => {
            const cnpjClean = String(s.cnpj || '').replace(/\D/g, '');
            if (!clientNameMap.has(cnpjClean)) {
                const clientObj = clients.find(c => String(c.cnpj).replace(/\D/g,'') === cnpjClean);
                clientNameMap.set(cnpjClean, clientObj?.nome_fantasia || s.cliente_nome || `CNPJ ${s.cnpj}`);
            }
            const current = clientMap.get(cnpjClean) || { current: 0, prev: 0 };
            current.current += Number(s.faturamento);
            clientMap.set(cnpjClean, current);
        });

        prevSales.forEach(s => {
            const cnpjClean = String(s.cnpj || '').replace(/\D/g, '');
            const current = clientMap.get(cnpjClean);
            if (current) {
                current.prev += Number(s.faturamento);
                clientMap.set(cnpjClean, current);
            }
        });

        const topClients = Array.from(clientMap.entries())
            .map(([cnpj, data]) => {
                const achievement = data.prev > 0 ? (data.current / data.prev) * 100 : (data.current > 0 ? 100 : 0);
                return {
                    name: clientNameMap.get(cnpj) || 'Cliente',
                    value: data.current,
                    prevValue: data.prev,
                    percent: totalFaturado > 0 ? (data.current / totalFaturado) * 100 : 0,
                    achievement: achievement
                };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        return {
            totalFaturado,
            totalMeta,
            pctMeta,
            positivacaoCount,
            totalPortfolio,
            pctPositivacao: pctPositivacao * 100,
            mediaMensal,
            uniqueSkus,
            uniqueSkusPrev,
            mixEvolutionPct: mixRatio * 100,
            finalScore: Math.min(finalScore, 100),
            scoreFinanceiro,
            scoreCarteira,
            scoreMix,
            monthlyData,
            monthsHit,
            segmentationData,
            topProducts,
            topClients
        };
    }, [selectedYear, selectedRepId, selectedMonths]);

    const getScoreLabel = (score: number) => {
        if (score >= 90) return { label: 'ELITE', color: 'text-blue-500', bg: 'bg-blue-500', border: 'border-blue-200', hex: '#3b82f6', bgHex: '#eff6ff' };
        if (score >= 80) return { label: 'ALTA PERFORMANCE', color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-200', hex: '#10b981', bgHex: '#ecfdf5' };
        if (score >= 60) return { label: 'REGULAR', color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-200', hex: '#f59e0b', bgHex: '#fffbeb' };
        return { label: 'CRÍTICO', color: 'text-red-500', bg: 'bg-red-500', border: 'border-red-200', hex: '#ef4444', bgHex: '#fef2f2' };
    };

    const scoreStyle = getScoreLabel(scoreData.finalScore);
    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    const handleExportImage = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        
        try {
            await new Promise(r => setTimeout(r, 2000));
            
            const element = exportRef.current;
            element.style.display = 'block';
            element.style.visibility = 'visible';

            const canvas = await html2canvas(element, {
                scale: 3, 
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: 1200, 
                height: element.offsetHeight,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 1200,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('scorecard-export-content');
                    if (el) {
                        el.style.display = 'block';
                        el.style.visibility = 'visible';
                        el.style.position = 'static';
                        el.style.transform = 'none';
                        el.style.margin = '0 auto';
                    }
                }
            });
            
            element.style.display = 'none';
            element.style.visibility = 'hidden';

            const link = document.createElement('a');
            const repName = selectedRepId === 'all' ? 'Regional' : users.find(u => u.id === selectedRepId)?.nome || 'Representante';
            link.download = `ScoreCard_${repName.replace(/\s/g, '_')}_${selectedYear}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (e) {
            console.error('Export error:', e);
            alert('Falha ao gerar imagem.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-20">
            {/* Overlay de carregamento global para o export */}
            {isExporting && createPortal(
                <div className="fixed inset-0 z-[500] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white">
                    <div className="relative mb-8">
                        <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-blue-400 animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-widest mb-2 text-center px-4">Gerando Score Card Realista</h3>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] animate-pulse">Organizando métricas e indicadores...</p>
                </div>,
                document.body
            )}

            {/* Header */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl">
                        <Trophy className="w-6 h-6 text-yellow-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">Score Card</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Avaliação de Desempenho 360º</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Botão de Exportação */}
                    <button 
                        onClick={handleExportImage}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50 min-w-[180px] justify-center"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Carregando...
                            </>
                        ) : (
                            <>
                                <Download className="w-3.5 h-3.5" />
                                Compartilhar Card
                            </>
                        )}
                    </button>

                    <div className="relative flex-1 md:flex-none w-full md:w-48">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <select 
                            value={selectedRepId} 
                            onChange={(e) => setSelectedRepId(e.target.value)} 
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                        >
                            <option value="all">Visão Regional (Média)</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.nome.toUpperCase()}</option>)}
                        </select>
                    </div>
                    <div className="relative flex-1 md:flex-none w-full md:w-32">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))} 
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                        >
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="relative flex-1 md:flex-none w-full md:w-auto" ref={dropdownRef}>
                        <button 
                            onClick={() => {
                                setTempSelectedMonths([...selectedMonths]);
                                setShowMonthDropdown(!showMonthDropdown);
                            }}
                            className="w-full md:w-auto bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase flex items-center gap-3 shadow-sm hover:bg-slate-50"
                        >
                            <span className="truncate max-w-[120px]">{getMonthsLabel()}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showMonthDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
                                    <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[9px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all">Todos</button>
                                    <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[9px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-all">Limpar</button>
                                </div>
                                <div className="p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                    {monthNames.map((m, i) => (
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
                                        className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                                    >
                                        Aplicar Filtro
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* VISUALIZAÇÃO NA TELA */}
            <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 bg-white rounded-[40px] border border-slate-200 shadow-lg p-8 flex flex-col items-center justify-center relative overflow-hidden">
                        <button onClick={() => setShowInfoModal(true)} className="absolute top-4 right-4 p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><Info className="w-4 h-4" /></button>
                        <div className={`absolute top-0 w-full h-2 ${scoreStyle.bg}`}></div>
                        <div className="text-center space-y-2 relative z-10">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Pontuação Geral</p>
                            <h1 className={`text-8xl font-black tracking-tighter ${scoreStyle.color} drop-shadow-sm`}>{scoreData.finalScore}</h1>
                            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${scoreStyle.border} ${scoreStyle.bg} bg-opacity-10`}><Medal className={`w-4 h-4 ${scoreStyle.color}`} /><span className={`text-[10px] font-black uppercase tracking-widest ${scoreStyle.color}`}>Nível {scoreStyle.label}</span></div>
                        </div>
                        <div className="grid grid-cols-3 w-full mt-10 pt-8 border-t border-slate-100 gap-2">
                            <div className="text-center"><p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Meta</p><div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(scoreData.pctMeta, 100)}%` }}></div></div><p className="text-[10px] font-black text-slate-700">{scoreData.scoreFinanceiro.toFixed(1)} <span className="text-[8px] text-slate-400">/ 60 pts</span></p></div>
                            <div className="text-center"><p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Carteira</p><div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(scoreData.pctPositivacao, 100)}%` }}></div></div><p className="text-[10px] font-black text-slate-700">{scoreData.scoreCarteira.toFixed(1)} <span className="text-[8px] text-slate-400">/ 25 pts</span></p></div>
                            <div className="text-center"><p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Mix</p><div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(scoreData.mixEvolutionPct, 100)}%` }}></div></div><p className="text-[10px] font-black text-slate-700">{scoreData.scoreMix.toFixed(1)} <span className="text-[8px] text-slate-400">/ 15 pts</span></p></div>
                        </div>
                    </div>
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-slate-900 text-white p-6 rounded-[32px] shadow-lg flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Target className="w-24 h-24" /></div>
                            <div><p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Performance Financeira</p><h3 className="text-2xl font-black">{formatBRL(scoreData.totalFaturado)}</h3><p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Meta: {formatBRL(scoreData.totalMeta)}</p></div>
                            <div className="mt-4"><div className="flex justify-between text-[9px] font-black uppercase mb-1"><span>Atingimento</span><span className={scoreData.pctMeta >= 100 ? 'text-emerald-400' : 'text-red-400'}>{scoreData.pctMeta.toFixed(2)}%</span></div><div className="w-full h-2 bg-white/10 rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${scoreData.pctMeta >= 100 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(scoreData.pctMeta, 100)}%` }}></div></div></div>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-blue-300 transition-all">
                            <div className="flex justify-between items-start"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cobertura de Carteira</p><h3 className="text-2xl font-black text-slate-900">{scoreData.positivacaoCount} <span className="text-sm text-slate-400">/ {scoreData.totalPortfolio}</span></h3></div><div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Users className="w-6 h-6" /></div></div><div className="mt-2 flex items-center gap-2"><span className="text-[10px] font-black bg-blue-50 text-blue-700 px-2 py-1 rounded-lg uppercase">{scoreData.pctPositivacao.toFixed(1)}% Positivado</span></div>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-emerald-300 transition-all">
                            <div className="flex justify-between items-start"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Média Mensal</p><h3 className="text-2xl font-black text-emerald-600">{formatBRL(scoreData.mediaMensal)}</h3></div><div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><TrendingUp className="w-6 h-6" /></div></div><p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Média de faturamento (meses selecionados)</p>
                        </div>
                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between group hover:border-purple-300 transition-all">
                            <div className="flex justify-between items-start"><div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Evolução de Mix</p><h3 className="text-2xl font-black text-purple-600">{scoreData.uniqueSkus} <span className="text-xs text-slate-400">/ {scoreData.uniqueSkusPrev} SKUs</span></h3></div><div className="p-3 bg-purple-50 text-purple-600 rounded-2xl"><ShoppingBag className="w-6 h-6" /></div></div><p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Comparativo mesmo período ano anterior</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6"><Briefcase className="w-5 h-5 text-emerald-600" /><h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Top 5 Clientes</h3></div>
                        {scoreData.topClients.length === 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-10"><Users className="w-12 h-12 mb-3 opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest">Sem clientes</p></div>) : (
                            <div className="space-y-3 flex-1">
                                {scoreData.topClients.map((client, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[9px] shrink-0 ${idx === 0 ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>{idx + 1}</div>
                                            <div className="min-w-0"><span className="text-[9px] font-bold text-slate-700 uppercase truncate max-w-[100px] block">{client.name}</span><span className={`text-[8px] font-black flex items-center gap-0.5 ${client.achievement >= 100 ? 'text-emerald-600' : 'text-red-500'}`}>{client.achievement >= 100 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}{client.achievement.toFixed(0)}% vs Ano Ant</span></div>
                                        </div>
                                        <div className="text-right shrink-0"><span className="block text-[9px] font-black text-emerald-700 tabular-nums">{client.percent.toFixed(1)}%</span><span className="text-[7px] text-slate-400 font-bold uppercase">Share</span></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6"><Package className="w-5 h-5 text-purple-600" /><h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Top 5 Produtos</h3></div>
                        {scoreData.topProducts.length === 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-10"><ShoppingBag className="w-12 h-12 mb-3 opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest">Sem vendas</p></div>) : (
                            <div className="space-y-3 flex-1">
                                {scoreData.topProducts.map((prod, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-2xl">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[9px] shrink-0 ${idx === 0 ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>{idx + 1}</div>
                                            <span className="text-[9px] font-bold text-slate-700 uppercase truncate max-w-[120px]">{prod.name}</span>
                                        </div>
                                        <span className="text-[9px] font-black text-purple-700 tabular-nums shrink-0">{prod.percent.toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-6"><Tag className="w-5 h-5 text-blue-600" /><h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Segmentação</h3></div>
                        {scoreData.segmentationData.length === 0 ? (<div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-10"><Users className="w-12 h-12 mb-3 opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest">Sem dados</p></div>) : (
                            <div className="space-y-4 flex-1">
                                {scoreData.segmentationData.slice(0, 5).map((seg, idx) => (
                                    <div key={idx} className="space-y-1.5">
                                        <div className="flex justify-between items-end"><span className="text-[9px] font-black text-slate-700 uppercase tracking-tight">{seg.label}</span><span className="text-[9px] font-black text-blue-600">{seg.percent.toFixed(1)}%</span></div>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(seg.percent, 100)}%` }}></div></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100"><tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest"><th className="px-8 py-5">Mês</th><th className="px-6 py-5 text-right">Meta</th><th className="px-6 py-5 text-right">Realizado</th><th className="px-6 py-5 text-center">Status</th><th className="px-6 py-5 text-center">Eficiência</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">
                            {scoreData.monthlyData.map((m, idx) => {
                                const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                                const isSuccess = achievement >= 100;
                                const isPending = m.sales === 0 && m.target > 0 && m.month > (new Date().getMonth() + 1);
                                return (<tr key={idx} className="hover:bg-slate-50 transition-colors"><td className="px-8 py-4 font-black text-slate-700 uppercase text-xs">{monthShort[m.month - 1]}</td><td className="px-6 py-4 text-right font-medium text-slate-400 text-xs tabular-nums">{formatBRL(m.target)}</td><td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{formatBRL(m.sales)}</td><td className="px-6 py-4 text-center">{isPending ? (<span className="text-[9px] font-bold text-slate-300 uppercase">Futuro</span>) : isSuccess ? (<span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border border-emerald-100">Superado</span>) : (<span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border border-red-100">Abaixo</span>)}</td><td className="px-6 py-4 text-center"><div className="flex items-center justify-center gap-2"><div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${isSuccess ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(achievement, 100)}%` }}></div></div><span className="text-[10px] font-black text-slate-600 tabular-nums">{achievement.toFixed(0)}%</span></div></td></tr>);
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- LAYOUT DEDICADO PARA EXPORTAÇÃO (SÓ APARECE DURANTE O CAPTURE) --- */}
            <div 
                ref={exportRef} 
                id="scorecard-export-content" 
                style={{ 
                    position: 'fixed', 
                    left: '-9999px', 
                    top: 0, 
                    width: '1200px', 
                    backgroundColor: '#ffffff', 
                    padding: '60px',
                    visibility: 'hidden',
                    display: 'none',
                    zIndex: -1,
                    fontFamily: "'Inter', sans-serif"
                }}
            >
                {/* Header Export */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '60px', borderBottom: '4px solid #0f172a', paddingBottom: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ padding: '20px', backgroundColor: '#0f172a', borderRadius: '24px', color: 'white' }}>
                            <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>
                        </div>
                        <div>
                            <h2 style={{ fontSize: '32px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: 0, letterSpacing: '-1px', lineHeight: '1.1' }}>Score Card Performance</h2>
                            <p style={{ fontSize: '14px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '3px', marginTop: '5px' }}>
                                {selectedRepId === 'all' ? 'VISÃO REGIONAL CONSOLIDADA' : users.find(u => u.id === selectedRepId)?.nome || 'REPRESENTANTE'} • {getMonthsLabel()} {selectedYear}
                            </p>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Data da Emissão</p>
                        <p style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>{new Date().toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', marginBottom: '30px' }}>
                    {/* Score Central Export - Corrigido para garantir respiro vertical total e centralização da pontuação */}
                    <div style={{ 
                        backgroundColor: '#ffffff', 
                        borderRadius: '40px', 
                        border: '4px solid #f1f5f9', 
                        padding: '80px 30px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        textAlign: 'center', 
                        position: 'relative',
                        minHeight: '520px'
                    }}>
                        <div style={{ height: '10px', width: '100%', backgroundColor: scoreStyle.hex, position: 'absolute', top: 0, left: 0, borderTopLeftRadius: '36px', borderTopRightRadius: '36px' }}></div>
                        
                        <p style={{ fontSize: '15px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '5px', marginBottom: '40px' }}>Pontuação Final</p>
                        
                        <h1 style={{ fontSize: '150px', fontWeight: '900', margin: 0, lineHeight: '1', color: scoreStyle.hex, letterSpacing: '-8px' }}>
                            {scoreData.finalScore}
                        </h1>
                        
                        {/* Selo de Nível - Ajustado para ser simétrico em relação ao título superior */}
                        <div style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            padding: '14px 35px', 
                            borderRadius: '99px', 
                            border: `4px solid ${scoreStyle.hex}`, 
                            backgroundColor: scoreStyle.bgHex,
                            minWidth: '260px',
                            marginTop: '40px',
                            marginBottom: '40px'
                        }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={scoreStyle.hex} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"></path><circle cx="12" cy="8" r="7"></circle></svg>
                            <span style={{ fontSize: '17px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: scoreStyle.hex }}>Nível {scoreStyle.label}</span>
                        </div>

                        {/* Pontuações individuais de rodapé */}
                        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '10px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Meta</p>
                                <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '99px', marginBottom: '8px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.min(scoreData.pctMeta, 100)}%`, backgroundColor: '#3b82f6', borderRadius: '99px', position: 'absolute', top: 0, left: 0 }}></div>
                                </div>
                                <p style={{ fontSize: '13px', fontWeight: '900', color: '#334155' }}>{scoreData.scoreFinanceiro.toFixed(1)} <span style={{ fontSize: '10px', color: '#cbd5e1' }}>/ 60</span></p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Portfólio</p>
                                <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '99px', marginBottom: '8px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.min(scoreData.pctPositivacao, 100)}%`, backgroundColor: '#a855f7', borderRadius: '99px', position: 'absolute', top: 0, left: 0 }}></div>
                                </div>
                                <p style={{ fontSize: '13px', fontWeight: '900', color: '#334155' }}>{scoreData.scoreCarteira.toFixed(1)} <span style={{ fontSize: '10px', color: '#cbd5e1' }}>/ 25</span></p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Mix</p>
                                <div style={{ height: '8px', backgroundColor: '#f1f5f9', borderRadius: '99px', marginBottom: '8px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.min(scoreData.mixEvolutionPct, 100)}%`, backgroundColor: '#10b981', borderRadius: '99px', position: 'absolute', top: 0, left: 0 }}></div>
                                </div>
                                <p style={{ fontSize: '13px', fontWeight: '900', color: '#334155' }}>{scoreData.scoreMix.toFixed(1)} <span style={{ fontSize: '10px', color: '#cbd5e1' }}>/ 15</span></p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Quadrantes KPI Export */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '30px', borderRadius: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderBottom: '6px solid #3b82f6' }}>
                            <div>
                                <p style={{ fontSize: '11px', fontWeight: '900', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '2px' }}>Faturamento Real</p>
                                <h3 style={{ fontSize: '32px', fontWeight: '900', margin: '10px 0' }}>{formatBRL(scoreData.totalFaturado)}</h3>
                                <p style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Meta: {formatBRL(scoreData.totalMeta)}</p>
                            </div>
                            <div style={{ marginTop: '20px', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '99px' }}>
                                <div style={{ height: '100%', width: `${Math.min(scoreData.pctMeta, 100)}%`, backgroundColor: '#3b82f6', borderRadius: '99px' }}></div>
                            </div>
                            <p style={{ fontSize: '11px', fontWeight: '900', color: '#60a5fa', marginTop: '10px' }}>{scoreData.pctMeta.toFixed(2)}% de Atingimento</p>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', border: '4px solid #f1f5f9', padding: '30px', borderRadius: '32px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Positivação Carteira</p>
                            <h3 style={{ fontSize: '32px', fontWeight: '900', margin: '10px 0', color: '#0f172a' }}>{scoreData.positivacaoCount} <span style={{ fontSize: '18px', color: '#cbd5e1' }}>/ {scoreData.totalPortfolio}</span></h3>
                            <div style={{ display: 'inline-block', marginTop: '10px', fontSize: '11px', fontWeight: '900', color: '#2563eb', backgroundColor: '#eff6ff', padding: '8px 16px', borderRadius: '12px' }}>{scoreData.pctPositivacao.toFixed(1)}% Cobertura</div>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', border: '4px solid #f1f5f9', padding: '30px', borderRadius: '32px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Média de Vendas</p>
                            <h3 style={{ fontSize: '32px', fontWeight: '900', margin: '10px 0', color: '#059669' }}>{formatBRL(scoreData.mediaMensal)}</h3>
                            <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Consolidado Médio do Período</p>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', border: '4px solid #f1f5f9', padding: '30px', borderRadius: '32px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px' }}>Mix de SKUs Ativos</p>
                            <h3 style={{ fontSize: '32px', fontWeight: '900', margin: '10px 0', color: '#7c3aed' }}>{scoreData.uniqueSkus} <span style={{ fontSize: '18px', color: '#cbd5e1' }}>itens</span></h3>
                            <p style={{ fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>vs {scoreData.uniqueSkusPrev} do Ano Anterior</p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                    {/* Top Clientes Export - Corrigido para evitar nomes cortados e melhorar alinhamento */}
                    <div style={{ backgroundColor: '#ffffff', border: '4px solid #f1f5f9', borderRadius: '32px', padding: '25px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            Top 5 Clientes
                        </h3>
                        {scoreData.topClients.map((client, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: idx === 4 ? 'none' : '2px solid #f8fafc', justifyContent: 'space-between', gap: '15px', minHeight: '60px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                    <div style={{ width: '32px', height: '32px', backgroundColor: idx === 0 ? '#059669' : '#f1f5f9', color: idx === 0 ? 'white' : '#94a3b8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '900', flexShrink: 0 }}>{idx + 1}</div>
                                    <div style={{ minWidth: 0 }}>
                                        <p style={{ fontSize: '11px', fontWeight: '900', color: '#334155', textTransform: 'uppercase', margin: 0, lineHeight: '1.4', whiteSpace: 'normal', wordBreak: 'break-word' }}>{client.name}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                            {client.achievement >= 100 ? (
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                            ) : (
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            )}
                                            <span style={{ fontSize: '10px', fontWeight: '900', color: client.achievement >= 100 ? '#059669' : '#ef4444' }}>
                                                {client.achievement.toFixed(0)}% vs {selectedYear - 1}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: '900', color: '#059669', flexShrink: 0, alignSelf: 'flex-start' }}>{client.percent.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>

                    {/* Principais Itens Export - Corrigido para nomes longos e respiro vertical */}
                    <div style={{ backgroundColor: '#ffffff', border: '4px solid #f1f5f9', borderRadius: '32px', padding: '25px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"></path><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>
                            Principais Itens
                        </h3>
                        {scoreData.topProducts.map((prod, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '18px 0', borderBottom: idx === 4 ? 'none' : '2px solid #f8fafc', justifyContent: 'space-between', gap: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                    <div style={{ width: '30px', height: '30px', backgroundColor: idx === 0 ? '#7c3aed' : '#f1f5f9', color: idx === 0 ? 'white' : '#94a3b8', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '900', flexShrink: 0 }}>{idx + 1}</div>
                                    <p style={{ fontSize: '11px', fontWeight: '900', color: '#334155', textTransform: 'uppercase', margin: 0, lineHeight: '1.5', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{prod.name}</p>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: '900', color: '#7c3aed', flexShrink: 0, alignSelf: 'flex-start' }}>{prod.percent.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>

                    {/* Canais Export */}
                    <div style={{ backgroundColor: '#ffffff', border: '4px solid #f1f5f9', borderRadius: '32px', padding: '25px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2H2v10h10H12z"></path><path d="M22 12H12v10h10H22z"></path><path d="M12 12H2v10h10H12z"></path><path d="M22 2H12v10h10H22z"></path></svg>
                            Mix de Canais
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {scoreData.segmentationData.slice(0, 5).map((seg, idx) => (
                                <div key={idx}>
                                    <div style={{ display: 'flex', marginBottom: '8px', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#334155', textTransform: 'uppercase' }}>{seg.label}</span>
                                        <span style={{ fontSize: '11px', fontWeight: '900', color: '#3b82f6' }}>{seg.percent.toFixed(1)}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
                                        <div style={{ height: '100%', width: `${Math.min(seg.percent, 100)}%`, backgroundColor: '#3b82f6', borderRadius: '99px', position: 'absolute', top: 0, left: 0 }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ border: '3px solid #f1f5f9', borderRadius: '32px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '3px solid #f1f5f9' }}>
                            <tr>
                                <th style={{ padding: '20px 30px', textAlign: 'left', fontSize: '12px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Mês Analítico</th>
                                <th style={{ padding: '20px 30px', textAlign: 'right', fontSize: '12px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Cota</th>
                                <th style={{ padding: '20px 30px', textAlign: 'right', fontSize: '12px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Realizado</th>
                                <th style={{ padding: '20px 30px', textAlign: 'center', fontSize: '12px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Eficiência</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scoreData.monthlyData.map((m, idx) => {
                                const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                                const isSuccess = achievement >= 100;
                                return (
                                    <tr key={idx} style={{ borderBottom: '2px solid #f8fafc' }}>
                                        <td style={{ padding: '18px 30px', fontSize: '13px', fontWeight: '900', color: '#334155', textTransform: 'uppercase' }}>{monthNames[m.month-1]}</td>
                                        <td style={{ padding: '18px 30px', textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}>{formatBRL(m.target)}</td>
                                        <td style={{ padding: '18px 30px', textAlign: 'right', fontSize: '15px', fontWeight: '900', color: isSuccess ? '#059669' : '#0f172a' }}>{formatBRL(m.sales)}</td>
                                        <td style={{ padding: '18px 30px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                                                <div style={{ width: '80px', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
                                                    <div style={{ height: '100%', width: `${Math.min(achievement, 100)}%`, backgroundColor: isSuccess ? '#10b981' : '#ef4444', borderRadius: '99px', position: 'absolute', top: 0, left: 0 }}></div>
                                                </div>
                                                <span style={{ fontSize: '14px', fontWeight: '900', color: isSuccess ? '#059669' : '#ef4444', minWidth: '45px' }}>{achievement.toFixed(0)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: '50px', textAlign: 'center', borderTop: '3px solid #f1f5f9', paddingTop: '30px' }}>
                    <p style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '6px' }}>Portal Centro-Norte • Inteligência Comercial Avançada</p>
                </div>
            </div>

            {showInfoModal && <ScoreRulesModal onClose={() => setShowInfoModal(false)} />}
        </div>
    );
};