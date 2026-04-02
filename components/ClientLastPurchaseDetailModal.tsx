
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, FileSpreadsheet, PieChart } from 'lucide-react';
import { totalDataStore } from '../lib/dataStore';
import { useSalesData } from '../hooks/useSalesData';
import * as XLSX from 'xlsx';

interface Product {
    sku: string;
    name: string;
    quantity: number;
    unitValue: number;
    totalValue: number;
    category: string;
}

interface ClientLastPurchaseDetailModalProps {
    client: {
        cnpj: string;
        nome_fantasia: string;
    };
    onClose: () => void;
    onBack?: () => void;
}

export const ClientLastPurchaseDetailModal: React.FC<ClientLastPurchaseDetailModalProps> = ({ client, onClose, onBack }) => {
    const [isExporting, setIsExporting] = useState(false);

    const clientUltimaCompra = useMemo(() => {
        return totalDataStore.clientesUltimaCompra.find(c => c.cnpj === client.cnpj);
    }, [client.cnpj]);

    const lastYear = useMemo(() => {
        if (!clientUltimaCompra?.ultima_compra) return null;
        return new Date(clientUltimaCompra.ultima_compra + 'T00:00:00').getUTCFullYear();
    }, [clientUltimaCompra]);

    // Fetch data for the year of last purchase if needed
    useSalesData(lastYear || 'all');

    const lastPurchaseData = useMemo(() => {
        if (!clientUltimaCompra) return null;

        const lastDateStr = clientUltimaCompra.ultima_compra;
        if (!lastDateStr) return null;

        const lastDateObj = new Date(lastDateStr + 'T00:00:00');
        const lYear = lastDateObj.getUTCFullYear();
        const lastMonth = lastDateObj.getUTCMonth() + 1;

        interface SaleItem {
            codigo_produto: string;
            produto: string;
            grupo: string;
            qtde_total: number;
            faturamento_total: number;
        }

        // Tentar buscar tanto na view de produtos quanto na store de sales granulares
        let clientSalesMonth: SaleItem[] = totalDataStore.vendasProdutosMes.filter(s => 
            s.cnpj === client.cnpj && 
            s.ano === lYear && 
            s.mes === lastMonth && 
            Number(s.faturamento_total) > 0
        );

        // Se não achou na view, tenta nos dados granulares (pode estar lá se foi buscado recentemente)
        if (clientSalesMonth.length === 0) {
            const granularSales = totalDataStore.sales.filter(s => {
                const sDate = new Date(s.data + 'T00:00:00');
                return s.cnpj === client.cnpj && 
                       sDate.getUTCFullYear() === lYear && 
                       (sDate.getUTCMonth() + 1) === lastMonth;
            });

            if (granularSales.length > 0) {
                // Agrupar por produto
                const grouped = new Map<string, SaleItem>();
                granularSales.forEach(s => {
                    const key = s.codigo_produto || s.produto;
                    const current = grouped.get(key) || { 
                        codigo_produto: s.codigo_produto || '', 
                        produto: s.produto || '', 
                        grupo: s.grupo || 'SEM GRUPO', 
                        qtde_total: 0, 
                        faturamento_total: 0 
                    };
                    grouped.set(key, {
                        ...current,
                        qtde_total: current.qtde_total + (Number(s.quantidade) || 0),
                        faturamento_total: current.faturamento_total + (Number(s.faturamento) || 0)
                    });
                });
                clientSalesMonth = Array.from(grouped.values());
            }
        }

        if (clientSalesMonth.length === 0) return null;

        const products: Product[] = clientSalesMonth.map(item => {
            const qty = Number(item.qtde_total) || 0;
            const total = Number(item.faturamento_total) || 0;
            return {
                sku: item.codigo_produto || 'N/I',
                name: item.produto || 'Produto sem nome',
                quantity: qty,
                unitValue: qty > 0 ? total / qty : 0,
                totalValue: total,
                category: (item.grupo || 'GERAL').trim().toUpperCase()
            };
        });

        // Ordenação por categoria (prioridade) e depois por valor
        const categoryPriority: { [key: string]: number } = {
            'DESCOLORANTE': 1,
            'COLORAÇÃO': 2,
            'FINALIZADOR': 3,
            'TRATAMENTO': 4,
            'SHAMPOO': 5,
            'OUTROS': 99
        };

        const sortedProducts = [...products].sort((a, b) => {
            const pA = categoryPriority[a.category] || 50;
            const pB = categoryPriority[b.category] || 50;
            if (pA !== pB) return pA - pB;
            if (a.category < b.category) return -1;
            if (a.category > b.category) return 1;
            return b.totalValue - a.totalValue;
        });

        const totalValue = products.reduce((acc, p) => acc + p.totalValue, 0);
        const totalSkus = products.length;
        const totalUnits = products.reduce((acc, p) => acc + p.quantity, 0);

        // Participação por categoria
        const categoryMap = new Map<string, { value: number, units: number, skus: number }>();
        products.forEach(p => {
            const current = categoryMap.get(p.category) || { value: 0, units: 0, skus: 0 };
            categoryMap.set(p.category, {
                value: current.value + p.totalValue,
                units: current.units + p.quantity,
                skus: current.skus + 1
            });
        });

        const categories = Array.from(categoryMap.entries()).map(([name, stats]) => ({
            name,
            value: stats.value,
            units: stats.units,
            skus: stats.skus,
            percent: totalValue > 0 ? (stats.value / totalValue) * 100 : 0
        })).sort((a, b) => b.value - a.value);

        return {
            date: lastDateStr,
            products: sortedProducts,
            totalValue,
            totalSkus,
            totalUnits,
            categories
        };
    }, [client.cnpj, clientUltimaCompra]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const handleExportExcel = () => {
        if (!lastPurchaseData) return;
        setIsExporting(true);
        try {
            const data = lastPurchaseData.products.map(p => ({
                "SKU": p.sku,
                "Produto": p.name,
                "Categoria": p.category,
                "Quantidade": p.quantity,
                "Valor Unitário": p.unitValue,
                "Valor Total": p.totalValue
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Ultima_Compra");
            XLSX.writeFile(wb, `Ultima_Compra_${client.nome_fantasia.replace(/\s/g, '_')}_${lastPurchaseData.date}.xlsx`);
        } catch (e) {
            console.error(e);
            alert('Erro ao exportar Excel');
        } finally {
            setIsExporting(false);
        }
    };

    const isLoading = Object.values(totalDataStore.loading).some(v => v === true);

    return createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 md:p-6 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
            <div className="bg-white w-full max-w-5xl rounded-[40px] shadow-2xl overflow-hidden animate-slideUp border border-white/20 flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
                            <Package className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Verificação de Última Compra</h3>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1.5">{client.nome_fantasia}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleExportExcel}
                            disabled={isExporting || !lastPurchaseData}
                            className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            Excel
                        </button>
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full">
                            {onBack && (
                                <button 
                                    onClick={onBack} 
                                    className="px-4 py-2 hover:bg-white hover:shadow-sm rounded-full text-[10px] font-black text-slate-600 uppercase transition-all"
                                >
                                    Voltar
                                </button>
                            )}
                            <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar p-6 md:p-8">
                    {!lastPurchaseData ? (
                        <div className="h-full flex flex-col items-center justify-center py-20 space-y-4">
                            {isLoading ? (
                                <>
                                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Buscando detalhes da compra...</p>
                                </>
                            ) : (
                                <>
                                    <Package className="w-16 h-16 text-slate-100" />
                                    <div className="text-center">
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum detalhe encontrado</p>
                                        <p className="text-[10px] text-slate-300 font-bold mt-1">A data da última compra é {clientUltimaCompra?.ultima_compra ? new Date(clientUltimaCompra.ultima_compra + 'T00:00:00').toLocaleDateString('pt-BR') : 'não registrada'}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8 animate-fadeIn">
                            {/* Top Stats & Categories */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                                {/* Summary Card */}
                                <div className="lg:col-span-1 bg-slate-900 rounded-[32px] p-6 text-white shadow-xl flex flex-col border-b-4 border-blue-600 h-fit">
                                    <div>
                                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em] mb-4">Resumo do Pedido</p>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Data</span>
                                                <span className="text-lg font-black tabular-nums">{new Date(lastPurchaseData.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Total de SKUs</span>
                                                <span className="text-lg font-black tabular-nums">{lastPurchaseData.totalSkus}</span>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Total de Unidades</span>
                                                <span className="text-lg font-black tabular-nums">{lastPurchaseData.totalUnits}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-8 pt-6 border-t border-white/10">
                                        <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">Valor Total</p>
                                        <h4 className="text-3xl font-black">{formatCurrency(lastPurchaseData.totalValue)}</h4>
                                    </div>
                                </div>

                                {/* Category Participation */}
                                <div className="lg:col-span-2 bg-slate-50 rounded-[32px] p-6 border border-slate-100">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-2">
                                            <PieChart className="w-4 h-4 text-blue-600" />
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Participação por Categoria</h4>
                                        </div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Mix do Pedido</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {lastPurchaseData.categories.map((cat, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-[9px] font-black text-slate-800 uppercase tracking-tight truncate max-w-[70%]">{cat.name}</p>
                                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">{cat.percent.toFixed(1)}%</span>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <div className="space-y-0.5">
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Faturamento</p>
                                                        <p className="text-[11px] font-black text-slate-900">{formatCurrency(cat.value)}</p>
                                                    </div>
                                                    <div className="text-right space-y-0.5">
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Volume / Itens</p>
                                                        <p className="text-[10px] font-bold text-slate-600">{cat.units} UN • {cat.skus} SKUs</p>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                                                    <div className="h-full bg-blue-600" style={{ width: `${cat.percent}%` }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Products Table */}
                            <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <tr className="border-b border-slate-200">
                                            <th className="px-8 py-5">SKU</th>
                                            <th className="px-6 py-5">Produto</th>
                                            <th className="px-6 py-5">Categoria</th>
                                            <th className="px-6 py-5 text-center">Qtd</th>
                                            <th className="px-6 py-5 text-right">Unitário</th>
                                            <th className="px-8 py-5 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {lastPurchaseData.products.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                                <td className="px-8 py-5 text-[10px] font-bold text-slate-400 font-mono">{p.sku}</td>
                                                <td className="px-6 py-5">
                                                    <span className="font-black text-slate-700 uppercase text-[11px] tracking-tight group-hover:text-blue-600">{p.name}</span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">{p.category}</span>
                                                </td>
                                                <td className="px-6 py-5 text-center font-black text-slate-900 tabular-nums">{p.quantity}</td>
                                                <td className="px-6 py-5 text-right text-slate-500 font-bold tabular-nums">{formatCurrency(p.unitValue)}</td>
                                                <td className="px-8 py-5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(p.totalValue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
