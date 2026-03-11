
import React, { useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, ShoppingBag, Users, Package, PieChart, BarChart3, Share2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart as RePieChart, Pie, Legend, LineChart, Line, LabelList } from 'recharts';
import html2canvas from 'html2canvas';
import { totalDataStore } from '../../lib/dataStore';

interface VisualAnalysisItem {
    label: string;
    level: number;
    faturamento: number;
    quantidade: number;
    participation?: number;
}

interface VisualAnalysisModalProps {
    onClose: () => void;
    totals: {
        faturamento: number;
        quantidade: number;
        skus: number;
        clients: number;
    };
    items: VisualAnalysisItem[];
    dimensions: string[];
    selectedYear: number;
    selectedMonths: number[];
    filters: {
        reps: string[];
        canais: string[];
        grupos: string[];
        clients: string[];
        products: string[];
    };
}

const COLORS = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#4f46e5', '#9333ea', '#c026d3', '#e11d48'];

export const VisualAnalysisModal: React.FC<VisualAnalysisModalProps> = ({ 
    onClose, totals, items, dimensions, selectedYear, selectedMonths, filters 
}) => {
    const contentRef = useRef<HTMLDivElement>(null);
    
    const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    const formatNumber = (v: number) => new Intl.NumberFormat('pt-BR').format(v);

    // 0. Active Filters Summary
    const activeFiltersSummary = useMemo(() => {
        const summary: string[] = [];
        
        if (filters.reps.length > 0) {
            const names = filters.reps.map(id => (totalDataStore.users as {id: string, nome: string}[])?.find(r => r.id === id)?.nome || id);
            summary.push(`Reps: ${names.join(', ')}`);
        }
        if (filters.canais.length > 0) {
            summary.push(`Canais: ${filters.canais.join(', ')}`);
        }
        if (filters.grupos.length > 0) {
            summary.push(`Grupos: ${filters.grupos.join(', ')}`);
        }
        if (filters.clients.length > 0) {
            const names = filters.clients.map(id => (totalDataStore.clients as {id: string, razao_social: string}[])?.find(c => c.id === id)?.razao_social || id);
            summary.push(`Clientes: ${names.length > 3 ? `${names.length} selecionados` : names.join(', ')}`);
        }
        if (filters.products.length > 0) {
            // Tenta encontrar o nome do produto nas vendas se não houver uma lista mestre
            const names = filters.products.map(id => {
                const sale = (totalDataStore.sales as {produto_id: string, produto_descricao: string}[])?.find(s => s.produto_id === id);
                return sale?.produto_descricao || id;
            });
            summary.push(`Produtos: ${names.length > 3 ? `${names.length} selecionados` : names.join(', ')}`);
        }
        
        if (selectedMonths.length > 0) {
            const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            summary.push(`Meses: ${selectedMonths.map(m => monthNames[m-1]).join(', ')}`);
        }

        return summary;
    }, [filters, selectedMonths]);

    // 1. Monthly Trend Data (Show full year for context)
    const monthlyTrend = useMemo(() => {
        const sales = totalDataStore.sales;
        const monthMap = new Map<number, number>();
        
        // Initialize all 12 months with 0
        for (let i = 1; i <= 12; i++) monthMap.set(i, 0);

        const allowedClientCnpjs = new Set<string>();
        if (filters.clients.length > 0) {
            totalDataStore.clients.forEach(c => {
                if (filters.clients.includes(c.id)) {
                    allowedClientCnpjs.add(String(c.cnpj || '').replace(/\D/g, ''));
                }
            });
        }

        sales.forEach(s => {
            const d = new Date(s.data + 'T00:00:00');
            const m = d.getUTCMonth() + 1;
            const y = d.getUTCFullYear();
            
            if (y === selectedYear) {
                // Apply other filters
                if (filters.reps.length > 0 && !filters.reps.includes(s.usuario_id)) return;
                if (filters.canais.length > 0 && (!s.canal_vendas || !filters.canais.includes(s.canal_vendas))) return;
                if (filters.grupos.length > 0 && (!s.grupo || !filters.grupos.includes(s.grupo))) return;
                if (filters.clients.length > 0) {
                    const saleCnpj = String(s.cnpj || '').replace(/\D/g, '');
                    if (!allowedClientCnpjs.has(saleCnpj)) return;
                }
                if (filters.products.length > 0) {
                    const pKey = s.codigo_produto || s.produto;
                    if (!filters.products.includes(pKey)) return;
                }

                monthMap.set(m, (monthMap.get(m) || 0) + (Number(s.faturamento) || 0));
            }
        });

        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return Array.from(monthMap.entries())
            .map(([m, val]) => ({ 
                name: monthNames[m-1], 
                value: val, 
                month: m,
                isSelected: selectedMonths.includes(m)
            }))
            .sort((a, b) => a.month - b.month);
    }, [selectedYear, selectedMonths, filters]);

    // 2. Dimension Charts (Vertical bars with labels)
    const dimensionCharts = useMemo(() => {
        return dimensions.map((dim, idx) => {
            const levelItems = items.filter(item => item.level === idx);
            const isRep = dim.toLowerCase().includes('representante');
            
            const sortedItems = levelItems.sort((a, b) => b.faturamento - a.faturamento);
            const displayItems = isRep ? sortedItems : sortedItems.slice(0, 10);

            const topItems = displayItems.map(item => ({
                name: item.label,
                value: item.faturamento,
                percent: (item.faturamento / totals.faturamento) * 100
            }));
            
            return {
                title: isRep ? `Performance de Representantes` : `Top 10 ${dim.charAt(0).toUpperCase() + dim.slice(1)}s`,
                data: topItems,
                dimension: dim
            };
        });
    }, [items, dimensions, totals.faturamento]);

    const handleShare = async () => {
        if (!contentRef.current) return;
        
        try {
            const canvas = await html2canvas(contentRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#f8fafc',
                windowWidth: contentRef.current.scrollWidth,
                windowHeight: contentRef.current.scrollHeight,
            });
            
            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            link.download = `analise-visual-${selectedYear}.png`;
            link.click();
        } catch (error) {
            console.error('Erro ao gerar imagem:', error);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl animate-fadeIn">
            <div className="bg-slate-50 w-full max-w-7xl h-[95vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col border border-white/20">
                
                {/* Header */}
                <div className="p-6 md:p-8 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-200">
                            <BarChart3 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Análise Visual Estratégica</h3>
                            <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-[0.2em]">Insights Gerados via Construtor de BI &bull; {selectedYear}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={handleShare}
                            className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
                        >
                            <Share2 className="w-4 h-4" />
                            Compartilhar PNG
                        </button>
                        <button onClick={onClose} className="p-3 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-2xl transition-all">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div ref={contentRef} className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar bg-slate-50">
                    
                    {/* Active Filters Display */}
                    {activeFiltersSummary.length > 0 && (
                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-wrap gap-3">
                            <div className="w-full mb-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtros Ativos</p>
                            </div>
                            {activeFiltersSummary.map((filter, i) => (
                                <span key={i} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-wider border border-slate-200">
                                    {filter}
                                </span>
                            ))}
                        </div>
                    )}
                    
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm group hover:border-blue-200 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                                    <TrendingUp className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">RECEITA</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturamento Total</p>
                            <h4 className="text-2xl font-black text-slate-900">{formatCurrency(totals.faturamento)}</h4>
                        </div>

                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm group hover:border-purple-200 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-all">
                                    <ShoppingBag className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-black text-purple-500 bg-purple-50 px-2 py-1 rounded-lg">VOLUME</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unidades Vendidas</p>
                            <h4 className="text-2xl font-black text-slate-900">{formatNumber(totals.quantidade)}</h4>
                        </div>

                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm group hover:border-pink-200 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-pink-50 text-pink-600 rounded-2xl group-hover:bg-pink-600 group-hover:text-white transition-all">
                                    <Users className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-black text-pink-500 bg-pink-50 px-2 py-1 rounded-lg">CLIENTES</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Clientes Atendidos</p>
                            <h4 className="text-2xl font-black text-slate-900">{formatNumber(totals.clients)}</h4>
                        </div>

                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm group hover:border-orange-200 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-orange-50 text-orange-600 rounded-2xl group-hover:bg-orange-600 group-hover:text-white transition-all">
                                    <Package className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">MIX</span>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SKUs Movimentados</p>
                            <h4 className="text-2xl font-black text-slate-900">{formatNumber(totals.skus)}</h4>
                        </div>
                    </div>

                    {/* Main Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* Monthly Trend */}
                        <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Tendência Mensal</h4>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evolução do Faturamento no Período</p>
                                </div>
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                    <TrendingUp className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={monthlyTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis 
                                            dataKey="name" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} 
                                            dy={10}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                            tickFormatter={(v) => `R$ ${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`}
                                        />
                                        <Tooltip 
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{payload[0].payload.name}</p>
                                                            <p className="text-lg font-black">{formatCurrency(Number(payload[0].value))}</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="value" 
                                            stroke="#2563eb" 
                                            strokeWidth={4} 
                                            dot={(props: { cx: number, cy: number, payload: { isSelected: boolean, month: number } }) => {
                                                const { cx, cy, payload } = props;
                                                if (payload.isSelected) {
                                                    return <circle key={`dot-${payload.month}`} cx={cx} cy={cy} r={6} fill="#2563eb" stroke="#fff" strokeWidth={3} />;
                                                }
                                                return <circle key={`dot-${payload.month}`} cx={cx} cy={cy} r={4} fill="#cbd5e1" stroke="#fff" strokeWidth={2} />;
                                            }}
                                            activeDot={{ r: 8, strokeWidth: 0 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* First Dimension Participation */}
                        {dimensionCharts.length > 0 && (
                            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Participação de Mercado</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Distribuição por {dimensionCharts[0].dimension}s</p>
                                    </div>
                                    <div className="p-3 bg-pink-50 text-pink-600 rounded-2xl">
                                        <PieChart className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="h-[300px] w-full flex items-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RePieChart>
                                            <Pie
                                                data={dimensionCharts[0].data}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {dimensionCharts[0].data.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                        <Tooltip 
                                            formatter={(v: number) => formatCurrency(v)}
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                                        />
                                            <Legend 
                                                layout="vertical" 
                                                align="right" 
                                                verticalAlign="middle"
                                                formatter={(value: string, entry: unknown) => {
                                                    const payload = (entry as { payload: { percent: number } }).payload;
                                                    return (
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                                                            {value} ({payload.percent.toFixed(1)}%)
                                                        </span>
                                                    );
                                                }}
                                            />
                                        </RePieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Dynamic Dimension Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {dimensionCharts.map((chart, idx) => (
                            <div key={idx} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{chart.title}</h4>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ranking por Faturamento</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl">
                                        <BarChart3 className="w-5 h-5" />
                                    </div>
                                </div>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chart.data} margin={{ top: 30, right: 30, left: 20, bottom: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                            <XAxis 
                                                dataKey="name" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fontSize: 8, fontWeight: 800, fill: '#64748b' }}
                                                interval={0}
                                                angle={-45}
                                                textAnchor="end"
                                                height={60}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                                                tickFormatter={(v) => `R$ ${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`}
                                            />
                                            <Tooltip 
                                                cursor={{ fill: '#f8fafc' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        return (
                                                            <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-white/10">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{payload[0].payload.name}</p>
                                                                <p className="text-lg font-black">{formatCurrency(Number(payload[0].value))}</p>
                                                                <p className="text-[10px] font-bold text-blue-400 uppercase">{payload[0].payload.percent.toFixed(1)}% de Participação</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={30}>
                                                {chart.data.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[idx % COLORS.length]} opacity={1 - (index * 0.05)} />
                                                ))}
                                                <LabelList 
                                                    dataKey="percent" 
                                                    position="top" 
                                                    formatter={(v: number) => `${v.toFixed(1)}%`}
                                                    style={{ fontSize: '9px', fontWeight: '900', fill: '#64748b' }}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer Branding */}
                    <div className="pt-10 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xs">CN</div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Portal Centro-Norte &bull; Business Intelligence</p>
                        </div>
                        <p className="text-[9px] font-bold text-slate-300 uppercase">Relatório gerado em {new Date().toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
