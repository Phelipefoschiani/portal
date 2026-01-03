
import React, { useState, useEffect } from 'react';
import { Megaphone, Save, CheckCircle2, TrendingUp, DollarSign, Percent, AlertCircle, Clock, XCircle, ChevronRight, History, Edit3, RefreshCw, Search, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../lib/supabase';

export const CampaignsScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [clients, setClients] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Form States (Strings para máscara)
  const [selectedClientId, setSelectedClientId] = useState('');
  const [description, setDescription] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [caju, setCaju] = useState('');
  const [dinheiro, setDinheiro] = useState('');
  const [produto, setProduto] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  useEffect(() => {
    if (userId) {
      fetchClients();
      if (activeTab === 'history') fetchHistory();
    }
  }, [userId, activeTab]);

  const fetchClients = async () => {
    const { data } = await supabase.from('clientes').select('id, nome_fantasia').eq('usuario_id', userId).order('nome_fantasia');
    setClients(data || []);
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    const { data } = await supabase
      .from('investimentos')
      .select('*, clientes(nome_fantasia)')
      .eq('usuario_id', userId)
      .order('criado_em', { ascending: false });
    setHistory(data || []);
    setIsLoadingHistory(false);
  };

  // --- Lógica de Máscara ---
  const formatCurrencyInput = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const numberValue = Number(cleanValue) / 100;
    return numberValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseToNumber = (formattedValue: string) => {
    if (!formattedValue) return 0;
    return Number(formattedValue.replace(/\./g, '').replace(',', '.'));
  };

  const handleInputChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(formatCurrencyInput(e.target.value));
  };

  const valOrder = parseToNumber(orderValue);
  const valCaju = parseToNumber(caju);
  const valDinheiro = parseToNumber(dinheiro);
  const valProduto = parseToNumber(produto);
  const totalInvestment = valCaju + valDinheiro + valProduto;
  const investmentPercent = valOrder > 0 ? (totalInvestment / valOrder) * 100 : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || totalInvestment === 0 || valOrder === 0) return;
    
    setIsSaving(true);
    try {
      const payload = {
        usuario_id: userId,
        cliente_id: selectedClientId,
        data: new Date().toISOString().split('T')[0],
        valor_total_investimento: totalInvestment,
        valor_caju: valCaju,
        valor_dinheiro: valDinheiro,
        valor_produto: valProduto,
        // Armazenamos o valor do pedido de forma estruturada no início da observação
        observacao: `[PEDIDO: R$ ${orderValue}] ${description}`,
        status: 'pendente'
      };

      if (editingId) {
        // Se estiver editando uma recusada, atualizamos a existente
        await supabase.from('investimentos').update(payload).eq('id', editingId);
      } else {
        await supabase.from('investimentos').insert(payload);
      }

      alert(editingId ? 'Solicitação revisada e reenviada!' : 'Solicitação enviada com sucesso!');
      
      // Limpar campos
      setSelectedClientId('');
      setDescription('');
      setOrderValue('');
      setCaju('');
      setDinheiro('');
      setProduto('');
      setEditingId(null);
      setActiveTab('history');
    } catch (err: any) {
        alert('Erro ao enviar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRejected = (inv: any) => {
    const obs = inv.observacao || '';
    setSelectedClientId(inv.cliente_id);
    
    // Tenta extrair a descrição limpa removendo prefixos
    const cleanDesc = obs.replace(/\[PEDIDO:.*?\]\s*/, '').replace(/\[RECUSADO:.*?\]\s*/, '');
    setDescription(cleanDesc);
    
    // Tenta extrair o valor do pedido da observação
    const orderMatch = obs.match(/\[PEDIDO:\s*R\$\s*(.*?)\]/);
    setOrderValue(orderMatch ? orderMatch[1] : (inv.valor_total_investimento * 10).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    
    setCaju((inv.valor_caju || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setDinheiro((inv.valor_dinheiro || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setProduto((inv.valor_produto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    
    setEditingId(inv.id);
    setActiveTab('new');
  };

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20">
      {/* Navegação por Abas */}
      <div className="flex justify-center mb-8">
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex gap-1">
          <button 
            onClick={() => { setActiveTab('new'); setEditingId(null); }} 
            className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'new' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {editingId ? 'Revisar Solicitação' : 'Nova Campanha'}
          </button>
          <button 
            onClick={() => setActiveTab('history')} 
            className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Minhas Solicitações
          </button>
        </div>
      </div>

      {activeTab === 'new' ? (
        <>
          <div className="bg-slate-900 p-8 rounded-[32px] text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 border-b-4 border-blue-600">
              <div className="absolute top-0 right-0 p-8 opacity-5"><TrendingUp className="w-32 h-32" /></div>
              <div className="text-center md:text-left">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Investimento Solicitado</p>
                  <p className="text-4xl font-black text-white tabular-nums">{formatBRL(totalInvestment)}</p>
              </div>
              <div className="flex-1 max-w-xs w-full">
                  <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Peso no Pedido</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${investmentPercent > 7 ? 'bg-red-500' : 'bg-emerald-500'}`}>
                          {investmentPercent.toFixed(2)}%
                      </span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${investmentPercent > 7 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(investmentPercent * 10, 100)}%` }}></div>
                  </div>
              </div>
          </div>

          <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
              <form onSubmit={handleSave} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-[0.2em]">Cliente Alvo</label>
                          <select 
                            value={selectedClientId} 
                            onChange={e => setSelectedClientId(e.target.value)} 
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-[20px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 transition-all" 
                            required
                          >
                              <option value="">Buscar na carteira...</option>
                              {clients.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia}</option>)}
                          </select>
                      </div>

                      <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-[0.2em]">Valor Total do Pedido (R$)</label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                            <input 
                              type="text" 
                              value={orderValue} 
                              onChange={handleInputChange(setOrderValue)} 
                              className="w-full p-4 pl-12 bg-slate-50 border border-slate-200 rounded-[20px] font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-100 transition-all tabular-nums" 
                              placeholder="0,00" 
                              required 
                            />
                          </div>
                      </div>

                      <div className="md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-[0.2em]">Justificativa e Detalhes da Ação</label>
                          <textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[24px] font-medium text-slate-600 outline-none focus:ring-4 focus:ring-blue-100 transition-all" 
                            rows={3} 
                            required 
                            placeholder="Descreva como essa verba ajudará no fechamento do pedido..."
                          ></textarea>
                      </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-6 tracking-[0.2em]">Distribuição do Investimento</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="p-6 bg-pink-50/50 rounded-3xl border border-pink-100">
                              <label className="text-[9px] font-black text-pink-600 uppercase block mb-3 text-center">Verba Caju</label>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  value={caju} 
                                  onChange={handleInputChange(setCaju)} 
                                  className="w-full p-3 bg-white border border-pink-200 rounded-xl font-black text-center text-pink-700 outline-none focus:ring-2 focus:ring-pink-300" 
                                  placeholder="0,00"
                                />
                              </div>
                          </div>
                          <div className="p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100">
                              <label className="text-[9px] font-black text-emerald-600 uppercase block mb-3 text-center">Dinheiro (Cash)</label>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  value={dinheiro} 
                                  onChange={handleInputChange(setDinheiro)} 
                                  className="w-full p-3 bg-white border border-emerald-200 rounded-xl font-black text-center text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-300" 
                                  placeholder="0,00"
                                />
                              </div>
                          </div>
                          <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                              <label className="text-[9px] font-black text-blue-600 uppercase block mb-3 text-center">Bonificação Produto</label>
                              <div className="relative">
                                <input 
                                  type="text" 
                                  value={produto} 
                                  onChange={handleInputChange(setProduto)} 
                                  className="w-full p-3 bg-white border border-blue-200 rounded-xl font-black text-center text-blue-700 outline-none focus:ring-2 focus:ring-blue-300" 
                                  placeholder="0,00"
                                />
                              </div>
                          </div>
                      </div>
                  </div>

                  <Button 
                    type="submit" 
                    fullWidth 
                    isLoading={isSaving} 
                    disabled={!selectedClientId || totalInvestment === 0 || valOrder === 0} 
                    className="h-16 rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/30"
                  >
                    {editingId ? 'Confirmar Revisão e Reenviar' : 'Enviar Solicitação para o Gerente'}
                  </Button>
              </form>
          </div>
        </>
      ) : (
        <div className="space-y-4">
            {isLoadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Carregando histórico...</p>
                </div>
            ) : history.length === 0 ? (
                <div className="bg-white rounded-[32px] p-20 text-center border border-dashed border-slate-200">
                    <History className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhuma campanha registrada.</p>
                </div>
            ) : (
                history.map(inv => {
                    const obs = inv.observacao || '';
                    const orderMatch = obs.match(/\[PEDIDO:\s*R\$\s*(.*?)\]/);
                    const pedidoValue = orderMatch ? orderMatch[1] : 'N/I';
                    const cleanObs = obs.replace(/\[PEDIDO:.*?\]\s*/, '').replace(/\[RECUSADO:.*?\]\s*/, '');

                    return (
                        <div key={inv.id} className={`bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 group transition-all`}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(inv.criado_em).toLocaleDateString('pt-BR')}</span>
                                    {inv.status === 'rejected' && <span className="px-2 py-0.5 rounded bg-red-50 text-red-500 text-[8px] font-black uppercase">Recusada</span>}
                                </div>
                                <h3 className="font-black text-slate-800 uppercase text-md truncate">{inv.clientes?.nome_fantasia}</h3>
                                <p className="text-[10px] text-slate-400 font-bold italic mt-1 line-clamp-1">"{cleanObs || 'Campanha comercial'}"</p>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedido</p>
                                    <p className="text-sm font-black text-slate-700">R$ {pedidoValue}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Investimento</p>
                                    <p className="text-sm font-black text-blue-600">{formatBRL(inv.valor_total_investimento)}</p>
                                </div>
                                <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                    inv.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                    inv.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 
                                    'bg-amber-50 text-amber-700 border-amber-100'
                                }`}>
                                    {inv.status === 'approved' ? 'Aprovado' : inv.status === 'rejected' ? 'Recusado' : 'Pendente'}
                                </div>
                                
                                {inv.status === 'rejected' && (
                                    <button 
                                        onClick={() => handleEditRejected(inv)}
                                        className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                                        title="Corrigir e Reenviar"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
      )}
    </div>
  );
};
