
import React, { useState, useMemo } from 'react';
import { Wallet, PieChart, Clock, CheckCircle2, XCircle, AlertTriangle, TrendingUp, History, X, ChevronRight, DollarSign, Users, Target, CalendarDays, ArrowUpRight, BarChart3, Info } from 'lucide-react';
import { totalDataStore } from '../lib/dataStore';
import { createPortal } from 'react-dom';
import { Button } from './Button';

export const InvestmentsScreen: React.FC = () => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedInv, setSelectedInv] = useState<any | null>(null);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  // --- MOTOR DE INTELIGÊNCIA FINANCEIRA ---
  const financialData = useMemo(() => {
    // 1. Meta Anual e Teto de Verba (5%)
    const annualTarget = totalDataStore.targets
      .filter(t => t.usuario_id === userId && t.ano === selectedYear)
      .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
    
    const totalBudget = annualTarget * 0.05;

    // 2. Investimentos do Ano (Aprovados e Geral)
    const yearInvs = totalDataStore.investments.filter(inv => {
        const d = new Date(inv.data + 'T00:00:00');
        return inv.usuario_id === userId && d.getUTCFullYear() === selectedYear;
    });

    const approvedInvs = yearInvs.filter(i => i.status === 'approved');
    const totalSpent = approvedInvs.reduce((acc, curr) => acc + (Number(curr.valor_total_investimento) || 0), 0);
    
    const remainingBalance = totalBudget - totalSpent;
    const consumptionPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    // 3. Agrupamento por Cliente
    const clientMap = new Map<string, any>();
    const clientsLookup = new Map(totalDataStore.clients.map(c => [c.id, c.nome_fantasia]));

    approvedInvs.forEach(inv => {
        const cId = inv.cliente_id;
        const cName = clientsLookup.get(cId) || "Cliente não Identificado";
        const current = clientMap.get(cId) || { name: cName, total: 0, count: 0 };
        
        clientMap.set(cId, {
            ...current,
            total: current.total + Number(inv.valor_total_investimento),
            count: current.count + 1
        });
    });

    const clientUsage = Array.from(clientMap.values())
        .sort((a, b) => b.total - a.total)
        .map(c => ({
            ...c,
            shareOfBudget: totalBudget > 0 ? (c.total / totalBudget) * 100 : 0
        }));

    return {
        totalBudget,
        totalSpent,
        remainingBalance,
        consumptionPct,
        clientUsage,
        allYearInvs: yearInvs.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
    };
  }, [userId, selectedYear]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fadeIn pb-24">
      {/* Header e Filtro */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Gestão de Verba Comercial</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-blue-600" /> Teto de Investimento: 5.0% sobre a Meta
          </p>
        </div>
        <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <CalendarDays className="w-4 h-4" />
            </div>
            <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer transition-all"
            >
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>ANO {y}</option>)}
            </select>
        </div>
      </div>

      {/* Cartões de KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Target className="w-16 h-16 text-slate-900" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Verba Disponível (Ano)</p>
              <h3 className="text-2xl font-black text-slate-900">{formatCurrency(financialData.totalBudget)}</h3>
              <p className="text-[9px] font-bold text-slate-400 mt-4 uppercase">Baseado na sua meta anual</p>
          </div>

          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="w-16 h-16 text-blue-600" /></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Consumido</p>
              <h3 className="text-2xl font-black text-blue-600">{formatCurrency(financialData.totalSpent)}</h3>
              <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] font-black text-blue-600 uppercase">{financialData.consumptionPct.toFixed(1)}% do Teto</span>
                  <div className="flex-1 max-w-[100px] h-1.5 bg-slate-100 rounded-full ml-3 overflow-hidden">
                      <div className="h-full bg-blue-600" style={{ width: `${Math.min(financialData.consumptionPct, 100)}%` }}></div>
                  </div>
              </div>
          </div>

          <div className={`p-6 rounded-[32px] shadow-xl relative overflow-hidden transition-all ${financialData.remainingBalance >= 0 ? 'bg-slate-900 text-white' : 'bg-red-600 text-white'}`}>
              <div className="absolute bottom-0 right-0 p-4 opacity-10"><Wallet className="w-20 h-20" /></div>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Saldo Atual</p>
              <h3 className="text-2xl font-black tabular-nums">{formatCurrency(financialData.remainingBalance)}</h3>
              <p className="text-[9px] font-black uppercase mt-4 tracking-widest opacity-60">
                  {financialData.remainingBalance >= 0 ? 'Saldo Positivo para Ações' : 'Atenção: Limite Excedido'}
              </p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tabela de Consumo por Cliente */}
          <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Utilização por Cliente</h3>
              </div>
              <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <tr>
                              <th className="px-6 py-4">Cliente</th>
                              <th className="px-6 py-4 text-right">Valor Usado</th>
                              <th className="px-6 py-4 text-right">% da Verba</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {financialData.clientUsage.length === 0 ? (
                              <tr>
                                  <td colSpan={3} className="px-6 py-12 text-center text-slate-300">
                                      <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                      <p className="text-[10px] font-black uppercase">Nenhum investimento aprovado neste ano</p>
                                  </td>
                              </tr>
                          ) : (
                              financialData.clientUsage.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-6 py-4">
                                          <p className="font-black text-slate-800 uppercase text-[11px] truncate max-w-[200px]">{item.name}</p>
                                          <p className="text-[9px] text-slate-400 font-bold uppercase">{item.count} Ações no ano</p>
                                      </td>
                                      <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{formatCurrency(item.total)}</td>
                                      <td className="px-6 py-4 text-right">
                                          <div className="flex flex-col items-end gap-1">
                                              <span className="text-[10px] font-black text-blue-600">{item.shareOfBudget.toFixed(1)}%</span>
                                              <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                  <div className="h-full bg-blue-600" style={{ width: `${Math.min(item.shareOfBudget, 100)}%` }}></div>
                                              </div>
                                          </div>
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </div>

          {/* Extrato Detalhado */}
          <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                  <History className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Extrato de Solicitações</h3>
              </div>
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {financialData.allYearInvs.length === 0 ? (
                      <div className="bg-white rounded-[32px] p-20 text-center border border-dashed border-slate-200">
                        <PieChart className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                        <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">Sem movimentações em {selectedYear}</p>
                      </div>
                  ) : (
                    financialData.allYearInvs.map(inv => (
                        <div 
                          key={inv.id} 
                          onClick={() => setSelectedInv(inv)}
                          className={`bg-white p-5 rounded-[28px] border border-slate-200 shadow-sm flex items-center justify-between group transition-all cursor-pointer hover:border-blue-500 ${inv.status === 'rejected' ? 'opacity-70' : ''}`}
                        >
                           <div className="min-w-0">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                                {new Date(inv.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                              </span>
                              <h4 className="font-black text-slate-800 uppercase text-[11px] truncate group-hover:text-blue-600 transition-colors">{inv.clientes?.nome_fantasia}</h4>
                              <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter border ${
                                inv.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                inv.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 
                                'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {inv.status === 'approved' ? 'Aprovado' : inv.status === 'rejected' ? 'Recusado' : 'Em Análise'}
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-sm font-black text-slate-900 tabular-nums">{formatCurrency(inv.valor_total_investimento)}</p>
                              <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-blue-500 ml-auto mt-1 transition-all" />
                           </div>
                        </div>
                    ))
                  )}
              </div>
          </div>
      </div>

      {/* Modal de Detalhe da Solicitação (Mesma lógica do original) */}
      {selectedInv && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-slideUp">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{selectedInv.clientes?.nome_fantasia}</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Detalhes da Ação</p>
                    </div>
                    <button onClick={() => setSelectedInv(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Status</p>
                            <p className={`font-black uppercase text-[10px] ${selectedInv.status === 'approved' ? 'text-emerald-600' : selectedInv.status === 'rejected' ? 'text-red-600' : 'text-amber-600'}`}>
                                {selectedInv.status === 'pendente' ? 'Em Análise' : selectedInv.status === 'approved' ? 'Autorizado' : 'Recusado'}
                            </p>
                        </div>
                        <div className="bg-slate-900 p-4 rounded-2xl text-right">
                            <p className="text-[9px] font-black text-blue-400 uppercase mb-1">Total</p>
                            <p className="text-lg font-black text-white">{formatCurrency(selectedInv.valor_total_investimento)}</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {selectedInv.valor_caju > 0 && <div className="flex-1 p-3 bg-pink-50 border border-pink-100 rounded-xl text-center"><p className="text-[8px] font-black text-pink-400 uppercase mb-1">Caju</p><p className="text-xs font-black text-pink-700">{formatCurrency(selectedInv.valor_caju)}</p></div>}
                        {selectedInv.valor_dinheiro > 0 && <div className="flex-1 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center"><p className="text-[8px] font-black text-emerald-400 uppercase mb-1">Cash</p><p className="text-xs font-black text-emerald-700">{formatCurrency(selectedInv.valor_dinheiro)}</p></div>}
                        {selectedInv.valor_produto > 0 && <div className="flex-1 p-3 bg-blue-50 border border-blue-100 rounded-xl text-center"><p className="text-[8px] font-black text-blue-400 uppercase mb-1">Produto</p><p className="text-xs font-black text-blue-700">{formatCurrency(selectedInv.valor_produto)}</p></div>}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                         <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5"><History className="w-3 h-3"/> Descrição da Campanha</p>
                         <p className="text-xs font-medium text-slate-700 leading-relaxed italic">"{(selectedInv.observacao || '').replace(/\[PEDIDO:.*?\]\s*/, '').replace(/\[RECUSADO:.*?\]\s*/, '')}"</p>
                    </div>

                    {selectedInv.status === 'rejected' && (
                        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 ring-1 ring-red-200">
                            <p className="text-[9px] font-black text-red-600 uppercase mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/> Motivo da Recusa</p>
                            <p className="text-xs font-black text-red-800 leading-relaxed italic">
                                {selectedInv.observacao.match(/\[RECUSADO:\s*(.*?)\]/)?.[1] || 'Verba não autorizada pelo gestor regional.'}
                            </p>
                        </div>
                    )}
                </div>
                
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <Button onClick={() => setSelectedInv(null)} variant="outline" className="rounded-xl px-8 font-black uppercase text-[10px]">Fechar Resumo</Button>
                </div>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};
