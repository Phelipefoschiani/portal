import React, { useState } from 'react';
import { Wallet, PieChart, TrendingUp, Calendar, AlertCircle, Building2, CheckCircle2, XCircle, Clock, Filter, CreditCard, Banknote, Package } from 'lucide-react';
import { repSettings, mockInvestments, Investment, PaymentChannelType } from '../lib/mockData';

export const InvestmentsScreen: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatPercent = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(val);

  // Cálculos - SÓ CONSIDERA O QUE ESTÁ APROVADO ('approved')
  const totalBudget = repSettings.annualTarget * repSettings.investmentRate;
  const totalUsed = mockInvestments.reduce((acc, curr) => curr.status === 'approved' ? acc + curr.totalValue : acc, 0);
  const totalPending = mockInvestments.reduce((acc, curr) => curr.status === 'pending' ? acc + curr.totalValue : acc, 0);
  const remainingBudget = totalBudget - totalUsed;
  const usagePercentage = (totalUsed / totalBudget) * 100;
  
  // Filtragem e Ordenação
  const filteredInvestments = mockInvestments
    .filter(inv => filterStatus === 'all' ? true : inv.status === filterStatus)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Cor da Barra de Progresso
  const getProgressColor = (pct: number) => {
    if (pct < 50) return 'bg-emerald-500';
    if (pct < 80) return 'bg-blue-500';
    if (pct < 95) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getStatusBadge = (status: Investment['status']) => {
    switch (status) {
        case 'approved':
            return (
                <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-bold border border-emerald-100 w-fit">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    APROVADO
                </div>
            );
        case 'rejected':
            return (
                <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-lg text-xs font-bold border border-red-100 w-fit">
                    <XCircle className="w-3.5 h-3.5" />
                    RECUSADO
                </div>
            );
        default:
            return (
                <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-100 w-fit">
                    <Clock className="w-3.5 h-3.5" />
                    PENDENTE
                </div>
            );
    }
  };

  const getChannelIcon = (type: PaymentChannelType) => {
    switch (type) {
        case 'Caju': return <CreditCard className="w-3 h-3 text-pink-500" />;
        case 'Dinheiro': return <Banknote className="w-3 h-3 text-emerald-500" />;
        case 'Produto': return <Package className="w-3 h-3 text-blue-500" />;
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-blue-600" />
            Controle de Investimentos
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Gestão de verbas comerciais. Apenas itens <strong>aprovados</strong> debitam do saldo.
          </p>
        </div>
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100">
           Exercício: 2024
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Orçamento Total */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <PieChart className="w-24 h-24 text-slate-800" />
            </div>
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Orçamento Anual</p>
            <h3 className="text-3xl font-bold text-slate-800">{formatCurrency(totalBudget)}</h3>
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                Referente a {formatPercent(repSettings.investmentRate)} da Meta Anual
            </p>
        </div>

        {/* Card 2: Utilizado (Aprovado) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Comprometido (Aprovado)</p>
                <div className={`px-2 py-1 rounded text-xs font-bold ${usagePercentage > 80 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    {usagePercentage.toFixed(1)}% Usado
                </div>
            </div>
            <h3 className="text-3xl font-bold text-blue-600">{formatCurrency(totalUsed)}</h3>
            
            {/* Progress Bar */}
            <div className="mt-4 w-full h-2 bg-slate-100 rounded-full overflow-hidden relative">
                <div 
                    className={`h-full transition-all duration-1000 ${getProgressColor(usagePercentage)}`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                ></div>
            </div>
            {totalPending > 0 && (
                <p className="text-xs text-amber-500 mt-2 font-medium">
                    + {formatCurrency(totalPending)} em análise (pendente)
                </p>
            )}
        </div>

        {/* Card 3: Disponível */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Saldo Disponível</p>
            <h3 className={`text-3xl font-bold ${remainingBudget < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                {formatCurrency(remainingBudget)}
            </h3>
            <p className="text-xs text-slate-400 mt-2">
                {remainingBudget < 0 ? 'Atenção: Limite excedido' : 'Disponível para novas ações'}
            </p>
        </div>
      </div>

      {/* Extrato / Tabela */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col">
        
        {/* Header da Tabela + Filtros */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-slate-500" />
                <h3 className="font-bold text-slate-800">Extrato de Solicitações</h3>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex p-1 bg-slate-200/50 rounded-lg self-start md:self-auto overflow-x-auto max-w-full">
                <button 
                    onClick={() => setFilterStatus('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterStatus === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Todos
                </button>
                <button 
                    onClick={() => setFilterStatus('approved')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${filterStatus === 'approved' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-emerald-600'}`}
                >
                    <CheckCircle2 className="w-3 h-3" />
                    Aprovados
                </button>
                <button 
                    onClick={() => setFilterStatus('pending')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${filterStatus === 'pending' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-amber-600'}`}
                >
                    <Clock className="w-3 h-3" />
                    Pendentes
                </button>
                <button 
                    onClick={() => setFilterStatus('rejected')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${filterStatus === 'rejected' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-red-600'}`}
                >
                    <XCircle className="w-3 h-3" />
                    Recusados
                </button>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <th className="py-4 px-6 font-medium w-[15%]">Data</th>
                        <th className="py-4 px-6 font-medium w-[25%]">Cliente</th>
                        <th className="py-4 px-6 font-medium w-[25%]">Canais de Pagamento</th>
                        <th className="py-4 px-6 font-medium w-[15%]">Status (Gerência)</th>
                        <th className="py-4 px-6 font-medium w-[10%] text-right">Valor Total</th>
                        <th className="py-4 px-6 font-medium w-[10%] text-right">Impacto</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredInvestments.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400">
                                <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                Nenhum registro encontrado para este filtro.
                            </td>
                        </tr>
                    ) : (
                        filteredInvestments.map((inv) => {
                            const impact = (inv.totalValue / totalBudget); 
                            const isApproved = inv.status === 'approved';
                            
                            return (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="py-4 px-6 text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-slate-300" />
                                            {new Date(inv.date).toLocaleDateString('pt-BR')}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-slate-300" />
                                            <span className="font-medium text-slate-700">{inv.clientName}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <div className="flex flex-col gap-1.5">
                                            {inv.channels.map((channel, idx) => (
                                                <div key={idx} className="flex items-center gap-2 text-xs">
                                                    {getChannelIcon(channel.type)}
                                                    <span className="text-slate-600 font-medium">{channel.type}:</span>
                                                    <span className="text-slate-500">{formatCurrency(channel.value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        {getStatusBadge(inv.status)}
                                        {inv.approvedBy && inv.status !== 'pending' && (
                                            <p className="text-[10px] text-slate-400 mt-1">Por: {inv.approvedBy}</p>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-right font-bold text-slate-700">
                                        {formatCurrency(inv.totalValue)}
                                    </td>
                                    <td className="py-4 px-6 text-right">
                                        {isApproved ? (
                                             <div className="flex flex-col items-end gap-1">
                                                <span className="text-xs font-bold text-slate-600">{formatPercent(impact)}</span>
                                                <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${Math.max(impact * 100 * 5, 5)}%` }}></div> 
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 text-xs">--</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl text-center text-xs text-slate-400">
            * Itens pendentes ou recusados não afetam seu saldo disponível.
        </div>
      </div>

    </div>
  );
};