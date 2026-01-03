
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Calendar, AlertCircle, Package, Target, History, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { ClientProductsModal } from './ClientProductsModal';
import { ClientLastPurchaseModal } from './ClientLastPurchaseModal';
import { supabase } from '../lib/supabase';
import html2canvas from 'html2canvas';

interface ClientDetailModalProps {
  client: any; 
  onClose: () => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({ client, onClose }) => {
  // Ano de referência padrão é o ano atual
  const [year, setYear] = useState(new Date().getFullYear());
  const [showProducts, setShowProducts] = useState(false);
  const [showLastPurchase, setShowLastPurchase] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  const cleanCnpj = (val: string) => String(val || '').replace(/\D/g, '');

  useEffect(() => {
    if (client) {
      fetchClientFullData();
    }
  }, [client, year]);

  const fetchClientFullData = async () => {
    setIsLoading(true);
    const cleanedCnpj = cleanCnpj(client.cnpj);
    try {
      // BUSCA HISTÓRICO COMPLETO (Sem filtro de data para Reposição e Mix)
      const { data: allSales } = await supabase
        .from('dados_vendas')
        .select('*')
        .eq('cnpj', cleanedCnpj)
        .limit(10000);

      // BUSCA METAS DO ANO SELECIONADO
      const { data: targets } = await supabase
        .from('metas_clientes')
        .select('*')
        .eq('cliente_id', client.id)
        .eq('ano', year);

      // 1. Processar Histórico Mensal (Filtrado pelo Ano Selecionado)
      const monthlyHistory = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        const monthSales = allSales?.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return d.getUTCMonth() + 1 === monthNum && d.getUTCFullYear() === year;
        }) || [];
        
        const monthTarget = targets?.find(t => t.mes === monthNum)?.valor || 0;
        const totalFaturado = monthSales.reduce((acc, curr) => acc + (Number(curr.faturamento) || 0), 0);
        
        return {
          month: monthNum,
          year: year,
          value: totalFaturado,
          target: monthTarget,
          positivou: totalFaturado > 0
        };
      });

      // 2. Processar Mix de Produtos (Histórico COMPLETO)
      const productMap = new Map();
      allSales?.forEach(s => {
        const key = s.codigo_produto || s.produto;
        const current = productMap.get(key) || { 
          id: key, 
          name: s.produto, 
          totalValue: 0, 
          quantity: 0, 
          lastPurchaseDate: s.data 
        };
        
        productMap.set(key, {
          ...current,
          totalValue: current.totalValue + (Number(s.faturamento) || 0),
          quantity: current.quantity + (Number(s.qtde_faturado) || 0),
          lastPurchaseDate: new Date(s.data) > new Date(current.lastPurchaseDate) ? s.data : current.lastPurchaseDate
        });
      });

      setHistoryData(monthlyHistory);
      setProductsData(Array.from(productMap.values()).sort((a, b) => b.totalValue - a.totalValue));
    } catch (error) {
      console.error('Erro ao carregar detalhes do cliente:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1200
      });
      const link = document.createElement('a');
      link.download = `performance_${client.nome_fantasia.replace(/\s/g, '_')}_${year}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const monthsPositive = historyData.filter(d => d.value > 0).length;
  const totalFaturado = historyData.reduce((acc, curr) => acc + curr.value, 0);
  const totalMeta = historyData.reduce((acc, curr) => acc + curr.target, 0);
  const percentualAlcance = totalMeta > 0 ? (totalFaturado / totalMeta) * 100 : 0;
  const averagePurchase = monthsPositive > 0 ? totalFaturado / monthsPositive : 0;

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const monthsNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden">
          
          <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-start bg-white">
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">{client.nome_fantasia}</h2>
              <div className="flex flex-wrap gap-2 text-sm text-slate-500 font-medium">
                <span>CNPJ: {client.cnpj}</span>
                <span>•</span>
                <span>{client.city || 'Cidade não informada'}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                   Ano Ref: 
                   <select 
                     value={year} 
                     onChange={(e) => setYear(Number(e.target.value))}
                     className="bg-transparent border-none p-0 font-bold text-slate-700 focus:ring-0 cursor-pointer"
                   >
                     <option value={2024}>2024</option>
                     <option value={2025}>2025</option>
                     <option value={2026}>2026</option>
                   </select>
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="px-8 py-4 bg-white border-b border-slate-100 flex flex-col md:flex-row justify-end items-center gap-3">
             <Button 
                variant="outline" 
                onClick={() => setShowLastPurchase(true)} 
                className="h-10 px-4 text-sm font-medium border-amber-400 text-slate-600 hover:bg-amber-50 rounded-xl"
                disabled={isLoading}
             >
                <History className="w-4 h-4 mr-2" />
                Reposição (Histórico Completo)
             </Button>
             
             <Button 
                variant="secondary" 
                onClick={() => setShowProducts(true)} 
                className="h-10 px-4 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white shadow-md rounded-xl"
                disabled={isLoading}
             >
                <Package className="w-4 h-4 mr-2" />
                Produtos
             </Button>

             <Button 
                variant="outline" 
                onClick={handleDownloadImage} 
                isLoading={isDownloading} 
                className="h-10 px-4 text-sm font-medium border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl shadow-sm"
             >
                <Download className="w-4 h-4 mr-2" />
                Salvar
             </Button>
          </div>

          <div className="overflow-y-auto p-6 md:p-8 bg-white flex-1">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                <p className="font-bold uppercase text-xs tracking-widest">Calculando performance...</p>
              </div>
            ) : (
              <div className="animate-fadeIn">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                   <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[100px]">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Média Mensal ({year})</p>
                      <p className="text-xl font-bold text-slate-800">{formatCurrency(averagePurchase)}</p>
                   </div>
                   <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[100px]">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Meta Total</p>
                      <p className="text-xl font-bold text-slate-800">{formatCurrency(totalMeta)}</p>
                   </div>
                   <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[100px]">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Faturado</p>
                      <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalFaturado)}</p>
                   </div>
                   <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[100px] relative overflow-hidden">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Alcançado</p>
                      <p className={`text-xl font-bold ${percentualAlcance >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {percentualAlcance.toFixed(1)}%
                      </p>
                      <div className="w-full h-1 bg-slate-50 mt-2 rounded-full overflow-hidden">
                         <div className={`h-full ${percentualAlcance >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(percentualAlcance, 100)}%` }}></div>
                      </div>
                   </div>
                   <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-center min-h-[100px]">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Positivação</p>
                      <p className="text-xl font-bold text-blue-600">{monthsPositive} <span className="text-sm font-normal text-slate-400">/ 12 meses</span></p>
                   </div>
                </div>

                <div className="flex items-center gap-2 mb-6">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-bold text-slate-800">Histórico Mensal {year}</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {historyData.map((data, i) => {
                    const hasData = data.value > 0;
                    return (
                      <div key={i} className={`p-5 rounded-2xl border transition-all ${hasData ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-bold text-slate-800">{monthsNames[i]}</span>
                          {hasData ? (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase">POSITIVADO</span>
                          ) : (
                            <span className="bg-slate-200 text-slate-500 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">SEM COMPRA</span>
                          )}
                        </div>
                        {hasData || data.target > 0 ? (
                          <div className="space-y-2 text-xs">
                             <div className="flex justify-between"><span className="text-slate-500">Realizado:</span><span className="font-bold text-slate-900">{formatCurrency(data.value)}</span></div>
                             <div className="flex justify-between"><span className="text-slate-500">Meta:</span><span className="text-slate-600">{formatCurrency(data.target)}</span></div>
                             {data.target > 0 && (
                               <div className="pt-2">
                                  <div className="flex justify-between text-[10px] mb-1">
                                     <span className="text-slate-400 font-bold uppercase">Atingimento</span>
                                     <span className={`font-bold ${(data.value / data.target) >= 1 ? 'text-emerald-600' : 'text-blue-600'}`}>{((data.value / data.target) * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                     <div className={`h-full rounded-full ${(data.value / data.target) >= 1 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min((data.value / data.target) * 100, 100)}%` }}></div>
                                  </div>
                               </div>
                             )}
                          </div>
                        ) : (
                          <div className="h-20 flex flex-col items-center justify-center text-slate-300">
                            <AlertCircle className="w-5 h-5 mb-1 opacity-10" />
                            <span className="text-[10px] font-medium uppercase tracking-widest">Nenhum registro</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div ref={printRef} className="fixed top-0 left-[-9999px] w-[1200px] bg-white p-12 text-slate-900">
        <div className="border-b-4 border-slate-900 pb-8 mb-10 flex justify-between items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-600 mb-2">Relatório de Performance Comercial</p>
              <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-2">{client.nome_fantasia}</h1>
              <div className="flex gap-6 text-sm font-bold text-slate-400 uppercase tracking-widest">
                <span>CNPJ: {client.cnpj}</span>
                <span>•</span>
                <span>{client.city || 'Cidade não informada'}</span>
                <span>•</span>
                <span>Ano Referência: {year}</span>
              </div>
            </div>
            <div className="text-right">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Data de Geração</p>
                <p className="text-xl font-black text-slate-800">{new Date().toLocaleDateString('pt-BR')}</p>
            </div>
        </div>
        <div className="grid grid-cols-5 gap-6 mb-12">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Média Mensal</p>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(averagePurchase)}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Meta Total</p>
                <p className="text-2xl font-black text-slate-900">{formatCurrency(totalMeta)}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Faturado</p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalFaturado)}</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Atingimento</p>
                <p className="text-2xl font-black text-blue-600">{percentualAlcance.toFixed(1)}%</p>
            </div>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Positivação</p>
                <p className="text-2xl font-black text-slate-800">{monthsPositive} / 12</p>
            </div>
        </div>
        <div className="grid grid-cols-3 gap-6">
            {historyData.map((data, i) => (
                <div key={i} className={`p-6 rounded-3xl border-2 ${data.value > 0 ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                    <div className="flex justify-between items-center mb-6">
                        <span className="text-lg font-black text-slate-800 uppercase tracking-tighter">{monthsNames[i]}</span>
                        {data.value > 0 ? (
                            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-widest">POSITIVADO</span>
                        ) : (
                            <span className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-200 text-slate-500 uppercase tracking-widest">SEM COMPRA</span>
                        )}
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Realizado</span>
                            <span className="text-xl font-black text-slate-900">{formatCurrency(data.value)}</span>
                        </div>
                        <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Meta</span>
                            <span className="text-lg font-bold text-slate-600">{formatCurrency(data.target)}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
        <div className="mt-20 pt-10 border-t border-slate-100 flex justify-between items-center opacity-40">
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Portal Centro-Norte • Inteligência de Dados Comercial</p>
            <div className="w-16 h-16 bg-slate-900 rounded-2xl"></div>
        </div>
      </div>

      {showProducts && (
        <ClientProductsModal 
          client={{ ...client, name: client.nome_fantasia, products: productsData }} 
          onClose={() => setShowProducts(false)} 
        />
      )}

      {showLastPurchase && (
        <ClientLastPurchaseModal
          client={{ ...client, name: client.nome_fantasia, products: productsData }}
          onClose={() => setShowLastPurchase(false)}
        />
      )}
    </>,
    document.body
  );
};
