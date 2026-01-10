
import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, FileDown, Package, Filter, Loader2, FileSpreadsheet, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import XLSX from 'xlsx';

interface ClientProductsModalProps {
  client: {
    id: string;
    name: string;
    products: any[];
  };
  onClose: () => void;
}

export const ClientProductsModal: React.FC<ClientProductsModalProps> = ({ client, onClose }) => {
  const exportPagesRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const sortedProducts = useMemo(() => {
    return [...client.products].sort((a, b) => b.totalValue - a.totalValue);
  }, [client.products]);

  const totalFaturado = useMemo(() => {
    return sortedProducts.reduce((acc, curr) => acc + curr.totalValue, 0);
  }, [sortedProducts]);

  const ITEMS_PER_PAGE = 18;
  const productBatches = useMemo(() => {
    const batches = [];
    for (let i = 0; i < sortedProducts.length; i += ITEMS_PER_PAGE) {
      batches.push(sortedProducts.slice(i, i + ITEMS_PER_PAGE));
    }
    return batches;
  }, [sortedProducts]);

  const handleDownloadExcel = () => {
    if (sortedProducts.length === 0) return;
    const excelData = sortedProducts.map(p => ({ "Produto": p.name, "QTD": p.quantity, "Valor Total": p.totalValue }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mix");
    XLSX.writeFile(wb, `mix_${client.name.replace(/\s/g, '_')}.xlsx`);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl rounded-[28px] md:rounded-[32px] shadow-2xl flex flex-col max-h-[94vh] md:max-h-[90vh] overflow-hidden border border-white/20">
        
        <div className="p-5 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2.5 md:p-3 bg-purple-100 text-purple-600 rounded-xl md:rounded-2xl shadow-sm shrink-0">
              <Package className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight uppercase leading-tight truncate">Mix Ativo</h3>
              <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full text-slate-400">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="p-3 md:p-4 bg-white border-b border-slate-100 flex justify-between items-center px-4 md:px-8 shrink-0">
            <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
               {sortedProducts.length} itens encontrados
            </div>
            <div className="flex gap-2">
                <button onClick={handleDownloadExcel} className="h-9 md:h-11 px-3 md:px-8 rounded-xl text-[8px] md:text-[10px] font-black border border-emerald-200 text-emerald-600 hover:bg-emerald-50 uppercase flex items-center gap-2">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                </button>
            </div>
        </div>

        <div className="overflow-y-auto p-3 md:p-6 bg-slate-50 flex-1 custom-scrollbar">
            {/* Desktop View */}
            <div className="hidden md:block bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 border-b border-slate-200 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                        <tr>
                            <th className="py-4 px-6">Produto</th>
                            <th className="py-4 px-6 text-center">Qtd.</th>
                            <th className="py-4 px-6 text-right">Valor Total</th>
                            <th className="py-4 px-8 text-right">Partic.</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedProducts.map((p, idx) => {
                            const part = totalFaturado > 0 ? (p.totalValue / totalFaturado) * 100 : 0;
                            return (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                    <td className="py-4 px-6 font-black text-slate-800 text-xs uppercase">{p.name}</td>
                                    <td className="py-4 px-6 text-center font-bold text-slate-600">{p.quantity}</td>
                                    <td className="py-4 px-6 text-right font-black text-slate-900">{formatCurrency(p.totalValue)}</td>
                                    <td className="py-4 px-8 text-right"><span className="text-[10px] font-black text-purple-600">{part.toFixed(1)}%</span></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden space-y-2">
                {sortedProducts.map((p, idx) => {
                    const part = totalFaturado > 0 ? (p.totalValue / totalFaturado) * 100 : 0;
                    return (
                        <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                            <div className="flex justify-between items-start gap-4">
                                <span className="text-[9px] font-black text-slate-800 uppercase leading-tight line-clamp-2">{p.name}</span>
                                <span className="text-[9px] font-black text-purple-600 tabular-nums shrink-0">{part.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between items-end border-t border-slate-50 pt-2">
                                <div>
                                    <p className="text-[7px] font-black text-slate-400 uppercase">Faturamento</p>
                                    <p className="text-[11px] font-black text-slate-900">{formatCurrency(p.totalValue)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[7px] font-black text-slate-400 uppercase">Volume</p>
                                    <p className="text-[11px] font-bold text-slate-600">{p.quantity} Un</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
