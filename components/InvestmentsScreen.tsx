
import React, { useState, useEffect } from 'react';
import { Wallet, PieChart, Clock, CheckCircle2, XCircle, AlertTriangle, MessageSquare, Info, History, X, ChevronRight, DollarSign, Package, Banknote, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export const InvestmentsScreen: React.FC = () => {
  const [investments, setInvestments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInv, setSelectedInv] = useState<any | null>(null);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  useEffect(() => {
    if (userId) {
      fetchInvestments();
    }
  }, [userId]);

  const fetchInvestments = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('investimentos')
      .select('*, clientes(nome_fantasia)')
      .eq('usuario_id', userId)
      .order('criado_em', { ascending: false });
    
    const results = data || [];
    setInvestments(results);
    setIsLoading(false);

    // Limpa o alerta (pontinho vermelho) salvando os IDs recusados no localStorage
    const rejectedIds = results.filter(i => i.status === 'rejected').map(i => i.id);
    if (rejectedIds.length > 0) {
        const seenIds = JSON.parse(localStorage.getItem('pcn_seen_inv_rejections') || '[]');
        const updatedSeenIds = Array.from(new Set([...seenIds, ...rejectedIds]));
        localStorage.setItem('pcn_seen_inv_rejections', JSON.stringify(updatedSeenIds));
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20">
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-600" /> Extrato de Campanhas
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Controle de Investimentos Comerciais</p>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
             <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
             <p className="text-[10px] font-black uppercase tracking-widest text-center">Sincronizando faturamentos e verbas...</p>
          </div>
        ) : investments.length === 0 ? (
          <div className="bg-white rounded-[32px] p-20 text-center border border-dashed border-slate-200">
            <PieChart className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhum investimento registrado.</p>
          </div>
        ) : (
          investments.map(inv => (
            <div 
              key={inv.id} 
              onClick={() => setSelectedInv(inv)}
              className={`bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 group transition-all cursor-pointer hover:border-blue-500 hover:shadow-xl ${inv.status === 'rejected' ? 'border-red-100 bg-red-50/5' : ''}`}
            >
               <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(inv.data).toLocaleDateString('pt-BR')}</span>
                      {inv.status === 'rejected' && <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>}
                  </div>
                  <h3 className="font-black text-slate-800 uppercase text-md truncate group-hover:text-blue-600 transition-colors">{inv.clientes?.nome_fantasia}</h3>
                  <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg text-[10px] font-black text-slate-600">
                         {inv.valor_caju > 0 && <span className="text-pink-500">Caju</span>}
                         {inv.valor_dinheiro > 0 && <span className="text-emerald-500 mx-1">Dinheiro</span>}
                         {inv.valor_produto > 0 && <span className="text-blue-500">Produto</span>}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold italic truncate max-w-[300px]">{inv.observacao}</p>
                  </div>
               </div>

               <div className="text-right flex flex-col items-end min-w-[150px]">
                  <p className="text-2xl font-black text-slate-900 leading-none tabular-nums">{formatCurrency(inv.valor_total_investimento)}</p>
                  <div className={`mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    inv.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                    inv.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 
                    'bg-amber-50 text-amber-700 border-amber-100'
                  }`}>
                    {inv.status === 'approved' ? <CheckCircle2 className="w-3 h-3" /> : 
                     inv.status === 'rejected' ? <XCircle className="w-3 h-3" /> : 
                     <Clock className="w-3 h-3" />}
                    {inv.status === 'pendente' ? 'EM ANÁLISE' : inv.status === 'approved' ? 'AUTORIZADO' : 'RECUSADO'}
                  </div>
               </div>
               <div className="hidden md:block">
                  <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-blue-500 transition-all" />
               </div>
            </div>
          ))
        )}
      </div>

      {selectedInv && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-slideUp">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{selectedInv.clientes?.nome_fantasia}</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Resumo da Campanha</p>
                    </div>
                    <button onClick={() => setSelectedInv(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p>
                            <div className="flex items-center gap-2">
                                {selectedInv.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : selectedInv.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-500" /> : <Clock className="w-4 h-4 text-amber-500" />}
                                <p className={`font-black uppercase text-[10px] ${selectedInv.status === 'approved' ? 'text-emerald-600' : selectedInv.status === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>
                                    {selectedInv.status === 'pendente' ? 'Em Análise' : selectedInv.status === 'approved' ? 'Autorizado' : 'Recusado'}
                                </p>
                            </div>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-2xl text-right">
                            <p className="text-[9px] font-black text-blue-400 uppercase mb-1">Total</p>
                            <p className="text-lg font-black text-white">{formatCurrency(selectedInv.valor_total_investimento)}</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {selectedInv.valor_caju > 0 && (
                            <div className="flex-1 p-3 bg-pink-50 border border-pink-100 rounded-xl text-center">
                                <p className="text-[8px] font-black text-pink-400 uppercase mb-1">Caju</p>
                                <p className="text-xs font-black text-pink-700">{formatCurrency(selectedInv.valor_caju)}</p>
                            </div>
                        )}
                        {selectedInv.valor_dinheiro > 0 && (
                            <div className="flex-1 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                                <p className="text-[8px] font-black text-emerald-400 uppercase mb-1">Cash</p>
                                <p className="text-xs font-black text-emerald-700">{formatCurrency(selectedInv.valor_dinheiro)}</p>
                            </div>
                        )}
                        {selectedInv.valor_produto > 0 && (
                            <div className="flex-1 p-3 bg-blue-50 border border-blue-100 rounded-xl text-center">
                                <p className="text-[8px] font-black text-blue-400 uppercase mb-1">Produto</p>
                                <p className="text-xs font-black text-blue-700">{formatCurrency(selectedInv.valor_produto)}</p>
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5"><MessageSquare className="w-3 h-3"/> Descrição</p>
                         <p className="text-xs font-medium text-slate-700 leading-relaxed italic">"{selectedInv.observacao}"</p>
                    </div>

                    {selectedInv.status === 'rejected' && (
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 ring-1 ring-red-200">
                            <p className="text-[9px] font-black text-red-600 uppercase mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/> Aviso</p>
                            <p className="text-xs font-black text-red-800 leading-relaxed">Verba não autorizada pelo gestor.</p>
                        </div>
                    )}
                </div>
                
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <Button onClick={() => setSelectedInv(null)} variant="outline" className="rounded-xl px-8 font-black uppercase text-[10px]">Fechar</Button>
                </div>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};
