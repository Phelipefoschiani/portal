import React from 'react';
import { Target, TrendingUp, Users, AlertCircle, DollarSign, Calendar } from 'lucide-react';

export const Dashboard: React.FC = () => {
  // Dados Fictícios (Mock)
  const data = {
    meta: 120000.00,
    faturado: 86450.00,
    clientesPositivados: 42,
    clientesNaoPositivados: 18,
    totalClientes: 60
  };

  // Cálculos
  const percentualAtingido = (data.faturado / data.meta) * 100;
  const percentualClientes = (data.clientesPositivados / data.totalClientes) * 100;

  // Formatador de Moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const currentDate = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fadeIn">
      
      {/* Header da Página */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Visão Geral</h2>
          <p className="text-slate-500 flex items-center gap-2 text-sm mt-1 capitalize">
            <Calendar className="w-4 h-4" />
            {currentDate}
          </p>
        </div>
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
           Região: Norte/Capital
        </div>
      </div>

      {/* Card Principal - Desempenho de Vendas */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
        
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-slate-500 text-sm font-medium">Meta do Mês</h3>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(data.meta)}</p>
            </div>
          </div>
          <div className="text-right">
             <span className={`text-2xl font-bold ${percentualAtingido >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
               {percentualAtingido.toFixed(1)}%
             </span>
             <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Atingido</p>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="relative pt-2 pb-6">
          <div className="flex justify-between mb-2 text-sm">
            <span className="font-semibold text-slate-700">Total Faturado</span>
            <span className="font-bold text-slate-900">{formatCurrency(data.faturado)}</span>
          </div>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                percentualAtingido >= 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
              }`}
              style={{ width: `${Math.min(percentualAtingido, 100)}%` }}
            >
                {/* Efeito de brilho na barra */}
                <div className="w-full h-full absolute top-0 left-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
            </div>
          </div>
           <p className="text-xs text-slate-400 mt-3 text-right">
             Faltam <strong>{formatCurrency(data.meta - data.faturado > 0 ? data.meta - data.faturado : 0)}</strong> para a meta
           </p>
        </div>
      </div>

      {/* Grid de KPIs Secundários */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card Clientes Positivados */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between group hover:border-emerald-200 transition-colors">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Clientes Positivados</p>
            <h4 className="text-3xl font-bold text-slate-900">{data.clientesPositivados}</h4>
            <div className="mt-2 flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit">
              <TrendingUp className="w-3 h-3 mr-1" />
              {percentualClientes.toFixed(0)}% da carteira
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Card Clientes Não Positivados */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between group hover:border-amber-200 transition-colors">
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Não Positivados</p>
            <h4 className="text-3xl font-bold text-slate-900">{data.clientesNaoPositivados}</h4>
             <div className="mt-2 flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit">
              <AlertCircle className="w-3 h-3 mr-1" />
              Oportunidade de venda
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6" />
          </div>
        </div>

      </div>
    </div>
  );
};
