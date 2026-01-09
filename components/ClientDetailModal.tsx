
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Calendar, AlertCircle, Package, Target, History, Loader2, TrendingUp, DollarSign } from 'lucide-react';
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
      const { data: allSales } = await supabase
        .from('dados_vendas')
        .select('*')
        .eq('cnpj', cleanedCnpj)
        .limit(10000);

      const { data: targets } = await supabase
        .from('metas_clientes')
        .select('*')
        .eq('cliente_id', client.id)
        .eq('ano', year);

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

  // Lógica de cálculo da média mensal baseada em meses fechados
  const now = new Date();
  const currentRealYear = now.getFullYear();
  const currentRealMonth = now.getMonth() + 1; // 1-12

  let divisorMeses = 12;
  if (year === currentRealYear) {
    // Se o ano selecionado é o atual, dividimos pelos meses já fechados
    // Ex: Abril (4), meses passados: Jan(1), Fev(2), Mar(3) = 3 meses.
    divisorMeses = Math.max(1, currentRealMonth - 1);
  } else if (year > currentRealYear) {
    // Se for um ano futuro, consideramos 1 para não dividir por zero ou doze indevidamente
    divisorMeses = 1;
  }
  
  const averagePurchase = totalFaturado / divisorMeses;

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  const monthsNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden">
          
          <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-start bg-white shrink-0">
            <div className="space-y-1">
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight uppercase italic">
                {client.nome_fantasia}
              </h2>
              <div className="flex flex-wrap gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>CNPJ: {client.cnpj}</span>
                <span>•</span>
                <span>{client.city || 'Cidade não informada'}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                   Ano Ref: 
                   <select 
                     value={year} 
                     onChange={(e) => setYear(Number(e.target.value))}
                     className="bg-transparent border-none p-0 font-black text-blue-600 focus:ring-0 cursor-pointer text-[10px]"
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

          <div className="px-8 py-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row justify-end items-center gap-3 shrink-0">
             <Button 
                variant="outline" 
                onClick={() => setShowLastPurchase(true)} 
                className="h-10 px-6 text-[10px] font-black uppercase tracking-widest border-amber-200 text-amber-600 hover:bg-amber-50 rounded-xl"
                disabled={isLoading}
             >
                <History className="w-4 h-4 mr-2" />
                Análise de Reposição
             </Button>
             
             <Button 
                variant="secondary" 
                onClick={() => setShowProducts(true)} 
                className="h-10 px-6 text-[10px] font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white shadow-md rounded-xl"
                disabled={isLoading}
             >
                <Package className="w-4 h-4 mr-2" />
                Produtos Ativos
             </Button>

             <Button 
                variant="outline" 
                onClick={handleDownloadImage} 
                isLoading={isDownloading} 
                className="h-10 px-6 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl shadow-sm"
             >
                <Download className="w-4 h-4 mr-2" />
                Salvar Painel
             </Button>
          </div>

          <div className="overflow-y-auto p-6 md:p-8 bg-white flex-1 custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
                <p className="font-black uppercase text-xs tracking-widest">Calculando performance...</p>
              </div>
            ) : (
              <div className="animate-fadeIn space-y-8">
                {/* Resumo em Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                   <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center min-h-[100px]">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Média Mensal</p>
                      <p className="text-xl font-black text-slate-800 tabular-nums">{formatCurrency(averagePurchase)}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Ref: {divisorMeses} {divisorMeses === 1 ? 'mês' : 'meses'}</p>
                   </div>
                   <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center min-h-[100px]">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Total</p>
                      <p className="text-xl font-black text-slate-800 tabular-nums">{formatCurrency(totalMeta)}</p>
                   </div>
                   <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center min-h-[100px]">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado {year}</p>
                      <p className="text-xl font-black text-blue-600 tabular-nums">{formatCurrency(totalFaturado)}</p>
                   </div>
                   <div className="bg-slate-900 p-5 rounded-3xl shadow-xl flex flex-col justify-center min-h-[100px] relative overflow-hidden">
                      <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Atingimento</p>
                      <p className="text-2xl font-black text-white tabular-nums">{percentualAlcance.toFixed(1)}%</p>
                   </div>
                   <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-center min-h-[100px]">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Positivação</p>
                      <p className="text-xl font-black text-slate-800">{monthsPositive} <span className="text-[10px] font-bold text-slate-400">/ 12 meses</span></p>
                   </div>
                </div>

                {/* Tabela de Histórico Mensal */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">DRE Mensal de Faturamento - {year}</h3>
                    </div>
                    
                    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr className="text-slate-400 text-[9px] font-black uppercase tracking-widest">
                                    <th className="px-8 py-5">Mês de Referência</th>
                                    <th className="px-6 py-5">Status</th>
                                    <th className="px-6 py-5 text-right">Objetivo (Meta)</th>
                                    <th className="px-6 py-5 text-right">Realizado (BRL)</th>
                                    <th className="px-8 py-5 text-right">% Eficiência</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {historyData.map((data, i) => {
                                    const achievement = data.target > 0 ? (data.value / data.target) * 100 : (data.value > 0 ? 100 : 0);
                                    const isTargetOk = achievement >= 100;
                                    
                                    return (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-8 py-4">
                                                <span className="font-black text-slate-700 uppercase text-[11px] tracking-tight group-hover:text-blue-600 transition-colors">{monthsNames[i]}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {data.value > 0 ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">Positivado</span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-black bg-slate-100 text-slate-400 border border-slate-200 uppercase tracking-wider">Sem Venda</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-400 tabular-nums text-xs">
                                                {formatCurrency(data.target)}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums text-xs">
                                                {formatCurrency(data.value)}
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-[11px] font-black tabular-nums ${isTargetOk ? 'text-emerald-600' : 'text-blue-600'}`}>{achievement.toFixed(1)}%</span>
                                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${isTargetOk ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(achievement, 100)}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-900 text-white border-t-4 border-blue-600">
                                <tr className="text-[10px] font-black uppercase tracking-widest">
                                    <td className="px-8 py-6 text-blue-400">Total Acumulado</td>
                                    <td className="px-6 py-6">--</td>
                                    <td className="px-6 py-6 text-right tabular-nums">{formatCurrency(totalMeta)}</td>
                                    <td className="px-6 py-6 text-right tabular-nums text-blue-400">{formatCurrency(totalFaturado)}</td>
                                    <td className="px-8 py-6 text-right tabular-nums">{percentualAlcance.toFixed(1)}%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
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
        <div className="bg-white rounded-[40px] border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest">
                    <tr>
                        <th className="px-10 py-6">Mês</th>
                        <th className="px-8 py-6 text-right">Meta</th>
                        <th className="px-8 py-6 text-right">Faturado</th>
                        <th className="px-10 py-6 text-right">Alcance (%)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {historyData.map((data, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                            <td className="px-10 py-5 text-slate-700 font-black uppercase">{monthsNames[i]}</td>
                            <td className="px-8 py-5 text-right text-slate-400 font-bold tabular-nums">{formatCurrency(data.target)}</td>
                            <td className="px-8 py-5 text-right text-slate-900 font-black tabular-nums">{formatCurrency(data.value)}</td>
                            <td className="px-10 py-5 text-right text-blue-600 font-black tabular-nums">
                                {data.target > 0 ? ((data.value / data.target) * 100).toFixed(1) : (data.value > 0 ? '100.0' : '0.0')}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
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
