import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, FileDown, Package, Filter } from 'lucide-react';
import { Button } from './Button';
import { Client, Product } from '../lib/mockData';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ClientProductsModalProps {
  client: Client;
  onClose: () => void;
}

export const ClientProductsModal: React.FC<ClientProductsModalProps> = ({ client, onClose }) => {
  // 0 representa "Todos"
  const [selectedYear, setSelectedYear] = useState<number>(0); 
  const [selectedMonth, setSelectedMonth] = useState<number>(0); 
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Filtragem
  const filteredProducts = client.products.map(p => {
    const modifier = (selectedYear === 0 && selectedMonth === 0) ? 1 : Math.random();
    return {
      ...p,
      totalValue: p.totalValue * modifier,
      quantity: Math.floor(p.quantity * modifier)
    };
  })
  .filter(p => p.totalValue > 0)
  .sort((a, b) => b.totalValue - a.totalValue);

  const totalFiltered = filteredProducts.reduce((acc, curr) => acc + curr.totalValue, 0);

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;
    setIsExporting(true);

    try {
      const element = contentRef.current;
      const clone = element.cloneNode(true) as HTMLElement;
      
      // FIX: Configurações específicas para impressão
      clone.style.width = '1200px';  // Largura fixa generosa
      clone.style.height = 'auto';
      clone.style.overflow = 'visible';
      clone.style.position = 'absolute';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.background = '#f8fafc';
      clone.style.padding = '40px'; 
      
      // Ajustes de estilo para evitar cortes
      const container = clone.querySelector('div.bg-white');
      if (container) {
          (container as HTMLElement).style.maxWidth = 'none';
          (container as HTMLElement).style.boxShadow = 'none';
      }

      // Forçar quebra de linha nos nomes dos produtos dentro do clone
      const productCells = clone.querySelectorAll('td.product-name-cell span.break-words');
      productCells.forEach((cell: any) => {
         cell.style.whiteSpace = 'normal';
         cell.style.wordWrap = 'break-word';
      });

      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, { 
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1200 // Força o contexto de renderização
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      if (pdfHeight > 297) {
         const longPdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight + 20]);
         longPdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
         longPdf.save(`mix_produtos_${client.name.replace(/\s/g, '_')}_completo.pdf`);
      } else {
         pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
         pdf.save(`mix_produtos_${client.name.replace(/\s/g, '_')}.pdf`);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    // Z-Index 110 para garantir que fique acima do Modal de Detalhes (Z-100)
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl rounded-xl md:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl md:rounded-t-2xl">
          <div>
            <h3 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Mix de Produtos
            </h3>
            <p className="text-xs md:text-sm text-slate-500 line-clamp-1">{client.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters - Stacked on Mobile */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-col md:flex-row gap-3 md:gap-4 md:items-center">
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <div className="flex items-center gap-2 text-sm text-slate-600 w-full md:w-auto mb-1 md:mb-0">
                    <Filter className="w-4 h-4" />
                    Filtros:
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <select 
                      value={selectedYear} 
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="flex-1 md:flex-none px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                      <option value={0}>Todos Anos</option>
                      <option value={2023}>2023</option>
                      <option value={2024}>2024</option>
                  </select>
                  <select 
                      value={selectedMonth} 
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="flex-[2] md:flex-none px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                      <option value={0}>Todos Meses</option>
                      {Array.from({length: 12}, (_, i) => (
                          <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', {month: 'long'})}</option>
                      ))}
                  </select>
                </div>
            </div>
            
            <div className="md:ml-auto w-full md:w-auto">
                <Button 
                    variant="secondary" 
                    onClick={handleDownloadPDF} 
                    isLoading={isExporting}
                    className="w-full md:w-auto py-2 h-10 md:h-9 text-sm md:text-xs justify-center"
                >
                    <FileDown className="w-4 h-4 mr-2" />
                    Baixar PDF
                </Button>
            </div>
        </div>

        {/* Content for PDF Capture */}
        <div className="overflow-y-auto p-4 md:p-6 bg-slate-50 flex-1" ref={contentRef}>
            <div className="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between md:items-end mb-6 border-b border-slate-100 pb-4 gap-4">
                    <div>
                        <h4 className="font-bold text-lg text-slate-900">Relatório de Compras</h4>
                        <p className="text-sm text-slate-500">
                            Período: {selectedMonth === 0 ? 'Geral' : selectedMonth.toString().padStart(2, '0')} / {selectedYear === 0 ? 'Geral' : selectedYear}
                        </p>
                    </div>
                    <div className="text-left md:text-right bg-purple-50 p-3 md:bg-transparent md:p-0 rounded-lg">
                        <p className="text-xs text-slate-400 uppercase font-bold">Total no Período</p>
                        <p className="text-xl md:text-2xl font-bold text-purple-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFiltered)}
                        </p>
                    </div>
                </div>

                {/* Tabela Responsiva com Scroll Horizontal no Mobile */}
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <div className="min-w-[500px] px-4 md:px-0">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                                <th className="pb-3 font-medium w-[40%]">Produto</th>
                                <th className="pb-3 font-medium text-center w-[15%]">Qtd.</th>
                                <th className="pb-3 font-medium text-right w-[25%]">Valor Total</th>
                                <th className="pb-3 font-medium text-right w-[20%]">% Mix</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredProducts.map((product, idx) => {
                                const share = (product.totalValue / totalFiltered) * 100;
                                return (
                                    <tr key={product.id} className="group hover:bg-slate-50">
                                        <td className="py-3 pr-4 font-medium text-slate-700 product-name-cell">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400 w-4 flex-shrink-0">{idx + 1}.</span>
                                                <span className="break-words">{product.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-center text-slate-600">{product.quantity}</td>
                                        <td className="py-3 text-right font-semibold text-slate-800">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.totalValue)}
                                        </td>
                                        <td className="py-3 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-xs text-slate-500">{share.toFixed(1)}%</span>
                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-purple-500" style={{ width: `${share}%` }}></div>
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
                
                <div className="mt-8 pt-4 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400">Documento gerado eletronicamente pelo Portal Centro-Norte.</p>
                </div>
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
};