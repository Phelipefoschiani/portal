
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PackageSearch, Search as SearchIcon, Filter, User, Calendar, Target, ChevronDown, CheckSquare, Square, X, Info, ListChecks, ArrowRight, Loader2, Award, Briefcase, Tag, Box, BarChart3, TrendingUp, CalendarDays, Eye, Building2, Trash2, LayoutGrid, FileSpreadsheet, Camera, MapPin, Hash, Package, Download, AlertTriangle, ChevronRight, Layers, DollarSign } from 'lucide-react';
import { totalDataStore } from '../../lib/dataStore';
import { createPortal } from 'react-dom';
import { Button } from '../Button';
import { generateGeneralMarketAnalysis, generateSpecificAnalysis, GeneralMarketAnalysis, SpecificProductAnalysis, RepRanking } from '../../lib/analysisEngine';

export const ManagerProductAnalysisScreen: React.FC = () => {
    const now = new Date();
    const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
    const userRole = session.role as 'admin' | 'rep';
    const userId = session.id;
    const isAdmin = userRole === 'admin';

    // Estados de Filtro
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [selectedRepId, setSelectedRepId] = useState<string>(isAdmin ? 'all' : userId);

    // Navegação e Loading
    const [activeTab, setActiveTab] = useState<'market' | 'specific'>('market');
    const [isProcessing, setIsProcessing] = useState(false);

    // Estados Aba Específica
    const [productSearch, setProductSearch] = useState('');
    const [showProductFilter, setShowProductFilter] = useState(false);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [boxConfigs, setBoxConfigs] = useState<{ productId: string; unitsPerBox: number }[]>([]);
    const [showBoxConfigModal, setShowBoxConfigModal] = useState(false);
    
    // Estados Drill-down (Modais)
    const [selectedProductForRanking, setSelectedProductForRanking] = useState<{ id: string; name: string; ranking: RepRanking[] } | null>(null);
    const [selectedChannelForDrill, setSelectedChannelForDrill] = useState<string | null>(null);
    const [selectedRepForGeneralDrill, setSelectedRepForGeneralDrill] = useState<string | null>(null);
    
    const [selectedDrillRep, setSelectedDrillRep] = useState<string | null>(null); // Específica
    const [selectedDrillClient, setSelectedDrillClient] = useState<string | null>(null); // Específica

    // Estados Internos do Modal de Rep (Específica)
    const [repModalSearch, setRepModalSearch] = useState('');
    const [repModalChannelTab, setRepModalChannelTab] = useState('TODOS');

    // Dados Processados
    const [marketData, setMarketData] = useState<GeneralMarketAnalysis | null>(null);
    const [specificData, setSpecificData] = useState<SpecificProductAnalysis | null>(null);

    // Refs
    const dropdownRef = useRef<HTMLDivElement>(null);
    const monthDropdownRef = useRef<HTMLDivElement>(null);

    const availableYears = [2024, 2025, 2026, 2027];
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // Click Outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowProductFilter(false);
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) setShowMonthDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Processar Dados com Loading
    useEffect(() => {
        setIsProcessing(true);
        const timer = setTimeout(() => {
            if (activeTab === 'market') {
                const data = generateGeneralMarketAnalysis(selectedYear, selectedMonths, selectedRepId);
                setMarketData(data);
            } else {
                const data = generateSpecificAnalysis(selectedProductIds, selectedYear, selectedMonths, selectedRepId);
                setSpecificData(data);
            }
            setIsProcessing(false);
        }, 100); // Pequeno delay para permitir renderização do loader
        return () => clearTimeout(timer);
    }, [selectedYear, selectedMonths, selectedRepId, activeTab, selectedProductIds]);

    // Lista de Produtos para Busca
    const filteredProductsForSelect = useMemo(() => {
        const uniqueProducts = new Map();
        totalDataStore.sales.forEach(s => {
            const key = s.codigo_produto || s.produto;
            if (!uniqueProducts.has(key)) {
                uniqueProducts.set(key, { id: key, nome: s.produto || 'Sem Descrição', grupo: s.grupo || 'GERAL' });
            }
        });
        return Array.from(uniqueProducts.values())
            .filter((p: any) => p.nome.toLowerCase().includes(productSearch.toLowerCase()) || p.id.toLowerCase().includes(productSearch.toLowerCase()))
            .sort((a: any, b: any) => a.nome.localeCompare(b.nome));
    }, [productSearch]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    const handleApplyMonthFilter = () => { setSelectedMonths([...tempSelectedMonths]); setShowMonthDropdown(false); };
    const toggleProductSelection = (id: string) => setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const handleSelectAllFiltered = () => { const ids = filteredProductsForSelect.map((p: any) => p.id); setSelectedProductIds(prev => Array.from(new Set([...prev, ...ids]))); };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-24 relative min-h-screen">
            {/* LOADING OVERLAY */}
            {isProcessing && (
                <div className="absolute inset-0 z-[500] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-[32px]">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Processando Análise...</p>
                </div>
            )}

            {/* CABEÇALHO E FILTROS */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200"><PackageSearch className="w-8 h-8" /></div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Análise de Produtos</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                            <Target className="w-3 h-3 text-emerald-500" /> Filtro de Clientes Ativos Aplicado
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {isAdmin && (
                        <div className="relative">
                            <select value={selectedRepId} onChange={(e) => setSelectedRepId(e.target.value)} className="pl-4 pr-8 py-2 bg-slate-100 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-slate-600 border-none">
                                <option value="all">TODOS REPRESENTANTES</option>
                                {totalDataStore.users.sort((a,b) => a.nome.localeCompare(b.nome)).map(u => <option key={u.id} value={u.id}>{u.nome.toUpperCase()}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-[10px] font-black uppercase px-3 py-2 cursor-pointer text-slate-600 outline-none">
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <div className="w-px h-4 bg-slate-200 self-center"></div>
                        <div className="relative" ref={monthDropdownRef}>
                            <button onClick={() => setShowMonthDropdown(!showMonthDropdown)} className="px-4 py-2 text-[10px] font-black uppercase text-slate-600 flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> {selectedMonths.length === 12 ? 'ANO TODO' : `${selectedMonths.length} MESES`}
                            </button>
                            {showMonthDropdown && (
                                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden">
                                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between gap-2">
                                        <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase">Todos</button>
                                        <button onClick={() => setTempSelectedMonths([])} className="flex-1 py-1.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase">Limpar</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 p-2 max-h-60 overflow-y-auto custom-scrollbar">
                                        {monthNames.map((m, i) => (
                                            <button key={i} onClick={() => { const val = i+1; setTempSelectedMonths(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]); }} className={`flex items-center gap-2 p-2 rounded-lg text-[9px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
                                                {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-20" />} {m}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 border-t border-slate-100 bg-slate-50"><button onClick={handleApplyMonthFilter} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all">Aplicar</button></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ABAS DE NAVEGAÇÃO */}
            <div className="flex justify-center">
                <div className="bg-slate-100 p-1 rounded-2xl flex gap-1">
                    <button onClick={() => setActiveTab('market')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'market' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <BarChart3 className="w-4 h-4" /> Visão de Mercado
                    </button>
                    <button onClick={() => setActiveTab('specific')} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'specific' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <ListChecks className="w-4 h-4" /> Análise Específica
                    </button>
                </div>
            </div>

            {/* CONTEÚDO: VISÃO DE MERCADO */}
            {activeTab === 'market' && marketData && (
                <div className="space-y-8 animate-fadeIn">
                    {/* TOP 5 E BOTTOM 10 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* TOP 5 */}
                        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Award className="w-6 h-6" /></div>
                                <div><h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Top 5 Mais Vendidos</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Curva A - Campeões de Venda</p></div>
                            </div>
                            <div className="flex-1 p-6">
                                {marketData.top5Products.map((p, idx) => (
                                    <button key={idx} onClick={() => setSelectedProductForRanking({ id: p.id, name: p.name, ranking: p.repRanking })} className="w-full text-left mb-6 last:mb-0 group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex gap-3">
                                                <span className="text-lg font-black text-slate-200 group-hover:text-blue-200 transition-colors">0{idx + 1}</span>
                                                <div>
                                                    <p className="font-black text-slate-800 uppercase text-xs group-hover:text-blue-600 transition-colors">{p.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{formatBRL(p.value)}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{p.qty} UN</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg block mb-1">{p.shareRegional.toFixed(2)}% Reg.</span>
                                            </div>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${p.shareRegional}%` }}></div></div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* BOTTOM 10 */}
                        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                                <div className="p-3 bg-red-100 text-red-600 rounded-xl"><AlertTriangle className="w-6 h-6" /></div>
                                <div><h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Top 10 Menos Vendidos</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Itens com Baixa Performance (Com Venda)</p></div>
                            </div>
                            <div className="flex-1 p-6 overflow-y-auto max-h-[400px] custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100"><tr><th className="pb-3 pl-2">Produto</th><th className="pb-3 text-right pr-2">Total</th></tr></thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {marketData.bottom10Products.map((p, idx) => (
                                            <tr key={idx} onClick={() => setSelectedProductForRanking({ id: p.id, name: p.name, ranking: p.repRanking })} className="hover:bg-slate-50 cursor-pointer group">
                                                <td className="py-3 pl-2"><p className="font-bold text-slate-700 uppercase text-[10px] truncate max-w-[250px] group-hover:text-blue-600">{p.name}</p><p className="text-[8px] font-bold text-slate-400">{p.id}</p></td>
                                                <td className="py-3 text-right pr-2 font-black text-slate-900 text-xs tabular-nums">{formatBRL(p.value)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* ANÁLISE DETALHADA DO TOP 5 */}
                    <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl">
                        <h2 className="text-2xl font-black uppercase tracking-tight mb-8 flex items-center gap-3"><TrendingUp className="w-6 h-6 text-blue-400" /> Análise Consolidada do Top 5</h2>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* CANAL */}
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-4">Share por Canal</h3>
                                <div className="space-y-3">
                                    {marketData.top5Analysis.shareByChannel.map((c, i) => (
                                        <button key={i} onClick={() => setSelectedChannelForDrill(c.channel)} className="w-full text-left group">
                                            <div className="flex justify-between text-[10px] font-bold uppercase mb-1"><span className="text-slate-300 group-hover:text-white transition-colors">{c.channel}</span><span className="text-white">{c.percentage.toFixed(1)}%</span></div>
                                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.percentage}%` }}></div></div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* REP */}
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <h3 className="text-sm font-black text-purple-400 uppercase tracking-widest mb-4">Share por Representante</h3>
                                <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                                    {marketData.top5Analysis.shareByRep.map((r, i) => (
                                        <button key={i} onClick={() => setSelectedRepForGeneralDrill(r.repId)} className="w-full flex justify-between items-center border-b border-white/5 pb-2 last:border-0 group hover:bg-white/5 rounded px-2 -mx-2 transition-colors">
                                            <span className="text-[10px] font-bold text-slate-300 uppercase truncate max-w-[150px] group-hover:text-white">{r.repName}</span>
                                            <span className="text-[10px] font-black text-purple-400">{r.percentage.toFixed(1)}%</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* CLIENTES */}
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-4">Top 5 Clientes (Top 5 Itens)</h3>
                                <div className="space-y-3">
                                    {marketData.top5Analysis.top5Clients.map((c, i) => (
                                        <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                                            <div className="min-w-0"><p className="text-[10px] font-bold text-slate-200 uppercase truncate">{c.name}</p><p className="text-[8px] text-slate-500">{c.id}</p></div>
                                            <div className="text-right"><p className="text-[10px] font-black text-emerald-400">{formatBRL(c.value)}</p><p className="text-[8px] text-slate-500">{c.qty} UN</p></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* MODAL: RANKING DE REPS POR PRODUTO */}
                    {selectedProductForRanking && createPortal(
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[85vh]">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <div><h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter truncate max-w-[300px]">{selectedProductForRanking.name}</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Ranking de Vendas por Representante</p></div>
                                    <button onClick={() => setSelectedProductForRanking(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
                                    {selectedProductForRanking.ranking.map((r, i) => (
                                        <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div>
                                                <p className="font-black text-slate-800 uppercase text-[10px]">{i+1}. {r.repName}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Última Venda: {new Date(r.lastSaleDate + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-slate-900 text-xs">{formatBRL(r.value)}</p>
                                                <p className="text-[8px] font-bold text-blue-500 uppercase mt-0.5">{r.shareInPortfolio.toFixed(2)}% da Carteira</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>, document.body
                    )}

                    {/* MODAL: DRILL DOWN CANAL */}
                    {selectedChannelForDrill && createPortal(
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                            <div className="bg-white w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[85vh]">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <div><h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Canal: {selectedChannelForDrill}</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Detalhamento por Representante e Clientes</p></div>
                                    <button onClick={() => setSelectedChannelForDrill(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                                    {marketData.top5Analysis.channelDrillDown[selectedChannelForDrill]?.reps.map((r, i) => (
                                        <div key={i} className="space-y-3">
                                            <div className="flex justify-between items-center bg-blue-50 p-3 rounded-xl border border-blue-100">
                                                <span className="font-black text-blue-800 uppercase text-xs">{r.repName}</span>
                                                <span className="font-black text-blue-600 text-xs">{formatBRL(r.value)}</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                                                {r.clients.map((c, j) => (
                                                    <div key={j} className="flex justify-between items-center p-2 border-b border-slate-50 text-[10px]">
                                                        <div className="min-w-0 pr-2"><p className="font-bold text-slate-700 uppercase truncate">{c.name}</p><p className="text-[8px] text-slate-400">{c.id}</p></div>
                                                        <div className="text-right shrink-0"><p className="font-black text-slate-900">{formatBRL(c.value)}</p><p className="text-[8px] text-emerald-500 font-bold">{c.shareInClient.toFixed(1)}% do Total</p></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>, document.body
                    )}

                    {/* MODAL: DRILL DOWN REP GERAL */}
                    {selectedRepForGeneralDrill && createPortal(
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                            <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[90vh]">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <div><h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Análise: {totalDataStore.users.find(u => u.id === selectedRepForGeneralDrill)?.nome}</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Comparativo Geral vs Seleção</p></div>
                                    <button onClick={() => setSelectedRepForGeneralDrill(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* LADO A: TOP 5 GERAL */}
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" /> Top 5 Produtos (Geral)</h4>
                                            <div className="space-y-3">
                                                {marketData.top5Analysis.repDrillDown[selectedRepForGeneralDrill]?.top5General.map((p, i) => (
                                                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                        <div className="min-w-0 pr-2">
                                                            <p className="font-black text-slate-800 uppercase text-[10px] truncate">{p.name}</p>
                                                            <p className="text-[9px] font-bold text-slate-400">{formatBRL(p.value)}</p>
                                                        </div>
                                                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{p.share.toFixed(1)}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* LADO B: CANAIS */}
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-purple-500" /> Comparativo de Canais</h4>
                                            <div className="space-y-6">
                                                <div>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Carteira Geral</p>
                                                    <div className="space-y-2">
                                                        {marketData.top5Analysis.repDrillDown[selectedRepForGeneralDrill]?.channelShareGeneral.map((c, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-[10px]">
                                                                <span className="w-24 truncate font-bold text-slate-600 uppercase">{c.channel}</span>
                                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-400 rounded-full" style={{ width: `${c.percentage}%` }}></div></div>
                                                                <span className="font-black text-slate-900">{c.percentage.toFixed(1)}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <p className="text-[9px] font-bold text-blue-400 uppercase mb-2">Top 5 Selecionado</p>
                                                    <div className="space-y-2">
                                                        {marketData.top5Analysis.repDrillDown[selectedRepForGeneralDrill]?.channelShareSelected.map((c, i) => (
                                                            <div key={i} className="flex items-center gap-2 text-[10px]">
                                                                <span className="w-24 truncate font-bold text-blue-600 uppercase">{c.channel}</span>
                                                                <div className="flex-1 h-1.5 bg-blue-50 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${c.percentage}%` }}></div></div>
                                                                <span className="font-black text-blue-600">{c.percentage.toFixed(1)}%</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>, document.body
                    )}
                </div>
            )}

            {/* CONTEÚDO: ANÁLISE ESPECÍFICA */}
            {activeTab === 'specific' && (
                <div className="space-y-8 animate-fadeIn">
                    {/* BARRA DE AÇÕES */}
                    <div className="flex flex-col md:flex-row gap-3 items-center">
                        <div className="relative flex-1 w-full" ref={dropdownRef}>
                            <button onClick={() => setShowProductFilter(!showProductFilter)} className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl border transition-all text-xs font-black uppercase tracking-widest shadow-sm ${selectedProductIds.length > 0 ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                                <SearchIcon className="w-4 h-4" /> {selectedProductIds.length === 0 ? 'Selecionar Produtos para Análise' : `${selectedProductIds.length} Itens Selecionados`}
                            </button>
                            {showProductFilter && (
                                <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl z-[200] overflow-hidden animate-slideUp">
                                    <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
                                        <div className="relative">
                                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input type="text" autoFocus placeholder="Filtrar..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <button onClick={handleSelectAllFiltered} className="text-[9px] font-black text-blue-600 uppercase hover:underline">Selecionar Listados</button>
                                            <button onClick={() => setSelectedProductIds([])} className="text-[9px] font-black text-red-500 uppercase hover:underline">Limpar Seleção</button>
                                        </div>
                                    </div>
                                    <div className="max-h-[350px] overflow-y-auto p-2 custom-scrollbar">
                                        {filteredProductsForSelect.map((p: any) => (
                                            <button key={p.id} onClick={() => toggleProductSelection(p.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left ${selectedProductIds.includes(p.id) ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}>
                                                {selectedProductIds.includes(p.id) ? <CheckSquare className="w-4 h-4 shrink-0" /> : <Square className="w-4 h-4 opacity-20 shrink-0" />}
                                                <div className="min-w-0"><p className="text-[10px] font-black uppercase truncate">{p.nome}</p><span className="text-[8px] font-bold opacity-60">SKU: {p.id} • {p.grupo}</span></div>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end"><button onClick={() => setShowProductFilter(false)} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase">Confirmar</button></div>
                                </div>
                            )}
                        </div>
                        <button onClick={() => setShowBoxConfigModal(true)} disabled={selectedProductIds.length === 0} className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-600 uppercase hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm">
                            <Box className="w-4 h-4 text-amber-500" /> Configurar Caixas
                        </button>
                    </div>

                    {/* MODAL CONFIG CAIXAS */}
                    {showBoxConfigModal && createPortal(
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[85vh]">
                                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <div className="flex items-center gap-3"><Box className="w-6 h-6 text-amber-600" /><div><h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Fator de Caixa</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Unidades por caixa</p></div></div>
                                    <button onClick={() => setShowBoxConfigModal(false)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-2">
                                    {selectedProductIds.map(pid => {
                                        const p = totalDataStore.sales.find(s => (s.codigo_produto || s.produto) === pid) || { produto: 'Produto Desconhecido' };
                                        const cfg = boxConfigs.find(c => c.productId === pid);
                                        return (
                                            <div key={pid} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                                <div className="min-w-0 pr-4"><p className="font-black text-slate-800 uppercase text-[10px] truncate">{p.produto}</p><p className="text-[8px] font-bold text-slate-400 uppercase">SKU: {pid}</p></div>
                                                <div className="flex items-center gap-3 shrink-0"><span className="text-[8px] font-black text-slate-400 uppercase">Un/Cx:</span><input type="number" value={cfg?.unitsPerBox || ''} onChange={e => { const val = Number(e.target.value); setBoxConfigs(prev => { const others = prev.filter(x => x.productId !== pid); return val > 0 ? [...others, { productId: pid, unitsPerBox: val }] : others; }); }} className="w-16 h-10 bg-white border border-slate-200 rounded-lg text-center font-black text-amber-600 text-xs outline-none focus:ring-2 focus:ring-amber-500" placeholder="--" /></div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="p-6 bg-slate-50 border-t border-slate-100"><Button onClick={() => setShowBoxConfigModal(false)} fullWidth className="h-12 rounded-xl font-black uppercase text-[10px] bg-amber-600 hover:bg-amber-700">Salvar Configuração</Button></div>
                            </div>
                        </div>, document.body
                    )}

                    {specificData && (
                        <div className="space-y-8 animate-fadeIn">
                            {/* GRÁFICOS DE PARTICIPAÇÃO */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* POR REPRESENTANTE */}
                                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-2"><User className="w-4 h-4 text-purple-500" /> Participação por Representante</h3>
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {specificData.summary.shareByRep.map((r, i) => (
                                            <button key={i} onClick={() => { setSelectedDrillRep(r.repId); setRepModalSearch(''); setRepModalChannelTab('TODOS'); }} className="w-full flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors group text-left">
                                                <div><p className="font-black text-slate-800 uppercase text-[10px] group-hover:text-blue-600 transition-colors">{r.repName}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{formatBRL(r.value)}</p></div>
                                                <div className="flex items-center gap-2"><span className="text-sm font-black text-purple-600">{r.percentage.toFixed(1)}%</span><ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500" /></div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* POR GRUPO */}
                                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center gap-2"><Layers className="w-4 h-4 text-blue-500" /> Participação por Grupo</h3>
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {specificData.summary.shareByGroup.map((g, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-0">
                                                <div><p className="font-black text-slate-800 uppercase text-[10px]">{g.group}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{formatBRL(g.value)}</p></div>
                                                <span className="text-sm font-black text-blue-600">{g.percentage.toFixed(1)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* TABELA DETALHADA DE PRODUTOS */}
                            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-8 border-b border-slate-100 bg-slate-50/50"><h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-3"><ListChecks className="w-5 h-5 text-slate-500" /> Detalhamento por Item</h3></div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                            <tr>
                                                <th className="px-8 py-4">Produto</th>
                                                <th className="px-6 py-4 text-right">Total (R$)</th>
                                                <th className="px-6 py-4 text-right">Qtde (UN)</th>
                                                <th className="px-6 py-4 text-right">Caixas</th>
                                                <th className="px-6 py-4 text-right">Share (Análise)</th>
                                                <th className="px-6 py-4 text-right">Share (Global)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {specificData.products.map((p, i) => {
                                                const boxFactor = boxConfigs.find(c => c.productId === p.id)?.unitsPerBox || 0;
                                                const boxes = boxFactor > 0 ? (p.qty / boxFactor).toFixed(1) : '-';
                                                const shareAnalysis = (p.value / specificData.summary.totalValue) * 100;
                                                const shareGlobal = specificData.summary.totalRegionalValue > 0 ? (p.value / specificData.summary.totalRegionalValue) * 100 : 0;
                                                return (
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-8 py-4"><p className="font-black text-slate-800 uppercase text-[11px]">{p.name}</p><p className="text-[9px] font-bold text-slate-400">{p.id}</p></td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-600 text-xs tabular-nums">{formatBRL(p.value)}</td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{p.qty}</td>
                                                        <td className="px-6 py-4 text-right font-black text-amber-600 text-xs tabular-nums">{boxes}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-blue-600 text-xs tabular-nums">{shareAnalysis.toFixed(2)}%</td>
                                                        <td className="px-6 py-4 text-right font-bold text-emerald-600 text-xs tabular-nums">{shareGlobal.toFixed(2)}%</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        {/* FOOTER TOTAIS */}
                                        <tfoot className="bg-slate-900 text-white">
                                            <tr>
                                                <td className="px-8 py-4 text-[10px] font-black uppercase tracking-widest">{specificData.products.length} SKUs Analisados</td>
                                                <td className="px-6 py-4 text-right font-black text-sm">{formatBRL(specificData.summary.totalValue)}</td>
                                                <td className="px-6 py-4 text-right font-black text-sm">{specificData.summary.totalQty} UN</td>
                                                <td className="px-6 py-4 text-right font-black text-amber-500 text-xs">-</td>
                                                <td className="px-6 py-4 text-right font-black text-xs">100%</td>
                                                <td className="px-6 py-4 text-right font-black text-emerald-400 text-xs">{(specificData.summary.totalValue / specificData.summary.totalRegionalValue * 100).toFixed(2)}%</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* MODAL DRILL-DOWN: REPRESENTANTE -> CLIENTES (COM PESQUISA E ABAS) */}
                    {selectedDrillRep && specificData && (
                        createPortal(
                            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                                <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[90vh]">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                        <div><h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{specificData.repDrillDown[selectedDrillRep].repName}</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Análise de Clientes</p></div>
                                        <button onClick={() => setSelectedDrillRep(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                                    </div>
                                    
                                    {/* CONTROLES: PESQUISA E ABAS */}
                                    <div className="p-4 border-b border-slate-100 bg-white space-y-4">
                                        <div className="relative">
                                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input type="text" placeholder="Pesquisar Cliente..." value={repModalSearch} onChange={(e) => setRepModalSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                                        </div>
                                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                            <button onClick={() => setRepModalChannelTab('TODOS')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-colors ${repModalChannelTab === 'TODOS' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Todos</button>
                                            {Array.from(new Set(specificData.repDrillDown[selectedDrillRep].clients.map(c => c.channel))).sort().map(ch => (
                                                <button key={ch} onClick={() => setRepModalChannelTab(ch)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-colors ${repModalChannelTab === ch ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>{ch}</button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-6 py-3">Cliente</th>
                                                    <th className="px-4 py-3">Canal</th>
                                                    <th className="px-6 py-3 text-right">Total Comprado</th>
                                                    <th className="px-4 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {specificData.repDrillDown[selectedDrillRep].clients
                                                    .filter(c => (repModalChannelTab === 'TODOS' || c.channel === repModalChannelTab) && (c.name.toLowerCase().includes(repModalSearch.toLowerCase()) || c.id.includes(repModalSearch)))
                                                    .sort((a,b) => b.totalValue - a.totalValue)
                                                    .map((c, i) => (
                                                        <tr key={i} onClick={() => setSelectedDrillClient(c.id)} className="hover:bg-blue-50 cursor-pointer group transition-colors">
                                                            <td className="px-6 py-3"><p className="font-black text-slate-800 uppercase text-[10px] group-hover:text-blue-600">{c.name}</p><p className="text-[9px] font-bold text-slate-400">{c.id}</p></td>
                                                            <td className="px-4 py-3"><span className="text-[9px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded-md">{c.channel}</span></td>
                                                            <td className="px-6 py-3 text-right font-black text-slate-900 text-xs">{formatBRL(c.totalValue)}</td>
                                                            <td className="px-4 py-3 text-right"><ChevronRight className="w-4 h-4 text-slate-300 inline-block group-hover:text-blue-500" /></td>
                                                        </tr>
                                                    ))
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>, document.body
                        )
                    )}

                    {/* MODAL DRILL-DOWN: CLIENTE -> ITENS */}
                    {selectedDrillClient && selectedDrillRep && specificData && (
                        createPortal(
                            <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
                                <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[85vh]">
                                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter truncate max-w-[300px]">
                                                {specificData.repDrillDown[selectedDrillRep].clients.find(c => c.id === selectedDrillClient)?.name}
                                            </h3>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Itens Comprados</p>
                                        </div>
                                        <button onClick={() => setSelectedDrillClient(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                                        {specificData.repDrillDown[selectedDrillRep].clients.find(c => c.id === selectedDrillClient)?.items.map((item, i) => {
                                            const boxFactor = boxConfigs.find(c => c.productId === item.productId)?.unitsPerBox || 0;
                                            const boxes = boxFactor > 0 ? (item.qty / boxFactor).toFixed(1) : '-';
                                            return (
                                                <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <p className="font-black text-slate-800 uppercase text-[10px] mb-2">{item.productName}</p>
                                                    <div className="grid grid-cols-2 gap-4 text-[9px] uppercase">
                                                        <div><span className="font-bold text-slate-400 block">Valor</span><span className="font-black text-slate-900">{formatBRL(item.value)}</span></div>
                                                        <div><span className="font-bold text-slate-400 block">Quantidade</span><span className="font-black text-slate-900">{item.qty} UN</span></div>
                                                        <div><span className="font-bold text-slate-400 block">Caixas</span><span className="font-black text-amber-600">{boxes} CX</span></div>
                                                        <div><span className="font-bold text-slate-400 block">Última Compra</span><span className="font-black text-slate-900">{new Date(item.lastDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>, document.body
                        )
                    )}
                </div>
            )}
        </div>
    );
};
