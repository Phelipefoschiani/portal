
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Table2, Filter, ChevronRight, FileSpreadsheet, Percent, Calculator, Search, User, Boxes, Tag, Package, Building2, BarChart4, Download, Layers, CheckSquare, Square, X, ChevronDown, ListFilter, ArrowRight, Calendar, FileText, Loader2, Trash2, ListChecks, CalendarDays, Hash, RotateCcw, AlertCircle } from 'lucide-react';
import { totalDataStore } from '../../lib/dataStore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from '../Button';

type Dimension = 'representante' | 'canal' | 'grupo' | 'cliente' | 'produto';

interface GroupData {
    label: string;
    level: number;
    faturamento: number;
    quantidade: number;
    pedidos: number;
    parentTotal: number;
    skuSet: Set<string>; 
    children?: Map<string, GroupData>;
}

export const ManagerDetailedAnalysisScreen: React.FC = () => {
    const now = new Date();
    const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
    const userRole = session.role as 'admin' | 'rep';
    const isAdmin = userRole === 'admin';
    
    const getSavedState = () => {
        const saved = sessionStorage.getItem('pcn_bi_builder_state');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            selectedYear: now.getFullYear(),
            selectedMonths: [now.getMonth() + 1],
            rowDimensions: [] as Dimension[],
            filterReps: [] as string[],
            filterCanais: [] as string[],
            filterGrupos: [] as string[],
            filterClients: [] as string[],
            displayMode: 'value' as 'value' | 'percent',
            searchTerm: '',
            topLimit: 'all' as number | 'all'
        };
    };

    const initialState = getSavedState();

    const [selectedYear, setSelectedYear] = useState<number>(initialState.selectedYear);
    const [selectedMonths, setSelectedMonths] = useState<number[]>(initialState.selectedMonths);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>(initialState.selectedMonths);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [showYearDropdown, setShowYearDropdown] = useState(false);

    const [filterReps, setFilterReps] = useState<string[]>(initialState.filterReps);
    const [filterCanais, setFilterCanais] = useState<string[]>(initialState.filterCanais);
    const [filterGrupos, setFilterGrupos] = useState<string[]>(initialState.filterGrupos);
    const [filterClients, setFilterClients] = useState<string[]>(initialState.filterClients);
    const [topLimit, setTopLimit] = useState<number | 'all'>(initialState.topLimit);
    
    const [activeDropdown, setActiveDropdown] = useState<'dims' | 'reps' | 'canais' | 'grupos' | 'clients' | 'top' | null>(null);

    const [rowDimensions, setRowDimensions] = useState<Dimension[]>(initialState.rowDimensions);
    const [displayMode, setDisplayMode] = useState<'value' | 'percent'>(initialState.displayMode);
    const [searchTerm, setSearchTerm] = useState(initialState.searchTerm);
    const [isExporting, setIsExporting] = useState<'excel' | 'pdf' | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const monthDropdownRef = useRef<HTMLDivElement>(null);
    const yearDropdownRef = useRef<HTMLDivElement>(null);
    const listContainerRef = useRef<HTMLDivElement>(null);

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const years = [2024, 2025, 2026, 2027];

    useEffect(() => {
        const stateToSave = {
            selectedYear,
            selectedMonths,
            rowDimensions,
            filterReps,
            filterCanais,
            filterGrupos,
            filterClients,
            displayMode,
            searchTerm,
            topLimit
        };
        sessionStorage.setItem('pcn_bi_builder_state', JSON.stringify(stateToSave));
    }, [selectedYear, selectedMonths, rowDimensions, filterReps, filterCanais, filterGrupos, filterClients, displayMode, searchTerm, topLimit]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setActiveDropdown(null);
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) setShowMonthDropdown(false);
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) setShowYearDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (filterReps.length === 0) {
            setFilterClients([]);
            setTopLimit('all');
        }
    }, [filterReps]);

    // Se selecionar clientes específicos, o top ranking deve ser forçado para 'all'
    useEffect(() => {
        if (filterClients.length > 0) setTopLimit('all');
    }, [filterClients]);

    const resetAllFilters = () => {
        if (!confirm('Deseja zerar todos os filtros e camadas desta consulta?')) return;
        setFilterReps([]);
        setFilterCanais([]);
        setFilterGrupos([]);
        setFilterClients([]);
        setRowDimensions([]);
        setTopLimit('all');
        setSearchTerm('');
        setSelectedMonths([now.getMonth() + 1]);
        sessionStorage.removeItem('pcn_bi_builder_state');
    };

    const filterOptions = useMemo(() => {
        const sales = totalDataStore.sales;
        const clients = totalDataStore.clients;
        const canais = new Set<string>();
        const grupos = new Set<string>();
        
        sales.forEach(s => {
            if (s.canal_vendas) canais.add(s.canal_vendas);
            if (s.grupo) grupos.add(s.grupo);
        });

        const dynamicClients = filterReps.length > 0 
            ? clients.filter(c => filterReps.includes(c.usuario_id))
            : [];

        return {
            reps: totalDataStore.users.sort((a, b) => a.nome.localeCompare(b.nome)),
            canais: Array.from(canais).sort(),
            grupos: Array.from(grupos).sort(),
            clients: dynamicClients.sort((a, b) => a.nome_fantasia.localeCompare(b.nome_fantasia))
        };
    }, [filterReps]);

    const toggleFilter = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        setList(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    };

    const processedBI = useMemo(() => {
        let sales = totalDataStore.sales;
        if (rowDimensions.length === 0) return { items: [], totals: { faturamento: 0, quantidade: 0, skus: 0 } };

        const usersMap = new Map(totalDataStore.users.map(u => [u.id, u.nome]));
        const clientCnpjToId = new Map();
        
        totalDataStore.clients.forEach(c => {
            const clean = String(c.cnpj || '').replace(/\D/g, '');
            clientCnpjToId.set(clean, c.id);
        });

        let filteredSales = sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            const m = d.getUTCMonth() + 1;
            const y = d.getUTCFullYear();
            const matchTime = y === selectedYear && selectedMonths.includes(m);
            if (!matchTime) return false;

            if (isAdmin && filterReps.length > 0 && !filterReps.includes(s.usuario_id)) return false;
            if (filterCanais.length > 0 && (!s.canal_vendas || !filterCanais.includes(s.canal_vendas))) return false;
            if (filterGrupos.length > 0 && (!s.grupo || !filterGrupos.includes(s.grupo))) return false;
            
            return true;
        });

        if (topLimit !== 'all' && filterClients.length === 0) {
            const clientRankingMap = new Map<string, number>();
            filteredSales.forEach(s => {
                const cnpj = String(s.cnpj || '').replace(/\D/g, '');
                const cId = clientCnpjToId.get(cnpj);
                if (cId) {
                    clientRankingMap.set(cId, (clientRankingMap.get(cId) || 0) + (Number(s.faturamento) || 0));
                }
            });

            const topClientIds = Array.from(clientRankingMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, Number(topLimit))
                .map(entry => entry[0]);

            filteredSales = filteredSales.filter(s => {
                const cId = clientCnpjToId.get(String(s.cnpj || '').replace(/\D/g, ''));
                return cId && topClientIds.includes(cId);
            });
        }

        if (filterClients.length > 0) {
            filteredSales = filteredSales.filter(s => {
                const cId = clientCnpjToId.get(String(s.cnpj || '').replace(/\D/g, ''));
                return cId && filterClients.includes(cId);
            });
        }

        const tree = new Map<string, GroupData>();
        let grandTotalFaturamento = 0;
        let grandTotalQuantidade = 0;
        const grandTotalSkuSet = new Set<string>();

        filteredSales.forEach(sale => {
            const fat = Number(sale.faturamento) || 0;
            const qtd = Number(sale.qtde_faturado) || 0;
            const skuId = sale.codigo_produto || sale.produto || 'N/I';
            
            grandTotalFaturamento += fat;
            grandTotalQuantidade += qtd;
            grandTotalSkuSet.add(skuId);

            let currentLevel = tree;
            rowDimensions.forEach((dim, idx) => {
                let key = 'N/I';
                if (dim === 'representante') key = usersMap.get(sale.usuario_id) || 'N/I';
                else if (dim === 'canal') key = sale.canal_vendas || 'GERAL';
                else if (dim === 'grupo') key = sale.grupo || 'SEM GRUPO';
                else if (dim === 'cliente') {
                    key = (sale.cliente_nome || `CNPJ: ${sale.cnpj}`).trim().toUpperCase();
                }
                else if (dim === 'produto') key = sale.produto ? sale.produto.trim().toUpperCase() : 'ITEM SEM DESCRIÇÃO';

                if (!currentLevel.has(key)) {
                    currentLevel.set(key, {
                        label: key,
                        level: idx,
                        faturamento: 0,
                        quantidade: 0,
                        pedidos: 0,
                        parentTotal: 0,
                        skuSet: new Set(),
                        children: idx < rowDimensions.length - 1 ? new Map() : undefined
                    });
                }

                const node = currentLevel.get(key)!;
                node.faturamento += fat;
                node.quantidade += qtd;
                node.pedidos += 1;
                node.skuSet.add(skuId);

                if (node.children) {
                    currentLevel = node.children;
                }
            });
        });

        const flatList: any[] = [];
        const flatten = (nodes: Map<string, GroupData>, parentTotalValue: number, parentLabels: string[] = []) => {
            const sortedNodes = Array.from(nodes.values()).sort((a, b) => b.faturamento - a.faturamento);
            sortedNodes.forEach(node => {
                const currentLabels = [...parentLabels, node.label];
                flatList.push({
                    ...node,
                    hierarchyLabels: currentLabels,
                    skusCount: node.skuSet.size,
                    participation: parentTotalValue > 0 ? (node.faturamento / parentTotalValue) * 100 : 100
                });
                if (node.children) flatten(node.children, node.faturamento, currentLabels);
            });
        };

        flatten(tree, grandTotalFaturamento);
        
        let filteredList = flatList;
        if (searchTerm) {
            filteredList = flatList.filter(item => item.label.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        return {
            items: filteredList,
            totals: { faturamento: grandTotalFaturamento, quantidade: grandTotalQuantidade, skus: grandTotalSkuSet.size }
        };
    }, [selectedYear, selectedMonths, filterReps, filterCanais, filterGrupos, filterClients, rowDimensions, searchTerm, isAdmin, topLimit]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    const FilterDropdown = ({ id, label, icon: Icon, options, selected, onToggle, onClear, isSimple = false, disabled = false }: any) => (
        <div className={`relative group/filter flex items-center gap-1 ${disabled ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}>
            <button 
                type="button"
                disabled={disabled}
                onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-tight shadow-sm min-w-[140px] justify-between ${
                    (isSimple ? selected !== 'all' : selected.length > 0) 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
                <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${(isSimple ? selected !== 'all' : selected.length > 0) ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate max-w-[110px]">
                        {id === 'top' 
                          ? (selected === 'all' ? label : `Top ${selected} Clts`)
                          : (selected.length > 0 ? `${selected.length} Sel.` : label)
                        }
                    </span>
                </div>
                <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === id ? 'rotate-180' : ''}`} />
            </button>
            
            {!disabled && (
                <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onClear(); }}
                    className={`p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm ${
                        (isSimple ? selected === 'all' : selected.length === 0) ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    disabled={(isSimple ? selected === 'all' : selected.length === 0)}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}

            {activeDropdown === id && !disabled && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[300] overflow-hidden animate-slideUp">
                    <div className="p-3 bg-slate-50 border-b border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                    </div>
                    <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar scroll-smooth" ref={listContainerRef}>
                        {options.map((opt: any) => {
                            const val = typeof opt === 'object' ? (opt.id || opt.nome) : opt;
                            const optLabel = typeof opt === 'object' ? (opt.nome || opt.label || opt.nome_fantasia) : opt;
                            const isSelected = isSimple ? selected === val : selected.includes(val);
                            
                            return (
                                <button 
                                    key={val} 
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); onToggle(val); }} 
                                    className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold uppercase flex items-center justify-between transition-colors ${isSelected ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}
                                >
                                    <span className="truncate pr-2">{optLabel}</span>
                                    {isSelected ? <CheckSquare className="w-3.5 h-3.5 shrink-0" /> : <Square className="w-3.5 h-3.5 opacity-20 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-32" ref={dropdownRef}>
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-xl"><Layers className="w-6 h-6" /></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Construtor de BI</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1.5 tracking-[0.2em]">Engenharia de Dados Comercial</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={resetAllFilters} className="h-10 px-6 rounded-xl text-[10px] font-black border border-red-100 text-red-500 hover:bg-red-50 transition-all uppercase flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Resetar Consulta</button>
                    <div className="w-px h-10 bg-slate-100 mx-2"></div>
                    <Button onClick={() => setIsExporting('excel')} className="h-10 px-6 rounded-xl text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 uppercase shadow-none"><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6 relative">
                <div className="flex flex-wrap items-center gap-8 pb-5 border-b border-slate-100">
                    <div className="flex items-center gap-3"><CalendarDays className="w-4 h-4 text-blue-600" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ano e Meses</span></div>
                    <div className="flex gap-3" ref={monthDropdownRef}>
                        <div className="relative" ref={yearDropdownRef}>
                            <button onClick={() => setShowYearDropdown(!showYearDropdown)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-3 min-w-[120px] justify-between">
                                <span>ANO {selectedYear}</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            {showYearDropdown && (
                                <div className="absolute top-full left-0 mt-2 w-32 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[250] overflow-hidden">
                                    {years.map(y => (
                                        <button key={y} onClick={() => { setSelectedYear(y); setShowYearDropdown(false); }} className={`w-full text-left px-4 py-2 text-[10px] font-bold uppercase transition-colors ${selectedYear === y ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}>{y}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <button onClick={() => { setTempSelectedMonths([...selectedMonths]); setShowMonthDropdown(!showMonthDropdown); }} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-3 min-w-[180px] justify-between">
                                <span>{selectedMonths.length === 12 ? 'ANO COMPLETO' : selectedMonths.length === 1 ? monthNames[selectedMonths[0]-1].toUpperCase() : `${selectedMonths.length} MESES`}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            {showMonthDropdown && (
                                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[250] overflow-hidden">
                                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between gap-2">
                                        <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[9px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg">Marcar Todos</button>
                                        <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[9px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg">Limpar</button>
                                    </div>
                                    <div className="p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                        {monthNames.map((m, i) => (
                                            <button key={i} onClick={() => { const val = i+1; setTempSelectedMonths(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]); }} className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i+1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
                                                {tempSelectedMonths.includes(i+1) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-20" />}
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 bg-slate-50 border-t border-slate-100">
                                        <button onClick={() => { setSelectedMonths([...tempSelectedMonths]); setShowMonthDropdown(false); }} className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100">Aplicar Período</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-start gap-10">
                    <div className="flex flex-col gap-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">1. Camadas da Tabela</span>
                        <FilterDropdown 
                            id="dims" label="Escolher Níveis" icon={Layers} 
                            options={[
                                ...(isAdmin ? [{ id: 'representante', label: 'Representante' }] : []),
                                { id: 'canal', label: 'Canal de Vendas' },
                                { id: 'grupo', label: 'Grupo Econômico' },
                                { id: 'cliente', label: 'Cliente (Indiv.)' },
                                { id: 'produto', label: 'Produto (SKU)' },
                            ]} 
                            selected={rowDimensions} 
                            onToggle={(val: any) => setRowDimensions(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])} 
                            onClear={() => setRowDimensions([])} 
                        />
                    </div>
                    
                    <div className="w-px h-16 bg-slate-100 hidden md:block"></div>

                    <div className="flex-1 flex flex-col gap-4">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">2. Filtros em Massa (Opcional)</span>
                        
                        <div className="flex flex-wrap gap-4 items-center">
                            {isAdmin && <FilterDropdown id="reps" label="Equipe" icon={User} options={filterOptions.reps} selected={filterReps} onToggle={(val: any) => toggleFilter(filterReps, setFilterReps, val)} onClear={() => setFilterReps([])} />}
                            <FilterDropdown id="canais" label="Canais" icon={Tag} options={filterOptions.canais} selected={filterCanais} onToggle={(val: any) => toggleFilter(filterCanais, setFilterCanais, val)} onClear={() => setFilterCanais([])} />
                            <FilterDropdown id="grupos" label="Grupos" icon={Boxes} options={filterOptions.grupos} selected={filterGrupos} onToggle={(val: any) => toggleFilter(filterGrupos, setFilterGrupos, val)} onClear={() => setFilterGrupos([])} />
                        </div>

                        {/* Filtro Dinâmico de Clientes e Ranking - Exibidos um abaixo do outro se houver representantes */}
                        {filterReps.length > 0 && (
                            <div className="flex flex-col gap-4 pt-4 border-t border-slate-50 animate-fadeIn">
                                <div className="flex flex-col gap-2">
                                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest px-1">Mapeamento de Clientes da Equipe</span>
                                    <FilterDropdown 
                                        id="clients" 
                                        label="Selecionar Clientes Manuais" 
                                        icon={Building2} 
                                        options={filterOptions.clients} 
                                        selected={filterClients} 
                                        onToggle={(val: any) => toggleFilter(filterClients, setFilterClients, val)} 
                                        onClear={() => setFilterClients([])}
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Limitar Ranking da Base</span>
                                        {filterClients.length > 0 && (
                                            <span className="flex items-center gap-1 text-[7px] font-black text-amber-500 uppercase bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                                <AlertCircle className="w-2.5 h-2.5" /> Desativado (Clientes selecionados manualmente)
                                            </span>
                                        )}
                                    </div>
                                    <FilterDropdown 
                                        id="top" 
                                        label="Top Ranking (Sugerido)" 
                                        icon={Hash} 
                                        isSimple={true}
                                        disabled={filterClients.length > 0}
                                        options={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, { id: 'all', label: 'Ver Tudo' }]} 
                                        selected={topLimit} 
                                        onToggle={(val: any) => setTopLimit(val)} 
                                        onClear={() => setTopLimit('all')} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative flex-1 w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Filtrar nesta visualização..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                    </div>
                    <div className="flex items-center gap-4 bg-white p-1.5 rounded-xl border border-slate-200">
                        <button onClick={() => setDisplayMode('value')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${displayMode === 'value' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Visualizar em Reais</button>
                        <button onClick={() => setDisplayMode('percent')} className={`px-5 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${displayMode === 'percent' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Visualizar em %</button>
                    </div>
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                            <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                <th className="px-8 py-5">Destrinchamento Hierárquico</th>
                                <th className="px-6 py-5 text-right">Faturamento</th>
                                <th className="px-6 py-5 text-center">Mix SKU</th>
                                <th className="px-6 py-5 text-center">Volume (Un)</th>
                                <th className="px-8 py-5 text-right">Part. no Pai (%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {processedBI.items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-40 text-center text-slate-300">
                                        <BarChart4 className="w-20 h-20 mx-auto opacity-10 mb-4" />
                                        <p className="text-[11px] font-black uppercase tracking-[0.4em]">
                                            {rowDimensions.length === 0 ? "Defina os níveis de análise para processar" : "Sem dados para o período selecionado"}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                processedBI.items.map((row, idx) => {
                                    const isRoot = row.level === 0;
                                    const paddingLeft = row.level * 32 + 32;
                                    const barColor = row.level === 0 ? 'bg-blue-600' : row.level === 1 ? 'bg-indigo-500' : 'bg-purple-500';

                                    return (
                                        <tr key={idx} className={`group transition-colors ${isRoot ? 'bg-slate-50/50' : 'hover:bg-slate-50/80'}`}>
                                            <td className="px-8 py-4" style={{ paddingLeft: `${paddingLeft}px` }}>
                                                <div className="flex items-center gap-3">
                                                    {isRoot ? <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div> : <ChevronRight className="w-3 h-3 text-slate-300" />}
                                                    <span className={`text-[11px] font-black uppercase tracking-tight ${isRoot ? 'text-slate-900' : 'text-slate-600'}`}>{row.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums">
                                                {displayMode === 'value' ? (
                                                    <span className={`text-xs font-black ${isRoot ? 'text-slate-900' : 'text-slate-600'}`}>{formatBRL(row.faturamento)}</span>
                                                ) : (
                                                    <span className="text-xs font-black text-blue-600">{row.participation.toFixed(2)}%</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center tabular-nums text-xs font-black text-slate-900">
                                                {row.skusCount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center tabular-nums text-xs font-bold text-slate-500">
                                                {row.quantidade.toLocaleString()}
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <span className="text-[10px] font-black text-slate-400 tabular-nums">{row.participation.toFixed(1)}%</span>
                                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${barColor}`} style={{ width: `${Math.min(row.participation, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {processedBI.items.length > 0 && (
                    <div className="p-8 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-10 px-12 border-t-4 border-blue-600 shadow-2xl">
                        <div>
                            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-400 block mb-1.5">Massa de Dados Processada</span>
                            <p className="text-xs font-bold text-slate-400">{selectedMonths.length === 12 ? 'ANO COMPLETO' : `${selectedMonths.length} Meses`} • {selectedYear}</p>
                        </div>
                        <div className="flex items-center gap-16">
                            <div className="text-right">
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Mix (Skus)</p>
                                <p className="text-2xl font-black tabular-nums">{processedBI.totals.skus.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Volume (Un)</p>
                                <p className="text-2xl font-black tabular-nums">{processedBI.totals.quantidade.toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Receita Bruta</p>
                                <p className="text-3xl font-black text-blue-400 tabular-nums">{formatBRL(processedBI.totals.faturamento)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
