
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, FileDown, History, CalendarClock, CheckSquare, Square, AlertTriangle } from 'lucide-react';
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

  const sortedProducts = [...client.products].sort((a, b) => {
    return new Date(a.lastPurchaseDate).getTime() - new Date(b.lastPurchaseDate).getTime();
  });

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedProductIds.length === sortedProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(sortedProducts.map(p => p.id));
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

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-8 bg-slate-900/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
        
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl shadow-sm">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Histórico de Últimas Compras</h3>
              <p className="text-sm font-medium text-slate-500">Analise itens sem reposição recente e gere sugestões.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 px-8">
            <button 
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors uppercase tracking-widest"
            >
                {selectedProductIds.length === sortedProducts.length ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-slate-300" />}
                Selecionar Todos
            </button>
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <span className="text-xs font-bold text-slate-400">{selectedProductIds.length} itens selecionados</span>
                <Button 
                    variant="primary" 
                    onClick={handleDownloadPDF} 
                    disabled={selectedProductIds.length === 0}
                    isLoading={isExporting}
                    className="flex-1 sm:flex-none h-11 text-xs font-bold shadow-blue-100"
                >
                    <FileDown className="w-4 h-4 mr-2" />
                    Gerar Relatório Selecionado
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
                <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                    <thead className="bg-slate-100 sticky top-0 z-10">
                        <tr className="text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-200">
                            <th className="py-4 px-8 w-16 text-center">#</th>
                            <th className="py-4 px-6">Produto</th>
                            <th className="py-4 px-6">Última Compra</th>
                            <th className="py-4 px-6 text-center">Qtd. Última</th>
                            <th className="py-4 px-8 text-right">Valor Último</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {sortedProducts.map((product) => {
                            const isSelected = selectedProductIds.includes(product.id);
                            const daysSince = Math.floor((new Date().getTime() - new Date(product.lastPurchaseDate).getTime()) / (1000 * 3600 * 24));
                            
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
                                        <p className="font-bold text-slate-800">{product.name}</p>
                                        {daysSince > 60 && (
                                            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-bold bg-red-50 text-red-500 border border-red-100 uppercase tracking-tighter">
                                                Sem compra há {daysSince} dias
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-5 px-6 text-slate-500 font-medium">
                                        <div className="flex items-center gap-2">
                                            <CalendarClock className="w-4 h-4 text-slate-300" />
                                            {new Date(product.lastPurchaseDate).toLocaleDateString('pt-BR')}
                                        </div>
                                    </td>
                                    <td className="py-5 px-6 text-center font-bold text-slate-600">{product.quantity}</td>
                                    <td className="py-5 px-8 text-right font-bold text-slate-900 tabular-nums">
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

      <div className="fixed top-0 left-[-9999px] w-[800px] bg-white text-slate-900 p-12" ref={printRef}>
        <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-end">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 mb-1">Sugestão de Reposição</p>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tighter">{client.name}</h1>
            </div>
            <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Relatório Gerado em</p>
                <p className="text-lg font-bold text-slate-800">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
        </div>
        <table className="w-full text-left text-sm border-collapse mb-8">
            <thead>
                <tr className="border-b-2 border-slate-200 text-slate-400 uppercase text-[10px] font-bold tracking-[0.2em]">
                    <th className="py-3 px-2">Item / Descrição</th>
                    <th className="py-3 px-2 text-right">Última Compra</th>
                    <th className="py-3 px-2 text-center">Últ. Qtd</th>
                    <th className="py-3 px-2 text-right">Valor Total</th>
                </tr>
            </thead>
            <tbody>
                {selectedProductsData.map((product) => (
                    <tr key={product.id} className="border-b border-slate-100">
                        <td className="py-4 px-2 font-bold text-slate-800 text-base">{product.name}</td>
                        <td className="py-4 px-2 text-right font-medium text-slate-600">{new Date(product.lastPurchaseDate).toLocaleDateString('pt-BR')}</td>
                        <td className="py-4 px-2 text-center font-bold text-slate-900">{product.quantity}</td>
                        <td className="py-4 px-2 text-right font-bold text-slate-800">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.totalValue)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-center opacity-40">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">Portal Centro-Norte • Inteligência Comercial</p>
            <div className="w-12 h-12 bg-slate-900 rounded-xl"></div>
        </div>
      </div>
    </div>,
    document.body
  );
};
