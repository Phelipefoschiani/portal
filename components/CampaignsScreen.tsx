
import React, { useState, useEffect } from 'react';
import { Megaphone, Save, CheckCircle2, TrendingUp, DollarSign, Percent, AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../lib/supabase';

interface CampaignsScreenProps {
  onNavigateToInvestments: () => void;
}

export const CampaignsScreen: React.FC<CampaignsScreenProps> = ({ onNavigateToInvestments }) => {
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [description, setDescription] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [caju, setCaju] = useState('');
  const [dinheiro, setDinheiro] = useState('');
  const [produto, setProduto] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  useEffect(() => {
    if (userId) fetchClients();
  }, [userId]);

  const fetchClients = async () => {
    const { data } = await supabase.from('clientes').select('id, nome_fantasia').eq('usuario_id', userId).order('nome_fantasia');
    setClients(data || []);
  };

  const valCaju = parseFloat(caju) || 0;
  const valDinheiro = parseFloat(dinheiro) || 0;
  const valProduto = parseFloat(produto) || 0;
  const valOrder = parseFloat(orderValue) || 0;
  const totalInvestment = valCaju + valDinheiro + valProduto;
  const investmentPercent = valOrder > 0 ? (totalInvestment / valOrder) * 100 : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || totalInvestment === 0 || valOrder === 0) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('investimentos').insert({
        usuario_id: userId,
        cliente_id: selectedClientId,
        data: new Date().toISOString().split('T')[0],
        valor_total_investimento: totalInvestment,
        valor_caju: valCaju,
        valor_dinheiro: valDinheiro,
        valor_produto: valProduto,
        observacao: `[PEDIDO ESTIMADO: R$ ${valOrder.toLocaleString('pt-BR')}] - ${description}`,
        status: 'pendente'
      });

      if (error) throw error;

      setMsg('Solicitação enviada! Redirecionando...');
      setTimeout(() => {
        onNavigateToInvestments();
      }, 1500);
    } catch (err: any) {
        alert('Erro ao enviar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Megaphone className="w-6 h-6 text-blue-600" /> Nova Campanha
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Planejamento Comercial</p>
          </div>
          <div className="bg-slate-900 px-6 py-2 rounded-xl border border-white/10 text-right">
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">ROI Estimado</p>
              <p className="text-xs font-black text-white">{investmentPercent.toFixed(1)}% DO PEDIDO</p>
          </div>
      </div>

      {/* Resumo da Proposta - NO TOPO */}
      <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="w-32 h-32" /></div>
          <div className="text-center md:text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Total do Investimento</p>
              <p className="text-4xl font-black text-white tabular-nums">{formatCurrency(totalInvestment)}</p>
          </div>
          <div className="flex-1 max-w-xs w-full">
              <div className="flex justify-between items-center mb-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Viabilidade (ROI)</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded ${investmentPercent > 10 ? 'bg-red-500' : 'bg-emerald-500'}`}>
                      {investmentPercent.toFixed(1)}%
                  </span>
              </div>
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-700 ${investmentPercent > 10 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(investmentPercent * 5, 100)}%` }}></div>
              </div>
          </div>
      </div>

      <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <form onSubmit={handleSave} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-[0.2em]">Cliente Alvo</label>
                      <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[20px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 transition-all" required>
                          <option value="">Buscar na carteira...</option>
                          {clients.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia}</option>)}
                      </select>
                  </div>

                  <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-[0.2em]">Valor do Pedido (Faturamento)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="number" value={orderValue} onChange={e => setOrderValue(e.target.value)} className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-[20px] font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-100 transition-all" placeholder="0,00" required />
                      </div>
                  </div>

                  <div className="md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-[0.2em]">Descrição e Justificativa</label>
                      <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[24px] font-medium text-slate-600 outline-none focus:ring-4 focus:ring-blue-100 transition-all" rows={4} required placeholder="Explique a necessidade do investimento..."></textarea>
                  </div>
              </div>

              <div className="pt-8 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-[0.2em]">Distribuição (Canais)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-6 bg-pink-50/50 rounded-3xl border border-pink-100 text-center">
                          <label className="text-[9px] font-black text-pink-600 uppercase block mb-3">Caju</label>
                          <input type="number" value={caju} onChange={e => setCaju(e.target.value)} className="w-full p-3 bg-white border border-pink-200 rounded-xl font-black text-center text-pink-700" placeholder="0"/>
                      </div>
                      <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100 text-center">
                          <label className="text-[9px] font-black text-emerald-600 uppercase block mb-3">Dinheiro</label>
                          <input type="number" value={dinheiro} onChange={e => setDinheiro(e.target.value)} className="w-full p-3 bg-white border border-emerald-200 rounded-xl font-black text-center text-emerald-700" placeholder="0"/>
                      </div>
                      <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100 text-center">
                          <label className="text-[9px] font-black text-blue-600 uppercase block mb-3">Produto</label>
                          <input type="number" value={produto} onChange={e => setProduto(e.target.value)} className="w-full p-3 bg-white border border-blue-200 rounded-xl font-black text-center text-blue-700" placeholder="0"/>
                      </div>
                  </div>
              </div>

              <Button type="submit" fullWidth isLoading={isSaving} disabled={!selectedClientId || totalInvestment === 0 || valOrder === 0} className="h-16 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/30">
                {msg || 'Enviar Campanha para Análise'}
              </Button>
          </form>
      </div>
    </div>
  );
};
