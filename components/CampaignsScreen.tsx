import React, { useState, useEffect } from 'react';
import { Megaphone, Save, CheckCircle2, TrendingUp, DollarSign, Percent, AlertCircle, Clock, XCircle, ChevronRight, History, Edit3, RefreshCw, Search, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../lib/supabase';

interface CampaignsScreenProps {
  onNavigateToInvestments?: () => void;
}

export const CampaignsScreen: React.FC<CampaignsScreenProps> = ({ onNavigateToInvestments }) => {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [clients, setClients] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Form States (Strings para máscara)
  const [selectedClientId, setSelectedClientId] = useState('');
  const [description, setDescription] = useState('');
  const [orderValue, setOrderValue] = useState('');
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
  const valDinheiro = parseToNumber(dinheiro);
  const valProduto = parseToNumber(produto);
  const totalInvestment = valDinheiro + valProduto;
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
        valor_caju: 0, 
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

              <div className="flex flex-col items-center md:items-end gap-2">
                  <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-sm">
                      <Percent className="w-5 h-5 text-blue-400" />
                      <div>
                          <p className={`text-xl font-black tabular-nums ${investmentPercent > 7 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {investmentPercent.toFixed(1)}%
                          </p>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Comprometimento ROI</p>
                      </div>
                  </div>
                  {investmentPercent > 7 && (
                    <div className="flex items-center gap-2 text-[9px] font-black text-red-400 uppercase animate-pulse">
                        <AlertCircle className="w-3 h-3" /> Requer Justificativa Forte
                    </div>
                  )}
              </div>
          </div>

          <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 space-y-6">
                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Selecione o Cliente</label>
                            <select 
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                required
                                className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                            >
                                <option value="">Buscar cliente...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor do Pedido Gerado</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                                <input 
                                    type="text"
                                    value={orderValue}
                                    onChange={handleInputChange(setOrderValue)}
                                    placeholder="0,00"
                                    required
                                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 text-sm font-black text-slate-900 outline-none focus:ring-4 focus:ring-blue-100 transition-all tabular-nums"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Justificativa da Ação</label>
                        <textarea 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            required
                            placeholder="Descreva o objetivo da campanha, produtos foco e expectativa de retorno..."
                            className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[24px] text-sm font-medium text-slate-600 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 ml-1">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Distribuição do Investimento</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:border-emerald-200 transition-all">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-3 text-center tracking-widest">Dinheiro (Cash)</p>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-bold">R$</span>
                                    <input 
                                        type="text"
                                        value={dinheiro}
                                        onChange={handleInputChange(setDinheiro)}
                                        placeholder="0,00"
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-sm font-black text-emerald-600 text-center outline-none focus:ring-2 focus:ring-emerald-100 tabular-nums"
                                    />
                                </div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 group hover:border-blue-200 transition-all">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-3 text-center tracking-widest">Bonificação Produto</p>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600 font-bold">R$</span>
                                    <input 
                                        type="text"
                                        value={produto}
                                        onChange={handleInputChange(setProduto)}
                                        placeholder="0,00"
                                        className="w-full h-12 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-sm font-black text-blue-600 text-center outline-none focus:ring-2 focus:ring-blue-100 tabular-nums"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" /> Resumo Estratégico
                    </h3>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                            <span>Venda Projetada</span>
                            <span className="text-slate-900">{formatBRL(valOrder)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                            <span>Invest. Total</span>
                            <span className="text-blue-600 font-black">{formatBRL(totalInvestment)}</span>
                        </div>
                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Percentual ROI</span>
                            <span className={`text-xl font-black ${investmentPercent > 7 ? 'text-red-600' : 'text-emerald-600'}`}>{investmentPercent.toFixed(2)}%</span>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                        <p className="text-[9px] font-bold text-blue-700 leading-relaxed uppercase">
                           Dica: Campanhas com investimento acima de 7% do valor do pedido requerem validação detalhada do gestor.
                        </p>
                    </div>

                    <Button 
                        type="submit" 
                        fullWidth 
                        isLoading={isSaving}
                        disabled={totalInvestment === 0 || !selectedClientId || valOrder === 0}
                        className="h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-blue-500/20"
                    >
                        <Save className="w-4 h-4 mr-2" /> {editingId ? 'Reenviar para Aprovação' : 'Solicitar Verba'}
                    </Button>
                </div>
                <button 
                  type="button"
                  onClick={onNavigateToInvestments}
                  className="w-full bg-slate-900 text-white p-5 rounded-[28px] font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all flex items-center justify-between group shadow-xl"
                >
                    <span>Ver Meu Saldo de Verba</span>
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
            </div>
          </form>
        </>
      ) : (
        <div className="space-y-4 animate-slideUp">
           <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <History className="w-6 h-6 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Status das Solicitações</h3>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{history.length} campanhas registradas</p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoadingHistory ? (
                  <div className="col-span-full py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" /></div>
              ) : history.length === 0 ? (
                  <div className="col-span-full bg-white rounded-[32px] p-24 text-center border-2 border-dashed border-slate-100">
                      <Megaphone className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                      <p className="text-slate-300 font-bold uppercase text-xs tracking-widest italic">Nenhuma solicitação enviada ainda</p>
                  </div>
              ) : (
                  history.map(inv => {
                    const obs = inv.observacao || '';
                    // Extração de dados da observação formatada
                    const orderMatch = obs.match(/\[PEDIDO:\s*R\$\s*(.*?)\]/);
                    const pedidoValue = orderMatch ? orderMatch[1] : 'N/I';
                    const cleanObs = obs.replace(/\[PEDIDO:.*?\]\s*/, '').replace(/\[RECUSADO:.*?\]\s*/, '');
                    
                    const isRejected = inv.status === 'rejected';

                    return (
                        <div key={inv.id} className={`bg-white p-6 rounded-[32px] border shadow-sm transition-all group ${isRejected ? 'border-red-200 ring-4 ring-red-50' : 'border-slate-200 hover:border-blue-500'}`}>
                            <div className="flex justify-between items-start mb-6">
                                <div className="min-w-0">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{new Date(inv.data).toLocaleDateString('pt-BR')}</p>
                                    <h4 className="font-black text-slate-800 uppercase text-xs truncate group-hover:text-blue-600 transition-colors">{inv.clientes?.nome_fantasia}</h4>
                                </div>
                                <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase shadow-sm ${
                                    inv.status === 'approved' ? 'bg-emerald-600 text-white' : 
                                    inv.status === 'rejected' ? 'bg-red-600 text-white' : 
                                    'bg-slate-900 text-white'
                                }`}>
                                    {inv.status === 'approved' ? 'Aprovado' : inv.status === 'rejected' ? 'Recusado' : 'Em Análise'}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Faturado</p>
                                        <p className="text-xs font-black text-slate-800">R$ {pedidoValue}</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Verba</p>
                                        <p className="text-xs font-black text-blue-600">{formatBRL(inv.valor_total_investimento)}</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-2">Justificativa</p>
                                    <p className="text-[10px] text-slate-500 italic line-clamp-2 leading-relaxed">"{cleanObs || 'Sem descrição adicional'}"</p>
                                </div>

                                {isRejected && (
                                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100 animate-fadeIn">
                                        <p className="text-[8px] font-black text-red-600 uppercase mb-2 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> Motivo da Recusa</p>
                                        <p className="text-[10px] text-red-800 font-bold italic mb-4 leading-relaxed">
                                            "{obs.match(/\[RECUSADO:\s*(.*?)\]/)?.[1] || 'Por favor, revise o ROI e as bonificações sugeridas.'}"
                                        </p>
                                        <button 
                                            onClick={() => handleEditRejected(inv)}
                                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-200"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" /> Corrigir e Reenviar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                  })
              )}
           </div>
        </div>
      )}
    </div>
  );
};