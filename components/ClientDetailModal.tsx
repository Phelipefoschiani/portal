import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Calendar, AlertCircle, Package, Target, History, Loader2, TrendingUp, DollarSign, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Button } from './Button';
import { ClientProductsModal } from './ClientProductsModal';
import { ClientLastPurchaseModal } from './ClientLastPurchaseModal';
import { supabase } from '../lib/supabase';
import { totalDataStore } from '../lib/dataStore';
import html2canvas from 'html2canvas';

interface ClientDetailModalProps {
  client: any; 
  onClose: () => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({ client, onClose }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [showProducts, setShowProducts] = useState(false);
  const [showLastPurchase, setShowLastPurchase] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  // Normalização padrão para match de IDs
  const cleanId = (val: any) => String(val || '').replace(/\D/g, '');

  useEffect(() => {
    if (client) {
      fetchClientFullData();
    }
  }, [client, year]);

  const fetchClientFullData = async () => {
    setIsLoading(true);
    const searchId = cleanId(client.cnpj);
    const prevYear = year - 1;

    try {
      // USAMOS O DATASTORE GLOBAL (O mesmo do Dashboard que você confirmou estar certo)
      const allSales = totalDataStore.sales;

      // Buscamos apenas as metas para o ano em questão
      const { data: targets } = await supabase
        .from('metas_clientes')
        .select('*')
        .eq('cliente_id', client.id)
        .eq('ano', year);

      const monthlyHistory = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        
        // FÓRMULA PARA ANO ATUAL (Baseada na lógica de sucesso do Dashboard)
        const monthSales = allSales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return d.getUTCFullYear() === year && 
                   (d.getUTCMonth() + 1) === monthNum && 
                   cleanId(s.cnpj) === searchId;
        });
        
        // FÓRMULA PARA ANO ANTERIOR (Exatamente a mesma, apenas subtraindo 1 ano)
        const prevMonthSales = allSales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return d.getUTCFullYear() === prevYear && 
                   (d.getUTCMonth() + 1) === monthNum && 
                   cleanId(s.cnpj) === searchId;
        });

        const totalFaturado = monthSales.reduce((acc, curr) => acc + (Number(curr.faturamento) || 0), 0);
        const totalPrevFaturado = prevMonthSales.reduce((acc, curr) => acc + (Number(curr.faturamento) || 0), 0);
        
        const monthTarget = targets?.find(t => t.mes === monthNum)?.valor || 0;
        
        // Cálculo de variação
        let growth = null;
        if (totalPrevFaturado > 0) {
            growth = ((totalFaturado / totalPrevFaturado) - 1) * 100;
        } else if (totalFaturado > 0 && totalPrevFaturado === 0) {
            growth = 100;
        }

        return {
          month: monthNum,
          year: year,
          value: totalFaturado,
          prevValue: totalPrevFaturado,
          growth: growth,
          target: monthTarget
        };
      });

      // Mix de produtos baseado no ano selecionado
      const productMap = new Map();
      allSales.filter(s => {
          const d = new Date(s.data + 'T00:00:00');
          return d.getUTCFullYear() === year && cleanId(s.cnpj) === searchId;
      }).forEach(s => {
        const key = s.codigo_produto || s.produto;
        const current = productMap.get(key) || { id: key, name: s.produto, totalValue: 0, quantity: 0, lastPurchaseDate: s.data };
        productMap.set(key, {
          ...current,
          totalValue: current.totalValue + (Number(s.faturamento) || 0),
          quantity: current.quantity + (Number(s.qtde_faturado) || 0),
          lastPurchaseDate: s.data > current.lastPurchaseDate ? s.data : current.lastPurchaseDate
        });
      });

      setHistoryData(monthlyHistory);
      setProductsData(Array.from(productMap.values()).sort((a, b) => b.totalValue - a.totalValue));
    } catch (error) {
      console.error('Erro ao processar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!printRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `PERFORMANCE_${client.nome_fantasia.replace(/\s/g, '_')}_${year}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  const monthsNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white w-full max-w-6xl rounded-[28px] md:rounded-2xl shadow-2xl flex flex-col max-h-[96vh] md:max-h-[90vh] overflow-hidden border border-white/20">
          
          <div className="p-5 md:p-8 border-b border-slate-100 flex justify-between items-start bg-white shrink-0">
            <div className="space-y-1">
              <h2 className="text-xl md:text-3xl font-black text-slate-800 tracking-tight uppercase italic leading-tight">
                {client.nome_fantasia}
              </h2>
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>CNPJ: {client.cnpj}</span>
                <span className="hidden md:inline">•</span>
                <span>{client.city || 'Cidade N/I'}</span>
                <span className="hidden md:inline">•</span>
                <span className="flex items-center gap-1">
                   Ano: 
                   <select 
                     value={year} 
                     onChange={(e) => setYear(Number(e.target.value))}
                     className="bg-blue-50 border-none p-0.5 px-2 rounded-md font-black text-blue-600 focus:ring-0 cursor-pointer text-[9px] md:text-[10px]"
                   >
                     <option value={2024}>2024</option>
                     <option value={2025}>2025</option>
                     <option value={2026}>2026</option>
                   </select>
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400">
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>

          <div className="px-4 md:px-8 py-3 md:py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-end items-center gap-2 md:gap-3 shrink-0">
             <button onClick={() => setShowLastPurchase(true)} className="flex-1 md:flex-none h-10 px-4 md:px-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-amber-200 bg-white text-amber-600 hover:bg-amber-50 rounded-xl flex items-center justify-center gap-2">
                <History className="w-3.5 h-3.5" /> Reposição
             </button>
             <button onClick={() => setShowProducts(true)} className="flex-1 md:flex-none h-10 px-4 md:px-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white shadow-md rounded-xl flex items-center justify-center gap-2">
                <Package className="w-3.5 h-3.5" /> Mix Ativo
             </button>
             <button onClick={handleDownloadImage} disabled={isLoading || isDownloading} className="hidden md:flex h-10 px-6 text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl items-center gap-2">
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />} Salvar
             </button>
          </div>

          <div className="overflow-y-auto p-4 md:p-8 bg-white flex-1 custom-scrollbar" ref={printRef}>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                <p className="font-black uppercase text-[10px] tracking-widest">Sincronizando Faturamento Global...</p>
              </div>
            ) : (
              <div className="animate-fadeIn space-y-6 md:space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
                   <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center">
                      <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Realizado {year}</p>
                      <p className="text-xs md:text-xl font-black text-blue-600 tabular-nums">{formatCurrency(historyData.reduce((acc, curr) => acc + curr.value, 0))}</p>
                   </div>
                   <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center">
                      <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Realizado {year-1}</p>
                      <p className="text-xs md:text-xl font-black text-slate-800 tabular-nums">{formatCurrency(historyData.reduce((acc, curr) => acc + curr.prevValue, 0))}</p>
                   </div>
                   <div className="bg-slate-900 p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-lg flex flex-col justify-center">
                      <p className="text-[7px] md:text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Crescimento Anual</p>
                      {(() => {
                          const v1 = historyData.reduce((acc, curr) => acc + curr.value, 0);
                          const v2 = historyData.reduce((acc, curr) => acc + curr.prevValue, 0);
                          const growth = v2 > 0 ? ((v1/v2)-1)*100 : 0;
                          return <p className={`text-sm md:text-2xl font-black tabular-nums ${growth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{growth >= 0 ? '+' : ''}{growth.toFixed(1)}%</p>
                      })()}
                   </div>
                   <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center">
                      <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Positivação</p>
                      <p className="text-xs md:text-xl font-black text-slate-800">{historyData.filter(d => d.value > 0).length} <span className="text-[8px] md:text-[10px] font-bold text-slate-400">/ 12 meses</span></p>
                   </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 md:gap-3 px-1 md:px-2">
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                        <h3 className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest">DRE Comparativo Detalhado ({year} vs {year-1})</h3>
                    </div>
                    
                    <div className="hidden md:block bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-8 py-5">Mês Referência</th>
                                    <th className="px-4 py-5 text-right">Objetivo {year}</th>
                                    <th className="px-4 py-5 text-right">Realizado {year}</th>
                                    <th className="px-4 py-5 text-right bg-blue-50/20 text-slate-600 border-x border-slate-100">Realizado {year-1}</th>
                                    <th className="px-4 py-5 text-center bg-blue-50/40 text-blue-600">Vs. Ano Ant. (%)</th>
                                    <th className="px-8 py-5 text-right">Eficiência %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {historyData.map((data, i) => {
                                    const achievement = data.target > 0 ? (data.value / data.target) * 100 : (data.value > 0 ? 100 : 0);
                                    return (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-8 py-4 font-black text-slate-700 uppercase text-[11px]">{monthsNames[i]}</td>
                                            <td className="px-4 py-4 text-right font-bold text-slate-400 text-xs">{formatCurrency(data.target)}</td>
                                            <td className="px-4 py-4 text-right font-black text-slate-900 text-xs">{formatCurrency(data.value)}</td>
                                            <td className="px-4 py-4 text-right font-bold text-slate-500 text-xs bg-blue-50/5 border-x border-slate-50">{formatCurrency(data.prevValue)}</td>
                                            <td className="px-4 py-4 text-center bg-blue-50/10">
                                                {data.growth !== null ? (
                                                    <div className={`inline-flex items-center gap-1 font-black text-[10px] tabular-nums ${data.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {data.growth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {Math.abs(data.growth).toFixed(1)}%
                                                    </div>
                                                ) : <span className="text-slate-200">--</span>}
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-[10px] font-black ${achievement >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{achievement.toFixed(1)}%</span>
                                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${achievement >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(achievement, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="md:hidden space-y-2">
                        {historyData.map((data, i) => {
                            const achievement = data.target > 0 ? (data.value / data.target) * 100 : (data.value > 0 ? 100 : 0);
                            return (
                                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{monthsNames[i]}</span>
                                        <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black border uppercase ${data.value > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                            {achievement.toFixed(1)}% Efic.
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Real {year}</p>
                                            <p className="text-[10px] font-black text-slate-900">{formatCurrency(data.value)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Real {year-1}</p>
                                            <p className="text-[10px] font-bold text-slate-500">{formatCurrency(data.prevValue)}</p>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-50 flex justify-between items-center">
                                        <span className="text-[8px] font-black text-slate-400 uppercase">Variação Anual</span>
                                        <span className={`text-[10px] font-black ${data.growth !== null && data.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {data.growth !== null ? `${data.growth >= 0 ? '+' : ''}${data.growth.toFixed(1)}%` : '--'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showProducts && <ClientProductsModal client={{ ...client, name: client.nome_fantasia, products: productsData }} onClose={() => setShowProducts(false)} />}
      {showLastPurchase && <ClientLastPurchaseModal client={{ ...client, name: client.nome_fantasia, products: productsData }} onClose={() => setShowLastPurchase(false)} />}
    </>,
    document.body
  );
};