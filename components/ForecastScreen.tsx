import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Lock, ChevronRight, Loader2, DollarSign, Building2, BarChart3, Info, AlertTriangle, MousePointer2, Plus, History, Clock, RefreshCw, Trash2, Send, AlertCircle, X, CheckCircle2, MessageSquareText } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../lib/supabase';
import { totalDataStore } from '../lib/dataStore';
import { createPortal } from 'react-dom';

type TabType = 'seasonality' | 'weekly';

interface DraftItem {
  description: string;
  value: number;
}

export const ForecastScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('seasonality');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedYear] = useState(new Date().getFullYear());

  const [originalTargets, setOriginalTargets] = useState<any[]>([]);
  const [adjustedTargets, setAdjustedTargets] = useState<Record<number, number>>({});
  const [confirmedMonths, setConfirmedMonths] = useState<Set<number>>(new Set());
  const [isCotaConfirmed, setIsCotaConfirmed] = useState(false);

  // Estados Envio de Previsão
  const [weeklyForecasts, setWeeklyForecasts] = useState<any[]>([]);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [weeklyDescription, setWeeklyDescription] = useState('');
  const [weeklyValueStr, setWeeklyValueStr] = useState('');
  
  // Controle de Confirmação de Exclusão
  const [confirmDeleteReport, setConfirmDeleteReport] = useState<any | null>(null);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;
  const userName = session.name;

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  useEffect(() => {
    if (userId) {
        fetchData();
        fetchWeeklyData();
    }
  }, [userId, selectedYear]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: targets } = await supabase
        .from('metas_usuarios')
        .select('*')
        .eq('usuario_id', userId)
        .eq('ano', selectedYear);
      
      setOriginalTargets(targets || []);
      
      const { data: existingForecast } = await supabase
        .from('previsoes')
        .select('id, observacao')
        .eq('usuario_id', userId)
        .eq('data', `${selectedYear}-01-01`)
        .not('observacao', 'ilike', '%WEEKLY_CHECKIN%')
        .maybeSingle();

      if (existingForecast) {
          setIsCotaConfirmed(true);
          setConfirmedMonths(new Set([1,2,3,4,5,6,7,8,9,10,11,12]));
      }

      const initialAdjusted: Record<number, number> = {};
      targets?.forEach(t => { initialAdjusted[t.mes] = Number(t.valor); });
      setAdjustedTargets(initialAdjusted);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchWeeklyData = async () => {
    try {
      const { data } = await supabase
        .from('previsoes')
        .select(`
          id, 
          data, 
          previsao_total, 
          status, 
          observacao,
          criado_em
        `)
        .eq('usuario_id', userId)
        .ilike('observacao', '%WEEKLY_CHECKIN%')
        .order('criado_em', { ascending: false });
      
      setWeeklyForecasts(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleValueMask = (val: string) => {
    const clean = val.replace(/\D/g, '');
    const num = Number(clean) / 100;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  };

  const parseToNumber = (formatted: string) => {
    if (!formatted) return 0;
    return Number(formatted.replace(/\./g, '').replace(',', '.'));
  };

  const addToDraft = () => {
    if (!weeklyDescription || !weeklyValueStr) return;
    const val = parseToNumber(weeklyValueStr);

    if (val <= 0) {
      alert('Informe um valor válido.');
      return;
    }

    setDraftItems(prev => [...prev, { description: weeklyDescription, value: val }]);
    setWeeklyDescription('');
    setWeeklyValueStr('');
  };

  const removeFromDraft = (index: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleUnderstoodAndReset = async () => {
    if (!confirmDeleteReport) return;
    
    setIsSaving(true);
    try {
        const { error } = await supabase.from('previsoes').delete().eq('id', confirmDeleteReport.id);
        if (error) throw error;

        await fetchWeeklyData();
        setConfirmDeleteReport(null);
        alert('Lançamento reiniciado com sucesso.');
    } catch (err: any) {
        alert('Erro ao resetar: ' + err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleSendBatch = async () => {
    if (draftItems.length === 0) return;
    
    setIsSaving(true);
    try {
      const totalBatch = draftItems.reduce((acc, curr) => acc + curr.value, 0);
      const combinedDesc = draftItems.map(i => i.description).join('; ');

      const { error: headerError } = await supabase
        .from('previsoes')
        .insert({
          usuario_id: userId,
          data: new Date().toISOString().split('T')[0],
          previsao_total: totalBatch,
          status: 'pending',
          observacao: `WEEKLY_CHECKIN: ${combinedDesc}`
        });

      if (headerError) throw headerError;

      setDraftItems([]);
      await fetchWeeklyData();
      alert('Previsão enviada com sucesso!');
    } catch (e: any) {
      alert('Erro ao enviar: ' + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmSeasonality = async () => {
    if (confirmedMonths.size < 12) {
        alert('Confirme todos os meses antes de continuar.');
        return;
    }
    setIsSaving(true);
    try {
      await supabase.from('previsoes').insert({
        usuario_id: userId,
        data: `${selectedYear}-01-01`,
        previsao_total: (Object.values(adjustedTargets) as number[]).reduce((a: number, b: number) => a + b, 0),
        status: 'approved',
        observacao: `CONFIRMAÇÃO ANUAL: ${userName} deu ciência nas metas de ${selectedYear}.`
      });
      
      setIsCotaConfirmed(true);
      alert('Ciência registrada com sucesso!');
    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
  };

  const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-32">
      <div className="flex justify-center mb-8">
        <div className="bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm flex gap-1">
          <button onClick={() => setActiveTab('seasonality')} className={`px-8 py-3 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'seasonality' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>1. Previsão Anual</button>
          <button onClick={() => setActiveTab('weekly')} className={`px-8 py-3 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'weekly' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>
            <MousePointer2 className="w-3.5 h-3.5" /> 2. Envio de Previsão
          </button>
        </div>
      </div>

      {isLoading ? (
          <div className="py-40 text-center"><Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" /></div>
      ) : activeTab === 'weekly' ? (
        <div className="space-y-6 animate-slideUp">
            {/* Form de Adição */}
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row items-end gap-6">
                    <div className="flex-1 w-full">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">O que está previsto? (Justificativa)</label>
                        <input 
                          type="text" 
                          value={weeklyDescription}
                          onChange={e => setWeeklyDescription(e.target.value)}
                          placeholder="Ex: Pedido Farmácia X, Licitação Y..."
                          className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                        />
                    </div>
                    <div className="w-full md:w-64">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Valor Estimado</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">R$</span>
                            <input 
                              type="text" 
                              value={weeklyValueStr}
                              onChange={e => setWeeklyValueStr(handleValueMask(e.target.value))}
                              placeholder="0,00"
                              className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 text-sm font-black text-slate-900 outline-none tabular-nums"
                            />
                        </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={addToDraft}
                      disabled={!weeklyDescription || !weeklyValueStr}
                      className="h-14 rounded-2xl px-8 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 hover:bg-slate-800 disabled:opacity-30"
                    >
                        <Plus className="w-4 h-4" /> Adicionar
                    </button>
                </div>

                {draftItems.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-slate-100 animate-fadeIn">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Previsão em Construção ({draftItems.length})</h4>
                      <p className="text-xs font-black text-blue-600">Total: {formatBRL(draftItems.reduce((a,b) => a + b.value, 0))}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
                      {draftItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black text-slate-900 uppercase truncate">{item.description}</p>
                            <p className="text-sm font-black text-blue-600">{formatBRL(item.value)}</p>
                          </div>
                          <button onClick={() => removeFromDraft(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                    <Button fullWidth onClick={handleSendBatch} isLoading={isSaving} className="h-16 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/20"><Send className="w-4 h-4 mr-2" /> Finalizar e Enviar ao Gerente</Button>
                  </div>
                )}
            </div>

            {/* Histórico */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                    <History className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Acompanhamento Semanal</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {weeklyForecasts.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-[32px]">
                            <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Sem movimentações recentes</p>
                        </div>
                    ) : (
                        weeklyForecasts.map(report => (
                            <div key={report.id} className={`bg-white p-6 rounded-[32px] border shadow-sm transition-all flex flex-col justify-between ${
                              report.status === 'rejected' ? 'border-red-200 ring-4 ring-red-50 shadow-lg' : 'border-slate-200'
                            }`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enviado em {new Date(report.criado_em).toLocaleDateString('pt-BR')}</p>
                                        <h4 className="text-xl font-black text-blue-600 tabular-nums">{formatBRL(report.previsao_total)}</h4>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase ${
                                      report.status === 'approved' ? 'bg-emerald-600 text-white' : 
                                      report.status === 'rejected' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
                                    }`}>
                                        {report.status === 'approved' ? 'Aprovado' : report.status === 'rejected' ? 'Recusado' : 'Em Análise'}
                                    </span>
                                </div>
                                
                                {report.status === 'rejected' && (
                                  <div className="mb-4 p-4 bg-red-50 rounded-2xl border border-red-100">
                                     <div className="flex items-center gap-2 mb-2 text-red-600">
                                         <AlertCircle className="w-4 h-4" />
                                         <p className="text-[9px] font-black uppercase tracking-widest text-left">Motivo da Recusa</p>
                                     </div>
                                     <p className="text-[10px] text-red-800 font-bold italic mb-4 leading-relaxed bg-white/50 p-3 rounded-xl border border-red-100/30">
                                       "{report.observacao.match(/\[REVISÃO GERENTE: (.*?)\]/)?.[1] || 'Por favor, revise o planejamento enviado.'}"
                                     </p>
                                     <Button 
                                       onClick={() => setConfirmDeleteReport(report)} 
                                       fullWidth 
                                       size="sm" 
                                       className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] h-12 rounded-xl"
                                     >
                                       <RefreshCw className="w-4 h-4 mr-2" /> Refazer e Apagar Registro
                                     </Button>
                                  </div>
                                )}

                                <div className="space-y-1 pt-4 border-t border-slate-50">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase line-clamp-2">
                                        <MessageSquareText className="w-3 h-3 inline mr-1 text-slate-300" />
                                        {report.observacao.replace(/\[REVISÃO GERENTE:.*?\]/, '').replace('WEEKLY_CHECKIN:', '').trim()}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal de Confirmação customizado */}
            {confirmDeleteReport && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center border border-white/20 animate-slideUp">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-100">
                            <AlertTriangle className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tem certeza?</h3>
                        <p className="text-sm text-slate-500 mt-4 font-medium leading-relaxed italic px-4">"Isso apagará o histórico atual para você reenviar um novo lançamento."</p>
                        <div className="grid grid-cols-1 gap-3 mt-10">
                            <Button onClick={handleUnderstoodAndReset} isLoading={isSaving} className="bg-red-600 hover:bg-red-700 text-white h-16 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-red-200">Sim, apagar e refazer</Button>
                            <button onClick={() => setConfirmDeleteReport(null)} className="h-14 rounded-2xl font-black uppercase text-[10px] border border-slate-200 hover:bg-slate-50 transition-all">Não, fechar janela</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
      ) : (
        <div className="space-y-6 animate-slideUp">
           <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 border-b-4 border-blue-600">
                <div className="absolute top-0 right-0 p-8 opacity-10"><BarChart3 className="w-40 h-40" /></div>
                <div>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-2">Projeção Anual {selectedYear}</p>
                    <h3 className="text-4xl font-black">{formatBRL((Object.values(adjustedTargets) as number[]).reduce((a: number, b: number) => a + b, 0))}</h3>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 backdrop-blur-sm max-w-xs text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status de Cota</p>
                    <p className={`text-xs font-black uppercase ${isCotaConfirmed ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {isCotaConfirmed ? 'Ciência Concluída' : 'Aguardando Ciência'}
                    </p>
                </div>
            </div>

            {isCotaConfirmed && (
                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[32px] flex items-center gap-4 animate-fadeIn">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"><CheckCircle2 className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs font-black text-emerald-900 uppercase tracking-tight">Cota Sincronizada</p>
                        <p className="text-[10px] text-emerald-700 font-bold uppercase">Sua confirmação anual foi registrada. Edições bloqueadas pela gerência.</p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden relative">
                {isCotaConfirmed && <div className="absolute inset-0 z-10 bg-white/10 backdrop-blur-[1px] cursor-not-allowed"></div>}
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-8 py-6">Mês</th>
                            <th className="px-6 py-6 text-right">Meta Regional</th>
                            <th className="px-8 py-6 text-center">Ciência</th>
                            <th className="px-8 py-6 text-right">Minha Previsão</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {months.map((m, idx) => {
                            const monthNum = idx + 1;
                            const original = originalTargets.find(t => t.mes === monthNum)?.valor || 0;
                            const isConfirmed = confirmedMonths.has(monthNum);
                            return (
                                <tr key={idx} className={`transition-all ${isConfirmed ? 'bg-emerald-50/20' : ''}`}>
                                    <td className="px-8 py-5 font-black text-slate-700 uppercase text-xs">{m}</td>
                                    <td className="px-6 py-5 text-right font-bold text-slate-400 tabular-nums">{formatBRL(original)}</td>
                                    <td className="px-8 py-5 text-center">
                                        <button disabled={isCotaConfirmed} onClick={() => setConfirmedMonths(prev => { const n = new Set(prev); if (n.has(monthNum)) n.delete(monthNum); else n.add(monthNum); return n; })} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${isConfirmed ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-400 border border-transparent'}`}>
                                            {isConfirmed ? 'CIENTE' : 'CONFIRMAR'}
                                        </button>
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-sm tabular-nums">{formatBRL(original)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {!isCotaConfirmed && (
                <div className="flex justify-end">
                    <Button onClick={confirmSeasonality} disabled={confirmedMonths.size < 12 || isSaving} isLoading={isSaving} className="rounded-2xl px-12 h-16 font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/20">Finalizar Ciência Anual <ChevronRight className="w-5 h-5 ml-2" /></Button>
                </div>
            )}
        </div>
      )}
    </div>
  );
};