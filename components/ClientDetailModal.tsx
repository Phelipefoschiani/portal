import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, TrendingUp, Calendar, AlertCircle, Package, Target, History } from 'lucide-react';
import { Button } from './Button';
import { ClientProductsModal } from './ClientProductsModal';
import { ClientLastPurchaseModal } from './ClientLastPurchaseModal';
import { Client } from '../lib/mockData';
import html2canvas from 'html2canvas';

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({ client, onClose }) => {
  const [year, setYear] = useState(2024);
  const [showProducts, setShowProducts] = useState(false);
  const [showLastPurchase, setShowLastPurchase] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Filtra histórico pelo ano
  const yearData = client.history.filter(h => h.year === year).sort((a, b) => a.month - b.month);

  // Cálculos do Resumo
  const monthsPassed = yearData.length; // Assumindo dados populados
  const monthsPositive = yearData.filter(d => d.value > 0).length;
  const totalFaturado = yearData.reduce((acc, curr) => acc + curr.value, 0);
  const totalMeta = yearData.reduce((acc, curr) => acc + curr.target, 0);
  const percentualAlcance = totalMeta > 0 ? (totalFaturado / totalMeta) * 100 : 0;
  const averagePurchase = monthsPositive > 0 ? totalFaturado / monthsPositive : 0;

  const handleDownloadImage = async () => {
    if (!contentRef.current) return;
    setIsDownloading(true);
    try {
      // Técnica de Clonagem para capturar todo o conteúdo (scroll)
      const element = contentRef.current;
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Ajusta estilos do clone
      clone.style.width = `${element.offsetWidth}px`;
      clone.style.height = 'auto'; // Altura automática para mostrar tudo
      clone.style.overflow = 'visible'; // Remove barra de rolagem
      clone.style.position = 'absolute';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.background = '#f8fafc'; // bg-slate-50
      
      // Criar cabeçalho para a imagem (já que o header original fica fora do scroll)
      const headerDiv = document.createElement('div');
      headerDiv.style.padding = '24px';
      headerDiv.style.background = '#ffffff';
      headerDiv.style.borderBottom = '1px solid #e2e8f0';
      headerDiv.style.marginBottom = '0px';
      headerDiv.innerHTML = `
        <h1 style="font-size: 24px; font-weight: bold; color: #1e293b; margin-bottom: 4px;">${client.name}</h1>
        <div style="display: flex; gap: 16px; font-size: 14px; color: #64748b;">
          <span>CNPJ: ${client.cnpj}</span>
          <span>•</span>
          <span>${client.city}</span>
          <span>•</span>
          <span>Ano Ref: ${year}</span>
        </div>
      `;
      
      // Inserir header no topo do clone
      clone.insertBefore(headerDiv, clone.firstChild);

      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, { 
        scale: 2,
        useCORS: true 
      });

      document.body.removeChild(clone);

      const link = document.createElement('a');
      link.download = `relatorio_${client.name.replace(/\s/g, '_')}_${year}_completo.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Usando Portal para renderizar fora da hierarquia DOM atual (que pode ter transform/opacity)
  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white w-full max-w-6xl rounded-xl md:rounded-2xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh]">
          
          {/* Header Responsivo */}
          <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start md:items-center bg-slate-50 rounded-t-xl md:rounded-t-2xl">
            <div className="pr-8 md:pr-0">
              {/* Removido line-clamp-1 para evitar corte de nome */}
              <h2 className="text-lg md:text-2xl font-bold text-slate-800">{client.name}</h2>
              <div className="flex flex-col md:flex-row md:gap-4 mt-1 text-xs md:text-sm text-slate-500">
                <span>CNPJ: {client.cnpj}</span>
                <span className="hidden md:inline">•</span>
                <span>{client.city}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={onClose} className="p-2 -mr-2 md:mr-0 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Controls Bar Responsiva */}
          <div className="p-4 bg-white border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
             <div className="flex items-center gap-3 w-full md:w-auto">
               <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Ano Ref:</label>
               <select 
                 value={year} 
                 onChange={(e) => setYear(Number(e.target.value))}
                 className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full md:w-auto p-2.5 outline-none"
               >
                 <option value={2023}>2023</option>
                 <option value={2024}>2024</option>
               </select>
             </div>
             
             {/* Botões em Grid no Mobile, Flex no Desktop */}
             <div className="grid grid-cols-2 md:flex gap-2 md:gap-3 w-full md:w-auto">
               <Button variant="outline" onClick={() => setShowLastPurchase(true)} className="h-10 px-3 text-xs md:text-sm justify-center border-amber-200 hover:border-amber-500 hover:text-amber-600 text-slate-600 col-span-2 md:col-span-1">
                  <History className="w-4 h-4 mr-2" />
                  Reposição
               </Button>
               <Button variant="secondary" onClick={() => setShowProducts(true)} className="h-10 px-3 text-xs md:text-sm justify-center">
                  <Package className="w-4 h-4 mr-2" />
                  Produtos
               </Button>
               <Button variant="outline" onClick={handleDownloadImage} isLoading={isDownloading} className="h-10 px-3 text-xs md:text-sm justify-center">
                  <Download className="w-4 h-4 mr-2" />
                  Salvar
               </Button>
             </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto p-4 md:p-6 bg-slate-50 flex-1" ref={contentRef}>
            
            {/* KPI Cards Grid Responsivo */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
               <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 col-span-2 md:col-span-1">
                  <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Média Mensal</p>
                  <p className="text-base md:text-lg font-bold text-slate-800">{formatCurrency(averagePurchase)}</p>
               </div>
               
               <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Meta Total</p>
                  <p className="text-base md:text-lg font-bold text-slate-700">{formatCurrency(totalMeta)}</p>
               </div>

               <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200">
                  <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Faturado</p>
                  <p className="text-base md:text-lg font-bold text-emerald-600">{formatCurrency(totalFaturado)}</p>
               </div>

               <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                  <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Alcançado</p>
                  <div className="flex items-end gap-2">
                     <p className={`text-base md:text-xl font-bold ${percentualAlcance >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                       {percentualAlcance.toFixed(1)}%
                     </p>
                  </div>
                  <div className="w-full h-1 bg-slate-100 mt-2 rounded-full overflow-hidden">
                     <div className={`h-full ${percentualAlcance >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(percentualAlcance, 100)}%` }}></div>
                  </div>
               </div>

               <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-200 col-span-2 md:col-span-1">
                  <p className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Positivação</p>
                  <p className="text-base md:text-lg font-bold text-blue-600">{monthsPositive} <span className="text-sm font-normal text-slate-400">/ {monthsPassed} meses</span></p>
               </div>
            </div>

            {/* Monthly Grid */}
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Histórico Mensal
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }, (_, i) => {
                const monthNum = i + 1;
                const data = yearData.find(d => d.month === monthNum);
                const hasData = data && data.value > 0;
                
                return (
                  <div key={monthNum} className={`p-4 rounded-xl border transition-all ${hasData ? 'bg-white border-slate-200' : 'bg-slate-100/50 border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-slate-700 capitalize">
                        {new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
                      </span>
                      {hasData ? (
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">POSITIVADO</span>
                      ) : (
                        <span className="bg-slate-200 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">SEM COMPRA</span>
                      )}
                    </div>

                    {hasData ? (
                      <div className="space-y-2">
                         <div className="flex justify-between text-sm">
                           <span className="text-slate-500">Realizado:</span>
                           <span className="font-bold text-slate-900">{formatCurrency(data.value)}</span>
                         </div>
                         <div className="flex justify-between text-sm">
                           <span className="text-slate-500">Meta:</span>
                           <span className="text-slate-600">{formatCurrency(data.target)}</span>
                         </div>
                         <div className="pt-2">
                            <div className="flex justify-between text-xs mb-1">
                               <span className="text-slate-400">Atingimento</span>
                               <span className={`font-bold ${(data.value / data.target) >= 1 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                 {((data.value / data.target) * 100).toFixed(0)}%
                               </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                               <div 
                                 className={`h-full rounded-full ${(data.value / data.target) >= 1 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                 style={{ width: `${Math.min((data.value / data.target) * 100, 100)}%` }}
                               ></div>
                            </div>
                         </div>
                      </div>
                    ) : (
                      <div className="h-20 flex flex-col items-center justify-center text-slate-400">
                        <AlertCircle className="w-6 h-6 mb-1 opacity-20" />
                        <span className="text-xs">Nenhum registro</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      </div>

      {/* Nested Product Modal */}
      {showProducts && (
        <ClientProductsModal 
          client={client} 
          onClose={() => setShowProducts(false)} 
        />
      )}

      {/* Nested Last Purchase Modal */}
      {showLastPurchase && (
        <ClientLastPurchaseModal
          client={client}
          onClose={() => setShowLastPurchase(false)}
        />
      )}
    </>,
    document.body
  );
};