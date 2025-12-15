import React, { useState } from 'react';
import { Target, TrendingUp, Users, AlertCircle, Calendar, DollarSign, Wallet } from 'lucide-react';
import { clients, representatives, mockInvestments } from '../../lib/mockData';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const ManagerDashboard: React.FC = () => {
    // Estado para Modais de Detalhe
    const [detailType, setDetailType] = useState<'sales' | 'meta' | 'positive' | 'negative' | null>(null);

    // Cálculos Globais
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // 1-12
    const currentYear = currentDate.getFullYear();
    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });

    // Consolidar dados de todos os representantes
    const globalStats = representatives.reduce((acc, rep) => {
        // Filtrar clientes deste rep
        const repClients = clients.filter(c => c.repId === rep.id);
        
        // Calcular vendas do mês atual para este rep
        const repSalesCurrentMonth = repClients.reduce((sum, client) => {
             const historyEntry = client.history.find(h => h.month === currentMonth && h.year === currentYear);
             return sum + (historyEntry?.value || 0);
        }, 0);

        // Positivação
        const positivized = repClients.filter(c => {
             const historyEntry = c.history.find(h => h.month === currentMonth && h.year === currentYear);
             return historyEntry && historyEntry.value > 0;
        }).length;

        // Investimentos Aprovados do Rep (APENAS DO MÊS ATUAL)
        const investments = mockInvestments
            .filter(i => {
                const iDate = new Date(i.date);
                return i.repId === rep.id && 
                       i.status === 'approved' &&
                       iDate.getMonth() + 1 === currentMonth &&
                       iDate.getFullYear() === currentYear;
            })
            .reduce((sum, i) => sum + i.totalValue, 0);

        return {
            totalTarget: acc.totalTarget + (rep.annualTarget / 12), // Meta mensal
            totalSales: acc.totalSales + repSalesCurrentMonth,
            positivizedClients: acc.positivizedClients + positivized,
            totalClients: acc.totalClients + repClients.length,
            totalInvestment: acc.totalInvestment + investments
        };
    }, { totalTarget: 0, totalSales: 0, positivizedClients: 0, totalClients: 0, totalInvestment: 0 });

    const nonPositivized = globalStats.totalClients - globalStats.positivizedClients;
    const percentualAtingido = globalStats.totalTarget > 0 ? (globalStats.totalSales / globalStats.totalTarget) * 100 : 0;
    
    // Investimento % referente a META
    const investmentPercentOfMeta = globalStats.totalTarget > 0 ? (globalStats.totalInvestment / globalStats.totalTarget) * 100 : 0;

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Visão Geral da Gerência</h2>
                    <p className="text-slate-500 text-sm mt-1 capitalize">
                        {monthName} de {currentYear} • Acompanhamento Mensal
                    </p>
                </div>
            </div>

            {/* Grid de Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Meta do Mês */}
                <div 
                    onClick={() => setDetailType('meta')}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Meta do Mês</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(globalStats.totalTarget)}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition-colors">
                            <Target className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded inline-block">
                        Ver meta por representante
                    </div>
                </div>

                 {/* 2. Total Faturado */}
                 <div 
                    onClick={() => setDetailType('sales')}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Total Faturado</p>
                            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(globalStats.totalSales)}</h3>
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100 transition-colors">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                         <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                             <div className="h-full bg-emerald-500" style={{ width: `${Math.min(percentualAtingido, 100)}%` }}></div>
                         </div>
                         <span className="text-xs font-bold text-emerald-700">{percentualAtingido.toFixed(1)}%</span>
                    </div>
                </div>

                {/* 3. Carteira Positivada */}
                <div 
                    onClick={() => setDetailType('positive')}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group"
                >
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Carteira Positivada</p>
                            <div className="flex items-baseline gap-1 mt-1">
                                <h3 className="text-2xl font-bold text-slate-900">{globalStats.positivizedClients}</h3>
                                <span className="text-sm text-slate-400">/ {globalStats.totalClients}</span>
                            </div>
                        </div>
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-100 transition-colors">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4 text-xs text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded inline-block">
                        Detalhar por representante
                    </div>
                </div>

                {/* 4. Investimentos (Mês Atual) */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Investimento (Mês)</p>
                            <h3 className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(globalStats.totalInvestment)}</h3>
                        </div>
                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                            <Wallet className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                             {investmentPercentOfMeta.toFixed(2)}% da Meta
                        </span>
                    </div>
                </div>

            </div>

            {/* Card de Alerta - Não Positivados */}
            <div 
                onClick={() => setDetailType('negative')}
                className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-center justify-between cursor-pointer hover:bg-red-100 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white text-red-500 rounded-full shadow-sm">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-red-900">{nonPositivized} Clientes Não Positivados</h3>
                        <p className="text-red-700 text-sm">Clique para ver a lista de clientes pendentes de compra no mês.</p>
                    </div>
                </div>
                <Users className="w-6 h-6 text-red-300" />
            </div>

            {/* -- MODAIS -- */}
            {detailType && (
                <DashboardDetailModal 
                    type={detailType} 
                    onClose={() => setDetailType(null)} 
                    currentMonth={currentMonth}
                    currentYear={currentYear}
                />
            )}
        </div>
    );
};

// Sub-componente Modal
const DashboardDetailModal: React.FC<{ type: string, onClose: () => void, currentMonth: number, currentYear: number }> = ({ type, onClose, currentMonth, currentYear }) => {
    
    // Preparar dados para a tabela
    const rows = representatives.map(rep => {
        const repClients = clients.filter(c => c.repId === rep.id);
        
        const sales = repClients.reduce((sum, c) => {
             const h = c.history.find(d => d.month === currentMonth && d.year === currentYear);
             return sum + (h?.value || 0);
        }, 0);

        const target = rep.annualTarget / 12; // Meta mensal aprox
        
        const positivized = repClients.filter(c => {
             const h = c.history.find(d => d.month === currentMonth && d.year === currentYear);
             return h && h.value > 0;
        });

        return {
            rep,
            sales,
            target,
            positivizedCount: positivized.length,
            totalClients: repClients.length,
            nonPositivized: repClients.filter(c => !positivized.includes(c)),
        };
    });

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    let title = '';
    let content = null;

    if (type === 'meta') {
        title = 'Metas do Mês por Representante';
        content = (
             <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-slate-50 text-slate-500">
                        <th className="py-3 px-4">Representante</th>
                        <th className="py-3 px-4 text-right">Meta Mensal</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map(row => (
                        <tr key={row.rep.id}>
                            <td className="py-3 px-4 font-medium text-slate-700">{row.rep.name}</td>
                            <td className="py-3 px-4 text-right font-bold text-slate-800">{formatCurrency(row.target)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    } else if (type === 'sales') {
        title = 'Faturamento Atual por Representante';
        content = (
             <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-slate-50 text-slate-500">
                        <th className="py-3 px-4">Representante</th>
                        <th className="py-3 px-4 text-right">Total Faturado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map(row => (
                        <tr key={row.rep.id}>
                            <td className="py-3 px-4 font-medium text-slate-700">{row.rep.name}</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600">{formatCurrency(row.sales)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    } else if (type === 'positive') {
        title = 'Carteira e Positivação por Representante';
        content = (
             <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-slate-50 text-slate-500">
                        <th className="py-3 px-4">Representante</th>
                        <th className="py-3 px-4 text-center">Clientes na Carteira</th>
                        <th className="py-3 px-4 text-center">Clientes que Compraram</th>
                        <th className="py-3 px-4 text-right">% Positivação</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {rows.map(row => {
                         const pct = row.totalClients > 0 ? (row.positivizedCount / row.totalClients) * 100 : 0;
                         return (
                            <tr key={row.rep.id}>
                                <td className="py-3 px-4 font-medium text-slate-700">{row.rep.name}</td>
                                <td className="py-3 px-4 text-center text-slate-600">{row.totalClients}</td>
                                <td className="py-3 px-4 text-center font-bold text-purple-600">{row.positivizedCount}</td>
                                <td className="py-3 px-4 text-right">
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${pct >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {pct.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    } else if (type === 'negative') {
        title = 'Clientes Não Positivados (Pendentes)';
        content = (
            <div className="space-y-6">
                {rows.map(row => (
                    <div key={row.rep.id} className="border-b border-slate-100 pb-4 last:border-0">
                        <h4 className="font-bold text-slate-800 mb-2 flex justify-between">
                            {row.rep.name}
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">{row.nonPositivized.length} pendentes</span>
                        </h4>
                        <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                            {row.nonPositivized.length === 0 ? (
                                <p className="text-xs text-emerald-600">Todos positivados!</p>
                            ) : (
                                <ul className="space-y-2">
                                    {row.nonPositivized.map(c => (
                                        <li key={c.id} className="text-xs text-slate-600 flex justify-between">
                                            <span>{c.name}</span>
                                            <span className="text-slate-400">Última: {new Date(c.lastPurchaseDate).toLocaleDateString('pt-BR')}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <h3 className="text-xl font-bold text-slate-800">{title}</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="overflow-y-auto p-6 flex-1">
                    {content}
                </div>
            </div>
        </div>,
        document.body
    );
}