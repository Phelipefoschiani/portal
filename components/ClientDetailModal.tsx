import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Calendar, AlertCircle, Package, Target, History, Loader2, TrendingUp, DollarSign, ChevronRight, Hash, Building2, MapPin } from 'lucide-react';
import { Button } from './Button';
import { ClientProductsModal } from './ClientProductsModal';
import { ClientLastPurchaseModal } from './ClientLastPurchaseModal';
import { supabase } from '../lib/supabase';
import { totalDataStore } from '../lib/dataStore'; 
import html2canvas from 'html2canvas';

interface ClientDetailModalProps {
  client: any; 
  initialYear?: number;
  onClose: () => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({ client, initialYear, onClose }) => {
  const [year, setYear] = useState(initialYear && typeof initialYear === 'number' ? initialYear : new Date().getFullYear());
  const [showProducts, setShowProducts] = useState(false);
  const [showLastPurchase, setShowLastPurchase] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [productsData, setProductsData] = useState<any[]>([]);
  
  // Ref separada para a área de exportação (layout bonito)
  const exportRef = useRef<HTMLDivElement>(null);

  const cleanCnpj = (val: string) => String(val || '').replace(/\D/g, '');

  useEffect(() => {
    if (client) {
      fetchClientFullData();
    }
  }, [client, year]);

  const fetchClientFullData = async () => {
    setIsLoading(true);
    const cleanedCnpj = cleanCnpj(client.cnpj);
    
    let salesData: any[] = [];
    let targetsData: any[] = [];

    try {
      const localSales = totalDataStore.sales.filter(s => String(s.cnpj || '').replace(/\D/g, '') === cleanedCnpj);
      
      if (localSales.length > 0) {
          salesData = localSales.filter(s => {
              const d = new Date(s.data + 'T00:00:00');
              return d.getUTCFullYear() === year;
          });
      } else {
          const startDate = `${year}-01-01`;
          const endDate = `${year}-12-31`;
          const { data, error } = await supabase
            .from('dados_vendas')
            .select('*')
            .eq('cnpj', cleanedCnpj) 
            .gte('data', startDate)
            .lte('data', endDate);
          if (error) throw error;
          salesData = data || [];
      }

      const { data: targets } = await supabase
        .from('metas_clientes')
        .select('*')
        .eq('cliente_id', client.id)
        .eq('ano', year);
      
      targetsData = targets || [];

      const monthlyHistory = Array.from({ length: 12 }, (_, i) => {
        const monthNum = i + 1;
        const monthSales = salesData.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return d.getUTCMonth() + 1 === monthNum;
        });
        
        const monthTarget = targetsData.find(t => t.mes === monthNum)?.valor || 0;
        const totalFaturado = monthSales.reduce((acc, curr) => acc + (Number(curr.faturamento) || 0), 0);
        
        return {
          month: monthNum,
          year: year,
          value: totalFaturado,
          target: monthTarget,
          positivou: totalFaturado > 0
        };
      });

      const productMap = new Map();
      salesData.forEach(s => {
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
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!exportRef.current) return;
    setIsDownloading(true);
    try {
        await new Promise(r => setTimeout(r, 500)); 
        
        const canvas = await html2canvas(exportRef.current, {
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: 1200, 
            windowWidth: 1200
        });
        
        const link = document.createElement('a');
        link.download = `Resumo_${client.nome_fantasia.replace(/\s/g, '_')}_${year}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      alert('Não foi possível salvar a imagem.');
    } finally {
      setIsDownloading(false);
    }
  };

  const monthsPositive = historyData.filter(d => d.value > 0).length;
  const totalFaturado = historyData.reduce((acc, curr) => acc + curr.value, 0);
  const totalMeta = historyData.reduce((acc, curr) => acc + curr.target, 0);
  const percentualAlcance = totalMeta > 0 ? (totalFaturado / totalMeta) * 100 : 0;
  const activeSkusCount = productsData.length;

  const now = new Date();
  const currentRealYear = now.getFullYear();
  const currentRealMonth = now.getMonth() + 1;

  let divisorMeses = 12;
  if (year === currentRealYear) {
    divisorMeses = Math.max(1, currentRealMonth - 1);
  } else if (year > currentRealYear) {
    divisorMeses = 1;
  }
  
  const averagePurchase = totalFaturado / divisorMeses;
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  const monthsNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return createPortal(
    <div className="relative z-[100]">
      <div className="fixed inset-0 flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white w-full max-w-6xl rounded-[28px] md:rounded-2xl shadow-2xl flex flex-col max-h-[96vh] md:max-h-[90vh] overflow-hidden">
          
          {/* Header Tela */}
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
                   Ano Base: 
                   <select 
                     value={year} 
                     onChange={(e) => setYear(Number(e.target.value))}
                     className="bg-blue-50 border-none p-0.5 px-2 rounded-md font-black text-blue-600 focus:ring-0 cursor-pointer text-[9px] md:text-[10px]"
                   >
                     <option value={2024}>2024</option>
                     <option value={2025}>2025</option>
                     <option value={2026}>2026</option>
                     <option value={2027}>2027</option>
                   </select>
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400">
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>

          {/* Botões Ação */}
          <div className="px-4 md:px-8 py-3 md:py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-end items-center gap-2 md:gap-3 shrink-0">
             <button onClick={() => setShowLastPurchase(true)} className="flex-1 md:flex-none h-10 px-4 md:px-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-amber-200 bg-white text-amber-600 hover:bg-amber-50 rounded-xl flex items-center justify-center gap-2" disabled={isLoading}><History className="w-3.5 h-3.5" /> Reposição</button>
             <button onClick={() => setShowProducts(true)} className="flex-1 md:flex-none h-10 px-4 md:px-6 text-[8px] md:text-[10px] font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white shadow-md rounded-xl flex items-center justify-center gap-2" disabled={isLoading}><Package className="w-3.5 h-3.5" /> Mix Ativo</button>
             <button onClick={handleDownloadImage} disabled={isLoading || isDownloading} className="hidden md:flex h-10 px-6 text-[10px] font-black uppercase tracking-widest border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl items-center gap-2">
                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4" />} Salvar
             </button>
          </div>

          {/* Conteúdo Tela (Scrollável) */}
          <div className="overflow-y-auto p-4 md:p-8 bg-white flex-1 custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                <p className="font-black uppercase text-[10px] tracking-widest">Carregando...</p>
              </div>
            ) : (
              <div className="animate-fadeIn space-y-6 md:space-y-8">
                {/* Cards KPI Tela */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 md:gap-4">
                   <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center min-h-[70px] md:min-h-[100px]">
                      <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Média Mensal</p>
                      <p className="text-xs md:text-xl font-black text-slate-800 tabular-nums">{formatCurrency(averagePurchase)}</p>
                   </div>
                   <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center min-h-[70px] md:min-h-[100px]">
                      <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Meta Acum.</p>
                      <p className="text-xs md:text-xl font-black text-slate-800 tabular-nums">{formatCurrency(totalMeta)}</p>
                   </div>
                   <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center min-h-[70px] md:min-h-[100px]">
                      <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Faturado {year}</p>
                      <p className="text-xs md:text-xl font-black text-blue-600 tabular-nums">{formatCurrency(totalFaturado)}</p>
                   </div>
                   <div className="bg-slate-900 p-3 md:p-5 rounded-2xl md:rounded-3xl shadow-lg flex flex-col justify-center min-h-[70px] md:min-h-[100px]">
                      <p className="text-[7px] md:text-[9px] font-black text-blue-400 uppercase tracking-widest mb-0.5 md:mb-1">Atingimento</p>
                      <p className="text-sm md:text-2xl font-black text-white tabular-nums">{percentualAlcance.toFixed(1)}%</p>
                   </div>
                   <div className="bg-slate-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-slate-100 flex flex-col justify-center min-h-[50px] md:min-h-[100px]">
                      <p className="text-[7px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Meses Positivados</p>
                      <p className="text-xs md:text-xl font-black text-slate-800">{monthsPositive} <span className="text-[8px] md:text-[10px] font-bold text-slate-400">/ 12</span></p>
                   </div>
                   <div className="bg-purple-50 p-3 md:p-5 rounded-2xl md:rounded-3xl border border-purple-100 flex flex-col justify-center min-h-[50px] md:min-h-[100px]">
                      <div className="flex items-center gap-1.5 mb-0.5 md:mb-1"><Hash className="w-3 h-3 text-purple-400" /><p className="text-[7px] md:text-[9px] font-black text-purple-400 uppercase tracking-widest">SKUs Ativos</p></div>
                      <p className="text-xs md:text-xl font-black text-purple-700">{activeSkusCount}</p>
                   </div>
                </div>

                {/* Tabela Tela */}
                <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-2 md:gap-3 px-1 md:px-2">
                        <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                        <h3 className="text-[10px] md:text-sm font-black text-slate-800 uppercase tracking-widest">DRE de Faturamento - {year}</h3>
                    </div>
                    
                    <div className="hidden md:block bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                <tr>
                                    <th className="px-8 py-5">Mês de Referência</th>
                                    <th className="px-6 py-5">Status</th>
                                    <th className="px-6 py-5 text-right">Objetivo</th>
                                    <th className="px-6 py-5 text-right">Realizado</th>
                                    <th className="px-8 py-5 text-right">% Eficiência</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {historyData.map((data, i) => {
                                    const achievement = data.target > 0 ? (data.value / data.target) * 100 : (data.value > 0 ? 100 : 0);
                                    return (
                                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-8 py-4 font-black text-slate-700 uppercase text-[11px]">{monthsNames[i]}</td>
                                            <td className="px-6 py-4">{data.value > 0 ? <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[8px] font-black uppercase">Positivado</span> : <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Sem Venda</span>}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-400 text-xs">{formatCurrency(data.target)}</td>
                                            <td className="px-6 py-4 text-right font-black text-slate-900 text-xs">{formatCurrency(data.value)}</td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-[10px] font-black ${achievement >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{achievement.toFixed(1)}%</span>
                                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${achievement >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(achievement, 100)}%` }}></div></div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-2">
                        {historyData.map((data, i) => {
                            const achievement = data.target > 0 ? (data.value / data.target) * 100 : (data.value > 0 ? 100 : 0);
                            return (
                                <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
                                    <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{monthsNames[i]}</span><div className={`px-2 py-0.5 rounded-lg text-[8px] font-black border uppercase ${data.value > 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{data.value > 0 ? 'Venda OK' : 'Sem Faturamento'}</div></div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div><p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Real</p><p className="text-[10px] font-black text-slate-900">{formatCurrency(data.value)}</p></div>
                                        <div><p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Meta</p><p className="text-[10px] font-bold text-slate-500">{formatCurrency(data.target)}</p></div>
                                        <div className="text-right"><p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Ating.</p><p className={`text-[10px] font-black ${achievement >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{achievement.toFixed(1)}%</p></div>
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

        {/* --- ÁREA DE EXPORTAÇÃO ESCONDIDA (Layout Bonito) --- */}
        <div 
          ref={exportRef} 
          style={{ 
              position: 'fixed', 
              top: 0, 
              left: '-9999px', 
              width: '1200px', 
              backgroundColor: 'white', 
              padding: '40px',
              fontFamily: 'Inter, sans-serif'
          }}
        >
          {/* Header Relatório */}
          <div className="flex justify-between items-end border-b-4 border-slate-900 pb-6 mb-8">
              <div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] mb-2">Relatório de Performance Comercial</p>
                  <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tight leading-none">{client.nome_fantasia}</h1>
                  <div className="flex items-center gap-4 mt-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Building2 className="w-4 h-4" /> CNPJ: {client.cnpj}</span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><MapPin className="w-4 h-4" /> {client.city || 'CIDADE N/I'}</span>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1"><Calendar className="w-4 h-4" /> Ano: {year}</span>
                  </div>
              </div>
              <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Data da Emissão</p>
                  <p className="text-lg font-black text-slate-900">{new Date().toLocaleDateString('pt-BR')}</p>
              </div>
          </div>

          {/* KPIs Relatório */}
          <div className="grid grid-cols-6 gap-4 mb-8">
              <div className="border border-slate-200 rounded-[20px] p-5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Média Mensal</p>
                  <p className="text-xl font-black text-slate-900">{formatCurrency(averagePurchase)}</p>
              </div>
              <div className="border border-slate-200 rounded-[20px] p-5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Meta Anual</p>
                  <p className="text-xl font-black text-slate-900">{formatCurrency(totalMeta)}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-[20px] p-5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Faturado</p>
                  <p className="text-xl font-black text-blue-600">{formatCurrency(totalFaturado)}</p>
              </div>
              <div className="bg-slate-900 text-white rounded-[20px] p-5">
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-2">Atingimento</p>
                  <p className="text-2xl font-black">{percentualAlcance.toFixed(1)}%</p>
              </div>
              <div className="border border-slate-200 rounded-[20px] p-5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Positivação</p>
                  <p className="text-xl font-black text-slate-900">{monthsPositive} <span className="text-xs text-slate-400">/ 12</span></p>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-[20px] p-5">
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-2">Mix Ativo</p>
                  <p className="text-xl font-black text-purple-700">{activeSkusCount}</p>
              </div>
          </div>

          {/* Tabela Relatório */}
          <div className="mb-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-600"/> DRE Detalhado</h3>
              <div className="border border-slate-200 rounded-[24px] overflow-hidden">
                  <table className="w-full text-left">
                      <thead>
                          <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500 border-b border-slate-200">
                              <th className="px-8 py-4">Mês</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4 text-right">Objetivo</th>
                              <th className="px-6 py-4 text-right">Realizado</th>
                              <th className="px-8 py-4 text-right">Eficiência</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                          {historyData.map((data, i) => {
                              const achievement = data.target > 0 ? (data.value / data.target) * 100 : (data.value > 0 ? 100 : 0);
                              return (
                                  <tr key={i}>
                                      <td className="px-8 py-4 font-black text-slate-800 uppercase text-xs">{monthsNames[i]}</td>
                                      <td className="px-6 py-4">
                                          <span className={`text-[9px] font-black px-2 py-1 rounded border uppercase ${data.value > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                              {data.value > 0 ? 'POSITIVADO' : 'SEM VENDA'}
                                          </span>
                                      </td>
                                      <td className="px-6 py-4 text-right font-bold text-slate-500 tabular-nums">{formatCurrency(data.target)}</td>
                                      <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">{formatCurrency(data.value)}</td>
                                      <td className="px-8 py-4 text-right">
                                          <div className="flex justify-end items-center gap-2">
                                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                  <div className="h-full bg-blue-600" style={{ width: `${Math.min(achievement, 100)}%` }}></div>
                                              </div>
                                              <span className="font-black text-xs tabular-nums text-blue-700">{achievement.toFixed(1)}%</span>
                                          </div>
                                      </td>
                                  </tr>
                              )
                          })}
                      </tbody>
                  </table>
              </div>
          </div>

          <div className="text-center pt-8 border-t border-slate-100">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Portal Centro-Norte • Inteligência de Dados</p>
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
      </div>
    </div>,
    document.body
  );
};