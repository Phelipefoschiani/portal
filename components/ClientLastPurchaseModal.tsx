
import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, FileDown, History, CalendarClock, CheckSquare, Square, AlertTriangle, ListChecks, CheckCircle2, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from './Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface ClientLastPurchaseModalProps {
  client: {
    id: string;
    name: string;
    products: any[];
  };
  onClose: () => void;
}

export const ClientLastPurchaseModal: React.FC<ClientLastPurchaseModalProps> = ({ client, onClose }) => {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  
  const sortedProducts = useMemo(() => {
    return [...client.products].sort((a, b) => {
      return new Date(a.lastPurchaseDate).getTime() - new Date(b.lastPurchaseDate).getTime();
    });
  }, [client.products]);

  const getDaysSince = (dateStr: string) => {
    const today = new Date();
    const purchaseDate = new Date(dateStr);
    const diffTime = Math.abs(today.getTime() - purchaseDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isRedItem = (product: any) => {
    const today = new Date();
    const purchaseDate = new Date(product.lastPurchaseDate);
    const diffMonths = (today.getFullYear() * 12 + today.getMonth()) - 
                       (purchaseDate.getFullYear() * 12 + purchaseDate.getMonth());
    return diffMonths >= 3;
  };

  const redItems = sortedProducts.filter(p => isRedItem(p));
  const whiteItems = sortedProducts.filter(p => !isRedItem(p));
  const isAllRedSelected = redItems.length > 0 && redItems.every(p => selectedProductIds.includes(p.id));
  const isAllWhiteSelected = whiteItems.length > 0 && whiteItems.every(p => selectedProductIds.includes(p.id));

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 md:p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-5xl rounded-[28px] md:rounded-3xl shadow-2xl flex flex-col max-h-[94vh] md:max-h-[90vh] overflow-hidden border border-white/20">
        
        <div className="p-5 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <div className="p-2.5 md:p-3 bg-amber-100 text-amber-600 rounded-xl md:rounded-2xl shadow-sm shrink-0">
              <History className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg md:text-xl font-black text-slate-800 tracking-tight uppercase truncate">Sugestão de Reposição</h3>
              <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full text-slate-400">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 px-4 md:px-8 shrink-0">
            <div className="flex items-center gap-4 md:gap-6 w-full sm:w-auto">
                <button 
                    onClick={() => { const ids = whiteItems.map(p => p.id); setSelectedProductIds(prev => isAllWhiteSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))); }}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-[8px] md:text-[9px] font-black uppercase px-3 py-2 rounded-xl border transition-all ${isAllWhiteSelected ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-100 text-slate-400'}`}
                >
                    {isAllWhiteSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 opacity-30" />} Brancos
                </button>
                <button 
                    onClick={() => { const ids = redItems.map(p => p.id); setSelectedProductIds(prev => isAllRedSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))); }}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-[8px] md:text-[9px] font-black uppercase px-3 py-2 rounded-xl border transition-all ${isAllRedSelected ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-100 text-slate-400'}`}
                >
                    {isAllRedSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 opacity-30" />} Vermelhos
                </button>
            </div>
            
            <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                <span className="text-[9px] font-black text-slate-400 uppercase">{selectedProductIds.length} Sel.</span>
                <Button variant="outline" className="h-9 md:h-11 px-6 rounded-xl text-[9px] md:text-[10px] font-black border-emerald-200 text-emerald-600 uppercase">
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1" /> Excel
                </Button>
            </div>
        </div>

        <div className="overflow-y-auto bg-slate-50 flex-1 custom-scrollbar">
            {/* Desktop View */}
            <div className="hidden md:block">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-100 sticky top-0 z-10 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                        <tr>
                            <th className="py-4 px-8 w-16 text-center">Sel.</th>
                            <th className="py-4 px-6">Item</th>
                            <th className="py-4 px-6">Última Compra</th>
                            <th className="py-4 px-6 text-center">Qtd</th>
                            <th className="py-4 px-8 text-right">Último Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {sortedProducts.map((p, idx) => {
                            const isSelected = selectedProductIds.includes(p.id);
                            const isRed = isRedItem(p);
                            return (
                                <tr key={idx} className={`hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-blue-50/40' : ''}`} onClick={() => toggleProduct(p.id)}>
                                    <td className="py-4 px-8 text-center"><div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200'}`}>{isSelected && '✓'}</div></td>
                                    <td className="py-4 px-6">
                                        <p className="font-black text-slate-800 text-xs uppercase">{p.name}</p>
                                        {isRed && <span className="text-[8px] font-black text-red-500 uppercase">Parado há {getDaysSince(p.lastPurchaseDate)} dias</span>}
                                    </td>
                                    <td className="py-4 px-6 text-[10px] font-bold text-slate-500">{new Date(p.lastPurchaseDate).toLocaleDateString('pt-BR')}</td>
                                    <td className="py-4 px-6 text-center font-black text-slate-700">{p.quantity}</td>
                                    <td className="py-4 px-8 text-right font-black text-slate-900">{formatCurrency(p.totalValue)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden p-3 space-y-2">
                {sortedProducts.map((p, idx) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    const isRed = isRedItem(p);
                    return (
                        <div 
                            key={idx} 
                            onClick={() => toggleProduct(p.id)}
                            className={`bg-white p-4 rounded-2xl border transition-all flex items-start gap-3 shadow-sm ${isSelected ? 'border-blue-500 ring-2 ring-blue-50' : 'border-slate-100'}`}
                        >
                            <div className={`mt-1 w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200'}`}>
                                {isSelected && <span className="text-[10px] font-bold">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-[10px] font-black text-slate-800 uppercase leading-tight line-clamp-2">{p.name}</h4>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-lg border ${isRed ? 'bg-red-50 text-red-500 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                        Última: {new Date(p.lastPurchaseDate).toLocaleDateString('pt-BR')}
                                    </span>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tabular-nums">{p.quantity} UN</span>
                                </div>
                                <div className="mt-2 text-right">
                                    <span className="text-[11px] font-black text-slate-900">{formatCurrency(p.totalValue)}</span>
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
