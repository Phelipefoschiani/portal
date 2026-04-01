
import React, { useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, BarChart3, PieChart, Activity, ShoppingCart, AlertCircle, ArrowUpRight, ArrowDownRight, Calendar, Download } from 'lucide-react';
import { totalDataStore } from '../lib/dataStore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, PieChart as RePieChart, Pie, Legend } from 'recharts';
import { Sale } from '../types';
import html2canvas from 'html2canvas';

interface ClientScoreCardModalProps {
    client: { cnpj: string; nome_fantasia?: string };
    onClose: () => void;
    onBack?: () => void;
}

export const ClientScoreCardModal: React.FC<ClientScoreCardModalProps> = ({ client, onClose, onBack }) => {
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [isDownloading, setIsDownloading] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

    const handleDownloadPNG = async () => {
        if (!contentRef.current) return;
        setIsDownloading(true);
        try {
            // Ensure the element is fully visible for capture
            const element = contentRef.current;
            const originalStyle = element.style.height;
            element.style.height = 'auto'; // Force natural height
            
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 1200, // Fixed width for consistent capture
                onclone: (clonedDoc) => {
                    const clonedElement = clonedDoc.getElementById('scorecard-content');
                    if (clonedElement) {
                        clonedElement.style.height = 'auto';
                        clonedElement.style.overflow = 'visible';
                        clonedElement.style.width = '1200px';
                        clonedElement.style.padding = '40px';
                    }
                }
            });
            
            element.style.height = originalStyle;

            const link = document.createElement('a');
            link.download = `Scorecard_${client.nome_fantasia || 'Cliente'}_${selectedYear}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Erro ao baixar PNG:', err);
        } finally {
            setIsDownloading(false);
        }
    };

    const years = useMemo(() => {
        const yearsSet = new Set<string>();
        (totalDataStore.sales as Sale[]).forEach(s => {
            if (s.data) yearsSet.add(s.data.substring(0, 4));
        });
        return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    }, []);

    const scoreData = useMemo(() => {
        const sales = (totalDataStore.sales as Sale[]).filter(s => 
            String(s.cnpj).replace(/\D/g, '') === String(client.cnpj).replace(/\D/g, '') && 
            Number(s.faturamento) > 0 &&
            (selectedYear === 'all' || s.data.startsWith(selectedYear))
        );
        
        if (sales.length === 0) return null;

        const totalFaturamento = sales.reduce((acc, s) => acc + (Number(s.faturamento) || 0), 0);
        const totalQuantidades = sales.reduce((acc, s) => acc + (Number(s.qtde_faturado) || 0), 0);

        // 1. Produtos mais comprados (Valor e Unidades)
        const productMap = new Map<string, { name: string, value: number, units: number, lastPurchase: string }>();
        sales.forEach(s => {
            const prodName = s.produto || 'Produto sem nome';
            const current = productMap.get(prodName) || { name: prodName, value: 0, units: 0, lastPurchase: '0000-00-00' };
            productMap.set(prodName, {
                name: prodName,
                value: current.value + (Number(s.faturamento) || 0),
                units: current.units + (Number(s.qtde_faturado) || 0),
                lastPurchase: s.data > current.lastPurchase ? s.data : current.lastPurchase
            });
        });

        const productsByUnits = Array.from(productMap.values()).sort((a, b) => b.units - a.units);

        // 2. Canais de produtos (Categorias)
        const categoryMap = new Map<string, { name: string, value: number, units: number }>();
        sales.forEach(s => {
            const cat = (s.grupo || 'GERAL').trim().toUpperCase();
            const current = categoryMap.get(cat) || { name: cat, value: 0, units: 0 };
            categoryMap.set(cat, {
                name: cat,
                value: current.value + (Number(s.faturamento) || 0),
                units: current.units + (Number(s.qtde_faturado) || 0)
            });
        });
        const categories = Array.from(categoryMap.values()).map(c => ({
            ...c,
            percent: totalFaturamento > 0 ? (c.value / totalFaturamento) * 100 : 0
        })).sort((a, b) => b.value - a.value);

        // 3. Compras Mensais (Bar Chart)
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const monthStr = String(i + 1).padStart(2, '0');
            const monthSales = sales.filter(s => s.data.includes(`-${monthStr}-`));
            const value = monthSales.reduce((acc, s) => acc + (Number(s.faturamento) || 0), 0);
            return {
                name: monthNames[i],
                value,
                percent: totalFaturamento > 0 ? (value / totalFaturamento) * 100 : 0
            };
        });

        // 4. Recompra e Saúde
        const monthsMap = new Map<string, number>();
        sales.forEach(s => {
            const month = s.data.substring(0, 7); // YYYY-MM
            monthsMap.set(month, (monthsMap.get(month) || 0) + (Number(s.faturamento) || 0));
        });
        const activeMonths = monthsMap.size;
        const avgMonthly = activeMonths > 0 ? totalFaturamento / activeMonths : 0;

        // 5. SKUs cadastrados
        const totalSkus = productMap.size;

        // 6. Tendência (Comparando com o ano anterior se selecionado um ano específico)
        let trend = 0;
        if (selectedYear !== 'all') {
            const prevYear = (parseInt(selectedYear) - 1).toString();
            const prevYearSales = (totalDataStore.sales as Sale[]).filter(s => 
                String(s.cnpj).replace(/\D/g, '') === String(client.cnpj).replace(/\D/g, '') && 
                Number(s.faturamento) > 0 &&
                s.data.startsWith(prevYear)
            );
            const prevYearTotal = prevYearSales.reduce((acc, s) => acc + (Number(s.faturamento) || 0), 0);
            trend = prevYearTotal > 0 ? ((totalFaturamento / prevYearTotal) - 1) * 100 : 0;
        }

        return {
            productsByUnits: productsByUnits.slice(0, 5),
            categories,
            monthlyData,
            totalSkus,
            avgMonthly,
            totalFaturamento,
            totalQuantidades,
            trend,
            activeMonths
        };
    }, [client.cnpj, selectedYear]);

    const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#ca8a04'];

    return createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 md:p-6 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
            <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl overflow-hidden animate-slideUp border border-white/20 flex flex-col max-h-[92vh]">
                
                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                                        Score Card do Cliente - {client.nome_fantasia}
                                    </h3>
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
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full">
                            <button 
                                onClick={handleDownloadPNG}
                                disabled={isDownloading}
                                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-blue-600 rounded-full text-[10px] font-black uppercase transition-all shadow-sm disabled:opacity-50"
                            >
                                <Download className="w-3 h-3" />
                                {isDownloading ? 'Gerando...' : 'Baixar PNG'}
                            </button>
                            {onBack && (
                                <button 
                                    onClick={onBack} 
                                    className="px-4 py-2 hover:bg-white hover:shadow-sm rounded-full text-[10px] font-black text-slate-600 uppercase transition-all"
                                >
                                    Voltar
                                </button>
                            )}
                            <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
                    <div ref={contentRef} id="scorecard-content" className="p-10 space-y-10 bg-white min-w-[1000px]">
                        {/* Header for PNG Capture */}
                        <div className="border-b-8 border-blue-600 pb-10 mb-10 flex justify-between items-end">
                            <div className="space-y-2">
                                <p className="text-blue-600 font-black text-xs uppercase tracking-[0.4em]">Relatório de Performance</p>
                                    <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tighter">
                                        Score Card - {client.nome_fantasia}
                                    </h1>
                                    <div className="flex items-center gap-3 mt-4">
                                        <div className="px-6 py-2 bg-slate-900 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg">
                                            Período: {selectedYear === 'all' ? 'Histórico Completo' : `Ano ${selectedYear}`}
                                        </div>
                                        <div className="px-6 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-black uppercase tracking-widest border border-blue-100">
                                            CNPJ: {client.cnpj}
                                        </div>
                                    </div>
                            </div>
                            <div className="text-right">
                                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl mb-4 ml-auto shadow-xl">CN</div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Inteligência de Vendas</p>
                                <p className="text-sm font-black text-slate-900 uppercase">Portal Centro-Norte</p>
                            </div>
                        </div>
                        
                        {!scoreData ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <AlertCircle className="w-16 h-16 text-slate-200" />
                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhum dado encontrado para este período</p>
                        </div>
                    ) : (
                        <>
                            {/* Top Stats - Reordered and Updated */}
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="bg-slate-900 rounded-[32px] p-6 text-white shadow-xl border-b-4 border-blue-600">
                                    <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Faturamento</p>
                                    <h4 className="text-xl font-black">{formatCurrency(scoreData.totalFaturamento)}</h4>
                                    <div className="mt-4 flex items-center gap-2">
                                        {scoreData.trend >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-red-400" />}
                                        <span className={`text-[10px] font-black uppercase ${scoreData.trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {Math.abs(scoreData.trend).toFixed(1)}% vs Ano Ant.
                                        </span>
                                    </div>
                                </div>
                                <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Meses Positivados</p>
                                    <h4 className="text-2xl font-black text-slate-900">{scoreData.activeMonths}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Meses com compras no período</p>
                                </div>
                                <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Média Mensal</p>
                                    <h4 className="text-2xl font-black text-slate-900">{formatCurrency(scoreData.avgMonthly)}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Valor médio por mês ativo</p>
                                </div>
                                <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total SKUs</p>
                                    <h4 className="text-2xl font-black text-slate-900">{scoreData.totalSkus}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Itens únicos comprados</p>
                                </div>
                                <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Quantidades</p>
                                    <h4 className="text-2xl font-black text-slate-900">{scoreData.totalQuantidades.toLocaleString('pt-BR')}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Unidades totais faturadas</p>
                                </div>
                            </div>

                            {/* Charts Row */}
                            <div className="grid grid-cols-1 gap-8">
                                {/* Monthly Purchases Bar Chart */}
                                <div className="bg-slate-50 rounded-[40px] p-8 border border-slate-100">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <BarChart3 className="w-5 h-5 text-blue-600" />
                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Compras Mensais</h4>
                                        </div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sazonalidade</span>
                                    </div>
                                    <div className="h-[300px] w-full" style={{ minWidth: 0 }}>
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
                                                                    <p className="text-[10px] font-black text-blue-600 uppercase">{data.percent.toFixed(1)}% do Total</p>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={32}>
                                                    <LabelList 
                                                        dataKey="percent" 
                                                        position="top" 
                                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                        formatter={(val: any) => Number(val) > 0 ? `${Number(val).toFixed(1)}%` : ''}
                                                        style={{ fontSize: '9px', fontWeight: 900, fill: '#64748b' }}
                                                    />
                                                    {scoreData.monthlyData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.value > scoreData.avgMonthly ? '#2563eb' : '#94a3b8'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                            </div>

                            {/* Tables Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Most Bought by Units */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 px-2">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                            <ShoppingCart className="w-5 h-5" />
                                        </div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Top 5 Mais Vendidos (Unidades)</h4>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                <tr>
                                                    <th className="px-6 py-4">Produto</th>
                                                    <th className="px-6 py-4 text-center">Última Compra</th>
                                                    <th className="px-6 py-4 text-right">Unidades</th>
                                                    <th className="px-6 py-4 text-right">Valor Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {scoreData.productsByUnits.map((p, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-6 py-6">
                                                            <p className="text-[11px] font-black text-slate-700 uppercase group-hover:text-emerald-600 transition-colors leading-normal max-w-[300px] break-words">{p.name}</p>
                                                        </td>
                                                        <td className="px-6 py-6 text-center text-[9px] font-bold text-slate-400 tabular-nums">
                                                            {new Date(p.lastPurchase + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                        </td>
                                                        <td className="px-6 py-6 text-right font-black text-emerald-600 tabular-nums">{p.units.toLocaleString('pt-BR')}</td>
                                                        <td className="px-6 py-6 text-right font-bold text-slate-400 tabular-nums text-[10px]">{formatCurrency(p.value)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pie Chart for Top 5 Items */}
                                    <div className="bg-slate-50 rounded-[40px] p-8 border border-slate-100 mt-8">
                                        <div className="flex items-center gap-3 mb-6">
                                            <PieChart className="w-5 h-5 text-emerald-600" />
                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Participação Top 5</h4>
                                        </div>
                                        <div className="h-[400px] w-full" style={{ minWidth: 0 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <RePieChart>
                                                    <Pie
                                                        data={scoreData.productsByUnits}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={60}
                                                        outerRadius={100}
                                                        paddingAngle={5}
                                                        dataKey="units"
                                                        nameKey="name"
                                                        label={({ name, percent }) => `${(name || '').substring(0, 20)}${(name || '').length > 20 ? '..' : ''} (${((percent || 0) * 100).toFixed(0)}%)`}
                                                        labelLine={{ stroke: '#64748b', strokeWidth: 1 }}
                                                    >
                                                        {scoreData.productsByUnits.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                const data = payload[0].payload;
                                                                return (
                                                                    <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">{data.name}</p>
                                                                        <p className="text-sm font-black text-slate-900">{data.units.toLocaleString('pt-BR')} Unidades</p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Legend 
                                                        verticalAlign="bottom" 
                                                        align="center"
                                                        content={({ payload }) => (
                                                            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-8 px-4">
                                                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                                                {(payload as any)?.map((entry: any, index: number) => (
                                                                    <div key={`item-${index}`} className="flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                                                        <span className="text-[9px] font-black text-slate-600 uppercase">{entry.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    />
                                                </RePieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>

                                {/* Categories Analysis (Now on the right and full height) */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <div className="flex items-center gap-3">
                                            <PieChart className="w-5 h-5 text-blue-600" />
                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Análise Detalhada por Categoria</h4>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {scoreData.categories.map((cat, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                                                <div className="flex justify-between items-center mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                                        <span className="text-[10px] font-black text-slate-800 uppercase">{cat.name}</span>
                                                    </div>
                                                    <span className="text-[10px] font-black text-blue-600">{cat.percent.toFixed(1)}%</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Faturamento</p>
                                                        <p className="text-xs font-black text-slate-900">{formatCurrency(cat.value)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[7px] font-black text-slate-400 uppercase">Unidades</p>
                                                        <p className="text-xs font-black text-slate-900">{cat.units.toLocaleString('pt-BR')} UN</p>
                                                    </div>
                                                </div>
                                                <div className="w-full h-1 bg-slate-100 rounded-full mt-3 overflow-hidden">
                                                    <div className="h-full" style={{ width: `${cat.percent}%`, backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer for PNG Capture */}
                            <div className="pt-12 border-t border-slate-100 flex justify-between items-center opacity-50">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Portal Centro-Norte • Inteligência de Vendas</p>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
                            </div>
                        </>
                    )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
