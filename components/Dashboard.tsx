
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Target, TrendingUp, Users, AlertCircle, Calendar, DollarSign, RefreshCw, CheckCircle2, Award, ChevronDown, CheckSquare, Square, RotateCcw, Filter, CalendarDays, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { NonPositivizedModal } from './NonPositivizedModal';
import { PositivizedModal } from './PositivizedModal';
import { RepPerformanceModal } from './manager/RepPerformanceModal';
import { supabase } from '../lib/supabase';
import { totalDataStore } from '../lib/dataStore';

export const Dashboard: React.FC = () => {
  const now = new Date();
  const [showNonPositivizedModal, setShowNonPositivizedModal] = useState(false);
  const [showPositivizedModal, setShowPositivizedModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
  const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;
  const userName = session.name;

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const availableYears = [2024, 2025, 2026, 2027];

  const cleanCnpj = (val: string) => String(val || '').replace(/\D/g, '');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setShowMonthDropdown(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const data = useMemo(() => {
    const sales = totalDataStore.sales;
    const targets = totalDataStore.targets;
    const clients = totalDataStore.clients;

    const totalMeta = targets
      .filter(t => t.usuario_id === userId && selectedMonths.includes(t.mes) && t.ano === selectedYear)
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

    const filteredSales = sales.filter(s => {
      const d = new Date(s.data + 'T00:00:00');
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      return s.usuario_id === userId && selectedMonths.includes(m) && y === selectedYear;
    });

    const totalFaturado = filteredSales.reduce((acc, curr) => acc + (Number(curr.faturamento) || 0), 0);
    const salesCnpjs = new Set(filteredSales.map(s => cleanCnpj(s.cnpj)));
    const positivadosCount = clients.filter(c => salesCnpjs.has(cleanCnpj(c.cnpj))).length;

    // Cálculo Crescimento vs Ano Anterior (Mesmo Período)
    const prevYearSales = sales.filter(s => {
        const d = new Date(s.data + 'T00:00:00');
        const m = d.getUTCMonth() + 1;
        const y = d.getUTCFullYear();
        return s.usuario_id === userId && selectedMonths.includes(m) && y === (selectedYear - 1);
    });
    const totalPrevFaturado = prevYearSales.reduce((acc, curr) => acc + (Number(curr.faturamento) || 0), 0);
    const growthPercent = totalPrevFaturado > 0 ? ((totalFaturado / totalPrevFaturado) - 1) * 100 : 0;

    return {
      meta: totalMeta,
      faturado: totalFaturado,
      clientesPositivados: positivadosCount,
      totalClientes: clients.length,
      growthPercent,
      hasPrevData: totalPrevFaturado > 0
    };
  }, [selectedMonths, selectedYear, userId]);

  const percentualAtingido = data.meta > 0 ? (data.faturado / data.meta) * 100 : 0;
  const percentualClientes = data.totalClientes > 0 ? (data.clientesPositivados / data.totalClientes) * 100 : 0;

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  const toggleTempMonth = (m: number) => {
    setTempSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const handleApplyFilter = () => {
    setSelectedMonths([...tempSelectedMonths]);
    setShowMonthDropdown(false);
  };

  const getMonthsLabel = () => {
    if (selectedMonths.length === 0) return "Selecione";
    if (selectedMonths.length === 1) return monthNames[selectedMonths[0] - 1].toUpperCase();
    if (selectedMonths.length === 12) return "ANO COMPLETO";
    return `${selectedMonths.length} MESES`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20 md:pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Análise Comercial</h2>
          <p className="text-slate-500 flex items-center gap-2 text-xs mt-2 capitalize font-bold text-left">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            Período: {selectedMonths.sort((a,b) => a-b).map(m => monthShort[m-1]).join(', ')} de {selectedYear}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <CalendarDays className="w-3.5 h-3.5" />
            </div>
            <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer transition-all"
            >
                {availableYears.map(y => (
                    <option key={y} value={y}>ANO {y}</option>
                ))}
            </select>
          </div>

          <div className="relative" ref={dropdownRef}>
                <button 
                    onClick={() => {
                        setTempSelectedMonths([...selectedMonths]);
                        setShowMonthDropdown(!showMonthDropdown);
                    }}
                    className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase flex items-center gap-3 shadow-sm hover:bg-slate-50 min-w-[150px] justify-between transition-all"
                >
                    <span>{getMonthsLabel()}</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showMonthDropdown && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
                            <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[9px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all">Todos</button>
                            <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[9px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-all">Limpar</button>
                        </div>
                        <div className="p-2 grid grid-cols-1 gap-0.5 max-h-64 overflow-y-auto">
                            {monthNames.map((m, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => toggleTempMonth(i + 1)}
                                    className={`flex items-center gap-3 p-2.5 rounded-xl text-[10px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                                    {m}
                                </button>
                            ))}
                        </div>
                        <div className="p-3 border-t border-slate-100 bg-slate-50">
                            <button 
                                onClick={handleApplyFilter}
                                className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                <Filter className="w-3 h-3" /> Aplicar Filtro
                            </button>
                        </div>
                    </div>
                )}
          </div>

          <button 
            onClick={() => setShowPerformanceModal(true)} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 text-[10px] font-black uppercase text-white bg-blue-600 px-6 py-3 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 border border-blue-500"
          >
            <Award className="w-4 h-4" /> Análise Comercial
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 shadow-sm border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none hidden md:block">
           <TrendingUp className="w-40 h-40 text-blue-600" />
        </div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 md:mb-10 gap-6">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="p-3 md:p-4 bg-blue-600 text-white rounded-2xl md:rounded-3xl shadow-xl shadow-blue-100 shrink-0">
              <Target className="w-6 h-6 md:w-8 md:w-8" />
            </div>
            <div>
              <h3 className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em]">Objetivo do Período</h3>
              <p className="text-2xl md:text-4xl font-black text-slate-900 leading-none mt-1 md:mt-2">{formatCurrency(data.meta)}</p>
              
              {data.hasPrevData && (
                  <div className={`mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${data.growthPercent >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                    {data.growthPercent >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(data.growthPercent).toFixed(1)}% vs Ano Ant.
                  </div>
              )}
            </div>
          </div>
          <div className="w-full md:w-auto text-center md:text-right bg-slate-50 px-6 py-4 md:px-8 md:py-4 rounded-2xl md:rounded-3xl border border-slate-100">
            <span className={`text-3xl md:text-4xl font-black tabular-nums ${percentualAtingido >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
              {percentualAtingido.toFixed(1)}%
            </span>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Atingimento Geral</p>
          </div>
        </div>
        <div className="relative pt-2">
          <div className="flex justify-between mb-3 text-sm items-end">
            <span className="font-black text-slate-400 uppercase text-[9px] md:text-[10px] tracking-widest flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-blue-500" /> Faturamento Real Consolidado
            </span>
            <span className="font-black text-slate-900 text-lg md:text-xl">{formatCurrency(data.faturado)}</span>
          </div>
          <div className="h-3 md:h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
            <div className={`h-full rounded-full transition-all duration-1000 ease-out ${percentualAtingido >= 100 ? 'bg-blue-600' : 'bg-red-600'}`} style={{ width: `${Math.min(percentualAtingido, 100)}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div onClick={() => setShowPositivizedModal(true)} className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 shadow-sm border border-slate-200 flex items-center justify-between group cursor-pointer hover:border-blue-400 transition-all active:scale-95">
          <div className="min-w-0 flex-1">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 md:mb-2">Positivados</p>
            <div className="flex items-baseline gap-2">
              <h4 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">{data.clientesPositivados}</h4>
              <span className="text-slate-400 font-bold text-base md:text-lg">/ {data.totalClientes}</span>
            </div>
            <div className="mt-4 md:mt-5 inline-flex items-center text-[9px] md:text-[10px] font-black text-blue-700 bg-blue-50 px-3 py-2 md:px-4 rounded-xl border border-blue-100 uppercase tracking-widest">
              <CheckCircle2 className="w-3.5 h-3.5 mr-2 shrink-0" /> {percentualClientes.toFixed(1)}% da Carteira
            </div>
          </div>
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner shrink-0 ml-4">
            <Users className="w-8 h-8 md:w-10 md:h-10" />
          </div>
        </div>

        <div onClick={() => setShowNonPositivizedModal(true)} className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 shadow-sm border border-slate-200 flex items-center justify-between group cursor-pointer hover:border-amber-400 transition-all active:scale-95">
          <div className="min-w-0 flex-1">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 md:mb-2">Pendentes</p>
            <h4 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">{data.totalClientes - data.clientesPositivados}</h4>
             <div className="mt-4 md:mt-5 inline-flex items-center text-[9px] md:text-[10px] font-black text-amber-700 bg-amber-50 px-3 py-2 md:px-4 rounded-xl border border-amber-100 uppercase tracking-widest">
              <AlertCircle className="w-3.5 h-3.5 mr-2 shrink-0" /> Detalhar Lista
            </div>
          </div>
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-inner shrink-0 ml-4">
            <Users className="w-8 h-8 md:w-10 md:h-10" />
          </div>
        </div>
      </div>

      {showNonPositivizedModal && <NonPositivizedModal onClose={() => setShowNonPositivizedModal(false)} selectedMonths={selectedMonths} selectedYear={selectedYear} />}
      {showPositivizedModal && <PositivizedModal onClose={() => setShowPositivizedModal(false)} selectedMonths={selectedMonths} selectedYear={selectedYear} />}
      {showPerformanceModal && (
        <RepPerformanceModal 
          rep={{ id: userId, nome: userName }} 
          year={selectedYear} 
          onClose={() => setShowPerformanceModal(false)} 
        />
      )}
    </div>
  );
};
