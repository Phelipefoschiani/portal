
import React, { useState, useMemo } from 'react';
import { Search, Calendar, Tag, CalendarClock, TrendingUp, Info, MapPin, Building2, FileSpreadsheet, MoreHorizontal } from 'lucide-react';
import { ClientDetailModal } from './ClientDetailModal';
import { ClientLastPurchaseDetailModal } from './ClientLastPurchaseDetailModal';
import { ClientScoreCardModal } from './ClientScoreCardModal';
import { ClientProductsModal } from './ClientProductsModal';
import { ClientLastPurchaseModal } from './ClientLastPurchaseModal';
import { ClientActionMenu } from './ClientActionMenu';
import { totalDataStore } from '../lib/dataStore';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { Sale } from '../types';

interface Client {
  id: string;
  cnpj: string;
  nome_fantasia: string;
  city?: string;
  canal_vendas?: string;
  lastPurchaseDate?: string;
  data_inativacao?: string;
}

export const ClientsScreen: React.FC = () => {
  const now = new Date();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;
  const userRole = session.role;

  // Modais e Menu
  const [selectedClientForMenu, setSelectedClientForMenu] = useState<Client | null>(null);
  const [activeModal, setActiveModal] = useState<'none' | 'x-ray' | 'last-purchase' | 'mix' | 'replenishment' | 'score-card'>('none');
  const [modalClient, setModalClient] = useState<Client | null>(null);

  const availableYears = [2024, 2025, 2026, 2027];

  React.useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const clientsQuery = supabase.from('clientes').select('*');
            if (userRole !== 'admin' && userRole !== 'director') clientsQuery.eq('usuario_id', userId);

            const salesQuery = supabase.from('dados_vendas').select('*');
            if (selectedYear !== 'all') {
                salesQuery.gte('data', `${selectedYear}-01-01`).lte('data', `${selectedYear}-12-31`);
            }
            if (userRole !== 'admin' && userRole !== 'director') salesQuery.eq('usuario_id', userId);

            const [clientsRes, salesRes] = await Promise.all([clientsQuery, salesQuery]);

            if (clientsRes.error) throw clientsRes.error;
            if (salesRes.error) throw salesRes.error;

            setClients(clientsRes.data || []);
            setSales(salesRes.data || []);
            
            // Sync with store for other components that might use it
            totalDataStore.clients = clientsRes.data || [];
            totalDataStore.sales = salesRes.data || [];
        } catch (e) {
            console.error('Error fetching clients screen data:', e);
        } finally {
            setIsLoading(false);
        }
    };
    fetchData();
  }, [selectedYear, userId, userRole]);

  // 1. Lista de canais únicos para o filtro (Baseado na carteira real)
  const channels = useMemo(() => {
    const set = new Set<string>();
    clients.forEach(c => {
        if (c.canal_vendas) set.add(c.canal_vendas);
    });
    return Array.from(set).sort();
  }, [clients]);

  // 2. Motor de Inteligência: Processa Ranking, Participação Dinâmica e Última Compra
  const processedData = useMemo(() => {
    // Filtrar clientes por busca e canal (Primeira camada de filtro)
    const filteredClientsBase = clients.filter(c => {
      const matchSearch = c.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (c.cnpj && c.cnpj.includes(searchTerm));
      const matchChannel = selectedChannel === 'all' ? true : c.canal_vendas === selectedChannel;
      
      // Regra de Carteira: Clientes ativos no final do ano anterior 
      // OU que compraram no ano selecionado
      let portfolioMatch = true;
      if (typeof selectedYear === 'number') {
          const lpDate = c.lastPurchaseDate ? new Date(c.lastPurchaseDate + 'T00:00:00') : null;
          if (!lpDate) {
              portfolioMatch = false;
          } else {
              const lpYear = lpDate.getUTCFullYear();
              const lpMonth = lpDate.getUTCMonth() + 1;
              const isCurrentYear = lpYear === selectedYear;
              const isActiveAtEndOfPrev = lpYear === selectedYear - 1 && lpMonth >= 10;
              portfolioMatch = isCurrentYear || isActiveAtEndOfPrev;
          }
      }

      return matchSearch && matchChannel && portfolioMatch;
    });

    const filteredClientCnpjs = new Set(filteredClientsBase.map(c => String(c.cnpj || '').replace(/\D/g, '')));

    // Filtrar vendas pelo período e APENAS pelos clientes que passaram no filtro acima
    const relevantSales = sales.filter(s => {
      const cleanCnpj = String(s.cnpj || '').replace(/\D/g, '');
      const matchClient = filteredClientCnpjs.has(cleanCnpj);
      const saleDate = new Date(s.data + 'T00:00:00');
      const matchYear = selectedYear === 'all' ? true : saleDate.getUTCFullYear() === selectedYear;
      return matchClient && matchYear;
    });

    // Calcular Base 100% do Grupo Filtrado
    const totalGroupFaturamento = relevantSales.reduce((acc, s) => acc + (Number(s.faturamento) || 0), 0);

    // Mapear estatísticas por cliente dentro do grupo
    const statsMap = new Map<string, { faturamento: number; lastDate: string; lastValue: number }>();
    relevantSales.forEach(s => {
      const cleanCnpj = String(s.cnpj || '').replace(/\D/g, '');
      const current = statsMap.get(cleanCnpj) || { faturamento: 0, lastDate: '0000-00-00', lastValue: 0 };
      
      let newLastDate = current.lastDate;
      let newLastValue = current.lastValue;
      
      if (s.data > current.lastDate) {
          newLastDate = s.data;
          newLastValue = Number(s.faturamento) || 0;
      } else if (s.data === current.lastDate) {
          newLastValue += Number(s.faturamento) || 0;
      }

      statsMap.set(cleanCnpj, {
        faturamento: current.faturamento + (Number(s.faturamento) || 0),
        lastDate: newLastDate,
        lastValue: newLastValue
      });
    });

    // Enriquecer a lista final para exibição
    const ranking = filteredClientsBase.map(c => {
      const stats = statsMap.get(String(c.cnpj || '').replace(/\D/g, ''));
      const fat = stats?.faturamento || 0;
      
      // Status dinâmico:
      // Se ano selecionado, Ativo se comprou no período filtrado.
      // Se histórico total, Ativo se comprou nos últimos 3 meses (regra geral).
      let isAtivo = false;
      if (selectedYear === 'all') {
          const lpDate = c.lastPurchaseDate ? new Date(c.lastPurchaseDate + 'T00:00:00') : null;
          if (lpDate) {
              const threeMonthsAgo = new Date();
              threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
              isAtivo = lpDate >= threeMonthsAgo;
          }
      } else {
          isAtivo = fat > 0;
      }

      return {
        ...c,
        faturamentoPeriodo: fat,
        lastPurchase: stats?.lastDate || null,
        lastPurchaseValue: stats?.lastValue || 0,
        participation: totalGroupFaturamento > 0 ? (fat / totalGroupFaturamento) * 100 : 0,
        isAtivo
      };
    }).sort((a, b) => b.faturamentoPeriodo - a.faturamentoPeriodo);

    return {
      ranking,
      totalGroupFaturamento
    };
  }, [searchTerm, selectedYear, selectedChannel, clients, sales]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  const checkLastPurchaseStatus = (dateStr: string | null) => {
    if (!dateStr || dateStr === '0000-00-00') return { label: 'S/ REGISTRO', isOld: true };
    const lastDate = new Date(dateStr + 'T00:00:00');
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      label: lastDate.toLocaleDateString('pt-BR'),
      isOld: diffDays > 90,
      days: diffDays
    };
  };

  const handleExportExcel = () => {
    if (processedData.ranking.length === 0) return;
    setIsExporting(true);
    try {
      const data = processedData.ranking.map(c => ({
        "Cliente": c.nome_fantasia,
        "CNPJ": c.cnpj,
        "Canal": c.canal_vendas || 'GERAL',
        "Última Compra": c.lastPurchase ? new Date(c.lastPurchase + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A',
        "Valor Últ. Compra": c.lastPurchaseValue,
        "Faturamento no Ano": c.faturamentoPeriodo,
        "Participação %": c.participation / 100
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Meus_Clientes");
      XLSX.writeFile(wb, `Meus_Clientes_${new Date().getTime()}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar Excel');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAction = (action: 'last-purchase' | 'x-ray' | 'mix' | 'replenishment' | 'score-card') => {
    const client = selectedClientForMenu;
    setSelectedClientForMenu(null);
    setModalClient(client);
    setActiveModal(action);
  };

  if (isLoading) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-black animate-pulse uppercase text-[10px] tracking-widest">Carregando carteira de clientes...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 md:space-y-6 animate-fadeIn pb-20">
      
      {/* Header Estratégico Adaptável */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 px-2">
        <div className="w-full lg:w-auto">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Minha Carteira</h2>
          <p className="text-slate-500 text-[8px] md:text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-2 text-left">
             <TrendingUp className="w-3 md:w-3.5 h-3 md:h-3.5 text-blue-600" />
             {selectedChannel === 'all' ? 'Ranking Geral de Faturamento' : `Análise de Participação: ${selectedChannel}`}
          </p>
        </div>

        <div className="grid grid-cols-2 md:flex md:flex-wrap items-center gap-2 w-full lg:w-auto">
          <button 
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg text-[9px] font-black uppercase tracking-widest h-[42px]"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>

          <div className="relative col-span-2 md:flex-1 md:min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar cliente ou CNPJ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all h-[42px]"
            />
          </div>

          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
               <Tag className="w-3 h-3" />
            </div>
            <select 
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full pl-8 pr-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer h-[42px]"
            >
              <option value="all">TODOS OS CANAIS</option>
              {channels.map(ch => <option key={ch} value={ch}>{ch.toUpperCase()}</option>)}
            </select>
          </div>

          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
               <Calendar className="w-3 h-3" />
            </div>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full pl-8 pr-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer h-[42px]"
            >
              <option value="all">HISTÓRICO TOTAL</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Resumo do Filtro Aplicado - Mobile Otimizado */}
      {processedData.totalGroupFaturamento > 0 && (
          <div className="mx-2 bg-slate-900 p-4 md:p-6 rounded-[24px] md:rounded-[32px] text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6 border-b-4 border-blue-600">
              <div className="text-center md:text-left">
                  <p className="text-[7px] md:text-[9px] font-black text-blue-400 uppercase tracking-[0.2em] md:tracking-[0.3em] mb-1">Base de Cálculo (100%)</p>
                  <h3 className="text-lg md:text-2xl font-black">{formatCurrency(processedData.totalGroupFaturamento)}</h3>
              </div>
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 md:px-6 md:py-3 rounded-xl md:rounded-2xl border border-white/5">
                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <p className="text-[7px] md:text-[10px] font-bold text-slate-400 leading-tight">
                      A porcentagem "% Ref" baseia-se no montante filtrado <br className="hidden md:block" /> de {selectedYear === 'all' ? 'todo o período' : selectedYear}.
                  </p>
              </div>
          </div>
      )}

      {/* Tabela de Clientes (Desktop) */}
      <div className="hidden md:block bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden mx-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-200">
                <th className="px-8 py-5">Nome</th>
                <th className="px-6 py-5">Última Compra</th>
                <th className="px-6 py-5 text-right">Valor Últ. Compra</th>
                <th className="px-6 py-5">Canal</th>
                <th className="px-6 py-5 text-right">Faturamento do Ano</th>
                <th className="px-8 py-5 text-right">Participação (%)</th>
                <th className="px-8 py-5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedData.ranking.map((client) => {
                const purchaseStatus = checkLastPurchaseStatus(client.lastPurchase);
                return (
                  <tr 
                    key={client.id} 
                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedClientForMenu(client)}
                  >
                    <td className="px-8 py-5">
                      <div className="min-w-0">
                          <p className="font-black text-slate-800 group-hover:text-blue-600 transition-colors uppercase tracking-tight text-sm truncate">{client.nome_fantasia}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{client.city || 'S/ CIDADE'} • {client.cnpj}</p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black border uppercase tracking-wider ${purchaseStatus.isOld ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                        <CalendarClock className="w-3 h-3" />
                        {purchaseStatus.label}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-slate-700 tabular-nums">{formatCurrency(client.lastPurchaseValue)}</td>
                    <td className="px-6 py-5">
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {client.canal_vendas || 'GERAL'}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(client.faturamentoPeriodo)}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex flex-col items-end">
                          <span className={`text-sm font-black tabular-nums ${client.participation > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                              {client.participation.toFixed(2)}%
                          </span>
                          <div className="w-16 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-blue-600" style={{ width: `${Math.min(client.participation * 2.5, 100)}%` }}></div>
                          </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all mx-auto shadow-sm">
                        <MoreHorizontal className="w-5 h-5" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lista Mobile (Cards Verticais) */}
      <div className="md:hidden space-y-3 px-2">
        {processedData.ranking.length === 0 ? (
          <div className="py-20 text-center text-slate-300 bg-white rounded-2xl border border-dashed border-slate-200 mx-2">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-[10px] font-black uppercase tracking-widest">Nenhum cliente filtrado</p>
          </div>
        ) : (
          processedData.ranking.map((client) => {
            const purchaseStatus = checkLastPurchaseStatus(client.lastPurchase);
            return (
              <div 
                key={client.id} 
                onClick={() => setSelectedClientForMenu(client)}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-tight truncate leading-tight">{client.nome_fantasia}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-2.5 h-2.5 text-slate-300" />
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{client.city || 'CIDADE N/I'} • {client.cnpj}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-xs font-black text-blue-600 tabular-nums">{client.participation.toFixed(2)}%</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Faturamento Ano</p>
                    <p className="text-[11px] font-black text-slate-700">{formatCurrency(client.faturamentoPeriodo)}</p>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Última Compra</p>
                    <p className="text-[11px] font-black text-slate-700">
                      {purchaseStatus.label}
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <Tag className="w-3 h-3 text-blue-500" />
                     <span className="text-[8px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">{client.canal_vendas || 'GERAL'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase">
                     Ações <MoreHorizontal className="w-3 h-3" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modals & Menu */}
      {selectedClientForMenu && (
        <ClientActionMenu 
            client={selectedClientForMenu} 
            onClose={() => setSelectedClientForMenu(null)} 
            onAction={handleAction}
        />
      )}

      {activeModal === 'x-ray' && modalClient && (
        <ClientDetailModal 
            client={modalClient} 
            initialYear={typeof selectedYear === 'number' ? selectedYear : new Date().getFullYear()}
            onClose={() => setActiveModal('none')} 
            onBack={() => { setActiveModal('none'); setSelectedClientForMenu(modalClient); }}
        />
      )}

      {activeModal === 'last-purchase' && modalClient && (
        <ClientLastPurchaseDetailModal 
            client={modalClient} 
            onClose={() => setActiveModal('none')} 
            onBack={() => { setActiveModal('none'); setSelectedClientForMenu(modalClient); }}
        />
      )}

      {activeModal === 'score-card' && modalClient && (
        <ClientScoreCardModal 
            client={modalClient} 
            onClose={() => setActiveModal('none')} 
            onBack={() => { setActiveModal('none'); setSelectedClientForMenu(modalClient); }}
        />
      )}

      {activeModal === 'mix' && modalClient && (
        <ClientProductsModal 
            client={{ id: modalClient.id, cnpj: modalClient.cnpj, nome_fantasia: modalClient.nome_fantasia }} 
            onClose={() => setActiveModal('none')} 
            onBack={() => { setActiveModal('none'); setSelectedClientForMenu(modalClient); }}
        />
      )}

      {activeModal === 'replenishment' && modalClient && (
        <ClientLastPurchaseModal 
            client={{ id: modalClient.id, cnpj: modalClient.cnpj, nome_fantasia: modalClient.nome_fantasia }} 
            onClose={() => setActiveModal('none')} 
            onBack={() => { setActiveModal('none'); setSelectedClientForMenu(modalClient); }}
        />
      )}
    </div>
  );
};
