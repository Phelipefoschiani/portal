
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, FileSpreadsheet, PieChart } from 'lucide-react';
import { totalDataStore } from '../lib/dataStore';
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
    client: any;
    onClose: () => void;
    onBack?: () => void;
}

export const ClientLastPurchaseDetailModal: React.FC<ClientLastPurchaseDetailModalProps> = ({ client, onClose, onBack }) => {
    const [isExporting, setIsExporting] = useState(false);

    const lastPurchaseData = useMemo(() => {
        const clientSales = totalDataStore.sales.filter(s => s.cnpj === client.cnpj && Number(s.faturamento) > 0);
        if (clientSales.length === 0) return null;

        // Encontrar a data da última compra
        const lastDate = clientSales.reduce((latest, current) => {
            return current.data > latest ? current.data : latest;
        }, '0000-00-00');

        // Pegar todos os itens dessa data
        const lastItems = clientSales.filter(s => s.data === lastDate);

        const products: Product[] = lastItems.map(item => {
            const qty = Number(item.qtde_faturado) || 0;
            const total = Number(item.faturamento) || 0;
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
            date: lastDate,
            products: sortedProducts,
            totalValue,
            totalSkus,
            totalUnits,
            categories
        };
    }, [client.cnpj]);

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

    if (!lastPurchaseData) return null;

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
                            disabled={isExporting}
                            className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg text-[10px] font-black uppercase tracking-widest"
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
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar p-6 md:p-8 space-y-8">
                    
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
            </div>
        </div>,
        document.body
    );
};
