
import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Users, AlertCircle, Calendar, DollarSign, RefreshCw, CheckCircle2, Award } from 'lucide-react';
import { NonPositivizedModal } from './NonPositivizedModal';
import { PositivizedModal } from './PositivizedModal';
import { RepPerformanceModal } from './manager/RepPerformanceModal';
import { supabase } from '../lib/supabase';

export const Dashboard: React.FC = () => {
  const [showNonPositivizedModal, setShowNonPositivizedModal] = useState(false);
  const [showPositivizedModal, setShowPositivizedModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState({
    meta: 0,
    faturado: 0,
    clientesPositivados: 0,
    totalClientes: 0
  });

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;
  const userName = session.name;

  const cleanCnpj = (val: string) => String(val || '').replace(/\D/g, '');

  useEffect(() => {
    if (userId) {
      fetchDashboardData();
    }
  }, [userId]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const firstDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

    try {
      const { data: metaData } = await supabase.from('metas_usuarios').select('valor').eq('usuario_id', userId).eq('mes', currentMonth).eq('ano', currentYear).maybeSingle();
      
      const { data: salesData } = await supabase
        .from('dados_vendas')
        .select('faturamento, cnpj')
        .eq('usuario_id', userId)
        .gte('data', firstDayStr)
        .limit(1000000);

      const { data: allClients, count: totalClientsCount } = await supabase.from('clientes').select('cnpj', { count: 'exact' }).eq('usuario_id', userId);

      const salesCnpjsCleaned = new Set(salesData?.map(s => cleanCnpj(s.cnpj)).filter(c => c !== ''));
      const totalFaturado = salesData?.reduce((acc, curr) => acc + (Number(curr.faturamento) || 0), 0) || 0;
      let positivadosCount = 0;
      allClients?.forEach(client => { if (salesCnpjsCleaned.has(cleanCnpj(client.cnpj))) positivadosCount++; });

      setData({
        meta: metaData?.valor || 0,
        faturado: totalFaturado,
        clientesPositivados: positivadosCount,
        totalClientes: totalClientsCount || 0
      });
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const percentualAtingido = data.meta > 0 ? (data.faturado / data.meta) * 100 : 0;
  const percentualClientes = data.totalClientes > 0 ? (data.clientesPositivados / data.totalClientes) * 100 : 0;

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-400">
        <RefreshCw className="w-10 h-10 animate-spin mb-4 text-blue-600" />
        <span className="font-black uppercase text-[10px] tracking-widest animate-pulse">Sincronizando faturamento...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20 md:pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Painel de Performance</h2>
          <p className="text-slate-500 flex items-center gap-2 text-xs mt-1 capitalize font-bold">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowPerformanceModal(true)} 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 text-[10px] font-black uppercase text-white bg-blue-600 px-6 py-3 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 border border-blue-500"
          >
            <Award className="w-4 h-4" /> Desempenho
          </button>
          <button 
            onClick={fetchDashboardData} 
            className="p-3 md:px-5 md:py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-slate-600 bg-white rounded-2xl hover:bg-slate-50 transition-all border border-slate-200 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
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
              <h3 className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em]">Objetivo Mensal</h3>
              <p className="text-2xl md:text-4xl font-black text-slate-900 leading-none mt-1 md:mt-2">{formatCurrency(data.meta)}</p>
            </div>
          </div>
          <div className="w-full md:w-auto text-center md:text-right bg-slate-50 px-6 py-4 md:px-8 md:py-4 rounded-2xl md:rounded-3xl border border-slate-100">
            <span className={`text-3xl md:text-4xl font-black tabular-nums ${percentualAtingido >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
              {percentualAtingido.toFixed(1)}%
            </span>
            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-1">Atingimento</p>
          </div>
        </div>
        <div className="relative pt-2">
          <div className="flex justify-between mb-3 text-sm items-end">
            <span className="font-black text-slate-400 uppercase text-[9px] md:text-[10px] tracking-widest flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Faturamento Real
            </span>
            <span className="font-black text-slate-900 text-lg md:text-xl">{formatCurrency(data.faturado)}</span>
          </div>
          <div className="h-3 md:h-4 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
            <div className={`h-full rounded-full transition-all duration-1000 ease-out ${percentualAtingido >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(percentualAtingido, 100)}%` }}></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div onClick={() => setShowPositivizedModal(true)} className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 shadow-sm border border-slate-200 flex items-center justify-between group cursor-pointer hover:border-emerald-400 transition-all active:scale-95">
          <div className="min-w-0 flex-1">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 md:mb-2">Positivados</p>
            <div className="flex items-baseline gap-2">
              <h4 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">{data.clientesPositivados}</h4>
              <span className="text-slate-400 font-bold text-base md:text-lg">/ {data.totalClientes}</span>
            </div>
            <div className="mt-4 md:mt-5 inline-flex items-center text-[9px] md:text-[10px] font-black text-emerald-700 bg-emerald-50 px-3 py-2 md:px-4 rounded-xl border border-emerald-100 uppercase tracking-widest">
              <CheckCircle2 className="w-3.5 h-3.5 mr-2 shrink-0" /> {percentualClientes.toFixed(1)}% da Carteira
            </div>
          </div>
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-inner shrink-0 ml-4">
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

      {showNonPositivizedModal && <NonPositivizedModal onClose={() => setShowNonPositivizedModal(false)} />}
      {showPositivizedModal && <PositivizedModal onClose={() => setShowPositivizedModal(false)} />}
      {showPerformanceModal && (
        <RepPerformanceModal 
          rep={{ id: userId, nome: userName }} 
          year={new Date().getFullYear()} 
          onClose={() => setShowPerformanceModal(false)} 
        />
      )}
    </div>
  );
};
