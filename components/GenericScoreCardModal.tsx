
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, BarChart3, Activity, ShoppingCart, AlertCircle, ArrowUpRight, ArrowDownRight, Calendar, Tag, MapPin, Users, Briefcase } from 'lucide-react';
import { totalDataStore } from '../lib/dataStore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList } from 'recharts';
import { Client } from '../types';
import { useSalesData } from '../hooks/useSalesData';

interface GenericScoreCardModalProps {
    dimension: 'canal_vendas' | 'grupo' | 'cidade' | 'usuario_id';
    value: string;
    label: string;
    onClose: () => void;
}

export const GenericScoreCardModal: React.FC<GenericScoreCardModalProps> = ({ dimension, value, label, onClose }) => {
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    
    useSalesData(parseInt(selectedYear, 10));

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

    const years = useMemo(() => {
        const yearsSet = new Set<string>();
        totalDataStore.vendasProdutosMes.forEach(s => {
            if (s.ano) yearsSet.add(String(s.ano));
        });
        return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    }, []);

    const scoreData = useMemo(() => {
        const clientMap = new Map<string, Client>();
        totalDataStore.clients.forEach(c => {
            clientMap.set(String(c.cnpj).replace(/\D/g, ''), c);
        });

        const sales = totalDataStore.vendasProdutosMes.filter(s => {
            const client = clientMap.get(String(s.cnpj).replace(/\D/g, ''));
            if (!client) return false;

            let matches = false;
            if (dimension === 'canal_vendas') matches = String(client.canal_vendas) === String(value);
            else if (dimension === 'grupo') matches = String(s.grupo) === String(value);
            else if (dimension === 'cidade') matches = String(client.cidade) === String(value);
            else if (dimension === 'usuario_id') matches = String(client.usuario_id) === String(value);

            return matches && Number(s.faturamento_total) > 0 && (selectedYear === 'all' || String(s.ano) === selectedYear);
        });
        
        if (sales.length === 0) return null;

        const totalFaturamento = sales.reduce((acc, s) => acc + (Number(s.faturamento_total) || 0), 0);
        const totalQuantidades = sales.reduce((acc, s) => acc + (Number(s.qtde_total) || 0), 0);

        // 1. Produtos mais comprados
        const productMap = new Map<string, { name: string, value: number, units: number, lastPurchase: string }>();
        sales.forEach(s => {
            const prodName = s.produto || 'Produto sem nome';
            const saleDate = `${s.ano}-${String(s.mes).padStart(2, '0')}-01`;
            const current = productMap.get(prodName) || { name: prodName, value: 0, units: 0, lastPurchase: '0000-00-00' };
            productMap.set(prodName, {
                name: prodName,
                value: current.value + (Number(s.faturamento_total) || 0),
                units: current.units + (Number(s.qtde_total) || 0),
                lastPurchase: saleDate > current.lastPurchase ? saleDate : current.lastPurchase
            });
        });
        const productsByUnits = Array.from(productMap.values()).sort((a, b) => b.units - a.units);

        // 2. Clientes Top
        const clientSalesMap = new Map<string, { name: string, value: number, units: number }>();
        sales.forEach(s => {
            const client = clientMap.get(String(s.cnpj).replace(/\D/g, ''));
            const clientName = client?.nome_fantasia || 'Cliente sem nome';
            const current = clientSalesMap.get(clientName) || { name: clientName, value: 0, units: 0 };
            clientSalesMap.set(clientName, {
                name: clientName,
                value: current.value + (Number(s.faturamento_total) || 0),
                units: current.units + (Number(s.qtde_total) || 0)
            });
        });
        const topClients = Array.from(clientSalesMap.values()).sort((a, b) => b.value - a.value).slice(0, 10);

        // 3. Compras Mensais
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const monthNum = i + 1;
            const monthSales = sales.filter(s => s.mes === monthNum);
            const val = monthSales.reduce((acc, s) => acc + (Number(s.faturamento_total) || 0), 0);
            return {
                name: monthNames[i],
                value: val,
                percent: totalFaturamento > 0 ? (val / totalFaturamento) * 100 : 0
            };
        });

        // 4. Métricas
        const monthsMap = new Set(sales.map(s => `${s.ano}-${String(s.mes).padStart(2, '0')}`));
        const activeMonths = monthsMap.size;
        const avgMonthly = activeMonths > 0 ? totalFaturamento / activeMonths : 0;
        const totalSkus = productMap.size;
        const totalUniqueClients = clientSalesMap.size;

        // 5. Tendência
        let trend = 0;
        if (selectedYear !== 'all') {
            const prevYear = parseInt(selectedYear) - 1;
            const prevYearSales = totalDataStore.vendasProdutosMes.filter(s => {
                const client = clientMap.get(String(s.cnpj).replace(/\D/g, ''));
                if (!client) return false;

                let matches = false;
                if (dimension === 'canal_vendas') matches = String(client.canal_vendas) === String(value);
                else if (dimension === 'grupo') matches = String(s.grupo) === String(value);
                else if (dimension === 'cidade') matches = String(client.cidade) === String(value);
                else if (dimension === 'usuario_id') matches = String(client.usuario_id) === String(value);

                return matches && Number(s.faturamento_total) > 0 && s.ano === prevYear;
            });
            const prevYearTotal = prevYearSales.reduce((acc, s) => acc + (Number(s.faturamento_total) || 0), 0);
            trend = prevYearTotal > 0 ? ((totalFaturamento / prevYearTotal) - 1) * 100 : 0;
        }

        return {
            productsByUnits: productsByUnits.slice(0, 10),
            topClients,
            monthlyData,
            totalSkus,
            totalUniqueClients,
            avgMonthly,
            totalFaturamento,
            totalQuantidades,
            trend,
            activeMonths
        };
    }, [dimension, value, selectedYear]);

    const getIcon = () => {
        switch (dimension) {
            case 'canal_vendas': return <Tag className="w-6 h-6" />;
            case 'grupo': return <Briefcase className="w-6 h-6" />;
            case 'cidade': return <MapPin className="w-6 h-6" />;
            case 'usuario_id': return <Users className="w-6 h-6" />;
            default: return <Activity className="w-6 h-6" />;
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 md:p-6 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
            <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl overflow-hidden animate-slideUp border border-white/20 flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
                            {getIcon()}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Score Card por {dimension.replace('_', ' ')}</h3>
                            <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1.5">{label}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <select 
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="text-[10px] font-black uppercase tracking-widest outline-none bg-transparent"
                            >
                                <option value="all">TODOS OS ANOS</option>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar p-6 md:p-8 space-y-8">
                    
                    {!scoreData ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <AlertCircle className="w-16 h-16 text-slate-200" />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum dado encontrado para este período</p>
                        </div>
                    ) : (
                        <>
                            {/* Top Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl border-b-4 border-indigo-600">
                                    <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest mb-1">Total Faturamento</p>
                                    <h4 className="text-xl font-black">{formatCurrency(scoreData.totalFaturamento)}</h4>
                                    <div className="mt-4 flex items-center gap-2">
                                        {scoreData.trend >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                                        <span className={`text-[10px] font-black uppercase ${scoreData.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {Math.abs(scoreData.trend).toFixed(1)}% vs Ano Ant.
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Clientes Atendidos</p>
                                    <h4 className="text-2xl font-black text-slate-900">{scoreData.totalUniqueClients}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Clientes distintos no período</p>
                                </div>
                                <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Média Mensal</p>
                                    <h4 className="text-2xl font-black text-slate-900">{formatCurrency(scoreData.avgMonthly)}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Valor médio por mês ativo</p>
                                </div>
                                <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total SKUs</p>
                                    <h4 className="text-2xl font-black text-slate-900">{scoreData.totalSkus}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Itens únicos vendidos</p>
                                </div>
                                <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Unidades</p>
                                    <h4 className="text-2xl font-black text-slate-900">{scoreData.totalQuantidades}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Unidades totais faturadas</p>
                                </div>
                            </div>

                            {/* Main Chart */}
                            <div className="bg-slate-50 rounded-[40px] p-8 border border-slate-100">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Performance Mensal</h4>
                                    </div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sazonalidade do {label}</span>
                                </div>
                                <div className="h-[350px] w-full" style={{ minWidth: 0 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={scoreData.monthlyData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} 
                                            />
                                            <YAxis hide />
                                            <Tooltip 
                                                cursor={{ fill: '#f1f5f9' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data = payload[0].payload;
                                                        return (
                                                            <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{data.name}</p>
                                                                <p className="text-lg font-black text-slate-900">{formatCurrency(data.value)}</p>
                                                                <p className="text-[10px] font-black text-indigo-600 uppercase">{data.percent.toFixed(1)}% do Total</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="value" fill="#4f46e5" radius={[8, 8, 0, 0]} barSize={40}>
                                                <LabelList 
                                                    dataKey="percent" 
                                                    position="top" 
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    formatter={(val: any) => Number(val) > 0 ? `${Number(val).toFixed(1)}%` : ''}
                                                    style={{ fontSize: '10px', fontWeight: 900, fill: '#64748b' }}
                                                />
                                                {scoreData.monthlyData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.value > scoreData.avgMonthly ? '#4f46e5' : '#94a3b8'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Tables Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Top Clients */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 px-2">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Top 10 Clientes</h4>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                <tr>
                                                    <th className="px-6 py-4">Cliente</th>
                                                    <th className="px-6 py-4 text-right">Unidades</th>
                                                    <th className="px-6 py-4 text-right">Valor Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {scoreData.topClients.map((c, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <p className="text-[10px] font-black text-slate-700 uppercase truncate max-w-[250px] group-hover:text-indigo-600 transition-colors">{c.name}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-500 tabular-nums">{c.units}</td>
                                                        <td className="px-6 py-4 text-right font-black text-indigo-600 tabular-nums">{formatCurrency(c.value)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Top Products */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 px-2">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                            <ShoppingCart className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Top 10 Produtos</h4>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                <tr>
                                                    <th className="px-6 py-4">Produto</th>
                                                    <th className="px-6 py-4 text-right">Unidades</th>
                                                    <th className="px-6 py-4 text-right">Valor Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {scoreData.productsByUnits.map((p, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-6 py-4">
                                                            <p className="text-[10px] font-black text-slate-700 uppercase truncate max-w-[250px] group-hover:text-emerald-600 transition-colors">{p.name}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-500 tabular-nums">{p.units}</td>
                                                        <td className="px-6 py-4 text-right font-black text-emerald-600 tabular-nums">{formatCurrency(p.value)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
