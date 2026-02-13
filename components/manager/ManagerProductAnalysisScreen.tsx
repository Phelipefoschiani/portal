import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PackageSearch, Search, Filter, User, Calendar, Target, ChevronDown, CheckSquare, Square, X, Info, Search as SearchIcon, ListChecks, ArrowRight, Loader2, Award, Briefcase, Tag, Box, BarChart3, TrendingUp, CalendarDays, Eye, Building2, Trash2, LayoutGrid, FileSpreadsheet, Camera, MapPin, Hash, Package, Download } from 'lucide-react';
import { totalDataStore } from '../../lib/dataStore';
import { createPortal } from 'react-dom';
import { Button } from '../Button';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface BoxConfig {
    productId: string;
    unitsPerBox: number;
}

export const ManagerProductAnalysisScreen: React.FC = () => {
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    
    // Filtros de Produto
    const [productSearch, setProductSearch] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [showProductFilter, setShowProductFilter] = useState(false);
    
    // Configurações de Caixa
    const [boxConfigs, setBoxConfigs] = useState<BoxConfig[]>([]);
    const [showBoxConfigModal, setShowBoxConfigModal] = useState(false);
    
    // Modais de Detalhe
    const [drilledProduct, setDrilledProduct] = useState<any | null>(null);
    const [selectedClientDetail, setSelectedClientDetail] = useState<any | null>(null);
    const [showFullAnalysis, setShowFullAnalysis] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Filtro interno para Clientes que Compraram
    const [clientTabRepFilter, setClientTabRepFilter] = useState<string>('all');

    const dropdownRef = useRef<HTMLDivElement>(null);
    const monthDropdownRef = useRef<HTMLDivElement>(null);
    const exportRef = useRef<HTMLDivElement>(null);
    const clientDetailExportRef = useRef<HTMLDivElement>(null);
    const clientsTableExportRef = useRef<HTMLDivElement>(null);

    const availableYears = [2024, 2025, 2026, 2027];
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowProductFilter(false);
            if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) setShowMonthDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const allProducts = useMemo(() => {
        const productMap = new Map();
        totalDataStore.sales.forEach(s => {
            const key = s.codigo_produto || s.produto;
            if (!productMap.has(key)) {
                productMap.set(key, { id: key, nome: s.produto || 'Sem Descrição', grupo: s.grupo || 'GERAL' });
            }
        });
        return Array.from(productMap.values()).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
    }, []);

    const filteredProductsForSelect = allProducts.filter((p: any) => 
        p.nome.toLowerCase().includes(productSearch.toLowerCase()) || p.id.toLowerCase().includes(productSearch.toLowerCase())
    );

    const processedData = useMemo(() => {
        if (selectedProductIds.length === 0) return [];
        const sales = totalDataStore.sales;
        const users = totalDataStore.users;

        const repReferenceMap = new Map<string, { totalQty: number, groupsQty: Map<string, number> }>();
        sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return d.getUTCFullYear() === selectedYear && selectedMonths.includes(d.getUTCMonth() + 1);
        }).forEach(s => {
            const rId = s.usuario_id;
            const qty = Number(s.qtde_faturado) || 0;
            const grp = s.grupo || 'GERAL';
            if (!repReferenceMap.has(rId)) repReferenceMap.set(rId, { totalQty: 0, groupsQty: new Map() });
            const ref = repReferenceMap.get(rId)!;
            ref.totalQty += qty;
            ref.groupsQty.set(grp, (ref.groupsQty.get(grp) || 0) + qty);
        });

        const targetSales = sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            const m = d.getUTCMonth() + 1;
            const y = d.getUTCFullYear();
            const productKey = s.codigo_produto || s.produto;
            return y === selectedYear && selectedMonths.includes(m) && selectedProductIds.includes(productKey);
        });

        const results: any[] = [];
        const repsInSales = Array.from(new Set(targetSales.map(s => s.usuario_id)));
        const sortedReps = users.filter(u => repsInSales.includes(u.id)).sort((a, b) => a.nome.localeCompare(b.nome));

        sortedReps.forEach(rep => {
            const repSales = targetSales.filter(s => s.usuario_id === rep.id);
            const repProductsMap = new Map();
            repSales.forEach(s => {
                const key = s.codigo_produto || s.produto;
                if (!repProductsMap.has(key)) {
                    repProductsMap.set(key, { id: key, nome: s.produto, grupo: s.grupo || 'GERAL', qty: 0, lastDate: '0000-00-00' });
                    const p = repProductsMap.get(key);
                    p.qty += Number(s.qtde_faturado) || 0;
                    if (s.data > p.lastDate) p.lastDate = s.data;
                } else {
                    const p = repProductsMap.get(key);
                    p.qty += Number(s.qtde_faturado) || 0;
                    if (s.data > p.lastDate) p.lastDate = s.data;
                }
            });
            const ref = repReferenceMap.get(rep.id) || { totalQty: 0, groupsQty: new Map() };
            const products = Array.from(repProductsMap.values()).map(p => {
                const groupTotal = ref.groupsQty.get(p.grupo) || 0;
                const boxCfg = boxConfigs.find(c => c.productId === p.id);
                return {
                    ...p,
                    sharePortfolio: ref.totalQty > 0 ? (p.qty / ref.totalQty) * 100 : 0,
                    shareGroup: groupTotal > 0 ? (p.qty / groupTotal) * 100 : 0,
                    boxes: boxCfg ? (p.qty / boxCfg.unitsPerBox) : null
                };
            }).sort((a, b) => b.qty - a.qty);
            results.push({ repId: rep.id, repNome: rep.nome, products });
        });
        return results;
    }, [selectedYear, selectedMonths, selectedProductIds, boxConfigs]);

    const toggleProductSelection = (id: string) => {
        setSelectedProductIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleApplyMonthFilter = () => {
        setSelectedMonths([...tempSelectedMonths]);
        setShowMonthDropdown(false);
    };

    const formatQty = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v);

    const handleExportExcelClients = () => {
        const clientList: any[] = [];
        const clientLookup = new Map(totalDataStore.clients.map(c => [String(c.cnpj).replace(/\D/g, ''), c]));
        const clientMap = new Map<string, any>();

        totalDataStore.sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            const pk = s.codigo_produto || s.produto;
            const repMatch = clientTabRepFilter === 'all' || s.usuario_id === clientTabRepFilter;
            return d.getUTCFullYear() === selectedYear && selectedMonths.includes(d.getUTCMonth() + 1) && selectedProductIds.includes(pk) && repMatch;
        }).forEach(s => {
            const cnpj = String(s.cnpj).replace(/\D/g, '');
            const pk = s.codigo_produto || s.produto;
            const qty = Number(s.qtde_faturado) || 0;
            const boxCfg = boxConfigs.find(cfg => cfg.productId === pk);
            const boxes = boxCfg ? (qty / boxCfg.unitsPerBox) : 0;

            if (!clientMap.has(cnpj)) {
                const cl = clientLookup.get(cnpj);
                clientMap.set(cnpj, {
                    nome: (cl?.nome_fantasia || s.cliente_nome || 'N/I').trim().toUpperCase(),
                    cnpj,
                    uniqueProducts: new Set([pk]),
                    totalQty: qty,
                    totalBoxes: boxes,
                    last: s.data
                });
            } else {
                const existing = clientMap.get(cnpj)!;
                existing.uniqueProducts.add(pk);
                existing.totalQty += qty;
                existing.totalBoxes += boxes;
                if (s.data > existing.last) existing.last = s.data;
            }
        });

        const data = Array.from(clientMap.values()).map(c => ({
            "Razão Social": c.nome,
            "CNPJ": c.cnpj,
            "Mix Positivado": c.uniqueProducts.size,
            "Total Unidades": c.totalQty,
            "Total Caixas": c.totalBoxes > 0 ? Number(c.totalBoxes.toFixed(1)) : null,
            "Última Compra": new Date(c.last + 'T00:00:00').toLocaleDateString('pt-BR')
        })).sort((a, b) => a["Razão Social"].localeCompare(b["Razão Social"]));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Clientes_Mapeados");
        XLSX.writeFile(wb, `Clientes_Mapeados_${selectedYear}.xlsx`);
    };

    const handleExportPngElement = async (ref: React.RefObject<HTMLDivElement>, name: string) => {
        if (!ref.current) return;
        setIsExporting(true);
        try {
            await new Promise(r => setTimeout(r, 200));
            const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = `${name}_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-24">
            {isExporting && createPortal(
                <div className="fixed inset-0 z-[600] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white">
                    <Loader2 className="w-16 h-16 animate-spin text-blue-500 mb-4" />
                    <h3 className="text-xl font-black uppercase tracking-widest">Processando Exportação...</h3>
                </div>, document.body
            )}

            <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg"><PackageSearch className="w-6 h-6" /></div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Análise de Produtos</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">Inteligência Estratégica por Unidades</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent border-none text-[10px] font-black uppercase px-3 py-1.5 cursor-pointer text-slate-600">
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <div className="w-px h-4 bg-slate-200 self-center"></div>
                        <div className="relative" ref={monthDropdownRef}>
                            <button onClick={() => setShowMonthDropdown(!showMonthDropdown)} className="px-4 py-1.5 text-[10px] font-black uppercase text-slate-600 flex items-center gap-2">
                                <Calendar className="w-3 h-3" /> {selectedMonths.length === 12 ? 'ANO TODO' : `${selectedMonths.length} MESES`}
                            </button>
                            {showMonthDropdown && (
                                <div className="absolute top-full right-0 mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden">
                                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
                                        <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[8px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg">Todos</button>
                                        <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[8px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg">Limpar</button>
                                    </div>
                                    <div className="p-2 grid grid-cols-2 gap-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {monthNames.map((m, i) => (
                                            <button key={i} onClick={() => { const val = i+1; setTempSelectedMonths(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]); }} className={`flex items-center gap-2 p-2 rounded-lg text-[9px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}>
                                                {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-20" />} {m}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="p-3 border-t border-slate-100 bg-slate-50">
                                        <button onClick={handleApplyMonthFilter} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[10px] font-black uppercase">Aplicar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-center px-1">
                <div className="relative" ref={dropdownRef}>
                    <button onClick={() => setShowProductFilter(!showProductFilter)} className={`flex items-center gap-3 px-6 py-3 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest shadow-sm ${selectedProductIds.length > 0 ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600'}`}>
                        <SearchIcon className="w-4 h-4" /> {selectedProductIds.length === 0 ? 'Selecionar Produtos' : `${selectedProductIds.length} Itens Mapeados`}
                    </button>
                    {showProductFilter && (
                        <div className="absolute top-full left-0 mt-2 w-[350px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[200] overflow-hidden animate-slideUp">
                            <div className="p-4 border-b border-slate-100 bg-slate-50">
                                <div className="relative">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" autoFocus placeholder="Filtrar por nome ou SKU..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
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
                            <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-between"><button onClick={() => setSelectedProductIds([])} className="text-[9px] font-black text-red-500 uppercase">Limpar Seleção</button><button onClick={() => setShowProductFilter(false)} className="text-[9px] font-black text-blue-600 uppercase">Fechar</button></div>
                        </div>
                    )}
                </div>
                <button onClick={() => setShowBoxConfigModal(true)} disabled={selectedProductIds.length === 0} className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-600 uppercase hover:bg-slate-50 disabled:opacity-30"><Box className="w-4 h-4 text-amber-500" /> Adicionar Caixas</button>
                <div className="flex-1"></div>
                <button onClick={() => setShowFullAnalysis(true)} disabled={selectedProductIds.length === 0} className="flex items-center gap-3 px-10 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 disabled:opacity-30"><BarChart3 className="w-4 h-4" /> Análise</button>
            </div>

            {selectedProductIds.length === 0 ? (
                <div className="bg-white rounded-[32px] p-32 text-center border-2 border-dashed border-slate-200"><SearchIcon className="w-16 h-16 text-slate-100 mx-auto mb-4" /><p className="text-slate-400 font-bold uppercase text-xs tracking-[0.4em]">Selecione itens para iniciar o mapeamento</p></div>
            ) : (
                <div className="space-y-12 animate-fadeIn">
                    {processedData.length === 0 ? (
                        <div className="p-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest">Nenhuma venda encontrada para os filtros selecionados.</div>
                    ) : (
                        processedData.map((repGroup, gIdx) => (
                            <div key={repGroup.repId} className="space-y-4">
                                <div className="flex items-center gap-4 px-4"><div className="w-2 h-8 bg-blue-600 rounded-full"></div><h3 className="font-black text-slate-900 uppercase tracking-tight text-lg">REPRESENTANTE: {repGroup.repNome}</h3></div>
                                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200"><tr className="text-slate-500 text-[9px] font-black uppercase tracking-widest"><th className="px-8 py-5">Produto</th><th className="px-6 py-5 text-right">% Carteira</th><th className="px-6 py-5 text-right">% Grupo</th><th className="px-6 py-5 text-right">Unidades</th>{boxConfigs.length > 0 && <th className="px-6 py-5 text-right">Caixas</th>}<th className="px-6 py-5 text-center">Última Venda</th><th className="px-8 py-5 text-right">Dtl</th></tr></thead>
                                        <tbody className="divide-y divide-slate-100">{repGroup.products.map((p: any) => (
                                            <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-8 py-4"><p className="font-black text-slate-800 uppercase text-[11px] truncate max-w-[300px]">{p.nome}</p><span className="text-[8px] font-bold text-slate-400 uppercase">{p.grupo} • {p.id}</span></td>
                                                <td className="px-6 py-4 text-right"><span className="text-[11px] font-black text-slate-700 tabular-nums">{p.sharePortfolio.toFixed(2)}%</span></td>
                                                <td className="px-6 py-4 text-right"><span className="text-[11px] font-black text-blue-600 tabular-nums">{p.shareGroup.toFixed(2)}%</span></td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{p.qty.toLocaleString()}</td>
                                                {boxConfigs.length > 0 && <td className="px-6 py-4 text-right">{p.boxes !== null ? <span className="font-black text-amber-600 text-xs tabular-nums">{formatQty(p.boxes)}</span> : <span className="text-[9px] text-slate-200">--</span>}</td>}
                                                <td className="px-6 py-4 text-center"><span className="text-slate-400 font-bold text-[10px]">{p.lastDate !== '0000-00-00' ? new Date(p.lastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '--'}</span></td>
                                                <td className="px-8 py-4 text-right"><button onClick={() => setDrilledProduct({ ...p, repNome: repGroup.repNome, repId: repGroup.repId })} className="p-2 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-lg text-slate-400 transition-all shadow-sm"><SearchIcon className="w-3.5 h-3.5" /></button></td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                                {gIdx < processedData.length - 1 && <div className="border-t-2 border-slate-100 my-8 pt-4"></div>}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* MODAL CONFIG CAIXAS */}
            {showBoxConfigModal && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><div className="flex items-center gap-3"><Box className="w-6 h-6 text-amber-600" /><div><h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Fator de Caixa</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Unidades por caixa</p></div></div><button onClick={() => setShowBoxConfigModal(false)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button></div>
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-2">{allProducts.filter((p: any) => selectedProductIds.includes(p.id)).map((p: any) => { const c = boxConfigs.find(x => x.productId === p.id); return ( <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl"><div className="min-w-0 pr-4"><p className="font-black text-slate-800 uppercase text-[10px] truncate">{p.nome}</p><p className="text-[8px] font-bold text-slate-400 uppercase">SKU: {p.id}</p></div><div className="flex items-center gap-3 shrink-0"><span className="text-[8px] font-black text-slate-400 uppercase">Un/Cx:</span><input type="number" value={c?.unitsPerBox || ''} onChange={e => { const val = Number(e.target.value); setBoxConfigs(prev => { const others = prev.filter(x => x.productId !== p.id); return val > 0 ? [...others, { productId: p.id, unitsPerBox: val }] : others; }); }} className="w-14 h-9 bg-white border border-slate-200 rounded-lg text-center font-black text-amber-600 text-xs outline-none" placeholder="--" /></div></div> ); })}</div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100"><Button onClick={() => setShowBoxConfigModal(false)} fullWidth className="h-12 rounded-xl font-black uppercase text-[10px] bg-amber-600 hover:bg-amber-700">Salvar Fatores</Button></div>
                    </div>
                </div>, document.body
            )}

            {/* MODAL LUPA: CLIENTES POR PRODUTO */}
            {drilledProduct && createPortal(
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50"><div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{drilledProduct.nome}</h3><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2 flex items-center gap-2"><Building2 className="w-4 h-4" /> Distribuição em Carteira • Rep: {drilledProduct.repNome}</p></div><button onClick={() => setDrilledProduct(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-7 h-7" /></button></div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-8 py-5">Cliente Positivado</th><th className="px-6 py-5 text-right">Unidades</th>{boxConfigs.find(c => c.productId === drilledProduct.id) && <th className="px-6 py-5 text-right">Caixas</th>}<th className="px-8 py-5 text-right">Última Compra</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">{totalDataStore.sales.filter(s => { const pk = s.codigo_produto || s.produto; return s.usuario_id === drilledProduct.repId && pk === drilledProduct.id && new Date(s.data + 'T00:00:00').getUTCFullYear() === selectedYear && selectedMonths.includes(new Date(s.data + 'T00:00:00').getUTCMonth() + 1); }).reduce((acc: any[], curr) => { const cnpj = String(curr.cnpj || '').replace(/\D/g, ''); const existing = acc.find(a => a.cnpj === cnpj); const qty = Number(curr.qtde_faturado) || 0; if (existing) { existing.qty += qty; if (curr.data > existing.last) existing.last = curr.data; } else { const cl = totalDataStore.clients.find(c => String(c.cnpj).replace(/\D/g, '') === cnpj); acc.push({ cnpj, nome: cl?.nome_fantasia || curr.cliente_nome || 'CLIENTE N/I', qty, last: curr.data, original: cl }); } return acc; }, []).sort((a, b) => b.qty - a.qty).map((c, i) => { const boxCfg = boxConfigs.find(cfg => cfg.productId === drilledProduct.id); return (
                                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-8 py-4"><button onClick={() => setSelectedClientDetail(c.original || { cnpj: c.cnpj, nome_fantasia: c.nome })} className="font-black text-slate-800 uppercase text-[11px] truncate max-w-[320px] hover:text-blue-600 text-left">{c.nome}</button><p className="text-[9px] font-bold text-slate-400">{c.cnpj}</p></td>
                                            <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{c.qty.toLocaleString()} UN</td>
                                            {boxCfg && <td className="px-6 py-4 text-right font-black text-amber-600 text-xs tabular-nums">{formatQty(c.qty / boxCfg.unitsPerBox)} CX</td>}
                                            <td className="px-8 py-4 text-right font-bold text-slate-400 text-xs">{new Date(c.last + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                        </tr>
                                    ); })}</tbody>
                                </table>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center"><Button onClick={() => setDrilledProduct(null)} className="px-12 py-3 rounded-xl font-black uppercase text-[10px]">Fechar Detalhamento</Button></div>
                    </div>
                </div>, document.body
            )}

            {/* DRILL-DOWN CLIENTE: TODOS PRODUTOS SELECIONADOS QUE COMPROU */}
            {selectedClientDetail && createPortal(
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{selectedClientDetail.nome_fantasia}</h3><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">Ficha de Itens Estratégicos Selecionados</p></div>
                            <div className="flex gap-2">
                                <button onClick={() => handleExportPngElement(clientDetailExportRef, `Detalhe_${selectedClientDetail.nome_fantasia}`)} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all"><Download className="w-5 h-5" /></button>
                                <button onClick={() => setSelectedClientDetail(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-7 h-7" /></button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white" ref={clientDetailExportRef}>
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-8 py-5">Produto Selecionado</th><th className="px-6 py-5 text-right">Unidades</th>{boxConfigs.length > 0 && <th className="px-6 py-5 text-right">Caixas</th>}<th className="px-8 py-5 text-right">Última Compra</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">{(() => {
                                        const cleanCnpj = String(selectedClientDetail.cnpj || '').replace(/\D/g, '');
                                        const list: any[] = [];
                                        totalDataStore.sales.filter(s => {
                                            const d = new Date(s.data + 'T00:00:00');
                                            const pk = s.codigo_produto || s.produto;
                                            return String(s.cnpj || '').replace(/\D/g, '') === cleanCnpj && selectedProductIds.includes(pk) && d.getUTCFullYear() === selectedYear && selectedMonths.includes(d.getUTCMonth() + 1);
                                        }).forEach(s => {
                                            const pk = s.codigo_produto || s.produto;
                                            const existing = list.find(x => x.id === pk);
                                            if (existing) {
                                                existing.qty += Number(s.qtde_faturado);
                                                if (s.data > existing.last) existing.last = s.data;
                                            } else {
                                                list.push({ id: pk, nome: s.produto, qty: Number(s.qtde_faturado), last: s.data });
                                            }
                                        });
                                        return list.sort((a,b) => b.qty - a.qty).map((item, idx) => {
                                            const boxCfg = boxConfigs.find(cfg => cfg.productId === item.id);
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="px-8 py-4"><p className="font-black text-slate-800 uppercase text-[11px] truncate">{item.nome}</p><p className="text-[8px] font-bold text-slate-400 uppercase">SKU: {item.id}</p></td>
                                                    <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{item.qty.toLocaleString()} UN</td>
                                                    {boxConfigs.length > 0 && <td className="px-6 py-4 text-right font-black text-amber-600 text-xs tabular-nums">{boxCfg ? formatQty(item.qty / boxCfg.unitsPerBox) : '--'} CX</td>}
                                                    <td className="px-8 py-4 text-right font-bold text-slate-400 text-xs">{new Date(item.last + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                                </tr>
                                            );
                                        });
                                    })()}</tbody>
                                </table>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center"><Button onClick={() => setSelectedClientDetail(null)} className="px-12 py-3 rounded-xl font-black uppercase text-[10px]">Fechar Resumo do Cliente</Button></div>
                    </div>
                </div>, document.body
            )}

            {/* FULL SCREEN ANÁLISE CONSOLIDADA */}
            {showFullAnalysis && createPortal(
                <div className="fixed inset-0 z-[400] bg-white overflow-y-auto animate-fadeIn custom-scrollbar">
                    <div className="w-full max-w-7xl mx-auto p-4 md:p-12 space-y-12 pb-32" ref={exportRef}>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b-4 border-slate-900 pb-10 gap-6">
                            <div><p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-3">Relatório Consolidado de Mapeamento</p><h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">Inteligência de Volume em Carteira</h1><div className="flex items-center gap-6 mt-6"><span className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest"><CalendarDays className="w-4 h-4 text-blue-500" /> Período: {selectedMonths.length === 12 ? 'ANO TODO' : `${selectedMonths.length} Meses`} de {selectedYear}</span><span className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest"><Hash className="w-4 h-4 text-blue-500" /> Itens Analisados: {selectedProductIds.length}</span></div></div>
                            <button onClick={() => setShowFullAnalysis(false)} data-html2canvas-ignore className="p-4 bg-slate-100 hover:bg-slate-200 rounded-2xl shadow-sm"><X className="w-8 h-8 text-slate-400" /></button>
                        </div>
                        <div className="space-y-6"><h2 className="text-lg font-black text-slate-900 uppercase tracking-widest border-l-8 border-blue-600 pl-4">Resumo Executivo Geral</h2><div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm"><table className="w-full text-left border-collapse"><thead className="bg-slate-50 border-b border-slate-200"><tr className="text-slate-400 text-[10px] font-black uppercase tracking-widest"><th className="px-8 py-5">Métrica Geral Regional</th><th className="px-8 py-5 text-right">Volume Consolidado</th></tr></thead><tbody className="divide-y divide-slate-100 font-black text-slate-700 uppercase text-xs">
                            <tr><td className="px-8 py-5 flex items-center gap-3"><Package className="w-4 h-4 text-blue-500" /> Total Geral Vendido (UN)</td><td className="px-8 py-5 text-right text-lg text-slate-900 tabular-nums">{processedData.reduce((acc, rep) => acc + rep.products.reduce((ap: number, bp: any) => ap + bp.qty, 0), 0).toLocaleString()} UN</td></tr>
                            {boxConfigs.length > 0 && (<tr><td className="px-8 py-5 flex items-center gap-3"><Box className="w-4 h-4 text-amber-500" /> Total Geral em Caixas (CX)</td><td className="px-8 py-5 text-right text-lg text-amber-600 tabular-nums">{formatQty(processedData.reduce((acc, rep) => acc + rep.products.reduce((ap: number, bp: any) => ap + (bp.boxes || 0), 0), 0))} CX</td></tr>)}
                            <tr><td className="px-8 py-5 flex items-center gap-3"><TrendingUp className="w-4 h-4 text-emerald-500" /> % Part. na Carteira da Regional</td><td className="px-8 py-5 text-right text-lg text-emerald-600 tabular-nums">{(processedData.reduce((acc, rep) => acc + rep.products.reduce((ap: number, bp: any) => ap + bp.qty, 0), 0) / totalDataStore.sales.filter(s => { const d = new Date(s.data + 'T00:00:00'); return d.getUTCFullYear() === selectedYear && selectedMonths.includes(d.getUTCMonth() + 1); }).reduce((a, b) => a + (Number(b.qtde_faturado) || 0), 0) * 100).toFixed(2)}%</td></tr>
                        </tbody></table></div></div>
                        <div className="space-y-8"><h2 className="text-lg font-black text-slate-900 uppercase tracking-widest border-l-8 border-slate-900 pl-4">Análise Detalhada por Representante</h2>{processedData.map((repGroup) => (
                            <div key={repGroup.repId} className="space-y-4">
                                <div className="flex justify-between items-end bg-slate-900 p-6 rounded-2xl text-white shadow-xl"><div><p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Unidade de Negócio</p><h3 className="text-2xl font-black uppercase tracking-tight">{repGroup.repNome}</h3></div><div className="text-right"><p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Itens Mapeados</p><p className="text-2xl font-black">{repGroup.products.length}</p></div></div>
                                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm"><table className="w-full text-left border-collapse"><thead className="bg-slate-50 border-b border-slate-200"><tr className="text-slate-400 text-[9px] font-black uppercase tracking-widest"><th className="px-8 py-5">Produto</th><th className="px-6 py-5 text-right">Qtde (UN)</th><th className="px-6 py-5 text-right">% no Grupo</th><th className="px-6 py-5 text-right">% na Carteira</th>{boxConfigs.length > 0 && <th className="px-6 py-5 text-right">Caixas</th>}<th className="px-8 py-5 text-right">Última Venda</th></tr></thead><tbody className="divide-y divide-slate-100 font-bold text-slate-700 uppercase text-xs">{repGroup.products.map((p: any) => {
                                    const totalRegionalProduct = processedData.reduce((acc, r) => { const rp = r.products.find((prod: any) => prod.id === p.id); return acc + (rp?.qty || 0); }, 0);
                                    const shareInProduct = totalRegionalProduct > 0 ? (p.qty / totalRegionalProduct) * 100 : 0;
                                    return (<tr key={p.id} className="hover:bg-slate-50/50"><td className="px-8 py-4 font-black text-slate-900 truncate max-w-[300px]">{p.nome}</td><td className="px-6 py-4 text-right tabular-nums">{p.qty.toLocaleString()}</td><td className="px-6 py-4 text-right tabular-nums text-blue-600">{p.shareGroup.toFixed(1)}%</td><td className="px-6 py-4 text-right tabular-nums">{p.sharePortfolio.toFixed(2)}%</td>{boxConfigs.length > 0 && (<td className="px-6 py-4 text-right text-amber-600 tabular-nums">{p.boxes !== null ? formatQty(p.boxes) : '--'}</td>)}<td className="px-8 py-4 text-right text-slate-400 tabular-nums">{p.lastDate !== '0000-00-00' ? new Date(p.lastDate + 'T00:00:00').toLocaleDateString('pt-BR') : '--'}</td></tr>);
                                })}</tbody></table></div>
                                <div className="border-t-2 border-slate-100 mt-12 mb-8"></div>
                            </div>
                        ))}</div>
                        <div className="space-y-6" ref={clientsTableExportRef}>
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest border-l-8 border-purple-600 pl-4">Clientes que Compraram</h2>
                                <div className="flex flex-wrap gap-2" data-html2canvas-ignore>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <select value={clientTabRepFilter} onChange={e => setClientTabRepFilter(e.target.value)} className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500">
                                            <option value="all">TODOS REPRESENTANTES</option>
                                            {totalDataStore.users.map(u => <option key={u.id} value={u.id}>{u.nome.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                    <button onClick={handleExportExcelClients} className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase shadow-sm"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
                                    <button onClick={() => handleExportPngElement(clientsTableExportRef, `Clientes_Faturamento`)} className="flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-sm"><Download className="w-4 h-4" /> PNG</button>
                                </div>
                            </div>
                            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm"><table className="w-full text-left border-collapse"><thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10"><tr className="text-slate-400 text-[9px] font-black uppercase tracking-widest"><th className="px-8 py-5">Razão Social / CNPJ</th><th className="px-6 py-5 text-center">Mix Positivado</th><th className="px-6 py-5 text-right">Unidades</th>{boxConfigs.length > 0 && <th className="px-6 py-5 text-right">Caixas</th>}<th className="px-8 py-5 text-right">Última Compra</th></tr></thead><tbody className="divide-y divide-slate-100 font-bold text-slate-700 uppercase text-xs">{(() => {
                                const clientMap = new Map<string, any>();
                                const clientLookup = new Map(totalDataStore.clients.map(c => [String(c.cnpj).replace(/\D/g, ''), c]));
                                
                                totalDataStore.sales.filter(s => {
                                    const d = new Date(s.data + 'T00:00:00');
                                    const pk = s.codigo_produto || s.produto;
                                    const repMatch = clientTabRepFilter === 'all' || s.usuario_id === clientTabRepFilter;
                                    return d.getUTCFullYear() === selectedYear && 
                                           selectedMonths.includes(d.getUTCMonth() + 1) && 
                                           selectedProductIds.includes(pk) && 
                                           repMatch;
                                }).forEach(s => {
                                    const cnpj = String(s.cnpj).replace(/\D/g, '');
                                    const pk = s.codigo_produto || s.produto;
                                    const qty = Number(s.qtde_faturado) || 0;
                                    const boxCfg = boxConfigs.find(cfg => cfg.productId === pk);
                                    const boxes = boxCfg ? (qty / boxCfg.unitsPerBox) : 0;

                                    if (!clientMap.has(cnpj)) {
                                        const cl = clientLookup.get(cnpj);
                                        clientMap.set(cnpj, {
                                            nome: (cl?.nome_fantasia || s.cliente_nome || 'N/I').trim().toUpperCase(),
                                            cnpj,
                                            uniqueProducts: new Set([pk]),
                                            totalQty: qty,
                                            totalBoxes: boxes,
                                            last: s.data,
                                            original: cl || { cnpj, nome_fantasia: s.cliente_nome }
                                        });
                                    } else {
                                        const existing = clientMap.get(cnpj)!;
                                        existing.uniqueProducts.add(pk);
                                        existing.totalQty += qty;
                                        existing.totalBoxes += boxes;
                                        if (s.data > existing.last) existing.last = s.data;
                                    }
                                });

                                const clientList = Array.from(clientMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));

                                if (clientList.length === 0) return <tr><td colSpan={5} className="py-20 text-center text-slate-300">Sem registros de compra.</td></tr>;
                                
                                return clientList.map((c, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50">
                                        <td className="px-8 py-4">
                                            <button onClick={() => setSelectedClientDetail(c.original)} className="font-black text-slate-900 truncate max-w-[280px] hover:text-blue-600 text-left">{c.nome}</button>
                                            <p className="text-[8px] font-bold text-slate-400">{c.cnpj}</p>
                                        </td>
                                        <td className="px-6 py-4 text-center tabular-nums text-[10px]">{c.uniqueProducts.size}</td>
                                        <td className="px-6 py-4 text-right tabular-nums">{c.totalQty.toLocaleString()} UN</td>
                                        {boxConfigs.length > 0 && (
                                            <td className="px-6 py-4 text-right text-amber-600 tabular-nums">
                                                {c.totalBoxes > 0 ? formatQty(c.totalBoxes) : '--'}
                                            </td>
                                        )}
                                        <td className="px-8 py-4 text-right text-slate-400 tabular-nums">
                                            {new Date(c.last + 'T00:00:00').toLocaleDateString('pt-BR')}
                                        </td>
                                    </tr>
                                ));
                            })()}</tbody></table></div></div>
                        <div className="pt-20 pb-10 text-center border-t border-slate-100"><p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-300">Portal Centro-Norte • Engine de Inteligência de Mercado</p></div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
};