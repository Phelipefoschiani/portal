
import React, { useState, useEffect, useMemo } from 'react';
import { Target, TrendingUp, Calendar, CheckCircle2, Lock, Unlock, ChevronRight, Save, Loader2, DollarSign, Building2, Building, ArrowUpRight, BarChart3, Info, AlertTriangle, Edit3, Check, MousePointer2 } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../lib/supabase';
import { totalDataStore } from '../lib/dataStore';

type TabType = 'seasonality' | 'clients';

export const ForecastScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('seasonality');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedYear] = useState(new Date().getFullYear());

  // Estados de Controle
  const [originalTargets, setOriginalTargets] = useState<any[]>([]);
  const [adjustedTargets, setAdjustedTargets] = useState<Record<number, number>>({});
  const [confirmedMonths, setConfirmedMonths] = useState<Set<number>>(new Set());
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [isCotaConfirmed, setIsCotaConfirmed] = useState(false);

  // Dados de Clientes
  const [clientForecasts, setClientForecasts] = useState<Record<string, number>>({});
  const [clientHistory, setClientHistory] = useState<any[]>([]);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  useEffect(() => {
    if (userId) fetchData();
  }, [userId]);

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
        .select('id, metadata')
        .eq('usuario_id', userId)
        .eq('data', `${selectedYear}-01-01`)
        .maybeSingle();

      if (existingForecast) {
          setIsCotaConfirmed(true);
          if (existingForecast.metadata?.adjusted_monthly) {
              setAdjustedTargets(existingForecast.metadata.adjusted_monthly);
              setConfirmedMonths(new Set([1,2,3,4,5,6,7,8,9,10,11,12]));
          }
      } else {
          const initialAdjusted: Record<number, number> = {};
          targets?.forEach(t => { initialAdjusted[t.mes] = Number(t.valor); });
          setAdjustedTargets(initialAdjusted);
      }

      const sales = totalDataStore.sales;
      const clients = totalDataStore.clients;
      const year1 = selectedYear - 1;
      const year2 = selectedYear - 2;

      const stats = clients.map(c => {
        const cleanCnpj = c.cnpj.replace(/\D/g, '');
        const val1 = sales.filter(s => s.cnpj.replace(/\D/g, '') === cleanCnpj && new Date(s.data + 'T00:00:00').getFullYear() === year1).reduce((a: number, b: any) => a + (Number(b.faturamento) || 0), 0);
        const val2 = sales.filter(s => s.cnpj.replace(/\D/g, '') === cleanCnpj && new Date(s.data + 'T00:00:00').getFullYear() === year2).reduce((a: number, b: any) => a + (Number(b.faturamento) || 0), 0);
        return { ...c, valYear1: val1, valYear2: val2, totalHist: val1 + val2 };
      }).sort((a, b) => b.totalHist - a.totalHist);

      setClientHistory(stats);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmMonth = (month: number) => {
      setConfirmedMonths(prev => new Set(prev).add(month));
      setEditingMonth(null);
  };

  const handleProposeIncrease = (month: number) => {
      setEditingMonth(month);
      setConfirmedMonths(prev => {
          const next = new Set(prev);
          next.delete(month);
          return next;
      });
  };

  const handleTargetChange = (month: number, newVal: string) => {
    const numeric = parseFloat(newVal) || 0;
    const original = originalTargets.find(t => t.mes === month)?.valor || 0;
    setAdjustedTargets(prev => ({ ...prev, [month]: Math.max(numeric, original) }));
  };

  const totalConfirmedTarget = (Object.values(adjustedTargets) as number[]).reduce((a: number, b: number) => a + b, 0);
  const allMonthsConfirmed = confirmedMonths.size === 12;

  const confirmSeasonality = async () => {
    if (!allMonthsConfirmed) {
        alert('Por favor, confirme ou ajuste todos os meses da grade antes de enviar.');
        return;
    }
    setIsSaving(true);
    try {
        const originalAnnual = originalTargets.reduce((a, b) => a + Number(b.valor), 0);
        const isModified = totalConfirmedTarget > originalAnnual;

        const payload = {
            usuario_id: userId,
            data: `${selectedYear}-01-01`,
            previsao_total: totalConfirmedTarget,
            status: 'pending',
            metadata: {
                adjusted_monthly: adjustedTargets,
                is_upgrade: isModified,
                original_total: originalAnnual
            }
        };

        await supabase.from('previsoes').upsert(payload, { onConflict: 'usuario_id, data' });
        setIsCotaConfirmed(true);
        setActiveTab('clients');
        alert('Previsão enviada com sucesso! Prossiga para o mapeamento por cliente.');
    } catch (e: any) {
        alert('Erro ao salvar: ' + e.message);
    } finally {
        setIsSaving(false);
    }
  };

  const totalClientMapped = (Object.values(clientForecasts) as number[]).reduce((a, b) => a + (b || 0), 0);
  const mappingProgress = totalConfirmedTarget > 0 ? (totalClientMapped / totalConfirmedTarget) * 100 : 0;

  const saveClientMapping = async () => {
    if (totalClientMapped < totalConfirmedTarget) {
        alert(`Sua alocação deve cobrir pelo menos 100% da sua previsão (Faltam ${formatBRL(totalConfirmedTarget - totalClientMapped)}).`);
        return;
    }
    setIsSaving(true);
    try {
        const { data: currentF } = await supabase.from('previsoes').select('id').eq('usuario_id', userId).eq('data', `${selectedYear}-01-01`).single();
        
        if (!currentF) {
            throw new Error('Não foi possível localizar o registro principal da previsão. Salve a primeira aba antes.');
        }

        const inserts = Object.entries(clientForecasts).map(([cId, val]) => ({
            previsao_id: currentF.id,
            cliente_id: cId,
            valor_previsto_cliente: val,
            status: 'pending'
        }));
        
        await supabase.from('previsao_clientes').delete().eq('previsao_id', currentF.id);
        await supabase.from('previsao_clientes').insert(inserts);
        alert('Mapeamento de carteira enviado para análise do gestor!');
    } catch (e: any) {
        alert('Erro: ' + e.message);
    } finally {
        setIsSaving(false);
    }
  };

  const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-32">
      <div className="flex justify-center mb-8">
        <div className="bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm flex gap-1">
          <button onClick={() => setActiveTab('seasonality')} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'seasonality' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}>1. Previsão de Faturamento</button>
          <button onClick={() => isCotaConfirmed && setActiveTab('clients')} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'clients' ? 'bg-blue-600 text-white shadow-lg' : isCotaConfirmed ? 'text-slate-400' : 'text-slate-200 cursor-not-allowed'}`}>
            {!isCotaConfirmed && <Lock className="w-3.5 h-3.5" />} 2. Participação de Clientes
          </button>
        </div>
      </div>

      {isLoading ? (
          <div className="py-40 text-center"><Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" /></div>
      ) : activeTab === 'seasonality' ? (
        <div className="space-y-6 animate-slideUp">
            <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 border-b-4 border-blue-600">
                <div className="absolute top-0 right-0 p-8 opacity-10"><BarChart3 className="w-40 h-40" /></div>
                <div>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em] mb-2">Previsão Acumulada {selectedYear}</p>
                    <h3 className="text-4xl font-black">{formatBRL(totalConfirmedTarget)}</h3>
                </div>
                <div className="bg-white/5 p-6 rounded-3xl border border-white/5 backdrop-blur-sm max-w-xs text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Status da Validação</p>
                    <p className="text-xs font-black uppercase text-blue-400">{allMonthsConfirmed ? 'Grade Validada' : 'Aguardando Ciência Mensal'}</p>
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
                            const isEditing = editingMonth === monthNum;
                            const val = adjustedTargets[monthNum] || original;

                            return (
                                <tr key={idx} className={`transition-all ${isConfirmed ? 'bg-emerald-50/20' : isEditing ? 'bg-blue-50/30' : ''}`}>
                                    <td className="px-8 py-5 font-black text-slate-700 uppercase text-xs">
                                        <div className="flex items-center gap-3">
                                            {isConfirmed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200"></div>}
                                            {m}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right font-bold text-slate-400 tabular-nums">{formatBRL(original)}</td>
                                    <td className="px-8 py-5">
                                        <div className="flex justify-center gap-2">
                                            {isConfirmed ? (
                                                <button onClick={() => handleProposeIncrease(monthNum)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-[9px] font-black text-slate-400 hover:text-blue-600 transition-all uppercase">
                                                    <Edit3 className="w-3.5 h-3.5" /> Ajustar Previsão
                                                </button>
                                            ) : isEditing ? (
                                                <button onClick={() => handleConfirmMonth(monthNum)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-100">
                                                    <Check className="w-3.5 h-3.5" /> Confirmar Valor
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleConfirmMonth(monthNum)} className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase hover:bg-emerald-700 transition-all shadow-md">
                                                       Confirmar Regional
                                                    </button>
                                                    <button onClick={() => handleProposeIncrease(monthNum)} className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[9px] font-black uppercase hover:bg-white transition-all">
                                                       Propor Aumento
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        {isEditing ? (
                                            <div className="relative inline-block">
                                                <input 
                                                    type="number" 
                                                    autoFocus
                                                    value={val}
                                                    onChange={e => handleTargetChange(monthNum, e.target.value)}
                                                    className="w-36 bg-white border-2 border-blue-500 rounded-xl px-4 py-2 text-right font-black text-blue-600 outline-none shadow-inner"
                                                />
                                                <div className="absolute -top-3 left-0 bg-blue-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase">Novo Valor</div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-end">
                                                <span className={`font-black text-sm tabular-nums ${val > original ? 'text-blue-600' : 'text-slate-900'}`}>{formatBRL(val)}</span>
                                                {val > original && <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest mt-1">+ UPGRADE</span>}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-end">
                <Button onClick={confirmSeasonality} disabled={!allMonthsConfirmed || isSaving} isLoading={isSaving} className="rounded-2xl px-12 h-16 font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-blue-500/20">
                    Sincronizar Previsão Regional <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
            </div>
        </div>
      ) : (
        <div className="space-y-6 animate-slideUp">
            <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-10">
                <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total a Mapear em Clientes</p>
                    <h3 className="text-3xl font-black text-slate-900">{formatBRL(totalConfirmedTarget)}</h3>
                    <div className="mt-6">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase italic">Importante: Mapeie 100% da meta nos clientes</span>
                            <span className={`text-[10px] font-black ${mappingProgress >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{mappingProgress.toFixed(1)}% Coberto</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-700 ${mappingProgress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(mappingProgress, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
                <Button onClick={saveClientMapping} disabled={mappingProgress < 99.9 || isSaving} isLoading={isSaving} className="rounded-[24px] h-16 px-10 font-black uppercase text-xs tracking-[0.2em] shadow-xl">Enviar Mapeamento <Save className="w-4 h-4 ml-2"/></Button>
            </div>

            <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-8 py-6">Cliente / Ranking de Compra</th>
                            <th className="px-6 py-6 text-right">Faturado {selectedYear-2}</th>
                            <th className="px-6 py-6 text-right">Faturado {selectedYear-1}</th>
                            <th className="px-8 py-6 text-right text-blue-600">Previsão {selectedYear} (R$)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {clientHistory.map((client, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 group">
                                <td className="px-8 py-4">
                                    <p className="font-black text-slate-800 uppercase text-xs truncate tracking-tight">{client.nome_fantasia}</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{client.cnpj}</p>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-slate-400 tabular-nums text-xs">{formatBRL(client.valYear2)}</td>
                                <td className="px-6 py-4 text-right font-bold text-slate-400 tabular-nums text-xs">{formatBRL(client.valYear1)}</td>
                                <td className="px-8 py-4 text-right">
                                    <input 
                                        type="number" 
                                        value={clientForecasts[client.id] || ''}
                                        onChange={e => setClientForecasts(prev => ({ ...prev, [client.id]: parseFloat(e.target.value) || 0 }))}
                                        className="w-36 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-right font-black text-xs outline-none focus:ring-4 focus:ring-blue-100"
                                        placeholder="0"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  );
};
