import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, FileSpreadsheet, Search, Layers, CheckSquare, Square, ChevronDown, Trash2, RotateCcw, CalendarDays, Loader2, User, Tag, Boxes, Building2, Package } from 'lucide-react';
import { totalDataStore } from '../../lib/dataStore';
import * as XLSX from 'xlsx';
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
    clientSet: Set<string>;
    lastSaleDate: string;
    purchaseCount: number;
    purchaseDates: Set<string>;
    children?: Map<string, GroupData>;
}

interface FilterOption {
    id?: string;
    nome?: string;
    label?: string;
    nome_fantasia?: string;
}

interface FilterDropdownProps {
    id: string;
    label: string;
    icon: React.ElementType;
    options: (string | FilterOption)[];
    selected: string | string[];
    onToggle: (val: string) => void;
    onClear: () => void;
    onSelectAll?: (allIds: string[]) => void;
    isSimple?: boolean;
    disabled?: boolean;
    openUp?: boolean;
    activeDropdown: string | null;
    setActiveDropdown: (id: string | null) => void;
}

// Componente extraído para suportar estado de busca local sem perder foco
const FilterDropdown = ({ id, label, icon: Icon, options, selected, onToggle, onClear, onSelectAll, isSimple = false, disabled = false, openUp = false, activeDropdown, setActiveDropdown }: FilterDropdownProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const listContainerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter((opt) => {
            const val = typeof opt === 'object' ? (opt.nome || opt.label || opt.nome_fantasia) : opt;
            return String(val).toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [options, searchTerm]);

    return (
        <div className={`relative group/filter flex items-center gap-1 ${disabled ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}>
            <button 
                type="button"
                disabled={disabled}
                onClick={() => {
                    const next = activeDropdown === id ? null : id;
                    if (next === id) setSearchTerm('');
                    setActiveDropdown(next);
                }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-tight shadow-sm min-w-[140px] justify-between ${
                    (isSimple ? selected !== 'all' : (selected as string[]).length > 0) 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
            >
                <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${(isSimple ? selected !== 'all' : (selected as string[]).length > 0) ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate max-w-[110px]">
                        {id === 'top' 
                          ? (selected === 'all' ? label : `Top ${selected} Clts`)
                          : ((selected as string[]).length > 0 ? `${(selected as string[]).length} Sel.` : label)
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
                        (isSimple ? selected === 'all' : (selected as string[]).length === 0) ? 'opacity-30 cursor-not-allowed' : ''
                    }`}
                    disabled={(isSimple ? selected === 'all' : (selected as string[]).length === 0)}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            )}

            {activeDropdown === id && !disabled && (
                <div className={`absolute ${openUp ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[300] overflow-hidden animate-slideUp`}>
                    <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                            {!isSimple && onSelectAll && (
                                <div className="flex gap-2">
                                    <button 
                                        onClick={(e) => { e.preventDefault(); onSelectAll(filteredOptions.map((o) => typeof o === 'object' ? (o.id || o.nome || '') : o)); }}
                                        className="text-[9px] font-black text-blue-600 hover:underline"
                                    >
                                        Todos
                                    </button>
                                    <button 
                                        onClick={(e) => { e.preventDefault(); onClear(); }}
                                        className="text-[9px] font-black text-red-500 hover:underline"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            )}
                        </div>
                        {/* Campo de Busca */}
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input 
                                autoFocus
                                type="text" 
                                placeholder="Buscar..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full pl-7 pr-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
                            />
                        </div>
                    </div>
                    <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar scroll-smooth" ref={listContainerRef}>
                        {filteredOptions.length === 0 ? (
                            <div className="text-center py-4 text-[10px] text-slate-400 font-bold uppercase">Nenhum resultado</div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const val = typeof opt === 'object' ? (opt.id || opt.nome || '') : opt;
                                const optLabel = typeof opt === 'object' ? (opt.nome || opt.label || opt.nome_fantasia) : opt;
                                const isSelected = isSimple ? selected === val : (selected as string[]).includes(val);
                                
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
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

interface ManagerDetailedAnalysisScreenProps {
    updateTrigger?: number;
}

export const ManagerDetailedAnalysisScreen: React.FC<ManagerDetailedAnalysisScreenProps> = ({ updateTrigger = 0 }) => {
    const now = new Date();
    const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
    const userRole = session.role as 'admin' | 'rep';
    const isAdmin = userRole === 'admin';
    
    const getSavedState = () => {
        const saved = sessionStorage.getItem('pcn_bi_builder_state');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error("Error parsing saved BI state", e);
            }
        }
        return {
            selectedYear: now.getFullYear(),
            selectedMonths: [now.getMonth() + 1],
            rowDimensions: [] as Dimension[],
            filterReps: [] as string[],
            filterCanais: [] as string[],
            filterGrupos: [] as string[],
            filterClients: [] as string[],
            filterProducts: [] as string[],
            displayMode: 'value' as 'value' | 'percent',
            searchTerm: '',
            topLimit: 'all' as number | 'all',
            isAdvancedAnalysis: false,
            topBottomFilter: 'none' as 'none' | 'top' | 'bottom',
            topBottomLimit: 10
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
    const [filterProducts, setFilterProducts] = useState<string[]>(initialState.filterProducts || []);
    const [topLimit, setTopLimit] = useState<number | 'all'>(initialState.topLimit);
    
    const [isAdvancedAnalysis, setIsAdvancedAnalysis] = useState<boolean>(initialState.isAdvancedAnalysis || false);
    const [isProcessingAdvanced, setIsProcessingAdvanced] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [topBottomFilter, setTopBottomFilter] = useState<'none' | 'top' | 'bottom'>(initialState.topBottomFilter || 'none');
    const [topBottomLimit, setTopBottomLimit] = useState<number>(initialState.topBottomLimit || 10);

    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    const [rowDimensions, setRowDimensions] = useState<Dimension[]>(initialState.rowDimensions);
    const [displayMode, setDisplayMode] = useState<'value' | 'percent'>(initialState.displayMode);
    const [searchTerm, setSearchTerm] = useState(initialState.searchTerm);
    const [isExporting, setIsExporting] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const monthDropdownRef = useRef<HTMLDivElement>(null);
    const yearDropdownRef = useRef<HTMLDivElement>(null);

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const years = [2024, 2025, 2026, 2027];

    const processedBI = useMemo(() => {
        void updateTrigger;
        const vendasProdutosMes = totalDataStore.vendasProdutosMes;
        if (rowDimensions.length === 0) return { items: [], totals: { faturamento: 0, quantidade: 0, skus: 0, entities: 0, clients: 0 } };

        const usersMap = new Map<string, string>(totalDataStore.users.map(u => [u.id, u.nome]));
        const clientLookup = new Map<string, string>();
        
        totalDataStore.clients.forEach(c => {
            const clean = String(c.cnpj || '').replace(/\D/g, '');
            clientLookup.set(clean, c.nome_fantasia);
        });

        const canalLookup = new Map<string, string>();
        totalDataStore.vendasCanaisMes.forEach(c => {
            const cleanCnpj = String(c.cnpj || '').replace(/\D/g, '');
            canalLookup.set(`${cleanCnpj}_${c.ano}_${c.mes}`, c.canal_vendas);
        });

        // Prepara Set de CNPJs permitidos se houver filtro de clientes
        const allowedClientCnpjs = new Set<string>();
        if (filterClients.length > 0) {
            totalDataStore.clients.forEach(c => {
                if (filterClients.includes(c.id)) {
                    allowedClientCnpjs.add(String(c.cnpj || '').replace(/\D/g, ''));
                }
            });
        }

        const filteredSales = vendasProdutosMes.filter(s => {
            const m = s.mes;
            const y = s.ano;
            const matchTime = y === selectedYear && selectedMonths.includes(m);
            if (!matchTime) return false;

            if (isAdmin && filterReps.length > 0 && !filterReps.includes(s.usuario_id)) return false;
            
            const saleCnpj = String(s.cnpj || '').replace(/\D/g, '');
            const canal_vendas = canalLookup.get(`${saleCnpj}_${y}_${m}`) || 'GERAL / OUTROS';
            
            if (filterCanais.length > 0 && (!canal_vendas || !filterCanais.includes(canal_vendas))) return false;
            if (filterGrupos.length > 0 && (!s.grupo || !filterGrupos.includes(s.grupo))) return false;
            
            // Filtro de Cliente aplicado aqui
            if (filterClients.length > 0) {
                if (!allowedClientCnpjs.has(saleCnpj)) return false;
            }

            // Filtro de Produtos (NOVO) - Aplica sobre o TOTAL e sobre os ITENS
            if (filterProducts.length > 0) {
                const pKey = s.codigo_produto || s.produto;
                if (!filterProducts.includes(pKey)) return false;
            }
            
            return true;
        });

        const tree = new Map<string, GroupData>();

        filteredSales.forEach(sale => {
            const fat = Number(sale.faturamento_total) || 0;
            const qtd = Number(sale.qtde_total) || 0;
            const skuId = sale.codigo_produto || sale.produto || 'N/I';
            const saleDate = `${sale.ano}-${String(sale.mes).padStart(2, '0')}-01`; // Use month start as proxy
            const cnpjClean = String(sale.cnpj || '').replace(/\D/g, '');
            const canal_vendas = canalLookup.get(`${cnpjClean}_${sale.ano}_${sale.mes}`) || 'GERAL / OUTROS';
            
            let currentLevel = tree;
            rowDimensions.forEach((dim, idx) => {
                let key = 'N/I';
                if (dim === 'representante') key = usersMap.get(sale.usuario_id) || 'N/I';
                else if (dim === 'canal') key = canal_vendas;
                else if (dim === 'grupo') key = sale.grupo || 'SEM GRUPO';
                else if (dim === 'cliente') {
                    const name = clientLookup.get(cnpjClean) || sale.cliente_nome;
                    key = (name || `CNPJ: ${sale.cnpj}`).trim().toUpperCase();
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
                        clientSet: new Set(),
                        lastSaleDate: '0000-00-00',
                        purchaseCount: 0,
                        purchaseDates: new Set(),
                        children: idx < rowDimensions.length - 1 ? new Map() : undefined
                    });
                }

                const node = currentLevel.get(key)!;
                node.faturamento += fat;
                node.quantidade += qtd;
                node.pedidos += 1;
                node.skuSet.add(skuId);
                node.clientSet.add(cnpjClean);
                node.purchaseCount += 1;
                node.purchaseDates.add(saleDate);
                if (saleDate > node.lastSaleDate) node.lastSaleDate = saleDate;

                if (node.children) {
                    currentLevel = node.children;
                }
            });
        });

        interface FlatItem extends GroupData {
            hierarchyLabels: string[];
            skusCount: number;
            participation: number;
        }

        const flatList: FlatItem[] = [];

        // Pass 1: Apply truncation and propagate totals upwards
        const pruneAndPropagate = (nodes: Map<string, GroupData>, level: number) => {
            const currentDimension = rowDimensions[level];
            let sortedNodes = Array.from(nodes.values()).sort((a, b) => b.faturamento - a.faturamento);

            if (currentDimension === 'produto' && topBottomFilter !== 'none') {
                if (topBottomFilter === 'top') {
                    sortedNodes = sortedNodes.slice(0, topBottomLimit);
                } else if (topBottomFilter === 'bottom') {
                    sortedNodes = Array.from(nodes.values())
                        .sort((a, b) => a.faturamento - b.faturamento)
                        .slice(0, topBottomLimit)
                        .sort((a, b) => b.faturamento - a.faturamento);
                }
                nodes.clear();
                sortedNodes.forEach(n => nodes.set(n.label, n));
            }

            let levelFat = 0;
            let levelQty = 0;
            const levelSkus = new Set<string>();
            const levelClients = new Set<string>();

            nodes.forEach(node => {
                if (node.children) {
                    const totals = pruneAndPropagate(node.children, level + 1);
                    node.faturamento = totals.faturamento;
                    node.quantidade = totals.quantidade;
                    node.skuSet = totals.skus;
                    node.clientSet = totals.clients;
                }
                levelFat += node.faturamento;
                levelQty += node.quantidade;
                node.skuSet.forEach(s => levelSkus.add(s));
                node.clientSet.forEach(c => levelClients.add(c));
            });

            return { faturamento: levelFat, quantidade: levelQty, skus: levelSkus, clients: levelClients };
        };

        pruneAndPropagate(tree, 0);

        // Pass 2: Flatten
        const flatten = (nodes: Map<string, GroupData>, parentLabels: string[] = []) => {
            const levelTotal = Array.from(nodes.values()).reduce((acc, n) => acc + n.faturamento, 0);
            const sortedNodes = Array.from(nodes.values()).sort((a, b) => b.faturamento - a.faturamento);

            sortedNodes.forEach(node => {
                const currentLabels = [...parentLabels, node.label];
                flatList.push({
                    ...node,
                    hierarchyLabels: currentLabels,
                    skusCount: node.skuSet.size,
                    participation: levelTotal > 0 ? (node.faturamento / levelTotal) * 100 : 100
                });
                if (node.children) flatten(node.children, currentLabels);
            });
        };

        flatten(tree);
        
        let filteredList = flatList;
        if (searchTerm) {
            filteredList = flatList.filter(item => item.label.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        // Calculate final totals from filteredList to reflect all filters and search
        const finalTotals = {
            faturamento: 0,
            quantidade: 0,
            skus: new Set<string>(),
            clients: new Set<string>(),
            entities: 0
        };

        const visiblePaths = new Set(filteredList.map(item => item.hierarchyLabels.join('|')));
        
        filteredList.forEach(item => {
            const parentPath = item.hierarchyLabels.slice(0, -1).join('|');
            const hasParentVisible = parentPath !== '' && visiblePaths.has(parentPath);
            
            if (!hasParentVisible) {
                finalTotals.faturamento += item.faturamento;
                finalTotals.quantidade += item.quantidade;
                item.skuSet.forEach(s => finalTotals.skus.add(s));
                item.clientSet.forEach(c => finalTotals.clients.add(c));
                if (item.level === 0) finalTotals.entities++;
            }
        });

        return {
            items: filteredList,
            totals: { 
                faturamento: finalTotals.faturamento, 
                quantidade: finalTotals.quantidade, 
                skus: finalTotals.skus.size,
                entities: finalTotals.entities,
                clients: finalTotals.clients.size
            }
        };
    }, [selectedYear, selectedMonths, filterReps, filterCanais, filterGrupos, filterClients, filterProducts, rowDimensions, searchTerm, isAdmin, topBottomFilter, topBottomLimit, updateTrigger]);

    useEffect(() => {
        const stateToSave = {
            selectedYear,
            selectedMonths,
            rowDimensions,
            filterReps,
            filterCanais,
            filterGrupos,
            filterClients,
            filterProducts,
            displayMode,
            searchTerm,
            topLimit,
            isAdvancedAnalysis,
            topBottomFilter,
            topBottomLimit
        };
        sessionStorage.setItem('pcn_bi_builder_state', JSON.stringify(stateToSave));
    }, [selectedYear, selectedMonths, rowDimensions, filterReps, filterCanais, filterGrupos, filterClients, filterProducts, displayMode, searchTerm, topLimit, isAdvancedAnalysis, topBottomFilter, topBottomLimit]);

    useEffect(() => {
        if (!rowDimensions.includes('produto')) {
            setTopBottomFilter('none');
            setIsAdvancedAnalysis(false);
        }
    }, [rowDimensions]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isProcessingAdvanced) {
            setLoadingProgress(0);
            const startTime = Date.now();
            const duration = 5000; // 5 segundos fixos

            interval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min((elapsed / duration) * 100, 100);
                setLoadingProgress(progress);

                if (progress >= 100) {
                    clearInterval(interval);
                    setIsProcessingAdvanced(false);
                }
            }, 30);
        }
        return () => clearInterval(interval);
    }, [isProcessingAdvanced]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setActiveDropdown(null);
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) setShowMonthDropdown(false);
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) setShowYearDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const resetAllFilters = () => {
        if (!confirm('Deseja zerar todos os filtros e camadas desta consulta?')) return;
        setFilterReps([]);
        setFilterCanais([]);
        setFilterGrupos([]);
        setFilterClients([]);
        setFilterProducts([]);
        setRowDimensions([]);
        setTopLimit('all');
        setSearchTerm('');
        setSelectedMonths([now.getMonth() + 1]);
        sessionStorage.removeItem('pcn_bi_builder_state');
    };

    const filterOptions = useMemo(() => {
        const vendasCanaisMes = totalDataStore.vendasCanaisMes;
        const vendasProdutosMes = totalDataStore.vendasProdutosMes;
        const clients = totalDataStore.clients;
        const canais = new Set<string>();
        const grupos = new Set<string>();
        const productMap = new Map();
        
        vendasCanaisMes.forEach(s => {
            if (s.canal_vendas) canais.add(s.canal_vendas);
        });
        
        vendasProdutosMes.forEach(s => {
            if (s.grupo) grupos.add(s.grupo);
            
            // Build Product List
            const pKey = s.codigo_produto || s.produto;
            if (pKey && !productMap.has(pKey)) {
                productMap.set(pKey, { id: pKey, nome: s.produto || 'Sem Descrição' });
            }
        });

        // Prepara Set de CNPJs permitidos se houver filtro de clientes
        const dynamicClients = (!isAdmin || filterReps.length > 0)
            ? clients.filter(c => isAdmin ? filterReps.includes(c.usuario_id) : true)
            : [];

        return {
            reps: totalDataStore.users.sort((a, b) => a.nome.localeCompare(b.nome)),
            canais: Array.from(canais).sort(),
            grupos: Array.from(grupos).sort(),
            clients: dynamicClients.sort((a, b) => a.nome_fantasia.localeCompare(b.nome_fantasia)),
            products: Array.from(productMap.values()).sort((a, b) => a.nome.localeCompare(b.nome))
        };
    }, [filterReps, isAdmin]);

    const toggleFilter = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        setList(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    const handleExportExcel = () => {
        if (!processedBI.items || processedBI.items.length === 0) {
            alert('Não há dados para exportar.');
            return;
        }

        setIsExporting(true);
        try {
            if (!XLSX || !XLSX.utils) {
                throw new Error("Biblioteca XLSX não carregada corretamente.");
            }

            const leafLevel = rowDimensions.length - 1;
            const exportItems = processedBI.items.filter(item => item.level === leafLevel);

            if (exportItems.length === 0) {
                alert('Selecione camadas antes de exportar.');
                setIsExporting(false);
                return;
            }

            const monthsStr = selectedMonths.length === 12 ? 'ANO COMPLETO' : selectedMonths.map(m => monthNames[m-1]).join(', ');
            const filterLabel = `RELATÓRIO BI CENTRO-NORTE | PERÍODO: ${monthsStr} ${selectedYear} | CAMADAS: ${rowDimensions.map(d => d.toUpperCase()).join(' > ')}`;

            const headers = [
                "ESTRUTURA COMPLETA",
                "ITEM FINAL ANALISADO",
                "FATURAMENTO (R$)",
                "MIX SKU",
                "VOLUME (UN)",
                ...(isAdvancedAnalysis ? ["RECOMPRA", "ÚLTIMA VENDA"] : []),
                "PART. NO TOTAL (%)"
            ];

            const dataMatrix = [
                [filterLabel],
                headers,
                ...exportItems.map(item => [
                    item.hierarchyLabels.join(' > '),
                    item.label,
                    item.faturamento,
                    item.skusCount,
                    item.quantidade,
                    ...(isAdvancedAnalysis ? [
                        item.purchaseDates.size,
                        item.lastSaleDate !== '0000-00-00' ? new Date(item.lastSaleDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'
                    ] : []),
                    (item.participation / 100)
                ])
            ];

            const ws = XLSX.utils.aoa_to_sheet(dataMatrix);

            if (ws['A1']) {
                (ws['A1'] as { s?: unknown }).s = {
                    font: { bold: true, color: { rgb: "1E40AF" }, sz: 14 },
                    alignment: { horizontal: "left", vertical: "center" }
                };
            }

            const headerCols = isAdvancedAnalysis ? ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] : ['A', 'B', 'C', 'D', 'E', 'F'];
            headerCols.forEach(col => {
                const cellRef = `${col}2`;
                if (ws[cellRef]) {
                    (ws[cellRef] as { s?: unknown }).s = {
                        font: { bold: true, color: { rgb: "000000" }, sz: 11 },
                        fill: { fgColor: { rgb: "F1F5F9" } },
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            bottom: { style: "medium", color: { rgb: "000000" } },
                            top: { style: "thin", color: { rgb: "CBD5E1" } }
                        }
                    };
                }
            });

            const range = XLSX.utils.decode_range(ws['!ref']!);
            for (let R = 2; R <= range.e.r; ++R) {
                // Faturamento (C)
                const cellC = ws[XLSX.utils.encode_cell({r: R, c: 2})];
                if (cellC) {
                    cellC.t = 'n';
                    cellC.z = '"R$" #,##0.00';
                    (cellC as { s?: unknown }).s = { alignment: { horizontal: "right" } };
                }
                // MIX SKU (D)
                const cellD = ws[XLSX.utils.encode_cell({r: R, c: 3})];
                if (cellD) {
                    cellD.t = 'n';
                    cellD.z = '#,##0';
                    (cellD as { s?: unknown }).s = { alignment: { horizontal: "center" } };
                }
                // Volume (E)
                const cellE = ws[XLSX.utils.encode_cell({r: R, c: 4})];
                if (cellE) {
                    cellE.t = 'n';
                    cellE.z = '#,##0';
                    (cellE as { s?: unknown }).s = { alignment: { horizontal: "center" } };
                }

                if (isAdvancedAnalysis) {
                    // Recompra (F)
                    const cellF = ws[XLSX.utils.encode_cell({r: R, c: 5})];
                    if (cellF) {
                        cellF.t = 'n';
                        cellF.z = '#,##0';
                        (cellF as { s?: unknown }).s = { alignment: { horizontal: "center" } };
                    }
                    // Última Venda (G)
                    const cellG = ws[XLSX.utils.encode_cell({r: R, c: 6})];
                    if (cellG) {
                        (cellG as { s?: unknown }).s = { alignment: { horizontal: "center" } };
                    }
                    // Partic (H)
                    const cellH = ws[XLSX.utils.encode_cell({r: R, c: 7})];
                    if (cellH) {
                        cellH.t = 'n';
                        cellH.z = '0.00%';
                        (cellH as { s?: unknown }).s = { alignment: { horizontal: "right" } };
                    }
                } else {
                    // Partic (F)
                    const cellF = ws[XLSX.utils.encode_cell({r: R, c: 5})];
                    if (cellF) {
                        cellF.t = 'n';
                        cellF.z = '0.00%';
                        (cellF as { s?: unknown }).s = { alignment: { horizontal: "right" } };
                    }
                }
            }

            ws['!cols'] = isAdvancedAnalysis 
                ? [ { wch: 65 }, { wch: 45 }, { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 20 } ]
                : [ { wch: 65 }, { wch: 45 }, { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 20 } ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "BI_CENTRONORTE");
            XLSX.writeFile(wb, `BI_CENTRONORTE_${new Date().getTime()}.xlsx`);
        } catch (e: unknown) {
            console.error('Erro Exportação Excel:', e);
            alert('Falha ao processar arquivo Excel. Tente recarregar a página.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-4 md:space-y-6 animate-fadeIn pb-32" ref={dropdownRef}>
            
            <div className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-2.5 md:p-3.5 bg-blue-600 text-white rounded-2xl shadow-xl"><Layers className="w-5 h-5 md:w-6 md:h-6" /></div>
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Construtor de BI</h2>
                        <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest md:tracking-[0.2em]">Inteligência Regional de Vendas</p>
                    </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={resetAllFilters} className="flex-1 md:flex-none h-10 px-4 md:px-6 rounded-xl text-[9px] md:text-[10px] font-black border border-red-100 text-red-500 hover:bg-red-50 transition-all uppercase flex items-center justify-center gap-2">
                        <RotateCcw className="w-3.5 h-3.5" /> 
                        <span className="md:inline">Resetar</span>
                    </button>
                    <Button 
                        onClick={handleExportExcel} 
                        isLoading={isExporting}
                        className="flex-1 md:flex-none h-10 px-4 md:px-6 rounded-xl text-[9px] md:text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 uppercase shadow-none flex items-center justify-center"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5 mr-2" /> 
                        Excel
                    </Button>
                </div>
            </div>

            <div className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-200 shadow-sm space-y-6 relative">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 pb-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <CalendarDays className="w-4 h-4 text-blue-600" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período de Análise</span>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:flex-none" ref={yearDropdownRef}>
                            <button onClick={() => setShowYearDropdown(!showYearDropdown)} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-3 min-w-[100px] justify-between">
                                <span>{selectedYear}</span>
                                <ChevronDown className={`w-3 h-3 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            {showYearDropdown && (
                                <div className="absolute top-full left-0 mt-2 w-32 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[250] overflow-hidden">
                                    {years.map(y => (
                                        <button key={y} onClick={() => { setSelectedYear(y); setShowYearDropdown(false); }} className={`w-full text-left px-4 py-2 text-[10px] font-bold uppercase transition-colors ${selectedYear === y ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}>{y}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative flex-1 md:flex-none" ref={monthDropdownRef}>
                            <button onClick={() => { setTempSelectedMonths([...selectedMonths]); setShowMonthDropdown(!showMonthDropdown); }} className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-3 min-w-[150px] justify-between">
                                <span className="truncate">{selectedMonths.length === 12 ? 'ANO COMPLETO' : selectedMonths.length === 1 ? monthNames[selectedMonths[0]-1].toUpperCase() : `${selectedMonths.length} MESES`}</span>
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            {showMonthDropdown && (
                                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[250] overflow-hidden">
                                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
                                        <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[8px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all">Todos</button>
                                        <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[8px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-all">Limpar</button>
                                    </div>
                                    <div className="p-2 grid grid-cols-2 gap-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {monthNames.map((m, i) => (
                                            <button key={i} onClick={() => { const val = i+1; setTempSelectedMonths(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]); }} className={`flex items-center gap-2 p-2 rounded-xl text-[9px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i+1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
                                                {tempSelectedMonths.includes(i+1) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-20" />}
                                                {m}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 border-t border-slate-100">
                                        <button onClick={() => { setSelectedMonths([...tempSelectedMonths]); setShowMonthDropdown(false); }} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100">Aplicar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-start gap-6 md:gap-10">
                    <div className="flex flex-col gap-3 w-full md:w-auto">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">1. Camadas da Tabela</span>
                        <div className="flex flex-col gap-2">
                            <FilterDropdown 
                                id="dims" label="Escolher Níveis" icon={Layers} 
                                options={[
                                    ...(isAdmin ? [{ id: 'representante', label: 'Representante' }] : []),
                                    { id: 'canal', label: 'Canal de Vendas' },
                                    { id: 'grupo', label: 'Grupo Econômico' },
                                    { id: 'cliente', label: 'Cliente (Nome)' },
                                    { id: 'produto', label: 'Produto (SKU)' },
                                ]} 
                                selected={rowDimensions} 
                                onToggle={(val) => setRowDimensions(prev => prev.includes(val as Dimension) ? prev.filter(v => v !== val) : [...prev, val as Dimension])} 
                                onClear={() => setRowDimensions([])} 
                                activeDropdown={activeDropdown}
                                setActiveDropdown={(id) => setActiveDropdown(id)}
                            />
                            
                            {rowDimensions.includes('produto') && (
                                <div className="space-y-2 animate-fadeIn">
                                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        <select 
                                            value={topBottomFilter} 
                                            onChange={(e) => setTopBottomFilter(e.target.value as 'none' | 'top' | 'bottom')}
                                            className="bg-transparent border-none text-[9px] font-black uppercase text-slate-600 outline-none cursor-pointer"
                                        >
                                            <option value="none">Sem Ranking</option>
                                            <option value="top">Mais Vendidos</option>
                                            <option value="bottom">Menos Vendidos</option>
                                        </select>
                                        {topBottomFilter !== 'none' && (
                                            <input 
                                                type="number" 
                                                value={topBottomLimit} 
                                                onChange={(e) => setTopBottomLimit(Number(e.target.value))}
                                                className="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] font-black text-blue-600 outline-none"
                                            />
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => {
                                            if (!isAdvancedAnalysis) {
                                                setIsProcessingAdvanced(true);
                                                setIsAdvancedAnalysis(true);
                                            } else {
                                                setIsAdvancedAnalysis(false);
                                            }
                                        }}
                                        disabled={isProcessingAdvanced}
                                        className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${isAdvancedAnalysis ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'} ${isProcessingAdvanced ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                        <Layers className={`w-3 h-3 ${isProcessingAdvanced ? 'animate-spin' : ''}`} />
                                        {isProcessingAdvanced ? 'Analisando...' : isAdvancedAnalysis ? 'Análise Avançada Ativa' : 'Ativar Análise Avançada'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="w-px h-16 bg-slate-100 hidden md:block"></div>

                    <div className="flex-1 flex flex-col gap-4 w-full">
                        <div className="flex justify-between items-center px-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">2. Filtros Dinâmicos (Opcional)</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 items-center">
                            {isAdmin && <FilterDropdown id="reps" label="Equipe" icon={User} options={filterOptions.reps} selected={filterReps} onToggle={(val) => toggleFilter(filterReps, setFilterReps, val)} onClear={() => setFilterReps([])} activeDropdown={activeDropdown} setActiveDropdown={(id) => setActiveDropdown(id)} />}
                            <FilterDropdown id="canais" label="Canais" icon={Tag} options={filterOptions.canais} selected={filterCanais} onToggle={(val) => toggleFilter(filterCanais, setFilterCanais, val)} onClear={() => setFilterCanais([])} activeDropdown={activeDropdown} setActiveDropdown={(id) => setActiveDropdown(id)} />
                            <FilterDropdown id="grupos" label="Grupos" icon={Boxes} options={filterOptions.grupos} selected={filterGrupos} onToggle={(val) => toggleFilter(filterGrupos, setFilterGrupos, val)} onClear={() => setFilterGrupos([])} activeDropdown={activeDropdown} setActiveDropdown={(id) => setActiveDropdown(id)} />
                            <FilterDropdown 
                                id="clients" 
                                label="Clientes" 
                                icon={Building2} 
                                disabled={isAdmin && filterReps.length === 0}
                                options={filterOptions.clients} 
                                selected={filterClients} 
                                onToggle={(val) => toggleFilter(filterClients, setFilterClients, val)} 
                                onClear={() => setFilterClients([])}
                                activeDropdown={activeDropdown}
                                setActiveDropdown={(id) => setActiveDropdown(id)}
                            />
                            {/* NOVO FILTRO DE PRODUTOS */}
                            <FilterDropdown 
                                id="products" 
                                label="Produtos" 
                                icon={Package} 
                                options={filterOptions.products} 
                                selected={filterProducts} 
                                onToggle={(val) => toggleFilter(filterProducts, setFilterProducts, val)} 
                                onClear={() => setFilterProducts([])}
                                onSelectAll={(allIds) => setFilterProducts(allIds)}
                                activeDropdown={activeDropdown}
                                setActiveDropdown={(id) => setActiveDropdown(id)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[24px] md:rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                <div className="p-4 md:p-5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative flex-1 w-full max-sm:max-w-none max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Filtrar dados..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                    </div>
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 w-full md:w-auto">
                        <button onClick={() => setDisplayMode('value')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all ${displayMode === 'value' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>Em Reais</button>
                        <button onClick={() => setDisplayMode('percent')} className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-[8px] md:text-[9px] font-black uppercase transition-all ${displayMode === 'percent' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>Em %</button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto relative">
                    {isProcessingAdvanced && createPortal(
                        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                            <div className="bg-white p-8 rounded-[32px] shadow-2xl flex flex-col items-center gap-6 max-w-xs w-full border border-slate-100 animate-slideUp">
                                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                </div>
                                <div className="text-center space-y-2">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Analisando Dados</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                        Processando métricas avançadas e histórico de recompra...
                                    </p>
                                    <div className="text-[10px] font-black text-blue-600">{Math.round(loadingProgress)}%</div>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-600 transition-all duration-75 ease-linear"
                                        style={{ width: `${loadingProgress}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>,
                        document.body
                    )}
                    <div className="hidden md:block overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-sm">
                            <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                <th className="px-8 py-5">Destrinchamento Hierárquico</th>
                                <th className="px-6 py-5 text-right">Faturamento</th>
                                <th className="px-6 py-5 text-center">Mix SKU</th>
                                <th className="px-6 py-5 text-center">Clientes</th>
                                <th className="px-6 py-5 text-center">Volume (Un)</th>
                                {isAdvancedAnalysis && (
                                    <>
                                        <th className="px-6 py-5 text-center">Recompra</th>
                                        <th className="px-6 py-5 text-center">Última Venda</th>
                                    </>
                                )}
                                <th className="px-8 py-5 text-right">Part. no Pai (%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {processedBI.items.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdvancedAnalysis ? 8 : 6} className="px-8 py-40 text-center text-slate-300">
                                        <Layers className="w-20 h-20 mx-auto opacity-10 mb-4" />
                                        <p className="text-[11px] font-black uppercase tracking-[0.4em]">
                                            {rowDimensions.length === 0 ? "Defina os níveis de análise" : "Sem dados"}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                processedBI.items.map((row) => {
                                    const isRoot = row.level === 0;
                                    const paddingLeft = row.level * 32 + 32;
                                    return (
                                        <tr key={row.hierarchyLabels.join('-')} className={`group transition-colors ${isRoot ? 'bg-slate-50/50' : 'hover:bg-slate-50/80'}`}>
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
                                            <td className="px-6 py-4 text-center tabular-nums text-xs font-black text-slate-900">
                                                {(rowDimensions[row.level] === 'representante' || rowDimensions[row.level] === 'canal') 
                                                    ? row.clientSet.size.toLocaleString() 
                                                    : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center tabular-nums text-xs font-bold text-slate-500">
                                                {row.quantidade.toLocaleString()}
                                            </td>
                                            {isAdvancedAnalysis && (
                                                <>
                                                    <td className="px-6 py-4 text-center tabular-nums text-xs font-black text-blue-600">
                                                        {row.purchaseDates.size.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 text-center tabular-nums text-[10px] font-bold text-slate-500">
                                                        {row.lastSaleDate !== '0000-00-00' ? new Date(row.lastSaleDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}
                                                    </td>
                                                </>
                                            )}
                                            <td className="px-8 py-4">
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <span className="text-[10px] font-black text-slate-400 tabular-nums">{row.participation.toFixed(1)}%</span>
                                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full bg-blue-600`} style={{ width: `${Math.min(row.participation, 100)}%` }}></div>
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
                </div>

                {processedBI.items.length > 0 && (
                    <div className="p-6 md:p-8 bg-slate-900 text-white flex flex-col lg:flex-row justify-between items-center gap-6 lg:gap-10 px-8 md:px-12 border-t-4 border-blue-600 shadow-2xl">
                        <div className="text-center lg:text-left w-full lg:w-auto">
                            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.4em] text-blue-400 block mb-1.5">Consolidado da Consulta</span>
                            <p className="text-[10px] md:text-xs font-bold text-slate-400">{selectedMonths.length === 12 ? 'ANO COMPLETO' : `${selectedMonths.length} MESES`} &bull; {selectedYear} &bull; {filterProducts.length > 0 ? `${filterProducts.length} Produtos Filtrados` : 'Todos Produtos'}</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 lg:gap-12 w-full lg:w-auto">
                            <div className="text-center lg:text-right p-2 bg-white/5 rounded-xl lg:bg-transparent">
                                <p className="text-[7px] md:text-[9px] font-black text-slate-500 uppercase mb-1">CLIENTES TOTAIS</p>
                                <p className="text-sm md:text-2xl font-black tabular-nums">{processedBI.totals.clients.toLocaleString()}</p>
                            </div>
                            <div className="text-center lg:text-right p-2 bg-white/5 rounded-xl lg:bg-transparent">
                                <p className="text-[7px] md:text-[9px] font-black text-slate-500 uppercase mb-1">SKUS TOTAIS</p>
                                <p className="text-sm md:text-2xl font-black tabular-nums">{processedBI.totals.skus.toLocaleString()}</p>
                            </div>
                            <div className="text-center lg:text-right p-2 bg-white/5 rounded-xl lg:bg-transparent">
                                <p className="text-[7px] md:text-[9px] font-black text-slate-500 uppercase mb-1">VOLUME</p>
                                <p className="text-sm md:text-2xl font-black tabular-nums">{processedBI.totals.quantidade.toLocaleString()}</p>
                            </div>
                            <div className="text-center lg:text-right p-2 bg-white/5 rounded-xl lg:bg-transparent col-span-2 sm:col-span-1">
                                <p className="text-[7px] md:text-[9px] font-black text-slate-500 uppercase mb-1 text-blue-400">RECEITA TOTAL</p>
                                <p className="text-sm md:text-3xl font-black text-blue-400 tabular-nums">{formatBRL(processedBI.totals.faturamento)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal removed */}
        </div>
    );
};