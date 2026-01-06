
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Table2, Filter, ChevronRight, FileSpreadsheet, Percent, Calculator, Search, User, Boxes, Tag, Package, Building2, BarChart4, Download, Layers, CheckSquare, Square, X, ChevronDown, ListFilter, ArrowRight, Calendar, FileText, Loader2, Trash2, ListChecks, CalendarDays } from 'lucide-react';
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
    
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [showYearDropdown, setShowYearDropdown] = useState(false);

    const [filterReps, setFilterReps] = useState<string[]>([]);
    const [filterCanais, setFilterCanais] = useState<string[]>([]);
    const [filterGrupos, setFilterGrupos] = useState<string[]>([]);
    
    const [activeDropdown, setActiveDropdown] = useState<'dims' | 'reps' | 'canais' | 'grupos' | null>(null);

    const [rowDimensions, setRowDimensions] = useState<Dimension[]>([]);
    const [displayMode, setDisplayMode] = useState<'value' | 'percent'>('value');
    const [searchTerm, setSearchTerm] = useState('');
    const [isExporting, setIsExporting] = useState<'excel' | 'pdf' | null>(null);

    const pdfExportRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const monthDropdownRef = useRef<HTMLDivElement>(null);
    const yearDropdownRef = useRef<HTMLDivElement>(null);

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const years = [2024, 2025, 2026, 2027];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setActiveDropdown(null);
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) setShowMonthDropdown(false);
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) setShowYearDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filterOptions = useMemo(() => {
        const sales = totalDataStore.sales;
        const canais = new Set<string>();
        const grupos = new Set<string>();
        sales.forEach(s => {
            if (s.canal_vendas) canais.add(s.canal_vendas);
            if (s.grupo) grupos.add(s.grupo);
        });
        return {
            reps: totalDataStore.users.sort((a, b) => a.nome.localeCompare(b.nome)),
            canais: Array.from(canais).sort(),
            grupos: Array.from(grupos).sort()
        };
    }, []);

    const toggleFilter = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        setList(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
    };

    const applyMonthFilter = () => {
        setSelectedMonths([...tempSelectedMonths]);
        setShowMonthDropdown(false);
    };

    const processedBI = useMemo(() => {
        let sales = totalDataStore.sales;
        if (rowDimensions.length === 0) return { items: [], totals: { faturamento: 0, quantidade: 0, skus: 0 } };

        const usersMap = new Map(totalDataStore.users.map(u => [u.id, u.nome]));
        const clientNameLookup = new Map();
        totalDataStore.clients.forEach(c => {
            const clean = String(c.cnpj || '').replace(/\D/g, '');
            clientNameLookup.set(clean, c.nome_fantasia);
        });

        sales = sales.filter(s => {
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

        const tree = new Map<string, GroupData>();
        let grandTotalFaturamento = 0;
        let grandTotalQuantidade = 0;
        const grandTotalSkuSet = new Set<string>();

        sales.forEach(sale => {
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
                    const cnpjClean = String(sale.cnpj || '').replace(/\D/g, '');
                    key = (sale.cliente_nome || clientNameLookup.get(cnpjClean) || `CNPJ: ${sale.cnpj}`).trim().toUpperCase();
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
                if (node.children) {
                    flatten(node.children, node.faturamento, currentLabels);
                }
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
    }, [selectedYear, selectedMonths, filterReps, filterCanais, filterGrupos, rowDimensions, searchTerm, isAdmin]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    const handleExportExcel = () => {
        if (processedBI.items.length === 0) return;
        setIsExporting('excel');
        const worksheetData = processedBI.items.map(row => {
            const obj: any = {};
            rowDimensions.forEach((dim, idx) => {
                obj[dim.toUpperCase()] = row.hierarchyLabels[idx] || '';
            });
            obj['FATURAMENTO'] = row.faturamento;
            obj['QTD_SKU'] = row.skusCount;
            obj['VOLUME_UN'] = row.quantidade;
            obj['PART_NO_PAI_PERCENT'] = row.participation.toFixed(2) + '%';
            return obj;
        });
        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "BI_DETALHADO");
        XLSX.writeFile(wb, `BI_Portal_CN_${selectedYear}.xlsx`);
        setIsExporting(null);
    };

    const handleExportPDF = async () => {
        if (processedBI.items.length === 0) return;
        setIsExporting('pdf');
        try {
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pages = pdfExportRef.current?.querySelectorAll('.pdf-bi-page');
            if (!pages) return;
            for (let i = 0; i < pages.length; i++) {
                const canvas = await html2canvas(pages[i] as HTMLElement, { scale: 2 });
                if (i > 0) pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 297, (canvas.height * 297) / canvas.width);
            }
            pdf.save(`BI_Relatorio_CN_${selectedYear}.pdf`);
        } catch (e) { console.error(e); } finally { setIsExporting(null); }
    };

    const FilterDropdown = ({ id, label, icon: Icon, options, selected, onToggle, onClear }: any) => (
        <div className="relative group/filter flex items-center gap-1.5">
            <button 
                onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-tight shadow-sm min-w-[140px] justify-between ${selected.length > 0 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
                <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${selected.length > 0 ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate max-w-[100px]">{selected.length > 0 ? `${selected.length} Sel.` : label}</span>
                </div>
                <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === id ? 'rotate-180' : ''}`} />
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className={`p-2.5 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:border-red-200 transition-all shadow-sm ${selected.length === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                disabled={selected.length === 0}
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>

            {activeDropdown === id && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                    <div className="p-3 bg-slate-50 border-b border-slate-100">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                    </div>
                    <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {options.map((opt: any) => {
                            const val = typeof opt === 'string' ? opt : opt.id || opt.nome;
                            const optLabel = typeof opt === 'string' ? opt : opt.nome || opt.label;
                            const isSelected = selected.includes(val);
                            return (
                                <button key={val} onClick={() => onToggle(val)} className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold uppercase flex items-center justify-between transition-colors ${isSelected ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}>
                                    <span className="truncate">{optLabel}</span>
                                    {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-20" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    const ITEMS_PER_PAGE_PDF = 22;
    const pdfBatches = useMemo(() => {
        const batches = [];
        for (let i = 0; i < processedBI.items.length; i += ITEMS_PER_PAGE_PDF) {
            batches.push(processedBI.items.slice(i, i + ITEMS_PER_PAGE_PDF));
        }
        return batches;
    }, [processedBI.items]);

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
                    <Button onClick={handleExportExcel} isLoading={isExporting === 'excel'} className="h-10 px-6 rounded-xl text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100 uppercase"><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel</Button>
                    <Button onClick={handleExportPDF} isLoading={isExporting === 'pdf'} className="h-10 px-6 rounded-xl text-[10px] font-black bg-slate-900 hover:bg-slate-800 uppercase"><FileText className="w-4 h-4 mr-2" /> PDF</Button>
                </div>
            </div>

            <div className="bg-white p-5 rounded-[32px] border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center gap-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3"><CalendarDays className="w-4 h-4 text-blue-600" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período de Análise</span></div>
                    <div className="flex gap-3" ref={monthDropdownRef}>
                        <div className="relative" ref={yearDropdownRef}>
                            <button onClick={() => setShowYearDropdown(!showYearDropdown)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-3 min-w-[120px] justify-between shadow-inner">
                                <span>ANO {selectedYear}</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            {showYearDropdown && (
                                <div className="absolute top-full left-0 mt-2 w-32 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                                    {years.map(y => (
                                        <button key={y} onClick={() => { setSelectedYear(y); setShowYearDropdown(false); }} className={`w-full text-left px-4 py-2 text-[10px] font-bold uppercase transition-colors ${selectedYear === y ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-500'}`}>{y}</button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <button onClick={() => { setTempSelectedMonths([...selectedMonths]); setShowMonthDropdown(!showMonthDropdown); }} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-3 min-w-[180px] justify-between shadow-inner">
                                <span>{selectedMonths.length === 12 ? 'ANO COMPLETO' : selectedMonths.length === 1 ? monthNames[selectedMonths[0]-1].toUpperCase() : `${selectedMonths.length} MESES`}</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                            </button>
                            {showMonthDropdown && (
                                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between gap-2">
                                        <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[9px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg">Todos</button>
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
                                        <button onClick={applyMonthFilter} className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100">Aplicar Filtro</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Estrutura (Linhas)</span>
                        <FilterDropdown 
                            id="dims" label="Camadas" icon={Layers} 
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
                    <div className="w-px h-10 bg-slate-100 hidden md:block"></div>
                    <div className="flex flex-col gap-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">Filtros de Massa</span>
                        <div className="flex flex-wrap gap-3">
                            {isAdmin && <FilterDropdown id="reps" label="Representantes" icon={User} options={filterOptions.reps} selected={filterReps} onToggle={(val: any) => toggleFilter(filterReps, setFilterReps, val)} onClear={() => setFilterReps([])} />}
                            <FilterDropdown id="canais" label="Canais" icon={Tag} options={filterOptions.canais} selected={filterCanais} onToggle={(val: any) => toggleFilter(filterCanais, setFilterCanais, val)} onClear={() => setFilterCanais([])} />
                            <FilterDropdown id="grupos" label="Grupos" icon={Boxes} options={filterOptions.grupos} selected={filterGrupos} onToggle={(val: any) => toggleFilter(filterGrupos, setFilterGrupos, val)} onClear={() => setFilterGrupos([])} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px] animate-slideUp">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="relative flex-1 w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Filtrar nesta visualização..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                    </div>
                    <div className="flex items-center gap-4 bg-white p-1 rounded-xl border border-slate-200">
                        <button onClick={() => setDisplayMode('value')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${displayMode === 'value' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Em Reais</button>
                        <button onClick={() => setDisplayMode('percent')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${displayMode === 'percent' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Em %</button>
                    </div>
                </div>

                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead className="bg-white sticky top-0 z-20 border-b border-slate-200">
                            <tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                <th className="px-8 py-5">Destrinchamento Hierárquico</th>
                                <th className="px-6 py-5 text-right">Faturamento</th>
                                <th className="px-6 py-5 text-center">Qtd de Sku</th>
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
                                            {rowDimensions.length === 0 ? "Defina as camadas de linhas para processar" : "Sem dados para o período"}
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
                            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-400 block mb-1.5">Massa Selecionada</span>
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

            {/* EXPORT PDF PAGINADO */}
            <div className="fixed top-0 left-[-9999px] w-[1100px]" ref={pdfExportRef}>
                {pdfBatches.map((batch, pageIdx) => (
                    <div key={pageIdx} className="pdf-bi-page bg-white p-12 text-slate-900 min-h-[1550px] flex flex-col">
                        <div className="border-b-4 border-slate-900 pb-8 mb-10 flex justify-between items-end">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.4em] text-blue-600 mb-2">Portal Comercial Centro-Norte</p>
                                <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Relatório de BI Detalhado</h1>
                                <p className="text-lg font-black text-slate-400 mt-2 uppercase">Período: {selectedYear} ({selectedMonths.length} Meses)</p>
                            </div>
                            <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl">CN</div>
                        </div>
                        <div className="flex-1">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-slate-200 bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-[0.2em]">
                                        <th className="py-4 px-3">Hierarquia Selecionada</th>
                                        <th className="py-4 px-3 text-right">Faturamento</th>
                                        <th className="py-4 px-3 text-center">Mix SKU</th>
                                        <th className="py-4 px-3 text-center">Quantidade</th>
                                        <th className="py-4 px-3 text-right">Part % (Pai)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batch.map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-100">
                                            <td className="py-4 px-3" style={{ paddingLeft: `${row.level * 15 + 10}px` }}>
                                                <span className="text-[10px] font-black uppercase text-slate-800">{row.label}</span>
                                            </td>
                                            <td className="py-4 px-3 text-right font-black text-slate-900">{formatBRL(row.faturamento)}</td>
                                            <td className="py-4 px-3 text-center font-black text-slate-900">{row.skusCount}</td>
                                            <td className="py-4 px-3 text-center text-slate-600">{row.quantidade.toLocaleString()}</td>
                                            <td className="py-4 px-3 text-right font-black text-blue-600">{row.participation.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center opacity-40">
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 italic">Página {pageIdx + 1} de {pdfBatches.length}</p>
                            <div className="text-right">
                                <p className="text-[8px] font-black uppercase">Documento interno exclusivo • Grupo Centro-Norte</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
