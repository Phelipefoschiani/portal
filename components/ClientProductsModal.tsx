import React, { useState, useRef } from 'react';
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
  // Nota: Como os dados mockados de produtos não têm data explícita na estrutura simples,
  // vamos simular a filtragem. Em produção, você filtraria por product.purchaseDate
  const filteredProducts = client.products.map(p => {
    // Simulação: Se filtrar, mudamos aleatoriamente os valores para parecer dinâmico
    // Se "Todos" (0) estiver selecionado, mostra o valor cheio
    const modifier = (selectedYear === 0 && selectedMonth === 0) ? 1 : Math.random();
    return {
      ...p,
      totalValue: p.totalValue * modifier,
      quantity: Math.floor(p.quantity * modifier)
    };
  })
  .filter(p => p.totalValue > 0) // Remove zerados se houver
  .sort((a, b) => b.totalValue - a.totalValue);

  const totalFiltered = filteredProducts.reduce((acc, curr) => acc + curr.totalValue, 0);

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;
    setIsExporting(true);

    try {
      // 1. Clonar o elemento para capturar todo o conteúdo (mesmo o que está com scroll)
      const element = contentRef.current;
      const clone = element.cloneNode(true) as HTMLElement;
      
      // 2. Estilizar o clone para expandir totalmente e não ter scroll
      clone.style.width = `${element.offsetWidth}px`;
      clone.style.height = 'auto';
      clone.style.overflow = 'visible';
      clone.style.position = 'absolute';
      clone.style.top = '-9999px'; // Esconder da visão do usuário
      clone.style.left = '-9999px';
      clone.style.background = '#f8fafc'; // bg-slate-50
      
      // Adicionar ao body temporariamente
      document.body.appendChild(clone);

      // 3. Gerar canvas do clone
      const canvas = await html2canvas(clone, { 
        scale: 2,
        useCORS: true,
        logging: false
      });

      // 4. Remover clone
      document.body.removeChild(clone);

      // 5. Gerar PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // Se a imagem for maior que uma página A4, o jsPDF vai cortar ou espremer.
      // Para relatórios longos simples, ajustamos a altura da página ou adicionamos imagem longa.
      // Aqui vamos ajustar se for muito grande, ou deixar em uma pagina longa customizada se preferir,
      // mas o padrão A4 com resize proporcional costuma funcionar para listas médias.
      
      // Opção: Se for muito alto, cria PDF com tamanho customizado
      if (pdfHeight > 297) {
         const longPdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight + 20]); // +20 margem
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

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div>
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Mix de Produtos
            </h3>
            <p className="text-sm text-slate-500">{client.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-sm text-slate-600">
                <Filter className="w-4 h-4" />
                Filtros:
            </div>
            <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            >
                <option value={0}>Todos os Anos</option>
                <option value={2023}>2023</option>
                <option value={2024}>2024</option>
            </select>
            <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            >
                <option value={0}>Todos os Meses</option>
                {Array.from({length: 12}, (_, i) => (
                    <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', {month: 'long'})}</option>
                ))}
            </select>
            
            <div className="ml-auto">
                <Button 
                    variant="secondary" 
                    onClick={handleDownloadPDF} 
                    isLoading={isExporting}
                    className="py-2 h-9 text-xs"
                >
                    <FileDown className="w-4 h-4 mr-2" />
                    Baixar PDF (Completo)
                </Button>
            </div>
        </div>

        {/* Content for PDF Capture */}
        <div className="overflow-y-auto p-6 bg-slate-50 flex-1" ref={contentRef}>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-4">
                    <div>
                        <h4 className="font-bold text-lg text-slate-900">Relatório de Compras por Produto</h4>
                        <p className="text-sm text-slate-500">
                            Período: {selectedMonth === 0 ? 'Todos os Meses' : selectedMonth.toString().padStart(2, '0')} / {selectedYear === 0 ? 'Todos os Anos' : selectedYear}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase font-bold">Total no Período</p>
                        <p className="text-2xl font-bold text-purple-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFiltered)}
                        </p>
                    </div>
                </div>

                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                            <th className="pb-3 font-medium">Produto</th>
                            <th className="pb-3 font-medium text-center">Qtd.</th>
                            <th className="pb-3 font-medium text-right">Valor Total</th>
                            <th className="pb-3 font-medium text-right">% Mix</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map((product, idx) => {
                            const share = (product.totalValue / totalFiltered) * 100;
                            return (
                                <tr key={product.id} className="group hover:bg-slate-50">
                                    <td className="py-3 pr-4 font-medium text-slate-700">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400 w-4">{idx + 1}.</span>
                                            {product.name}
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
                
                <div className="mt-8 pt-4 border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400">Documento gerado eletronicamente pelo Portal Centro-Norte.</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};