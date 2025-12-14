import React, { useState, useRef } from 'react';
import { X, FileDown, History, CalendarClock, CheckSquare, Square } from 'lucide-react';
import { Button } from './Button';
import { Client } from '../lib/mockData';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ClientLastPurchaseModalProps {
  client: Client;
  onClose: () => void;
}

export const ClientLastPurchaseModal: React.FC<ClientLastPurchaseModalProps> = ({ client, onClose }) => {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Ordenar produtos: Do mais antigo para o mais recente (Crescente)
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
      // Usamos o printRef (que contem apenas os itens selecionados e formatados para impressão)
      const element = printRef.current;
      if (!element) return;

      // Importante: html2canvas precisa que o elemento esteja visível no DOM.
      // O elemento agora está posicionado fora da tela (left: -9999px) mas é visível para o renderizador.
      
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff', // Garante fundo branco
        windowWidth: 1000 // Força largura da janela para garantir layout
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      if (pdfHeight > 297) {
        const longPdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight + 20]);
        longPdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        longPdf.save(`sugestao_reposicao_${client.name.replace(/\s/g, '_')}.pdf`);
      } else {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`sugestao_reposicao_${client.name.replace(/\s/g, '_')}.pdf`);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  // Produtos selecionados para exibição no relatório oculto
  const selectedProductsData = sortedProducts.filter(p => selectedProductIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-amber-600" />
              Histórico de Últimas Compras
            </h3>
            <p className="text-sm text-slate-500">Analise itens sem reposição recente e gere sugestões.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
            <button 
                onClick={toggleAll}
                className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
            >
                {selectedProductIds.length === sortedProducts.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                Selecionar Todos
            </button>
            
            <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-500">{selectedProductIds.length} itens selecionados</span>
                <Button 
                    variant="primary" 
                    onClick={handleDownloadPDF} 
                    disabled={selectedProductIds.length === 0}
                    isLoading={isExporting}
                    className="py-2 h-9 text-xs"
                >
                    <FileDown className="w-4 h-4 mr-2" />
                    Gerar Relatório Selecionado
                </Button>
            </div>
        </div>

        {/* List View */}
        <div className="overflow-y-auto p-0 bg-slate-50 flex-1">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                    <tr className="text-slate-500">
                        <th className="py-3 px-6 w-12 text-center">#</th>
                        <th className="py-3 px-6 font-medium">Produto</th>
                        <th className="py-3 px-6 font-medium">Última Compra</th>
                        <th className="py-3 px-6 font-medium text-center">Qtd. Última</th>
                        <th className="py-3 px-6 font-medium text-right">Valor Último</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                    {sortedProducts.map((product) => {
                        const isSelected = selectedProductIds.includes(product.id);
                        const daysSince = Math.floor((new Date().getTime() - new Date(product.lastPurchaseDate).getTime()) / (1000 * 3600 * 24));
                        
                        return (
                            <tr 
                                key={product.id} 
                                className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/30' : ''}`}
                                onClick={() => toggleProduct(product.id)}
                            >
                                <td className="py-3 px-6 text-center">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center mx-auto ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                                        {isSelected && <span className="text-[10px]">✓</span>}
                                    </div>
                                </td>
                                <td className="py-3 px-6 font-medium text-slate-700">
                                    {product.name}
                                    {daysSince > 90 && (
                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
                                            {daysSince} dias
                                        </span>
                                    )}
                                </td>
                                <td className="py-3 px-6 text-slate-600 flex items-center gap-2">
                                    <CalendarClock className="w-4 h-4 text-slate-400" />
                                    {new Date(product.lastPurchaseDate).toLocaleDateString('pt-BR')}
                                </td>
                                <td className="py-3 px-6 text-center text-slate-600">{product.quantity}</td>
                                <td className="py-3 px-6 text-right font-medium text-slate-700">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.totalValue)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>

      {/* Hidden Print Container - Fixed positioning off-screen to allow html2canvas to render it */}
      <div 
        className="fixed top-0 left-[-9999px] w-[800px] bg-white text-slate-900 p-8" 
        ref={printRef}
      >
        <div className="border-b-2 border-slate-800 pb-4 mb-6 flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">{client.name}</h1>
            </div>
            <div className="text-right">
                <p className="text-sm text-slate-500">Gerado em: {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
        </div>

        <table className="w-full text-left text-sm border-collapse mb-8">
            <thead>
                <tr className="border-b border-slate-300 text-slate-600">
                    <th className="py-2 font-bold w-[40%]">Produto</th>
                    <th className="py-2 text-right w-[20%]">Últ. Compra</th>
                    <th className="py-2 text-right w-[20%]">Valor Total</th>
                    <th className="py-2 text-center w-[20%]">Qtd.</th>
                </tr>
            </thead>
            <tbody>
                {selectedProductsData.map((product) => (
                    <tr key={product.id} className="border-b border-slate-100">
                        <td className="py-3 font-medium text-slate-800">{product.name}</td>
                        <td className="py-3 text-right text-slate-600">{new Date(product.lastPurchaseDate).toLocaleDateString('pt-BR')}</td>
                        <td className="py-3 text-right text-slate-600">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.totalValue)}
                        </td>
                        <td className="py-3 text-center text-slate-600 font-medium">{product.quantity}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        <div className="text-center text-xs text-slate-400 mt-12 border-t border-slate-100 pt-4">
            Relatório gerado pelo Portal Centro-Norte
        </div>
      </div>

    </div>
  );
};