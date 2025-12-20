
import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, AlertTriangle, TrendingUp, Calendar, CheckCircle2, XCircle, RefreshCw, PenTool, Loader2, ChevronRight, X, Clock } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../lib/supabase';
import { createPortal } from 'react-dom';

export const ForecastScreen: React.FC = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [forecastValue, setForecastValue] = useState('');
  const [draftItems, setDraftItems] = useState<any[]>([]);
  const [historyByMonth, setHistoryByMonth] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMonthDetail, setSelectedMonthDetail] = useState<any | null>(null);
  
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<any | null>(null);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  useEffect(() => {
    if (userId) {
      fetchInitialData();
      loadAllRejectedItems();
    }
  }, [userId]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const { data: clientsData } = await supabase.from('clientes').select('id, nome_fantasia, cnpj').eq('usuario_id', userId).order('nome_fantasia');
      setClients(clientsData || []);

      // Agrupa previsões por mês para o histórico
      const { data: allItems } = await supabase
        .from('previsao_clientes')
        .select('*, previsoes!inner(id, data, usuario_id), clientes(nome_fantasia)')
        .eq('previsoes.usuario_id', userId);

      // Organizar por Mês/Ano
      const months: any = {};
      allItems?.forEach(item => {
        const date = new Date(item.previsoes.data);
        const monthKey = `${date.getMonth() + 1}/${date.getFullYear()}`;
        if (!months[monthKey]) {
          months[monthKey] = {
            key: monthKey,
            total: 0,
            items: [],
            monthName: date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
          };
        }
        months[monthKey].items.push(item);
        months[monthKey].total += item.valor_previsto_cliente;
      });

      setHistoryByMonth(Object.values(months).sort((a: any, b: any) => b.key.localeCompare(a.key)));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllRejectedItems = async () => {
    try {
      const { data: items } = await supabase
        .from('previsao_clientes')
        .select('*, clientes(nome_fantasia), previsoes!inner(usuario_id)')
        .eq('status', 'rejected')
        .eq('previsoes.usuario_id', userId);

      if (items && items.length > 0) {
        setDraftItems(items.map(i => ({
          dbId: i.id,
          clientId: i.cliente_id,
          clientName: i.clientes?.nome_fantasia || 'Cliente',
          forecastValue: i.valor_previsto_cliente,
          motivo_recusa: i.motivo_recusa,
          isCorrection: true
        })));
      }
    } catch (error) {
      console.error('Erro ao carregar itens recusados:', error);
    }
  };

  const handleUpdateDraftValue = (idx: number, newVal: string) => {
    const val = parseFloat(newVal) || 0;
    setDraftItems(prev => prev.map((item, i) => i === idx ? { ...item, forecastValue: val } : item));
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !forecastValue) return;

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    const numValue = parseFloat(forecastValue);
    const now = new Date();
    const { data: meta } = await supabase
      .from('metas_clientes')
      .select('valor')
      .eq('cliente_id', client.id)
      .eq('mes', now.getMonth() + 1)
      .eq('ano', now.getFullYear())
      .maybeSingle();

    const targetVal = meta?.valor || 0;
    const newItem = { clientId: client.id, clientName: client.nome_fantasia, forecastValue: numValue, targetValue: targetVal };

    if (numValue < targetVal && targetVal > 0) {
      setPendingItem(newItem);
      setWarningModalOpen(true);
    } else {
      confirmAddItem(newItem);
    }
  };

  const confirmAddItem = (item: any) => {
    setDraftItems(prev => {
      const exists = prev.findIndex(i => i.clientId === item.clientId);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = { ...updated[exists], ...item };
        return updated;
      }
      return [...prev, item];
    });
    setSelectedClientId('');
    setForecastValue('');
    setWarningModalOpen(false);
  };

  const handleSaveForecast = async () => {
    if (draftItems.length === 0) return;
    setIsSaving(true);
    try {
      const now = new Date();
      const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

      // 1. Verificar se já existe cabeçalho para este mês
      let { data: existingForecast } = await supabase
        .from('previsoes')
        .select('id')
        .eq('usuario_id', userId)
        .eq('data', firstDayStr(now))
        .maybeSingle();

      if (!existingForecast) {
        const { data: newF, error: fErr } = await supabase.from('previsoes').insert({
          usuario_id: userId,
          data: firstDayStr(now),
          previsao_total: 0
        }).select().single();
        if (fErr) throw fErr;
        existingForecast = newF;
      }

      // 2. Salvar Itens
      for (const item of draftItems) {
        if (item.dbId) {
          // Se era correção, atualiza o existente e volta para pendente
          await supabase.from('previsao_clientes').update({
            valor_previsto_cliente: item.forecastValue,
            status: 'pending',
            motivo_recusa: null
          }).eq('id', item.dbId);
        } else {
          // Se for novo, insere
          await supabase.from('previsao_clientes').insert({
            previsao_id: existingForecast.id,
            cliente_id: item.clientId,
            valor_previsto_cliente: item.forecastValue,
            status: 'pending'
          });
        }
      }

      // 3. Atualizar total do cabeçalho
      const { data: allItems } = await supabase.from('previsao_clientes').select('valor_previsto_cliente').eq('previsao_id', existingForecast.id);
      const newTotal = allItems?.reduce((acc, curr) => acc + curr.valor_previsto_cliente, 0) || 0;
      await supabase.from('previsoes').update({ previsao_total: newTotal }).eq('id', existingForecast.id);

      alert('Previsão mensal atualizada!');
      setDraftItems([]);
      fetchInitialData();
    } catch (error: any) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const firstDayStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
          <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-600" /> Previsão de Fechamento
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alimentação Mensal Consolidada</p>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-xl border border-white/10 text-right">
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Sincronização</p>
              <p className="text-xs font-black text-white">{draftItems.length > 0 ? 'DADOS PENDENTES' : 'CONCLUÍDO'}</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600" /> Adicionar / Atualizar Valor
            </h3>
            <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              <div className="md:col-span-6">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Cliente</label>
                <select 
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Selecione...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia}</option>)}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Valor Planejado (R$)</label>
                <input 
                  type="number"
                  value={forecastValue}
                  onChange={(e) => setForecastValue(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="md:col-span-2">
                <Button fullWidth className="h-[46px] rounded-xl font-black">SALVAR</Button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Lançamentos em Rascunho</h3>
              <span className="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest">
                {draftItems.length} Clientes
              </span>
            </div>
            
            <div className="overflow-y-auto max-h-[450px]">
              {draftItems.length === 0 ? (
                <div className="p-20 text-center">
                  <TrendingUp className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhum dado novo para enviar</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {draftItems.map((item, idx) => (
                    <div key={idx} className={`p-6 flex items-center justify-between group hover:bg-slate-50 transition-colors ${item.isCorrection ? 'bg-red-50/20 border-l-4 border-red-500' : ''}`}>
                      <div className="flex-1">
                        <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">{item.clientName}</h4>
                        {item.motivo_recusa && (
                          <p className="text-[10px] font-bold text-red-700 mt-1 uppercase underline tracking-tight">Motivo: {item.motivo_recusa}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-6 ml-4">
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Previsão</p>
                          <input 
                            type="number"
                            value={item.forecastValue}
                            onChange={(e) => handleUpdateDraftValue(idx, e.target.value)}
                            className="w-24 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-black text-slate-900 text-right"
                          />
                        </div>
                        {!item.isCorrection && (
                          <button onClick={() => setDraftItems(prev => prev.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 p-2">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {draftItems.length > 0 && (
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total do Lote</p>
                   <p className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(draftItems.reduce((acc, curr) => acc + curr.forecastValue, 0))}</p>
                </div>
                <Button onClick={handleSaveForecast} isLoading={isSaving} className="h-12 px-8 font-black text-xs uppercase tracking-widest">
                   Enviar Atualização <Save className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" /> Resumo Mensal
            </h3>
            <div className="space-y-3">
              {historyByMonth.map(m => (
                <div 
                  key={m.key} 
                  onClick={() => setSelectedMonthDetail(m)}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-300 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase">{m.monthName}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                  </div>
                  <p className="text-sm font-black text-slate-800 tabular-nums">{formatCurrency(m.total)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedMonthDetail && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase">{selectedMonthDetail.monthName}</h3>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Situação de todos os clientes</p>
                </div>
                <button onClick={() => setSelectedMonthDetail(null)} className="p-2 hover:bg-slate-200 rounded-full">
                   <X className="w-6 h-6 text-slate-400" />
                </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                {selectedMonthDetail.items.map((item: any) => (
                    <div key={item.id} className="py-4 flex justify-between items-center">
                        <div>
                            <p className="font-black text-slate-800 text-sm uppercase">{item.clientes?.nome_fantasia}</p>
                            <div className="flex items-center gap-2 mt-1">
                                {item.status === 'approved' ? (
                                    <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-2 py-0.5 rounded uppercase">Aceito</span>
                                ) : item.status === 'rejected' ? (
                                    <span className="bg-red-100 text-red-700 text-[8px] font-black px-2 py-0.5 rounded uppercase">Recusado</span>
                                ) : (
                                    <span className="bg-blue-100 text-blue-700 text-[8px] font-black px-2 py-0.5 rounded uppercase">Em Análise</span>
                                )}
                            </div>
                        </div>
                        <p className={`font-black ${item.status === 'approved' ? 'text-emerald-600' : item.status === 'rejected' ? 'text-red-600' : 'text-slate-900'}`}>
                            {formatCurrency(item.valor_previsto_cliente)}
                        </p>
                    </div>
                ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
