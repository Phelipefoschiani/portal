import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Lock, ChevronRight, Loader2, DollarSign, Building2, BarChart3, Info, AlertTriangle, MousePointer2, Plus, History, Clock, RefreshCw, Trash2, Send, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../lib/supabase';
import { totalDataStore } from '../lib/dataStore';
import { createPortal } from 'react-dom';

type TabType = 'seasonality' | 'clients' | 'weekly';

interface DraftItem {
  clientId: string;
  clientName: string;
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

  // Estados Check-in Semanal
  const [weeklyForecasts, setWeeklyForecasts] = useState<any[]>([]);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [selectedClientForWeekly, setSelectedClientForWeekly] = useState('');
  const [weeklyValueStr, setWeeklyValueStr] = useState('');

  // Estado para o Novo Modal de Confirmação
  const [reportToCorrect, setReportToCorrect] = useState<any | null>(null);

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
        .not('observacao', 'ilike', 'WEEKLY_CHECKIN%')
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
          criado_em,
          previsao_clientes (
            id,
            cliente_id,
            valor_previsto_cliente,
            clientes (nome_fantasia, cnpj)
          )
        `)
        .eq('usuario_id', userId)
        .ilike('observacao', 'WEEKLY_CHECKIN%')
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
    if (!selectedClientForWeekly || !weeklyValueStr) return;
    const client = totalDataStore.clients.find(c => c.id === selectedClientForWeekly);
    const clientName = client?.nome_fantasia || 'Cliente';
    const val = parseToNumber(weeklyValueStr);

    if (val <= 0) {
      alert('Informe um valor válido.');
      return;
    }

    setDraftItems(prev => [...prev, { clientId: selectedClientForWeekly, clientName, value: val }]);
    setSelectedClientForWeekly('');
    setWeeklyValueStr('');
  };

  const removeFromDraft = (index: number) => {
    setDraftItems(prev => prev.filter((_, i) => i !== index));
  };

  const executeCorrection = async () => {
    if (!reportToCorrect) return;

    setIsSaving(true);
    
    try {
        const itemsToEdit: DraftItem[] = (reportToCorrect.previsao_clientes || []).map((item: any) => ({
            clientId: item.cliente_id,
            clientName: item.clientes?.nome_fantasia || 'Cliente não identificado',
            value: Number(item.valor_previsto_cliente || 0)
        }));

        const { error: errItems } = await supabase
            .from('previsao_clientes')
            .delete()
            .eq('previsao_id', reportToCorrect.id);
        if (errItems) throw new Error('Falha ao apagar itens: ' + errItems.message);

        const { error: errHeader } = await supabase
            .from('previsoes')
            .delete()
            .eq('id', reportToCorrect.id);
        if (errHeader) throw new Error('Falha ao apagar relatório: ' + errHeader.message);

        setDraftItems(itemsToEdit);
        setActiveTab('weekly');
        await fetchWeeklyData();
        
        setReportToCorrect(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        alert('O relatório anterior foi removido. Ajuste os valores e envie novamente.');

    } catch (err: any) {
        alert('Erro técnico: ' + err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleSendBatch = async () => {
    if (draftItems.length === 0) {
        alert('Sua lista de construção está vazia.');
        return;
    }
    
    setIsSaving(true);
    try {
      const totalBatch = draftItems.reduce((acc, curr) => acc + curr.value, 0);
      
      const { data: header, error: headerError } = await supabase
        .from('previsoes')
        .insert({
          usuario_id: userId,
          data: new Date().toISOString().split('T')[0],
          previsao_total: totalBatch,
          status: 'pending',
          observacao: `WEEKLY_CHECKIN: Relatório enviado/corrigido por ${userName}.`
        })
        .select()
        .single();

      if (headerError) throw headerError;

      const itemsToInsert = draftItems.map(item => ({
        previsao_id: header.id,
        cliente_id: item.clientId,
        valor_previsto_cliente: item.value,
        status: 'pending'
      }));

      const { error: itemsError } = await supabase.from('previsao_clientes').insert(itemsToInsert);
      if (itemsError) throw itemsError;

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
        alert('Você precisa confirmar todos os meses antes de sincronizar.');
        return;
    }
    setIsSaving(true);
    try {
      await supabase.from('previsoes').insert({
        usuario_id: userId,
        data: `${selectedYear}-01-01`,
        previsao_total: Object.values(adjustedTargets).reduce((a,b) => a+b, 0),
        status: 'pending',
        observacao: `CONFIRMAÇÃO ANUAL: ${userName} aceitou a grade de ${selectedYear}.`
      });
      
      setIsCotaConfirmed(true);
      alert('Meta anual sincronizada!');
    } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
  };

  const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-32">
      <div className="flex justify-center mb-8">
        <div className="bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm flex gap-1 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('seasonality')} className={`px-6 md:px-8 py-3 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'seasonality' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>1. Previsão Anual</button>
          <button onClick={() => isCotaConfirmed && setActiveTab('clients')} className={`px-6 md:px-8 py-3 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'clients' ? 'bg-blue-600 text-white shadow-lg' : isCotaConfirmed ? 'text-slate-400' : 'text-slate-200 cursor-not-allowed'}`}>
            {!isCotaConfirmed && <Lock className="w-3.5 h-3.5" />} 2. Carteira Anual
          </button>
          <button onClick={() => setActiveTab('weekly')} className={`px-6 md:px-8 py-3 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'weekly' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>
            <MousePointer2 className="w-3.5 h-3.5" /> 3. Check-in Semanal
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
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Selecione o Cliente</label>
                        <select 
                          value={selectedClientForWeekly}
                          onChange={e => setSelectedClientForWeekly(e.target.value)}
                          className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">Buscar cliente...</option>
                            {totalDataStore.clients.sort((a,b) => a.nome_fantasia.localeCompare(b.nome_fantasia)).map(c => (
                                <option key={c.id} value={c.id}>{c.nome_fantasia} - {c.cnpj}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full md:w-64">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Venda Prevista</label>
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
                      disabled={!selectedClientForWeekly || !weeklyValueStr}
                      className="h-14 rounded-2xl px-8 bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 hover:bg-slate-800 disabled:opacity-30"
                    >
                        <Plus className="w-4 h-4" /> Adicionar
                    </button>
                </div>

                {/* RELATÓRIO EM CONSTRUÇÃO */}
                {draftItems.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-slate-100 animate-fadeIn">
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Relatório em Construção ({draftItems.length})</h4>
                      <p className="text-xs font-black text-blue-600">Total: {formatBRL(draftItems.reduce((a,b) => a + b.value, 0))}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {draftItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-xl group animate-fadeIn">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black text-slate-900 uppercase truncate">{item.clientName}</p>
                            <p className="text-sm font-black text-blue-600">{formatBRL(item.value)}</p>
                          </div>
                          <button onClick={() => removeFromDraft(idx)} className="p-2 text-slate-300 hover:text-red-500 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6">
                      <Button fullWidth onClick={handleSendBatch} isLoading={isSaving} className="h-16 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/20">
                        <Send className="w-4 h-4 mr-2" /> Finalizar e Enviar Previsão
                      </Button>
                    </div>
                  </div>
                )}
            </div>

            {/* Histórico */}
            <div className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                    <History className="w-5 h-5 text-blue-600" />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Minhas Previsões Recentes</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {weeklyForecasts.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-[32px]">
                            <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Nenhuma previsão encontrada</p>
                        </div>
                    ) : (
                        weeklyForecasts.map(report => (
                            <div key={report.id} className={`bg-white p-6 rounded-[32px] border shadow-sm transition-all flex flex-col justify-between ${
                              report.status === 'rejected' ? 'border-red-200 ring-4 ring-red-50 shadow-lg' : 'border-slate-200'
                            }`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Relatório {new Date(report.data).toLocaleDateString('pt-BR')}</p>
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
                                         <p className="text-[9px] font-black uppercase tracking-widest">Pendente de Ajustes</p>
                                     </div>
                                     <p className="text-[10px] text-red-800 font-bold italic mb-4 leading-relaxed bg-white/50 p-2 rounded-lg">
                                       "{report.observacao.match(/\[REVISÃO GERENTE: (.*?)\]/)?.[1] || 'Por favor, revise os valores sugeridos.'}"
                                     </p>
                                     <Button 
                                       onClick={(e) => {
                                          if (e) { e.preventDefault(); e.stopPropagation(); }
                                          setReportToCorrect(report);
                                       }} 
                                       fullWidth 
                                       size="sm" 
                                       className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] h-12 rounded-xl shadow-xl"
                                     >
                                       <RefreshCw className="w-4 h-4 mr-2" /> Corrigir e Reenviar
                                     </Button>
                                  </div>
                                )}

                                <div className="space-y-1 pt-4 border-t border-slate-50">
                                    {report.previsao_clientes.slice(0, 3).map((item: any) => (
                                        <div key={item.id} className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                            <span className="truncate pr-4">{item.clientes?.nome_fantasia}</span>
                                            <span className="shrink-0 tabular-nums">{formatBRL(item.valor_previsto_cliente)}</span>
                                        </div>
                                    ))}
                                    {report.previsao_clientes.length > 3 && (
                                        <p className="text-[9px] text-slate-300 font-black uppercase pt-1">+ {report.previsao_clientes.length - 3} outros clientes</p>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      ) : activeTab === 'seasonality' ? (
        <div className="space-y-6 animate-slideUp">
           <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 border-b-4 border-blue-600">
                <div className="absolute top-0 right-0 p-8 opacity-10"><BarChart3 className="w-40 h-40" /></div>
                <div>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-2">Previsão Acumulada {selectedYear}</p>
                    <h3 className="text-4xl font-black">{formatBRL(Object.values(adjustedTargets).reduce((a,b) => a+b, 0))}</h3>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 backdrop-blur-sm max-w-xs text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status da Validação</p>
                    <p className="text-xs font-black uppercase text-blue-400">{confirmedMonths.size === 12 ? 'Grade Validada' : 'Aguardando Ciência Mensal'}</p>
                </div>
            </div>
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-8 py-6">Mês Referência</th>
                            <th className="px-6 py-6 text-right">Meta Regional</th>
                            <th className="px-8 py-6 text-center">Decisão Comercial</th>
                            <th className="px-8 py-6 text-right">Minha Previsão</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {months.map((m, idx) => {
                            const monthNum = idx + 1;
                            const original = originalTargets.find(t => t.mes === monthNum)?.valor || 0;
                            const isConfirmed = confirmedMonths.has(monthNum);
                            const val = adjustedTargets[monthNum] || original;
                            return (
                                <tr key={idx} className={`transition-all ${isConfirmed ? 'bg-emerald-50/20' : ''}`}>
                                    <td className="px-8 py-5 font-black text-slate-700 uppercase text-xs">{m}</td>
                                    <td className="px-6 py-5 text-right font-bold text-slate-400 tabular-nums">{formatBRL(original)}</td>
                                    <td className="px-8 py-5 text-center">
                                        <button onClick={() => setConfirmedMonths(prev => { const n = new Set(prev); if (n.has(monthNum)) n.delete(monthNum); else n.add(monthNum); return n; })} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase ${isConfirmed ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                            {isConfirmed ? 'CIENTE' : 'CONFIRMAR'}
                                        </button>
                                    </td>
                                    <td className="px-8 py-5 text-right font-black text-sm tabular-nums">{formatBRL(val)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-end">
                <Button onClick={confirmSeasonality} disabled={confirmedMonths.size < 12 || isSaving} isLoading={isSaving} className="rounded-2xl px-12 h-16 font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/20">Sincronizar Meta Anual <ChevronRight className="w-5 h-5 ml-2" /></Button>
            </div>
        </div>
      ) : (
        <div className="space-y-6 animate-slideUp">
           <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm text-center py-20 text-slate-300">
               <Building2 className="w-16 h-16 mx-auto mb-4 opacity-10" />
               <p className="font-black uppercase text-xs tracking-[0.3em]">Funcionalidade de mapeamento de carteira anual habilitada.</p>
           </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE CORREÇÃO CUSTOMIZADO */}
      {reportToCorrect && createPortal(
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
              <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-slideUp border border-white/20 text-center">
                  <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reiniciar Envio</h3>
                  <p className="text-sm text-slate-500 mt-2 font-medium">
                      Este relatório será <strong>excluído permanentemente</strong> do seu histórico para que você possa editá-lo.
                  </p>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 my-6 text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Itens Carregados</p>
                      <p className="text-sm font-black text-blue-600">{reportToCorrect.previsao_clientes?.length || 0} Clientes</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 mb-1">Montante Anterior</p>
                      <p className="text-sm font-black text-slate-800">{formatBRL(reportToCorrect.previsao_total)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-8">
                      <Button 
                          variant="outline" 
                          onClick={() => setReportToCorrect(null)}
                          disabled={isSaving}
                          className="rounded-2xl h-14 font-black uppercase text-[10px]"
                      >
                          Cancelar
                      </Button>
                      <Button 
                          onClick={executeCorrection}
                          isLoading={isSaving}
                          className="bg-slate-900 hover:bg-slate-800 text-white rounded-2xl h-14 font-black uppercase text-[10px] shadow-xl"
                      >
                          Sim, Editar
                      </Button>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};