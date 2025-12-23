
import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, FileDown, History, CalendarClock, CheckSquare, Square, AlertTriangle, ListChecks, CheckCircle2 } from 'lucide-react';
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
  const printRef = useRef<HTMLDivElement>(null);

  const sortedProducts = useMemo(() => {
    return [...client.products].sort((a, b) => {
      return new Date(a.lastPurchaseDate).getTime() - new Date(b.lastPurchaseDate).getTime();
    });
  }, [client.products]);

  // Helper para identificar se é "Vermelho" (60-90 dias)
  const isRedItem = (product: any) => {
    const daysSince = Math.floor((new Date().getTime() - new Date(product.lastPurchaseDate).getTime()) / (1000 * 3600 * 24));
    return daysSince > 60 && daysSince <= 90;
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
      // Desmarcar apenas os vermelhos
      setSelectedProductIds(prev => prev.filter(id => !redIds.includes(id)));
    } else {
      // Marcar todos os vermelhos (sem remover os brancos que já estiverem marcados)
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...redIds])));
    }
  };

  const toggleWhiteCategory = () => {
    const whiteIds = whiteItems.map(p => p.id);
    if (isAllWhiteSelected) {
      // Desmarcar apenas os brancos
      setSelectedProductIds(prev => prev.filter(id => !whiteIds.includes(id)));
    } else {
      // Marcar todos os brancos (sem remover os vermelhos que já estiverem marcados)
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...whiteIds])));
    }
  };

  const handleDownloadPDF = async () => {
    if (selectedProductIds.length === 0) return;
    setIsExporting(true);
    try {
      const element = printRef.current;
      if (!element) return;
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1000
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`sugestao_reposicao_${client.name.replace(/\s/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedProductsData = sortedProducts.filter(p => selectedProductIds.includes(p.id));
  const formatQty = (val: number) => new Intl.NumberFormat('pt-BR').format(val);

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
        
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl shadow-sm">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Histórico de Últimas Compras</h3>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Análise de Itens e Reposição</p>
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
                    className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${isAllRedSelected ? 'text-red-600' : 'text-slate-500 hover:text-red-500'}`}
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
                    Gerar Relatório
                </Button>
            </div>
        </div>

        <div className="overflow-y-auto bg-slate-50 flex-1">
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
                            const daysSince = Math.floor((new Date().getTime() - new Date(product.lastPurchaseDate).getTime()) / (1000 * 3600 * 24));
                            const isRed = isRedItem(product);
                            const unitPrice = product.quantity > 0 ? product.totalValue / product.quantity : 0;
                            
                            return (
                                <tr 
                                    key={product.id} 
                                    className={`hover:bg-slate-50 transition-all cursor-pointer ${isSelected ? 'bg-blue-50/40' : ''}`}
                                    onClick={() => toggleProduct(product.id)}
                                >
                                    <td className="py-5 px-8 text-center">
                                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200'}`}>
                                            {isSelected && <span className="text-[10px] font-bold">✓</span>}
                                        </div>
                                    </td>
                                    <td className="py-5 px-6">
                                        <p className="font-black text-slate-800 text-xs uppercase tracking-tight">{product.name}</p>
                                        {isRed && (
                                            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black bg-red-50 text-red-500 border border-red-100 uppercase tracking-widest">
                                                Sem compra há {daysSince} dias
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-5 px-6 text-slate-500 font-bold uppercase text-[10px]">
                                        <div className="flex items-center gap-2">
                                            <CalendarClock className="w-4 h-4 text-slate-300" />
                                            {new Date(product.lastPurchaseDate).toLocaleDateString('pt-BR')}
                                        </div>
                                    </td>
                                    <td className="py-5 px-6 text-right font-bold text-slate-600 tabular-nums">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unitPrice)}
                                    </td>
                                    <td className="py-5 px-6 text-center font-black text-slate-900">{formatQty(product.quantity)}</td>
                                    <td className="py-5 px-8 text-right font-black text-slate-900 tabular-nums">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.totalValue)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
      </div>

      <div className="fixed top-0 left-[-9999px] w-[900px] bg-white text-slate-900 p-12" ref={printRef}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
            <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 mb-1">Sugestão de Reposição</p>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{client.name}</h1>
            </div>
            <div className="text-right">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Relatório Gerado em</p>
                <p className="text-lg font-black text-slate-800">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
        </div>
        <table className="w-full text-left text-sm border-collapse mb-8">
            <thead>
                <tr className="border-b-2 border-slate-200 text-slate-400 uppercase text-[10px] font-black tracking-[0.2em]">
                    <th className="py-3 px-2">Item / Descrição</th>
                    <th className="py-3 px-2 text-right">Última Compra</th>
                    <th className="py-3 px-2 text-right">Preço Unit.</th>
                    <th className="py-3 px-2 text-center">Última Qtd</th>
                    <th className="py-3 px-2 text-right">Último Valor</th>
                </tr>
            </thead>
            <tbody>
                {selectedProductsData.map((product) => {
                    const unitPrice = product.quantity > 0 ? product.totalValue / product.quantity : 0;
                    const daysSince = Math.floor((new Date().getTime() - new Date(product.lastPurchaseDate).getTime()) / (1000 * 3600 * 24));
                    return (
                        <tr key={product.id} className="border-b border-slate-100">
                            <td className="py-4 px-2">
                                <p className="font-black text-slate-800 text-sm uppercase">{product.name}</p>
                                {isRedItem(product) && (
                                    <p className="text-[10px] font-black text-red-500 uppercase mt-1">
                                        Sem compra há {daysSince} dias
                                    </p>
                                )}
                            </td>
                            <td className="py-4 px-2 text-right font-bold text-slate-600 text-xs">{new Date(product.lastPurchaseDate).toLocaleDateString('pt-BR')}</td>
                            <td className="py-4 px-2 text-right font-black text-slate-900 text-xs">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unitPrice)}
                            </td>
                            <td className="py-4 px-2 text-center font-black text-slate-900 text-sm">{formatQty(product.quantity)}</td>
                            <td className="py-4 px-2 text-right font-black text-slate-800 text-sm">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.totalValue)}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-center opacity-40">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Portal Centro-Norte • Inteligência Comercial</p>
            <div className="w-12 h-12 bg-slate-900 rounded-xl"></div>
        </div>
      </div>
    </div>,
    document.body
  );
};
