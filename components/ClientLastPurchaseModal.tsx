
import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, FileDown, History, CalendarClock, CheckSquare, Square, AlertTriangle, ListChecks, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { Button } from './Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  
  const exportPagesRef = useRef<HTMLDivElement>(null);

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
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const toggleRedCategory = () => {
    const redIds = redItems.map(p => p.id);
    if (isAllRedSelected) {
      setSelectedProductIds(prev => prev.filter(id => !redIds.includes(id)));
    } else {
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...redIds])));
    }
  };

  const toggleWhiteCategory = () => {
    const whiteIds = whiteItems.map(p => p.id);
    if (isAllWhiteSelected) {
      setSelectedProductIds(prev => prev.filter(id => !whiteIds.includes(id)));
    } else {
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...whiteIds])));
    }
  };

  const selectedProductsData = sortedProducts.filter(p => selectedProductIds.includes(p.id));
  const ITEMS_PER_PAGE = 15;
  const productBatches = useMemo(() => {
    const batches = [];
    for (let i = 0; i < selectedProductsData.length; i += ITEMS_PER_PAGE) {
      batches.push(selectedProductsData.slice(i, i + ITEMS_PER_PAGE));
    }
    return batches;
  }, [selectedProductsData]);

  const handleDownloadPDF = async () => {
    if (selectedProductIds.length === 0) return;
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      
      const pageElements = exportPagesRef.current?.querySelectorAll('.pdf-page-container');
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

      pdf.save(`sugestao_reposicao_${client.name.replace(/\s/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar o PDF. Verifique se o navegador possui permissões de download.');
    } finally {
      setIsExporting(false);
    }
  };

  const formatQty = (val: number) => new Intl.NumberFormat('pt-BR').format(val);
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
        
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl shadow-sm">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Sugestão de Reposição</h3>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 px-8">
            <div className="flex items-center gap-6">
                <button 
                    onClick={toggleWhiteCategory}
                    className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${isAllWhiteSelected ? 'text-blue-600' : 'text-slate-500 hover:text-blue-500'}`}
                >
                    {isAllWhiteSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-300" />}
                    Selecionar Brancos
                </button>
                <button 
                    onClick={toggleRedCategory}
                    className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${isAllRedSelected ? 'text-red-600' : 'text-slate-500 hover:text-blue-500'}`}
                >
                    {isAllRedSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-300" />}
                    Selecionar Vermelhos
                </button>
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <span className="text-[10px] font-black text-slate-400 uppercase">{selectedProductIds.length} itens marcados</span>
                <Button 
                    variant="primary" 
                    onClick={handleDownloadPDF} 
                    disabled={selectedProductIds.length === 0}
                    isLoading={isExporting}
                    className="flex-1 sm:flex-none h-11 text-[10px] font-black shadow-blue-100 uppercase tracking-widest"
                >
                    <FileDown className="w-4 h-4 mr-2" />
                    Gerar Relatório PDF
                </Button>
            </div>
        </div>

        <div className="overflow-y-auto bg-slate-50 flex-1 custom-scrollbar">
            {sortedProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-slate-300">
                    <AlertTriangle className="w-12 h-12 mb-2 opacity-20" />
                    <p className="font-bold uppercase text-xs tracking-widest">Nenhum histórico encontrado</p>
                </div>
            ) : (
                <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                    <thead className="bg-slate-100 sticky top-0 z-10">
                        <tr className="text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-200">
                            <th className="py-4 px-8 w-16 text-center">#</th>
                            <th className="py-4 px-6">Produto</th>
                            <th className="py-4 px-6">Última Compra</th>
                            <th className="py-4 px-6 text-right">Preço Unit.</th>
                            <th className="py-4 px-6 text-center">Última Qtd</th>
                            <th className="py-4 px-8 text-right">Último Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {sortedProducts.map((product) => {
                            const isSelected = selectedProductIds.includes(product.id);
                            const isRed = isRedItem(product);
                            const unitPrice = product.quantity > 0 ? product.totalValue / product.quantity : 0;
                            const daysSince = getDaysSince(product.lastPurchaseDate);
                            
                            return (
                                <tr 
                                    key={product.id} 
                                    className={`hover:bg-slate-50 transition-all cursor-pointer ${isSelected ? 'bg-blue-50/40' : ''}`}
                                    onClick={() => toggleProduct(product.id)}
                                >
                                    <td className="py-4 px-8 text-center">
                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200'}`}>
                                            {isSelected && <span className="text-[10px] font-bold">✓</span>}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <p className="font-black text-slate-800 text-xs uppercase tracking-tight">{product.name}</p>
                                        {isRed && (
                                            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black bg-red-50 text-red-500 border border-red-100 uppercase tracking-widest">
                                                Sem compra há {daysSince} dias
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-slate-500 font-bold uppercase text-[10px]">
                                        <div className="flex items-center gap-2">
                                            <CalendarClock className="w-4 h-4 text-slate-300" />
                                            {new Date(product.lastPurchaseDate).toLocaleDateString('pt-BR')}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-right font-bold text-slate-600 tabular-nums">
                                        {formatCurrency(unitPrice)}
                                    </td>
                                    <td className="py-4 px-6 text-center font-black text-slate-900">{formatQty(product.quantity)}</td>
                                    <td className="py-4 px-8 text-right font-black text-slate-900 tabular-nums">
                                        {formatCurrency(product.totalValue)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
      </div>

      <div className="fixed top-0 left-[-9999px] w-[800px]" ref={exportPagesRef}>
        {productBatches.map((batch, pageIdx) => (
          <div key={pageIdx} className="pdf-page-container bg-white p-12 text-slate-900 min-h-[1120px] flex flex-col">
            <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Sugestão de Reposição • Página {pageIdx + 1}/{productBatches.length}</p>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{client.name}</h1>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Inteligência Comercial Centro-Norte</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Data do Relatório</p>
                    <p className="text-lg font-black text-slate-800">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            <div className="flex-1">
                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr className="border-b-2 border-slate-200 bg-slate-50 text-slate-400 uppercase text-[10px] font-black tracking-[0.2em]">
                            <th className="py-4 px-2">Item / Descrição</th>
                            <th className="py-4 px-2 text-right">Última Compra</th>
                            <th className="py-4 px-2 text-right">Preço Unit.</th>
                            <th className="py-4 px-2 text-center">Última Qtd</th>
                            <th className="py-4 px-2 text-right">Último Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {batch.map((product) => {
                            const unitPrice = product.quantity > 0 ? product.totalValue / product.quantity : 0;
                            const daysSince = getDaysSince(product.lastPurchaseDate);
                            const isRed = isRedItem(product);

                            return (
                                <tr key={product.id} className="border-b border-slate-100">
                                    <td className="py-4 px-2">
                                        <p className="font-black text-slate-800 text-sm uppercase leading-tight">{product.name}</p>
                                        {isRed && (
                                            <p className="text-[10px] font-black text-red-500 uppercase mt-1">
                                                * Crítico: Sem compra há {daysSince} dias
                                            </p>
                                        )}
                                    </td>
                                    <td className="py-4 px-2 text-right font-bold text-slate-600 text-xs">{new Date(product.lastPurchaseDate).toLocaleDateString('pt-BR')}</td>
                                    <td className="py-4 px-2 text-right font-black text-slate-900 text-xs">
                                        {formatCurrency(unitPrice)}
                                    </td>
                                    <td className="py-4 px-2 text-center font-black text-slate-900 text-sm">{formatQty(product.quantity)}</td>
                                    <td className="py-4 px-2 text-right font-black text-slate-800 text-sm">
                                       {formatCurrency(product.totalValue)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center opacity-40">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 italic">Portal Centro-Norte • Este documento é exclusivo para suporte comercial.</p>
                <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black">CN</div>
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
};
