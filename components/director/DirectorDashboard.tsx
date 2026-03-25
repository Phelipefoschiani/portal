

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
    ChevronDown, CheckSquare, Square, 
    DollarSign, Target, PieChart, ArrowUpRight, ArrowDownRight,
    Package, Layers, X, Info, Award
} from 'lucide-react';
import { totalDataStore } from '../../lib/dataStore';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
    PieChart as RePieChart, Pie, Cell, LabelList
} from 'recharts';
import { createPortal } from 'react-dom';

interface GroupData {
    name: string;
    value: number;
    share: number;
}

const AllGroupsModal: React.FC<{ groups: GroupData[]; onClose: () => void }> = ({ groups, onClose }) => {
    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp border border-white/20 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-xl"><Layers className="w-5 h-5" /></div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Detalhamento de Grupos</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="overflow-y-auto p-0 custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-6 py-4">Grupo</th>
                                <th className="px-6 py-4 text-right">Faturamento</th>
                                <th className="px-6 py-4 text-right">Part. %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {groups.map((group, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-xs font-bold text-slate-700 uppercase">{group.name}</td>
                                    <td className="px-6 py-4 text-right text-xs font-black text-slate-900 tabular-nums">{formatCurrency(group.value)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${group.share}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 w-12 tabular-nums">{group.share.toFixed(2)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 text-center shrink-0">
                    <button onClick={onClose} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Fechar Lista</button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const DirectorDashboard: React.FC = () => {
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [showAllGroupsModal, setShowAllGroupsModal] = useState(false);
    
    const dropdownRef = useRef<HTMLDivElement>(null);

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const availableYears = [2024, 2025, 2026, 2027];
    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowMonthDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleTempMonth = (m: number) => {
        setTempSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    };

    const handleApplyFilter = () => {
        setSelectedMonths([...tempSelectedMonths]);
        setShowMonthDropdown(false);
    };

    const getMonthsLabel = () => {
        if (selectedMonths.length === 0) return "Mês";
        if (selectedMonths.length === 1) return monthNames[selectedMonths[0] - 1].toUpperCase();
        if (selectedMonths.length === 12) return "ANO TODO";
        return `${selectedMonths.length} MESES`;
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
    const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);

    // Helper to interpolate color from Blue (#3b82f6) to Red (#ef4444)
    const getGradientColor = (index: number, total: number) => {
        const startColor = { r: 59, g: 130, b: 246 }; // Blue-500
        const endColor = { r: 239, g: 68, b: 68 };   // Red-500
        
        if (total <= 1) return `rgb(${startColor.r}, ${startColor.g}, ${startColor.b})`;

        const ratio = index / (total - 1);
        
        const r = Math.round(startColor.r + (endColor.r - startColor.r) * ratio);
        const g = Math.round(startColor.g + (endColor.g - startColor.g) * ratio);
        const b = Math.round(startColor.b + (endColor.b - startColor.b) * ratio);

        return `rgb(${r}, ${g}, ${b})`;
    };

    // --- DATA PROCESSING ---
    const data = useMemo(() => {
        const vendasConsolidadas = totalDataStore.vendasConsolidadas;
        const vendasCanaisMes = totalDataStore.vendasCanaisMes;
        const vendasProdutosMes = totalDataStore.vendasProdutosMes;
        const targets = totalDataStore.targets;

        // 1. Filter Sales for Current Period
        const currentVendas = vendasConsolidadas.filter(v => 
            v.ano === selectedYear && selectedMonths.includes(v.mes)
        );

        // 2. Filter Sales for Previous Period
        const prevVendas = vendasConsolidadas.filter(v => 
            v.ano === (selectedYear - 1) && selectedMonths.includes(v.mes)
        );

        // 3. Calculate Totals (Period)
        const totalRevenue = currentVendas.reduce((acc, curr) => acc + (Number(curr.faturamento_total) || 0), 0);
        const totalPrevRevenue = prevVendas.reduce((acc, curr) => acc + (Number(curr.faturamento_total) || 0), 0);
        const revenueGrowth = totalPrevRevenue > 0 ? ((totalRevenue / totalPrevRevenue) - 1) * 100 : 0;

        // 4. Calculate Targets (Period)
        const totalTarget = targets
            .filter(t => t.ano === selectedYear && selectedMonths.includes(t.mes))
            .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
        
        const targetAchievement = totalTarget > 0 ? (totalRevenue / totalTarget) * 100 : 0;

        // 5. Calculate Annual Totals (Year)
        const annualVendas = vendasConsolidadas.filter(v => 
            v.ano === selectedYear
        );
        const totalAnnualRevenue = annualVendas.reduce((acc, curr) => acc + (Number(curr.faturamento_total) || 0), 0);
        
        const totalAnnualTarget = targets
            .filter(t => t.ano === selectedYear)
            .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
            
        const annualAchievement = totalAnnualTarget > 0 ? (totalAnnualRevenue / totalAnnualTarget) * 100 : 0;

        // 6. Channel Analysis
        const channelMap = new Map<string, number>();
        const currentCanais = vendasCanaisMes.filter(v => 
            v.ano === selectedYear && selectedMonths.includes(v.mes)
        );
        currentCanais.forEach(v => {
            const channel = v.canal_vendas || 'OUTROS';
            channelMap.set(channel, (channelMap.get(channel) || 0) + Number(v.faturamento_total));
        });
        const channelData = Array.from(channelMap.entries())
            .map(([name, value]) => ({ name, value, share: totalRevenue > 0 ? (value / totalRevenue) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);

        // 7. Group Analysis
        const groupMap = new Map<string, number>();
        const currentProdutos = vendasProdutosMes.filter(v => 
            v.ano === selectedYear && selectedMonths.includes(v.mes)
        );
        currentProdutos.forEach(v => {
            const group = v.grupo || 'GERAL';
            groupMap.set(group, (groupMap.get(group) || 0) + Number(v.faturamento_total));
        });
        const groupData = Array.from(groupMap.entries())
            .map(([name, value]) => ({ name, value, share: totalRevenue > 0 ? (value / totalRevenue) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);

        // 8. Product Analysis
        const productMap = new Map<string, { name: string, revenue: number, units: number, group: string }>();
        currentProdutos.forEach(v => {
            const key = v.codigo_produto || v.produto;
            const existing = productMap.get(key) || { 
                name: v.produto || 'Item', 
                revenue: 0, 
                units: 0, 
                group: v.grupo || 'GERAL'
            };
            existing.revenue += Number(v.faturamento_total);
            existing.units += Number(v.qtde_total || 0);
            productMap.set(key, existing);
        });
        const productData = Array.from(productMap.values())
            .map(p => ({ ...p, share: totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0 }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10); // Top 10 Products

        return {
            totalRevenue,
            totalPrevRevenue,
            revenueGrowth,
            totalTarget,
            targetAchievement,
            totalAnnualRevenue,
            totalAnnualTarget,
            annualAchievement,
            channelData,
            groupData,
            productData
        };
    }, [selectedYear, selectedMonths]);

    const chartGroupData = data.groupData.slice(0, 12); // Show top 12 in chart to avoid clutter

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-20">
            {/* HEADER & FILTERS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Visão do Diretor</h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Análise Executiva de Performance</p>
                </div>

                <div className="flex gap-3 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => {
                                setTempSelectedMonths([...selectedMonths]);
                                setShowMonthDropdown(!showMonthDropdown);
                            }}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black uppercase flex items-center gap-2 hover:bg-slate-100 transition-colors"
                        >
                            <span>{getMonthsLabel()}</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        
                        {showMonthDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between gap-2">
                                    <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[9px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100">Todos</button>
                                    <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[9px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg hover:bg-red-100">Limpar</button>
                                </div>
                                <div className="p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
                                    {monthNames.map((m, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => toggleTempMonth(i + 1)}
                                            className={`flex items-center gap-2 p-2 rounded-lg text-[9px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 opacity-20" />}
                                            {m.substring(0, 3)}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-3 border-t border-slate-100">
                                    <button onClick={handleApplyFilter} className="w-full bg-blue-600 text-white py-2 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700">Aplicar Filtro</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* PERIOD KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Revenue Card */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <DollarSign className="w-24 h-24 text-blue-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturamento Realizado (Período)</p>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(data.totalRevenue)}</h3>
                        
                        <div className="mt-4 flex items-center gap-3">
                            <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${data.revenueGrowth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                {data.revenueGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {Math.abs(data.revenueGrowth).toFixed(2)}%
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">vs Ano Anterior ({formatCurrency(data.totalPrevRevenue)})</span>
                        </div>
                    </div>
                </div>

                {/* Target Card */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Target className="w-24 h-24 text-purple-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta do Período</p>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(data.totalTarget)}</h3>
                        
                        <div className="mt-4">
                            <div className="flex justify-between text-[9px] font-black uppercase mb-1">
                                <span className="text-slate-500">Atingimento</span>
                                <span className={data.targetAchievement >= 100 ? 'text-blue-600' : 'text-red-500'}>{data.targetAchievement.toFixed(2)}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${data.targetAchievement >= 100 ? 'bg-blue-600' : 'bg-red-500'}`} 
                                    style={{ width: `${Math.min(data.targetAchievement, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ANNUAL KPI CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Annual Revenue Card */}
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Award className="w-24 h-24 text-amber-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturamento Anual ({selectedYear})</p>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(data.totalAnnualRevenue)}</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Acumulado do ano até o momento</p>
                    </div>
                </div>

                {/* Annual Target Card */}
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Target className="w-24 h-24 text-indigo-500" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Anual ({selectedYear})</p>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(data.totalAnnualTarget)}</h3>
                        
                        <div className="mt-4">
                            <div className="flex justify-between text-[9px] font-black uppercase mb-1">
                                <span className="text-slate-500">Atingimento Anual</span>
                                <span className={data.annualAchievement >= 100 ? 'text-blue-600' : 'text-red-500'}>{data.annualAchievement.toFixed(2)}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full rounded-full ${data.annualAchievement >= 100 ? 'bg-blue-600' : 'bg-red-500'}`} 
                                    style={{ width: `${Math.min(data.annualAchievement, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CHARTS ROW 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Channel Analysis */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><PieChart className="w-5 h-5" /></div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Canais de Venda</h3>
                    </div>
                    <div className="h-[300px] w-full" style={{ minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                                                <RePieChart>
                                                    <Pie
                                                        data={data.channelData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                        nameKey="name"
                                                        label={({ name, percent }) => `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                                                        labelLine={{ stroke: '#64748b', strokeWidth: 1 }}
                                                    >
                                                        {data.channelData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        formatter={(value: any) => formatCurrency(Number(value) || 0)}
                                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                    />
                                                    <Legend />
                                                </RePieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                        {data.channelData.map((channel, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                    <span className="font-bold text-slate-600 uppercase">{channel.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-bold text-slate-900">{formatCurrency(channel.value)}</span>
                                    <span className="font-black text-slate-400 w-12 text-right">{channel.share.toFixed(2)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>


                {/* Group Analysis - Horizontal Bars */}
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Layers className="w-5 h-5" /></div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Top Grupos</h3>
                    </div>
                    <div className="h-[400px] w-full" style={{ minWidth: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                layout="vertical" 
                                data={chartGroupData} 
                                margin={{ top: 0, right: 50, left: 10, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#e2e8f0" />
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    width={140}
                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#475569' }} 
                                    axisLine={false}
                                    tickLine={false}
                                    interval={0}
                                />
                                <Tooltip 
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    formatter={(value: any) => formatCurrency(Number(value) || 0)}
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                />
                                <Bar 
                                    dataKey="value" 
                                    radius={[0, 6, 6, 0]} 
                                    onClick={() => setShowAllGroupsModal(true)}
                                    cursor="pointer"
                                    barSize={24}
                                >
                                    {chartGroupData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getGradientColor(index, chartGroupData.length)} />
                                    ))}
                                    <LabelList 
                                        dataKey="share" 
                                        position="right" 
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                        formatter={(val: any) => `${Number(val).toFixed(2)}%`} 
                                        style={{ fontSize: '10px', fontWeight: '900', fill: '#64748b' }} 
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <p className="text-center text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-wide flex items-center justify-center gap-2">
                        <Info className="w-3 h-3" />
                        Clique nas barras para ver o detalhamento completo
                    </p>
                </div>
            </div>

            {/* TOP PRODUCTS TABLE */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Package className="w-5 h-5" /></div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Produtos Mais Vendidos</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="pb-4 pl-4">Produto</th>
                                <th className="pb-4">Grupo</th>
                                <th className="pb-4 text-right">Unidades</th>
                                <th className="pb-4 text-right">Valor Total</th>
                                <th className="pb-4 text-right pr-4">Part. %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data.productData.map((prod, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 pl-4">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">{idx + 1}</span>
                                            <span className="text-xs font-bold text-slate-700 uppercase truncate max-w-[300px] block">{prod.name}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 text-[10px] font-bold text-slate-500 uppercase">
                                        <div className="flex items-center gap-1.5">
                                            <Layers className="w-3 h-3 text-slate-300" />
                                            {prod.group}
                                        </div>
                                    </td>
                                    <td className="py-3 text-right text-xs font-bold text-slate-600 tabular-nums">{formatNumber(prod.units)}</td>
                                    <td className="py-3 text-right text-xs font-black text-slate-900 tabular-nums">{formatCurrency(prod.revenue)}</td>
                                    <td className="py-3 text-right pr-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${prod.share}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 w-12 tabular-nums">{prod.share.toFixed(2)}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showAllGroupsModal && (
                <AllGroupsModal groups={data.groupData} onClose={() => setShowAllGroupsModal(false)} />
            )}
        </div>
    );
};
