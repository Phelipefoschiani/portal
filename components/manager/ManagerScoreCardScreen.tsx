import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Trophy, Target, Users, ShoppingBag, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, AlertCircle, Search, User, Filter, Medal, Activity, BarChart3, Star, Percent, Info, ChevronDown, CheckSquare, Square, Tag, Package, X, Briefcase, CheckCircle2, XCircle, Download, Loader2 } from 'lucide-react';
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
                            <span className="text-xs font-black text-slate-700 uppercase">2. Qualidade da Carteira</span>
                            <span className="text-xs font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">Peso 25%</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                            Calculado pela taxa de positivação (Clientes que compraram no período / Total de clientes ativos na carteira).
                        </p>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden"><div className="w-[25%] bg-purple-500 h-full"></div></div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-black text-slate-700 uppercase">3. Evolução de Mix</span>
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
    // Ref específica para o container de exportação
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
    
    // Motor de Cálculo do Score
    const scoreData = useMemo(() => {
        const sales = totalDataStore.sales;
        const targets = totalDataStore.targets;
        const clients = totalDataStore.clients;

        // Filtro Base
        const filterSales = (s: any, yearToCheck: number) => {
            const d = new Date(s.data + 'T00:00:00');
            const m = d.getUTCMonth() + 1;
            const y = d.getUTCFullYear();
            return y === yearToCheck && selectedMonths.includes(m) && (selectedRepId === 'all' ? true : s.usuario_id === selectedRepId);
        };
        
        // Vendas Atuais
        const currentSales = sales.filter(s => filterSales(s, selectedYear));
        
        // Vendas Ano Anterior (Para Comparativo de Mix e Crescimento Clientes)
        const prevSales = sales.filter(s => filterSales(s, selectedYear - 1));
        
        // Métricas Totais
        const totalFaturado = currentSales.reduce((acc, curr) => acc + Number(curr.faturamento), 0);
        
        // Meta
        const currentTargets = targets.filter(t => t.ano === selectedYear && selectedMonths.includes(t.mes) && (selectedRepId === 'all' ? true : t.usuario_id === selectedRepId));
        const totalMeta = currentTargets.reduce((acc, curr) => acc + Number(curr.valor), 0);

        // Positivação
        const activeCnpjs = new Set(currentSales.map(s => String(s.cnpj || '').replace(/\D/g, '')));
        const totalPortfolio = clients.filter(c => selectedRepId === 'all' ? true : c.usuario_id === selectedRepId).length || 1; 
        const positivacaoCount = activeCnpjs.size;
        
        // Mix e Ticket
        const uniqueSkus = new Set(currentSales.map(s => s.codigo_produto)).size;
        const uniqueSkusPrev = new Set(prevSales.map(s => s.codigo_produto)).size;
        
        // Média Mensal
        const monthsCount = selectedMonths.length || 1;
        const mediaMensal = totalFaturado / monthsCount;

        // --- ALGORITMO DE SCORE (0 a 100) - RÍGIDO ---
        const pctMeta = totalMeta > 0 ? (totalFaturado / totalMeta) : 0;
        const scoreFinanceiro = Math.min(pctMeta, 1.0) * 60; 

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

        // Dados Mensais para Tabela
        const monthlyData = selectedMonths.sort((a,b) => a-b).map(month => {
            const mSales = currentSales.filter(s => {
                const d = new Date(s.data + 'T00:00:00');
                return d.getUTCMonth() + 1 === month;
            }).reduce((a, b) => a + Number(b.faturamento), 0);
            
            const mTarget = currentTargets.filter(t => t.mes === month).reduce((a, b) => a + Number(b.valor), 0);
            
            return { month, sales: mSales, target: mTarget };
        });

        const monthsHit = monthlyData.filter(m => m.target > 0 && m.sales >= m.target).length;

        // --- ANÁLISE DE SEGMENTAÇÃO (Canais) ---
        const segmentMap = new Map<string, number>();
        currentSales.forEach(s => {
            const seg = s.canal_vendas || 'GERAL / OUTROS';
            segmentMap.set(seg, (segmentMap.get(seg) || 0) + Number(s.faturamento));
        });
        const segmentationData = Array.from(segmentMap.entries())
            .map(([label, value]) => ({ label, value, percent: totalFaturado > 0 ? (value / totalFaturado) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);

        // --- TOP PRODUTOS (Em %) ---
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

        // --- TOP CLIENTES (Em % e Atingimento vs Ano Anterior) ---
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
                // Cálculo de atingimento: (Atual / Anterior) * 100
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
            pctMeta: pctMeta * 100,
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
        if (score >= 90) return { label: 'ELITE', color: 'text-blue-500', bg: 'bg-blue-500', border: 'border-blue-200' };
        if (score >= 80) return { label: 'ALTA PERFORMANCE', color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-200' };
        if (score >= 60) return { label: 'REGULAR', color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-200' };
        return { label: 'CRÍTICO', color: 'text-red-500', bg: 'bg-red-500', border: 'border-red-200' };
    };

    const scoreStyle = getScoreLabel(scoreData.finalScore);
    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    // Helpers de Cores para o Export (Evita classes Tailwind dinâmicas no html2canvas que podem falhar)
    const getHexColor = (colorClass: string) => {
        if (colorClass.includes('blue')) return '#3b82f6';
        if (colorClass.includes('emerald')) return '#10b981';
        if (colorClass.includes('amber')) return '#f59e0b';
        if (colorClass.includes('red')) return '#ef4444';
        return '#3b82f6';
    };

    const getBorderHex = (borderClass: string) => {
        if (borderClass.includes('blue')) return '#bfdbfe';
        if (borderClass.includes('emerald')) return '#a7f3d0';
        if (borderClass.includes('amber')) return '#fde68a';
        if (borderClass.includes('red')) return '#fecaca';
        return '#bfdbfe';
    };

    const handleExportImage = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        try {
            await new Promise(r => setTimeout(r, 500));
            
            const element = exportRef.current;
            
            // Força o scroll para o topo para garantir que html2canvas capture desde o início
            window.scrollTo(0, 0);

            const canvas = await html2canvas(element, {
                scale: 2, 
                useCORS: true,
                backgroundColor: '#ffffff', // Força fundo branco sólido
                logging: false,
                width: 1200, 
                windowWidth: 1200,
                // IMPORTANTE: Definir altura explicitamente baseada no scrollHeight do elemento
                height: element.scrollHeight,
                windowHeight: element.scrollHeight,
                x: 0,
                y: 0,
                scrollX: 0,
                scrollY: 0,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('scorecard-export-content');
                    if (el) {
                        // Garante que no clone o elemento seja visível e tenha o estilo correto
                        el.style.display = 'block'; 
                        el.style.visibility = 'visible';
                        el.style.position = 'static'; // Reseta posicionamento para fluxo normal
                        el.style.width = '1200px';
                        el.style.height = 'auto';
                        el.style.padding = '40px';
                        el.style.margin = '0';
                        el.style.backgroundColor = '#ffffff';
                    }
                }
            });
            
            const link = document.createElement('a');
            const repName = selectedRepId === 'all' ? 'Regional' : users.find(u => u.id === selectedRepId)?.nome || 'Representante';
            link.download = `ScoreCard_${repName.replace(/\s/g, '_')}_${selectedYear}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error('Export error:', e);
            alert('Erro ao gerar imagem.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-20">
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
                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Compartilhar Card
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
                            className="w-full md:w-auto bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase flex items-center justify-between gap-3 shadow-sm hover:bg-slate-50"
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
                                            className={`flex items-center gap-2 p-2.5 rounded-xl text-[10px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
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

            {/* VISUALIZAÇÃO NA TELA (INTERATIVA) */}
            <div className="space-y-6">
                {/* Score Card + KPIs - Reutiliza mesmos componentes do export */}
                {/* ... (Renderização normal dos cards - mantida igual para o usuário interagir) ... */}
                {/* Por brevidade, vou renderizar o conteúdo principal abaixo, mas o importante é o exportRef */}
                
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
                    {/* Top Clientes - Visualização Tela */}
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
                    {/* Top Produtos - Visualização Tela */}
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
                    {/* Segmentação - Visualização Tela */}
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

            {/* --- LAYOUT DEDICADO PARA EXPORTAÇÃO (INVISÍVEL NA TELA) --- */}
            {/* Este layout tem largura fixa de 1200px para evitar quebra de texto e fundo branco sólido */}
            <div ref={exportRef} id="scorecard-export-content" style={{ position: 'fixed', left: '-9999px', top: 0, width: '1200px', backgroundColor: '#ffffff', padding: '40px', visibility: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px', borderBottom: '2px solid #f1f5f9', paddingBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ padding: '15px', backgroundColor: '#0f172a', borderRadius: '16px', color: 'white' }}><Trophy style={{ width: '32px', height: '32px', color: '#facc15' }} /></div>
                        <div>
                            <h2 style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', margin: 0 }}>Score Card</h2>
                            <p style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '2px', marginTop: '5px' }}>{selectedRepId === 'all' ? 'VISÃO REGIONAL' : users.find(u => u.id === selectedRepId)?.nome || 'REPRESENTANTE'} • {getMonthsLabel()} {selectedYear}</p>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', marginBottom: '30px' }}>
                    {/* Score Principal (SEM OVERFLOW HIDDEN) */}
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '32px', border: '2px solid #e2e8f0', padding: '30px', textAlign: 'center', position: 'relative' }}>
                        <div style={{ height: '8px', width: '100%', backgroundColor: getHexColor(scoreStyle.bg), position: 'absolute', top: 0, left: 0, borderTopLeftRadius: '30px', borderTopRightRadius: '30px' }}></div>
                        <p style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px' }}>Pontuação Geral</p>
                        {/* Line height fix to prevent cutting */}
                        <h1 style={{ fontSize: '96px', fontWeight: '900', margin: '10px 0', lineHeight: '1', color: getHexColor(scoreStyle.color) }}>{scoreData.finalScore}</h1>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '8px 20px', borderRadius: '99px', border: `2px solid ${getBorderHex(scoreStyle.border)}`, backgroundColor: '#f8fafc' }}>
                            <span style={{ fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: getHexColor(scoreStyle.color) }}>Nível {scoreStyle.label}</span>
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '25px', borderRadius: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div><p style={{ fontSize: '11px', fontWeight: '900', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '1px' }}>Performance Financeira</p><h3 style={{ fontSize: '28px', fontWeight: '900', margin: '5px 0' }}>{formatBRL(scoreData.totalFaturado)}</h3><p style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Meta: {formatBRL(scoreData.totalMeta)}</p></div>
                            <div style={{ marginTop: '15px', padding: '5px 10px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', width: 'fit-content', fontSize: '12px', fontWeight: '800' }}>{scoreData.pctMeta.toFixed(2)}% Atingimento</div>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0', padding: '25px', borderRadius: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><div><p style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Carteira</p><h3 style={{ fontSize: '28px', fontWeight: '900', margin: '5px 0', color: '#0f172a' }}>{scoreData.positivacaoCount} <span style={{ fontSize: '16px', color: '#94a3b8' }}>/ {scoreData.totalPortfolio}</span></h3></div></div>
                            <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: '800', color: '#2563eb', backgroundColor: '#eff6ff', padding: '5px 10px', borderRadius: '8px', width: 'fit-content' }}>{scoreData.pctPositivacao.toFixed(1)}% Positivado</div>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0', padding: '25px', borderRadius: '24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Média Mensal</p><h3 style={{ fontSize: '28px', fontWeight: '900', margin: '5px 0', color: '#059669' }}>{formatBRL(scoreData.mediaMensal)}</h3>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0', padding: '25px', borderRadius: '24px' }}>
                            <p style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Mix SKUs</p><h3 style={{ fontSize: '28px', fontWeight: '900', margin: '5px 0', color: '#7c3aed' }}>{scoreData.uniqueSkus}</h3>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                    {/* Top Clientes Fixed Layout */}
                    <div style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0', borderRadius: '24px', padding: '25px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}><Briefcase size={20} color="#059669" /><h3 style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>Top 5 Clientes</h3></div>
                        {scoreData.topClients.map((client, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                                    <div style={{ width: '24px', height: '24px', backgroundColor: idx===0?'#059669':'#f1f5f9', color: idx===0?'white':'#64748b', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '900' }}>{idx+1}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{client.name}</span>
                                        <span style={{ fontSize: '10px', fontWeight: '800', color: client.achievement >= 100 ? '#059669' : '#ef4444' }}>{client.achievement >= 100 ? '▲' : '▼'} {client.achievement.toFixed(0)}% vs Ano Ant</span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', minWidth: '60px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#047857' }}>{client.percent.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Top Produtos Fixed Layout */}
                    <div style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0', borderRadius: '24px', padding: '25px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}><Package size={20} color="#7c3aed" /><h3 style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>Top 5 Produtos</h3></div>
                        {scoreData.topProducts.map((prod, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                                    <div style={{ width: '24px', height: '24px', backgroundColor: idx===0?'#7c3aed':'#f1f5f9', color: idx===0?'white':'#64748b', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '900' }}>{idx+1}</div>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{prod.name}</span>
                                </div>
                                <div style={{ textAlign: 'right', minWidth: '50px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#6d28d9' }}>{prod.percent.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Segmentação Fixed Layout */}
                    <div style={{ backgroundColor: '#ffffff', border: '2px solid #e2e8f0', borderRadius: '24px', padding: '25px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}><Tag size={20} color="#2563eb" /><h3 style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>Segmentação</h3></div>
                        {scoreData.segmentationData.slice(0, 5).map((seg, idx) => (
                            <div key={idx} style={{ marginBottom: '15px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>{seg.label}</span>
                                    <span style={{ fontSize: '11px', fontWeight: '900', color: '#2563eb' }}>{seg.percent.toFixed(1)}%</span>
                                </div>
                                <div style={{ width: '100%', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${Math.min(seg.percent, 100)}%`, backgroundColor: '#2563eb' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Table Fixed Layout */}
                <div style={{ border: '2px solid #e2e8f0', borderRadius: '24px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                            <tr>
                                <th style={{ padding: '15px 25px', textAlign: 'left', fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Mês</th>
                                <th style={{ padding: '15px 25px', textAlign: 'right', fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Meta</th>
                                <th style={{ padding: '15px 25px', textAlign: 'right', fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Realizado</th>
                                <th style={{ padding: '15px 25px', textAlign: 'center', fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Status</th>
                                <th style={{ padding: '15px 25px', textAlign: 'center', fontSize: '11px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Eficiência</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scoreData.monthlyData.map((m, idx) => {
                                const achievement = m.target > 0 ? (m.sales / m.target) * 100 : 0;
                                const isSuccess = achievement >= 100;
                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '15px 25px', fontSize: '12px', fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>{monthShort[m.month-1]}</td>
                                        <td style={{ padding: '15px 25px', textAlign: 'right', fontSize: '12px', fontWeight: '700', color: '#94a3b8' }}>{formatBRL(m.target)}</td>
                                        <td style={{ padding: '15px 25px', textAlign: 'right', fontSize: '12px', fontWeight: '900', color: '#0f172a' }}>{formatBRL(m.sales)}</td>
                                        <td style={{ padding: '15px 25px', textAlign: 'center' }}>
                                            <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '6px', backgroundColor: isSuccess ? '#ecfdf5' : '#fef2f2', color: isSuccess ? '#059669' : '#dc2626' }}>
                                                {isSuccess ? 'Superado' : 'Abaixo'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '15px 25px', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                                <div style={{ width: '60px', height: '6px', backgroundColor: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${Math.min(achievement, 100)}%`, backgroundColor: isSuccess ? '#10b981' : '#ef4444' }}></div>
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: '900', color: '#475569' }}>{achievement.toFixed(0)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: '30px', textAlign: 'center', borderTop: '2px solid #f1f5f9', paddingTop: '20px' }}>
                    <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '4px' }}>Portal Centro-Norte • Inteligência de Dados</p>
                </div>
            </div>

            {showInfoModal && <ScoreRulesModal onClose={() => setShowInfoModal(false)} />}
        </div>
    );
};