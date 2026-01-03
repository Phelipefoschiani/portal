
import React, { useState, useMemo } from 'react';
import { Search, Users, Calendar, ChevronRight, BarChart3, Filter, Building2, Tag, CalendarClock, TrendingUp, Info } from 'lucide-react';
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
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header Estratégico */}
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6">
        <div className="w-full lg:w-auto">
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Minha Carteira</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-2 flex items-center gap-2 text-left">
             <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
             {selectedChannel === 'all' ? 'Ranking Geral de Faturamento' : `Análise de Participação: ${selectedChannel}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Busca */}
          <div className="relative flex-1 lg:min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar cliente ou CNPJ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
            />
          </div>

          {/* Filtro de Canal / Grupo */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
               <Tag className="w-3.5 h-3.5" />
            </div>
            <select 
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
            >
              <option value="all">TODOS OS CANAIS</option>
              {channels.map(ch => <option key={ch} value={ch}>{ch.toUpperCase()}</option>)}
            </select>
          </div>

          {/* Filtro de Ano */}
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
               <Calendar className="w-3.5 h-3.5" />
            </div>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
            >
              <option value="all">HISTÓRICO TOTAL</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Resumo do Filtro Aplicado */}
      {processedData.totalGroupFaturamento > 0 && (
          <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6 border-b-4 border-blue-600">
              <div>
                  <p className="text-[9px] font-black text-blue-400 uppercase tracking-[0.3em] mb-1">Base de Cálculo (100%)</p>
                  <h3 className="text-2xl font-black">{formatCurrency(processedData.totalGroupFaturamento)}</h3>
              </div>
              <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-2xl border border-white/5">
                  <Info className="w-4 h-4 text-blue-400" />
                  <p className="text-[10px] font-bold text-slate-400 leading-tight">
                      A porcentagem "% Ref" de cada cliente abaixo refere-se à sua <br/> participação exclusiva neste montante de {selectedYear === 'all' ? 'todo o período' : selectedYear}.
                  </p>
              </div>
          </div>
      )}

      {/* Tabela de Clientes */}
      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
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
              
              {processedData.ranking.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-32 text-center text-slate-400">
                    <div className="flex flex-col items-center">
                      <Building2 className="w-16 h-16 mb-4 opacity-10 text-blue-600" />
                      <p className="font-black uppercase text-xs tracking-[0.3em]">Nenhum cliente mapeado para este critério.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
