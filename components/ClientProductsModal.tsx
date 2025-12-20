
import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, FileDown, Package, Filter } from 'lucide-react';
import { Button } from './Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ClientProductsModalProps {
  client: {
    id: string;
    name: string;
    products: any[];
  };
  onClose: () => void;
}

export const ClientProductsModal: React.FC<ClientProductsModalProps> = ({ client, onClose }) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(0); 
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Agora usamos os produtos reais que vieram do banco (já filtrados por ano no modal pai)
  // Se quiser filtrar por mês aqui, os dados de produtos precisariam conter o mês da venda.
  // Como o productsData no pai já é um resumo anual, vamos exibir o Mix Anual ou permitir busca.
  
  const filteredProducts = useMemo(() => {
    // Se no futuro passarmos a data da venda para os produtos, filtraríamos aqui.
    // Por enquanto, exibimos o Mix consolidado que o banco retornou para o ano selecionado.
    return client.products.sort((a, b) => b.totalValue - a.totalValue);
  }, [client.products]);

  const totalFiltered = filteredProducts.reduce((acc, curr) => acc + curr.totalValue, 0);

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;
    setIsExporting(true);

    try {
      const element = contentRef.current;
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`mix_produtos_${client.name.replace(/\s/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
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

        <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
               <Filter className="w-4 h-4" />
               Listando {filteredProducts.length} itens vendidos no ano
            </div>
            
            <Button 
                variant="secondary" 
                onClick={handleDownloadPDF} 
                isLoading={isExporting}
                className="h-10 text-sm"
            >
                <FileDown className="w-4 h-4 mr-2" />
                Baixar PDF
            </Button>
        </div>

        <div className="overflow-y-auto p-6 bg-slate-50 flex-1">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200" ref={contentRef}>
                <div className="flex justify-between items-end mb-8 border-b border-slate-100 pb-4">
                    <div>
                        <h4 className="font-bold text-xl text-slate-900">Mix de Produtos Ativo</h4>
                        <p className="text-sm text-slate-500">Análise de volume e faturamento por item</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Total Faturado</p>
                        <p className="text-2xl font-black text-purple-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalFiltered)}
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                                <th className="pb-3 font-bold uppercase tracking-wider text-[10px]">Produto</th>
                                <th className="pb-3 font-bold uppercase tracking-wider text-[10px] text-center">Qtd.</th>
                                <th className="pb-3 font-bold uppercase tracking-wider text-[10px] text-right">Valor Total</th>
                                <th className="pb-3 font-bold uppercase tracking-wider text-[10px] text-right">Participação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredProducts.map((product, idx) => {
                                const share = totalFiltered > 0 ? (product.totalValue / totalFiltered) * 100 : 0;
                                return (
                                    <tr key={product.id} className="group hover:bg-slate-50">
                                        <td className="py-4 pr-4 font-bold text-slate-700">
                                            <div className="flex items-center gap-3">
                                                <span className="text-[10px] text-slate-300 w-4">{idx + 1}.</span>
                                                {product.name}
                                            </div>
                                        </td>
                                        <td className="py-4 text-center text-slate-600 font-medium">{product.quantity}</td>
                                        <td className="py-4 text-right font-black text-slate-900">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.totalValue)}
                                        </td>
                                        <td className="py-4 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <span className="text-[10px] font-black text-slate-400">{share.toFixed(1)}%</span>
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
        </div>
      </div>
    </div>,
    document.body
  );
};
