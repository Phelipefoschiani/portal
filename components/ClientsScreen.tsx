
import React, { useState, useMemo } from 'react';
import { Search, Users, Calendar, ChevronRight, BarChart3, Filter, Building2, Tag, CalendarClock, TrendingUp, Info, MapPin } from 'lucide-react';
import { ClientDetailModal } from './ClientDetailModal';
import { totalDataStore } from '../lib/dataStore';

export const ClientsScreen: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  const years = [2024, 2025, 2026, 2027];

  // 1. Lista de canais únicos para o filtro (Baseado na carteira real)
  const channels = useMemo(() => {
    const set = new Set<string>();
    totalDataStore.clients.forEach(c => {
        if (c.canal_vendas) set.add(c.canal_vendas);
    });
    return Array.from(set).sort();
  }, []);

  // 2. Motor de Inteligência: Processa Ranking, Participação Dinâmica e Última Compra
  const processedData = useMemo(() => {
    const clients = totalDataStore.clients;
    const sales = totalDataStore.sales;

    // Filtrar clientes por busca e canal (Primeira camada de filtro)
    const filteredClientsBase = clients.filter(c => {
      const matchSearch = c.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (c.cnpj && c.cnpj.includes(searchTerm));
      const matchChannel = selectedChannel === 'all' ? true : c.canal_vendas === selectedChannel;
      return matchSearch && matchChannel;
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
    const statsMap = new Map<string, { faturamento: number; lastDate: string }>();
    relevantSales.forEach(s => {
      const cleanCnpj = String(s.cnpj || '').replace(/\D/g, '');
      const current = statsMap.get(cleanCnpj) || { faturamento: 0, lastDate: '0000-00-00' };
      statsMap.set(cleanCnpj, {
        faturamento: current.faturamento + (Number(s.faturamento) || 0),
        lastDate: s.data > current.lastDate ? s.data : current.lastDate
      });
    });

    // Enriquecer a lista final para exibição
    const ranking = filteredClientsBase.map(c => {
      const stats = statsMap.get(String(c.cnpj || '').replace(/\D/g, ''));
      const fat = stats?.faturamento || 0;
      return {
        ...c,
        faturamentoPeriodo: fat,
        lastPurchase: stats?.lastDate || null,
        participation: totalGroupFaturamento > 0 ? (fat / totalGroupFaturamento) * 100 : 0
      };
    }).sort((a, b) => b.faturamentoPeriodo - a.faturamentoPeriodo);

    return {
      ranking,
      totalGroupFaturamento
    };
  }, [searchTerm, selectedYear, selectedChannel]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

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
          {/* Busca - Ocupa largura total no mobile */}
          <div className="relative col-span-2 md:flex-1 md:min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar cliente ou CNPJ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
            />
          </div>

          {/* Filtro de Canal */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
               <Tag className="w-3 h-3" />
            </div>
            <select 
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="w-full pl-8 pr-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
            >
              <option value="all">TODOS OS CANAIS</option>
              {channels.map(ch => <option key={ch} value={ch}>{ch.toUpperCase()}</option>)}
            </select>
          </div>

          {/* Filtro de Ano */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
               <Calendar className="w-3 h-3" />
            </div>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full pl-8 pr-2 py-2.5 bg-white border border-slate-200 rounded-xl text-[9px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
            >
              <option value="all">HISTÓRICO TOTAL</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
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
                <th className="px-8 py-5">#</th>
                <th className="px-6 py-5">Cliente / Entidade</th>
                <th className="px-6 py-5">CNPJ</th>
                <th className="px-6 py-5">Canal</th>
                <th className="px-6 py-5">Última Compra</th>
                <th className="px-6 py-5 text-right">% Participação</th>
                <th className="px-8 py-5 text-center">Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedData.ranking.map((client, idx) => (
                <tr 
                  key={client.id} 
                  className="group hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedClient(client)}
                >
                  <td className="px-8 py-5">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm ${idx < 3 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {idx + 1}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="min-w-0">
                        <p className="font-black text-slate-800 uppercase tracking-tight text-sm truncate">{client.nome_fantasia}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{client.city || 'S/ CIDADE'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-500 font-mono text-xs">{client.cnpj}</td>
                  <td className="px-6 py-5">
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      {client.canal_vendas || 'GERAL'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {client.lastPurchase ? (
                        <div className="flex items-center gap-2 text-slate-600 font-bold text-xs tabular-nums">
                            <CalendarClock className="w-3.5 h-3.5 text-slate-300" />
                            {new Date(client.lastPurchase + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </div>
                    ) : (
                        <span className="text-[9px] font-black text-slate-300 uppercase">Sem Registro</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
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
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </td>
                </tr>
              ))}
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
          processedData.ranking.map((client, idx) => (
            <div 
              key={client.id} 
              onClick={() => setSelectedClient(client)}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all relative overflow-hidden"
            >
              {/* Rank Badge */}
              <div className={`absolute top-0 left-0 px-2.5 py-1 rounded-br-xl text-[8px] font-black text-white ${idx < 3 ? 'bg-blue-600' : 'bg-slate-300'}`}>
                #{idx + 1}
              </div>

              <div className="flex justify-between items-start mb-4 pt-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-slate-800 uppercase text-xs tracking-tight truncate leading-tight">{client.nome_fantasia}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="w-2.5 h-2.5 text-slate-300" />
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{client.city || 'CIDADE N/I'}</span>
                  </div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className="text-xs font-black text-blue-600 tabular-nums">{client.participation.toFixed(2)}%</p>
                  <p className="text-[7px] text-slate-400 font-black uppercase tracking-widest">% de Ref</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Faturamento</p>
                  <p className="text-[11px] font-black text-slate-700">{formatCurrency(client.faturamentoPeriodo)}</p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Última Compra</p>
                  <p className="text-[11px] font-black text-slate-700">
                    {client.lastPurchase ? new Date(client.lastPurchase + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/I'}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Tag className="w-3 h-3 text-blue-500" />
                   <span className="text-[8px] font-black text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded-md">{client.canal_vendas || 'GERAL'}</span>
                </div>
                <div className="flex items-center gap-1 text-[8px] font-black text-blue-600 uppercase">
                   Detalhar <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedClient && (
        <ClientDetailModal 
          client={selectedClient} 
          onClose={() => setSelectedClient(null)} 
        />
      )}
    </div>
  );
};
