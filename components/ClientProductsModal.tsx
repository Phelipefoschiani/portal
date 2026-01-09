
import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, FileDown, Package, Filter, Loader2, FileSpreadsheet } from 'lucide-react';
import { Button } from './Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

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

  // Ordenação por valor para o Mix
  const sortedProducts = useMemo(() => {
    return [...client.products].sort((a, b) => b.totalValue - a.totalValue);
  }, [client.products]);

  const totalFaturado = useMemo(() => {
    return sortedProducts.reduce((acc, curr) => acc + curr.totalValue, 0);
  }, [sortedProducts]);

  // Lógica de Paginação para o PDF (aprox 18 itens por página)
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
    
    const excelData = sortedProducts.map(p => ({
        "Produto": p.name,
        "QTD": p.quantity,
        "Valor Total": p.totalValue
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mix de Produtos");
    
    // Auto-ajuste das colunas
    const colWidths = [{ wch: 40 }, { wch: 10 }, { wch: 15 }];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `mix_produtos_${client.name.replace(/\s/g, '_')}.xlsx`);
  };

  const handleDownloadPDF = async () => {
    if (sortedProducts.length === 0) return;
    setIsExporting(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      const pageElements = exportPagesRef.current?.querySelectorAll('.mix-pdf-page');
      if (!pageElements) return;

      for (let i = 0; i < pageElements.length; i++) {
        const canvas = await html2canvas(pageElements[i] as HTMLElement, { 
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 800
        });

        const imgData = canvas.toDataURL('image/png');
        const imgHeightInPDF = (canvas.height * pdfWidth) / canvas.width;
        
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeightInPDF);
      }

      pdf.save(`mix_produtos_${client.name.replace(/\s/g, '_')}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar o relatório. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
        
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl shadow-sm">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Mix de Produtos Ativo</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center px-8 shrink-0">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
               <Filter className="w-4 h-4 text-purple-500" />
               {sortedProducts.length} itens encontrados
            </div>
            
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    onClick={handleDownloadExcel}
                    className="h-11 px-8 rounded-xl text-[10px] font-black border-emerald-200 text-emerald-600 hover:bg-emerald-50 uppercase tracking-widest"
                >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Gerar Excel
                </Button>
                <Button 
                    variant="secondary" 
                    onClick={handleDownloadPDF} 
                    isLoading={isExporting}
                    className="h-11 px-8 rounded-xl text-[10px] font-black shadow-purple-100 uppercase tracking-widest bg-purple-600 hover:bg-purple-700"
                >
                    <FileDown className="w-4 h-4 mr-2" />
                    Gerar PDF
                </Button>
            </div>
        </div>

        <div className="overflow-y-auto p-6 bg-slate-50 flex-1 custom-scrollbar">
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-200">
                        <tr className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                            <th className="py-4 px-8 w-12 text-center">#</th>
                            <th className="py-4 px-6">Produto</th>
                            <th className="py-4 px-6 text-center">Qtd.</th>
                            <th className="py-4 px-6 text-right">Valor Total</th>
                            <th className="py-4 px-8 text-right">Participação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedProducts.map((product, idx) => {
                            const participation = totalFaturado > 0 ? (product.totalValue / totalFaturado) * 100 : 0;
                            return (
                                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="py-4 px-8 text-center text-slate-300 font-black text-xs">{idx + 1}</td>
                                    <td className="py-4 px-6">
                                        <p className="font-black text-slate-800 text-xs uppercase tracking-tight group-hover:text-purple-600 transition-colors">{product.name}</p>
                                    </td>
                                    <td className="py-4 px-6 text-center font-bold text-slate-600 tabular-nums">{product.quantity}</td>
                                    <td className="py-4 px-6 text-right font-black text-slate-900 tabular-nums">
                                        {formatCurrency(product.totalValue)}
                                    </td>
                                    <td className="py-4 px-8 text-right">
                                        <div className="flex items-center justify-end gap-3">
                                            <span className="text-[10px] font-black text-slate-400">{participation.toFixed(1)}%</span>
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-purple-500" style={{ width: `${participation}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

      <div className="fixed top-0 left-[-9999px] w-[800px]" ref={exportPagesRef}>
        {productBatches.map((batch, pageIdx) => (
          <div key={pageIdx} className="mix-pdf-page bg-white p-12 text-slate-900 min-h-[1100px] flex flex-col">
            <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-600 mb-1">Participação no Mix - Página {pageIdx + 1}/{productBatches.length}</p>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{client.name}</h1>
                </div>
                <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Relatório Gerado em</p>
                    <p className="text-lg font-black text-slate-800">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            <div className="flex-1">
                <div className="mb-6 flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faturamento Acumulado</span>
                    <span className="text-xl font-black text-purple-600">{formatCurrency(totalFaturado)}</span>
                </div>

                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr className="border-b-2 border-slate-200 text-slate-400 uppercase text-[10px] font-black tracking-[0.2em]">
                            <th className="py-3 px-2 w-10">#</th>
                            <th className="py-3 px-2">Descrição do Produto</th>
                            <th className="py-3 px-2 text-center">Quantidade</th>
                            <th className="py-3 px-2 text-right">Valor Total</th>
                            <th className="py-3 px-2 text-right">Partic. (%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {batch.map((product, idx) => {
                            const globalIdx = (pageIdx * ITEMS_PER_PAGE) + idx + 1;
                            const participation = totalFaturado > 0 ? (product.totalValue / totalFaturado) * 100 : 0;

                            return (
                                <tr key={product.id} className="border-b border-slate-100">
                                    <td className="py-4 px-2 text-slate-300 font-bold text-xs">{globalIdx}</td>
                                    <td className="py-4 px-2">
                                        <p className="font-black text-slate-800 text-xs uppercase">{product.name}</p>
                                    </td>
                                    <td className="py-4 px-2 text-center font-bold text-slate-600 text-xs">{product.quantity}</td>
                                    <td className="py-4 px-2 text-right font-black text-slate-900 text-xs">
                                        {formatCurrency(product.totalValue)}
                                    </td>
                                    <td className="py-4 px-2 text-right font-black text-purple-600 text-xs">
                                       {participation.toFixed(1)}%
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center opacity-40">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Portal Centro-Norte • Inteligência de Mercado</p>
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black">CN</div>
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
};
