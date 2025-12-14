import React, { useState } from 'react';
import { Target, TrendingUp, Users, AlertCircle, Calendar, LineChart as LineChartIcon, BarChart3 } from 'lucide-react';
import { NonPositivizedModal } from './NonPositivizedModal';

export const Dashboard: React.FC = () => {
  const [showNonPositivizedModal, setShowNonPositivizedModal] = useState(false);

  // Dados Fictícios (Mock)
  const data = {
    meta: 120000.00,
    faturado: 86450.00,
    clientesPositivados: 42,
    clientesNaoPositivados: 18,
    totalClientes: 60
  };

  // Metas Totais por Trimestre (Exemplo)
  const quarterTargets = {
      1: 250000, // Q1
      2: 300000, // Q2
      3: 350000, // Q3
      4: 400000  // Q4
  };

  // Dados consolidados Mensais
  const fullYearData = [
    { month: 'Jan', realized: 85000, target: 80000, projected: 85000 },
    { month: 'Fev', realized: 92000, target: 80000, projected: 92000 },
    { month: 'Mar', realized: 88000, target: 80000, projected: 88000 },
    { month: 'Abr', realized: 95000, target: 90000, projected: 95000 },
    { month: 'Mai', realized: 110000, target: 90000, projected: 110000 },
    { month: 'Jun', realized: 86450, target: 90000, projected: 120000 }, // Mês atual
    { month: 'Jul', realized: 0, target: 100000, projected: 125000 },
    { month: 'Ago', realized: 0, target: 100000, projected: 125000 },
    { month: 'Set', realized: 0, target: 100000, projected: 130000 },
    { month: 'Out', realized: 0, target: 110000, projected: 135000 },
    { month: 'Nov', realized: 0, target: 110000, projected: 140000 },
    { month: 'Dez', realized: 0, target: 110000, projected: 150000 },
  ];

  // Prepara dados para o Gráfico Trimestral (Acumulativo)
  let currentQSum = 0;
  const quarterlyChartData = fullYearData.map((d, i) => {
      // Reseta a soma a cada inicio de trimestre (Jan=0, Abr=3, Jul=6, Out=9)
      if (i % 3 === 0) currentQSum = 0;
      currentQSum += d.realized;
      
      const quarterNum = Math.floor(i / 3) + 1;
      // @ts-ignore
      const qTarget = quarterTargets[quarterNum];

      return {
          ...d,
          cumulative: currentQSum,
          quarterTargetTotal: qTarget,
          quarter: quarterNum
      };
  });

  // Cálculos de Escala
  const maxValAnnual = Math.max(...fullYearData.map(d => Math.max(d.realized, d.target, d.projected))) * 1.1;
  const maxValQuarterly = 450000; // Fixo um pouco acima da maior meta trimestral para visualização

  // Cálculos KPIs
  const percentualAtingido = (data.faturado / data.meta) * 100;
  const percentualClientes = (data.clientesPositivados / data.totalClientes) * 100;
  const currentDate = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Helpers de Formatação
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatCompact = (value: number) => new Intl.NumberFormat('pt-BR', { notation: "compact", compactDisplay: "short" }).format(value);

  // --- COMPONENTES DE GRÁFICO ---

  // 1. Gráfico de Linha (Anual)
  const AnnualLineChart = ({ 
    data, 
    width = 1000, 
    height = 300, 
    maxValue
  }: { data: any[], width?: number, height?: number, maxValue: number }) => {
    const paddingX = 40;
    const paddingY = 40;
    const chartWidth = width - (paddingX * 2);
    const chartHeight = height - (paddingY * 2);
    const stepX = chartWidth / (data.length - 1);

    const getCoord = (index: number, value: number) => {
      const x = paddingX + (index * stepX);
      const y = height - paddingY - ((value / maxValue) * chartHeight);
      return { x, y };
    };

    const createPath = (key: string) => {
      return data.map((item, i) => {
        if (key === 'realized' && item[key] === 0 && i > 5) return null;
        const { x, y } = getCoord(i, item[key] || 0);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      }).filter(Boolean).join(' ');
    };

    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    // Definição das linhas conforme pedido
    const lines = [
        { key: 'target', color: '#ef4444', dashed: false, label: 'Meta', width: 2 }, // Vermelho Sólido
        { key: 'projected', color: '#eab308', dashed: true, label: 'Projeção', width: 2 }, // Amarelo Pontilhado
        { key: 'realized', color: '#22c55e', dashed: true, label: 'Realizado', width: 3 } // Verde Pontilhado
    ];

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
        {/* Grid Lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = height - paddingY - (pct * chartHeight);
          return (
            <g key={i}>
              <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={paddingX - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400">
                {formatCompact(maxValue * pct)}
              </text>
            </g>
          );
        })}

        {/* Lines */}
        {lines.map((line, idx) => (
          <g key={idx}>
            <path
              d={createPath(line.key)}
              fill="none"
              stroke={line.color}
              strokeWidth={line.width}
              strokeDasharray={line.dashed ? "6 4" : "0"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dots */}
            {data.map((item, i) => {
               if (line.key === 'realized' && item[line.key] === 0 && i > 5) return null;
               const { x, y } = getCoord(i, item[line.key] || 0);
               return (
                 <circle 
                   key={i} 
                   cx={x} 
                   cy={y} 
                   r="4" 
                   fill="white" 
                   stroke={line.color} 
                   strokeWidth="2"
                   className="transition-all hover:r-6 cursor-pointer"
                   onMouseEnter={() => setHoverIndex(i)}
                   onMouseLeave={() => setHoverIndex(null)}
                 />
               );
            })}
          </g>
        ))}

        {/* X Axis Labels */}
        {data.map((item, i) => {
           const { x } = getCoord(i, 0);
           return (
             <text key={i} x={x} y={height - 10} textAnchor="middle" className="text-[10px] sm:text-xs fill-slate-500 font-medium">
               {item.month}
             </text>
           );
        })}

        {/* Tooltip */}
        {hoverIndex !== null && (
          <g transform={`translate(${getCoord(hoverIndex, 0).x}, 0)`}>
             <line x1="0" y1={paddingY} x2="0" y2={height - paddingY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
             <rect x="-70" y="10" width="140" height={80} rx="4" fill="#1e293b" fillOpacity="0.95" />
             <text x="0" y="30" textAnchor="middle" className="text-[10px] fill-slate-300 font-bold uppercase">{data[hoverIndex].month}</text>
             {lines.map((line, i) => {
                const val = data[hoverIndex][line.key];
                if (val === 0 && line.key === 'realized' && hoverIndex > 5) return null;
                return (
                  <text key={i} x="0" y={48 + (i * 15)} textAnchor="middle" className="text-xs fill-white font-medium" style={{ fill: line.color }}>
                    {line.label}: {formatCompact(val)}
                  </text>
                )
             })}
          </g>
        )}
      </svg>
    );
  };

  // 2. Gráfico de Barras Trimestral (Acumulativo)
  const QuarterlyBarChart = ({ 
    data, 
    width = 1000, 
    height = 300, 
    maxValue
  }: { data: any[], width?: number, height?: number, maxValue: number }) => {
    const paddingX = 40;
    const paddingY = 40;
    const chartWidth = width - (paddingX * 2);
    const chartHeight = height - (paddingY * 2);
    const barWidth = (chartWidth / data.length) * 0.6;
    const stepX = chartWidth / data.length;

    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const getY = (val: number) => height - paddingY - ((val / maxValue) * chartHeight);

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const y = height - paddingY - (pct * chartHeight);
            return (
                <g key={i}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                <text x={paddingX - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400">
                    {formatCompact(maxValue * pct)}
                </text>
                </g>
            );
            })}

            {/* Target Lines (Quarter Plateaus) & Bars */}
            {data.map((item, i) => {
                const x = paddingX + (i * stepX) + (stepX - barWidth) / 2;
                const yBar = getY(item.cumulative);
                const barHeight = height - paddingY - yBar;
                
                // Target Line Logic
                const yTarget = getY(item.quarterTargetTotal);
                const xLineStart = paddingX + (Math.floor(i / 3) * 3 * stepX);
                const xLineEnd = xLineStart + (3 * stepX);

                // Is start of quarter? Draw target line background reference
                const isStartOfQuarter = i % 3 === 0;

                return (
                    <g key={i}>
                        {/* Quarter Separators/Backgrounds */}
                        {isStartOfQuarter && (
                            <>
                                {/* Quarter Label */}
                                <text x={xLineStart + (1.5 * stepX)} y={paddingY - 10} textAnchor="middle" className="text-xs font-bold fill-slate-300">
                                    {item.quarter}º TRIM
                                </text>
                                {/* Target Line */}
                                <line 
                                    x1={xLineStart} y1={yTarget} 
                                    x2={xLineEnd} y2={yTarget} 
                                    stroke="#c084fc" strokeWidth="2" strokeDasharray="5 3" 
                                />
                            </>
                        )}

                        {/* Bar (Cumulative) */}
                        {item.realized > 0 && ( // Só desenha barra se houve venda
                            <rect
                                x={x}
                                y={yBar}
                                width={barWidth}
                                height={barHeight}
                                rx="4"
                                fill={item.cumulative >= item.quarterTargetTotal ? "#10b981" : "#8b5cf6"} // Verde se bateu, Roxo se não
                                className="transition-all hover:opacity-80 cursor-pointer"
                                onMouseEnter={() => setHoverIndex(i)}
                                onMouseLeave={() => setHoverIndex(null)}
                            />
                        )}

                        {/* X Axis Label */}
                        <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" className="text-[10px] sm:text-xs fill-slate-500 font-medium">
                            {item.month}
                        </text>
                    </g>
                );
            })}

            {/* Tooltip */}
            {hoverIndex !== null && (
                <g transform={`translate(${paddingX + (hoverIndex * stepX) + stepX/2}, 0)`}>
                    <rect x="-60" y="20" width="120" height="70" rx="4" fill="#1e293b" fillOpacity="0.95" />
                    <text x="0" y="40" textAnchor="middle" className="text-[10px] fill-slate-300 font-bold uppercase">
                        {data[hoverIndex].month} (Acumulado)
                    </text>
                    <text x="0" y="58" textAnchor="middle" className="text-xs fill-white font-bold">
                       Atual: {formatCompact(data[hoverIndex].cumulative)}
                    </text>
                    <text x="0" y="75" textAnchor="middle" className="text-[10px] fill-purple-300">
                       Meta Trim: {formatCompact(data[hoverIndex].quarterTargetTotal)}
                    </text>
                </g>
            )}

        </svg>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20 md:pb-0">
      
      {/* Header da Página */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Visão Geral</h2>
          <p className="text-slate-500 flex items-center gap-2 text-sm mt-1 capitalize">
            <Calendar className="w-4 h-4" />
            {currentDate}
          </p>
        </div>
        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium border border-blue-100 w-full md:w-auto text-center md:text-left">
           Região: Norte/Capital
        </div>
      </div>

      {/* Card Principal - Desempenho de Vendas */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 blur-3xl opacity-50"></div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 relative z-10 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-slate-500 text-sm font-medium">Meta do Mês</h3>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(data.meta)}</p>
            </div>
          </div>
          <div className="text-left sm:text-right w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end">
             <span className="text-sm font-medium text-slate-500 sm:hidden">Atingimento:</span>
             <div>
                <span className={`text-2xl font-bold ${percentualAtingido >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                {percentualAtingido.toFixed(1)}%
                </span>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide hidden sm:block">Atingido</p>
             </div>
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

        {/* Card Clientes Não Positivados (Clicável) */}
        <div 
          onClick={() => setShowNonPositivizedModal(true)}
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex items-center justify-between group hover:border-amber-200 transition-colors cursor-pointer"
        >
          <div>
            <p className="text-slate-500 text-sm font-medium mb-1">Não Positivados</p>
            <h4 className="text-3xl font-bold text-slate-900">{data.clientesNaoPositivados}</h4>
             <div className="mt-2 flex items-center text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded w-fit">
              <AlertCircle className="w-3 h-3 mr-1" />
              Ver lista pendente
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Seção de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico de Projeção Anual */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
               <LineChartIcon className="w-5 h-5 text-blue-600" />
               <h3 className="font-bold text-slate-800">Projeção Anual</h3>
            </div>
            {/* Legenda Customizada Anual */}
            <div className="flex flex-wrap gap-2 text-[10px] justify-end">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-1 bg-red-500 rounded-full"></div>
                    <span className="text-slate-500">Meta</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-1 border-t-2 border-green-500 border-dashed"></div>
                    <span className="text-slate-500">Realizado</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-1 border-t-2 border-yellow-500 border-dashed"></div>
                    <span className="text-slate-500">Projeção</span>
                </div>
            </div>
          </div>
          
          <div className="flex-1 w-full">
            <AnnualLineChart 
              data={fullYearData} 
              maxValue={maxValAnnual}
            />
          </div>
        </div>

        {/* Gráfico de Fechamento Trimestral */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col h-[400px]">
           <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
               <BarChart3 className="w-5 h-5 text-purple-600" />
               <h3 className="font-bold text-slate-800">Fechamento Trimestral</h3>
            </div>
             <div className="flex flex-wrap gap-2 text-[10px] justify-end">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-purple-500 rounded-sm"></div>
                    <span className="text-slate-500">Acumulado</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-1 border-t-2 border-purple-400 border-dashed"></div>
                    <span className="text-slate-500">Meta Trimestre</span>
                </div>
            </div>
          </div>

          <div className="flex-1 w-full">
             <QuarterlyBarChart 
              data={quarterlyChartData} 
              maxValue={maxValQuarterly}
            />
          </div>
        </div>

      </div>

      {showNonPositivizedModal && (
        <NonPositivizedModal onClose={() => setShowNonPositivizedModal(false)} />
      )}

    </div>
  );
};