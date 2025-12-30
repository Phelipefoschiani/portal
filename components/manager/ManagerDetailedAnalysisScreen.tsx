
import React, { useState, useMemo, useRef } from 'react';
import { Table2, Filter, ChevronRight, FileSpreadsheet, Percent, Calculator, Search, User, Boxes, Tag, Package, Building2, BarChart4, Download, Layers, CheckSquare, Square, X, ChevronDown, ListFilter, ArrowRight, Calendar, FileText, Loader2 } from 'lucide-react';
import { totalDataStore } from '../../lib/dataStore';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Button } from '../Button';

type Dimension = 'representante' | 'canal' | 'grupo' | 'cliente' | 'produto';
type Metric = 'faturamento' | 'quantidade' | 'ticketMedio' | 'share';

export const ManagerDetailedAnalysisScreen: React.FC = () => {
    const now = new Date();
    
    // 1. Estados de Filtros de Tempo
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const [showMonthFilter, setShowMonthFilter] = useState(false);

    // 2. Estados de Filtros de Base
    const [filterReps, setFilterReps] = useState<string[]>([]);
    const [filterCanais, setFilterCanais] = useState<string[]>([]);
    const [filterGrupos, setFilterGrupos] = useState<string[]>([]);
    
    // 3. Estados de Estrutura
    const [rowDimensions, setRowDimensions] = useState<Dimension[]>(['representante']);
    const [displayMode, setDisplayMode] = useState<'value' | 'percent'>('value');
    const [searchTerm, setSearchTerm] = useState('');
    const [isExporting, setIsExporting] = useState<'excel' | 'pdf' | null>(null);

    const pdfExportRef = useRef<HTMLDivElement>(null);
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // Dados auxiliares para os filtros
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

    const toggleMonth = (m: number) => {
        setSelectedMonths(prev => prev.includes(m) ? (prev.length > 1 ? prev.filter(x => x !== m) : prev) : [...prev, m]);
    };

    // 4. Processamento do BI
    const reportData = useMemo(() => {
        let sales = totalDataStore.sales;
        const usersMap = new Map(totalDataStore.users.map(u => [u.id, u.nome]));

        // Filtro 1: Tempo (Ano e Meses)
        sales = sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            const m = d.getUTCMonth() + 1;
            const y = d.getUTCFullYear();
            return y === selectedYear && selectedMonths.includes(m);
        });

        // Filtro 2: Seleção Manual
        if (filterReps.length > 0) sales = sales.filter(s => filterReps.includes(s.usuario_id));
        if (filterCanais.length > 0) sales = sales.filter(s => filterCanais.includes(s.canal_vendas));
        if (filterGrupos.length > 0) sales = sales.filter(s => filterGrupos.includes(s.grupo));

        if (rowDimensions.length === 0) return { items: [], totals: { faturamento: 0, quantidade: 0, pedidos: 0 } };

        const grouping = new Map<string, any>();
        let grandTotalFaturamento = 0;
        let grandTotalQuantidade = 0;

        sales.forEach(sale => {
            const keys = rowDimensions.map(dim => {
                if (dim === 'representante') return usersMap.get(sale.usuario_id) || 'N/I';
                if (dim === 'canal') return sale.canal_vendas || 'GERAL';
                if (dim === 'grupo') return sale.grupo || 'SEM GRUPO';
                if (dim === 'cliente') return sale.cliente_nome || 'CLIENTE S/ MAPA';
                if (dim === 'produto') return sale.produto || 'ITEM S/ MAPA';
                return 'OUTROS';
            });

            const groupKey = keys.join(' | ');
            const faturamento = Number(sale.faturamento) || 0;
            const quantidade = Number(sale.qtde_faturado) || 0;
            
            grandTotalFaturamento += faturamento;
            grandTotalQuantidade += quantidade;

            if (!grouping.has(groupKey)) {
                grouping.set(groupKey, { label: groupKey, keys, faturamento: 0, quantidade: 0, pedidos: 0 });
            }

            const current = grouping.get(groupKey);
            current.faturamento += faturamento;
            current.quantidade += quantidade;
            current.pedidos += 1;
        });

        let result = Array.from(grouping.values()).map(item => ({
            ...item,
            ticketMedio: item.pedidos > 0 ? item.faturamento / item.pedidos : 0,
            share: grandTotalFaturamento > 0 ? (item.faturamento / grandTotalFaturamento) * 100 : 0,
            shareQty: grandTotalQuantidade > 0 ? (item.quantidade / grandTotalQuantidade) * 100 : 0
        }));

        if (searchTerm) {
            result = result.filter(r => r.label.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        return {
            items: result.sort((a, b) => b.faturamento - a.faturamento),
            totals: { faturamento: grandTotalFaturamento, quantidade: grandTotalQuantidade }
        };
    }, [selectedYear, selectedMonths, filterReps, filterCanais, filterGrupos, rowDimensions, searchTerm]);

    // 5. Lógica de Exportação
    const handleExportExcel = () => {
        setIsExporting('excel');
        const worksheetData = reportData.items.map(row => {
            const obj: any = {};
            rowDimensions.forEach((dim, idx) => {
                obj[dim.toUpperCase()] = row.keys[idx];
            });
            obj['FATURAMENTO_R$'] = row.faturamento;
            obj['QUANTIDADE_UN'] = row.quantidade;
            obj['TICKET_MEDIO_R$'] = row.ticketMedio;
            obj['SHARE_PERCENT'] = (row.share / 100);
            return obj;
        });

        const ws = XLSX.utils.json_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "BI_Centro_Norte");
        XLSX.writeFile(wb, `BI_CN_Dinamico_${selectedYear}_${new Date().getTime()}.xlsx`);
        setIsExporting(null);
    };

    const handleExportPDF = async () => {
        if (reportData.items.length === 0) return;
        setIsExporting('pdf');
        try {
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pages = pdfExportRef.current?.querySelectorAll('.pdf-bi-page');
            if (!pages) return;

            for (let i = 0; i < pages.length; i++) {
                const canvas = await html2canvas(pages[i] as HTMLElement, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, 297, (canvas.height * 297) / canvas.width);
            }
            pdf.save(`Relatorio_BI_CN_${selectedYear}.pdf`);
        } catch (e) {
            console.error(e);
        } finally {
            setIsExporting(null);
        }
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    // Fragmentação para o PDF (20 itens por página para legibilidade)
    const ITEMS_PER_PAGE = 20;
    const pdfBatches = useMemo(() => {
        const batches = [];
        for (let i = 0; i < reportData.items.length; i += ITEMS_PER_PAGE) {
            batches.push(reportData.items.slice(i, i + ITEMS_PER_PAGE));
        }
        return batches;
    }, [reportData.items]);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-32">
            {/* Header / Filtros Cronológicos */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-xl">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Construtor de BI</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Engenharia de Dados Comercial</p>
                        </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Filtro de Ano */}
                        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2" />
                            {[2024, 2025].map(y => (
                                <button key={y} onClick={() => setSelectedYear(y)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${selectedYear === y ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{y}</button>
                            ))}
                        </div>

                        {/* Filtro de Meses */}
                        <div className="relative">
                            <button onClick={() => setShowMonthFilter(!showMonthFilter)} className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-3 shadow-sm hover:bg-slate-50 min-w-[160px] justify-between">
                                <span>{selectedMonths.length === 12 ? 'Todos os Meses' : `${selectedMonths.length} Meses`}</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMonthFilter ? 'rotate-180' : ''}`} />
                            </button>
                            {showMonthFilter && (
                                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] p-4 grid grid-cols-2 gap-1 animate-slideUp">
                                    <button onClick={() => setSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="col-span-2 mb-2 text-[9px] font-black text-blue-600 uppercase border-b pb-2">Selecionar Todos</button>
                                    {monthNames.map((m, i) => (
                                        <button key={i} onClick={() => toggleMonth(i+1)} className={`text-left px-2 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all ${selectedMonths.includes(i+1) ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="h-8 w-px bg-slate-200 mx-2 hidden lg:block"></div>

                        <div className="flex gap-2">
                            <Button onClick={handleExportExcel} isLoading={isExporting === 'excel'} className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100">
                                <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                            </Button>
                            <Button onClick={handleExportPDF} isLoading={isExporting === 'pdf'} className="h-10 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 hover:bg-slate-800">
                                <FileText className="w-4 h-4 mr-2" /> PDF
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Configurações Laterais */}
                <div className="lg:col-span-3 space-y-6">
                    {/* FILTROS DE ENTIDADE */}
                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ListFilter className="w-4 h-4 text-blue-600" /> 1. Filtrar Entidades
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Representantes</p>
                                <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-xl p-2 space-y-1 custom-scrollbar">
                                    {filterOptions.reps.map(r => (
                                        <button key={r.id} onClick={() => toggleFilter(filterReps, setFilterReps, r.id)} className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center justify-between ${filterReps.includes(r.id) ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}>
                                            <span className="truncate">{r.nome}</span>
                                            {filterReps.includes(r.id) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 opacity-20" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Canais de Venda</p>
                                <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-xl p-2 space-y-1 custom-scrollbar">
                                    {filterOptions.canais.map(c => (
                                        <button key={c} onClick={() => toggleFilter(filterCanais, setFilterCanais, c)} className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center justify-between ${filterCanais.includes(c) ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}>
                                            <span className="truncate">{c}</span>
                                            {filterCanais.includes(c) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 opacity-20" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Grupos</p>
                                <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-xl p-2 space-y-1 custom-scrollbar">
                                    {filterOptions.grupos.map(g => (
                                        <button key={g} onClick={() => toggleFilter(filterGrupos, setFilterGrupos, g)} className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase flex items-center justify-between ${filterGrupos.includes(g) ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}>
                                            <span className="truncate">{g}</span>
                                            {filterGrupos.includes(g) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 opacity-20" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CONFIGURAÇÃO DE LINHAS */}
                    <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Layers className="w-4 h-4 text-purple-600" /> 2. Estrutura Linhas
                        </h3>
                        <div className="space-y-1">
                            {[
                                { id: 'representante', label: 'Representante', icon: User },
                                { id: 'canal', label: 'Canal Vendas', icon: Tag },
                                { id: 'grupo', label: 'Grupo', icon: Boxes },
                                { id: 'cliente', label: 'Cliente', icon: Building2 },
                                { id: 'produto', label: 'Produto', icon: Package },
                            ].map((dim: any) => (
                                <button key={dim.id} onClick={() => setRowDimensions(prev => prev.includes(dim.id) ? prev.filter(d => d !== dim.id) : [...prev, dim.id])} className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${rowDimensions.includes(dim.id) ? 'bg-purple-600 border-purple-600 text-white shadow-lg shadow-purple-100' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-white'}`}>
                                    <div className="flex items-center gap-3">
                                        <dim.icon className={`w-4 h-4 ${rowDimensions.includes(dim.id) ? 'text-white' : 'text-slate-400'}`} />
                                        <span className="text-[10px] font-black uppercase tracking-tight">{dim.label}</span>
                                    </div>
                                    {rowDimensions.includes(dim.id) && <ChevronRight className="w-3 h-3" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900 p-6 rounded-[32px] border border-white/10 shadow-2xl text-white">
                        <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-4">3. Modo de Exibição</h3>
                        <div className="grid grid-cols-2 gap-2 bg-white/5 p-1 rounded-2xl">
                            <button onClick={() => setDisplayMode('value')} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${displayMode === 'value' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Valor</button>
                            <button onClick={() => setDisplayMode('percent')} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${displayMode === 'percent' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>Share %</button>
                        </div>
                    </div>
                </div>

                {/* Tabela de Resultados */}
                <div className="lg:col-span-9 space-y-4">
                    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                             <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" placeholder="Filtrar resultados..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                             </div>
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{reportData.items.length} Agrupamentos</span>
                        </div>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white sticky top-0 z-20 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[300px]">Hierarquia das Linhas</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Faturamento</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Volume (Un)</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Tkt Médio</th>
                                        <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Share</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reportData.items.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-32 text-center text-slate-300"><BarChart4 className="w-16 h-16 mx-auto opacity-10 mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">Aguardando definição de cruzamento.</p></td></tr>
                                    ) : (
                                        reportData.items.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        {row.keys.map((k: string, kIdx: number) => (
                                                            <React.Fragment key={kIdx}>
                                                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${kIdx === row.keys.length - 1 ? 'bg-blue-50 text-blue-600 border-blue-100 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{k}</span>
                                                                {kIdx < row.keys.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                                                            </React.Fragment>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums">
                                                    {displayMode === 'value' ? <span className="text-xs font-black text-slate-900">{formatBRL(row.faturamento)}</span> : <span className="text-xs font-black text-blue-600">{row.share.toFixed(2)}%</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums">
                                                    {displayMode === 'value' ? <span className="text-xs font-bold text-slate-600">{row.quantidade.toLocaleString()}</span> : <span className="text-xs font-bold text-slate-400">{row.shareQty.toFixed(2)}%</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums font-black text-slate-900 text-xs">{formatBRL(row.ticketMedio)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[11px] font-black text-purple-600">{row.share.toFixed(1)}%</span>
                                                        <div className="w-16 h-1 bg-slate-100 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-purple-500" style={{ width: `${Math.min(row.share, 100)}%` }}></div></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        
                        {reportData.items.length > 0 && (
                            <div className="p-8 bg-slate-900 text-white flex flex-col md:flex-row justify-between items-center gap-8 px-12 border-t-4 border-blue-600">
                                <div className="text-center md:text-left">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400 block mb-1">Status Dinâmico</span>
                                    <p className="text-xs font-medium text-slate-400">Ano Base {selectedYear} • {selectedMonths.length} Meses</p>
                                </div>
                                <div className="flex items-center gap-12">
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-500 uppercase mb-1 tracking-widest">Volume Acumulado</p>
                                        <p className="text-2xl font-black">{reportData.totals.quantidade.toLocaleString()} un</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[8px] font-black text-slate-500 uppercase mb-1 tracking-widest">Faturamento Total</p>
                                        <p className="text-3xl font-black text-blue-400">{formatBRL(reportData.totals.faturamento)}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ÁREA OCULTA PARA GERAÇÃO DO PDF PAGINADO */}
            <div className="fixed top-0 left-[-9999px] w-[1100px]" ref={pdfExportRef}>
                {pdfBatches.map((batch, pageIdx) => (
                    <div key={pageIdx} className="pdf-bi-page bg-white p-12 text-slate-900 min-h-[1550px] flex flex-col">
                        <div className="border-b-4 border-slate-900 pb-8 mb-10 flex justify-between items-end">
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.4em] text-blue-600 mb-2">Auditoria de Dados • Portal Centro-Norte</p>
                                <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Relatório Estratégico de BI - {selectedYear}</h1>
                                <div className="flex gap-4 mt-3">
                                    <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded uppercase tracking-widest">Página {pageIdx+1} / {pdfBatches.length}</span>
                                    <span className="text-[10px] font-black text-slate-400 border border-slate-200 px-3 py-1 rounded uppercase tracking-widest">Meses: {selectedMonths.length === 12 ? 'Ano Completo' : selectedMonths.join(', ')}</span>
                                </div>
                            </div>
                            <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl">CN</div>
                        </div>

                        <div className="flex-1">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                    <tr className="border-b-2 border-slate-200 bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-[0.2em]">
                                        <th className="py-4 px-3">Estrutura de Linhas (Grupamento)</th>
                                        <th className="py-4 px-3 text-right">Faturamento</th>
                                        <th className="py-4 px-3 text-right">Volume</th>
                                        <th className="py-4 px-3 text-right">Ticket Médio</th>
                                        <th className="py-4 px-3 text-right">Share %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {batch.map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-100">
                                            <td className="py-4 px-3">
                                                <div className="flex flex-wrap gap-1 items-center">
                                                    {row.keys.map((k: string, kIdx: number) => (
                                                        <React.Fragment key={kIdx}>
                                                            <span className="text-[9px] font-black uppercase text-slate-700">{k}</span>
                                                            {kIdx < row.keys.length - 1 && <span className="text-slate-300 mx-1">/</span>}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-4 px-3 text-right font-black text-slate-900 text-xs">{formatBRL(row.faturamento)}</td>
                                            <td className="py-4 px-3 text-right font-bold text-slate-600 text-xs">{row.quantidade.toLocaleString()}</td>
                                            <td className="py-4 px-3 text-right font-bold text-slate-900 text-xs">{formatBRL(row.ticketMedio)}</td>
                                            <td className="py-4 px-3 text-right font-black text-blue-600 text-xs">{row.share.toFixed(2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-20 pt-10 border-t-2 border-slate-100 flex justify-between items-center opacity-40">
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 italic">Este documento é confidencial e gerado para uso administrativo exclusivo.</p>
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Impresso em: {new Date().toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
