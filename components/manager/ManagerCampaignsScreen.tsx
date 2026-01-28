import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Loader2, Quote, X, History, TrendingUp, Calendar, Info, MessageCircleQuestion, Filter, DollarSign, Wallet, ArrowUpRight, BarChart3, ChevronDown, PieChart, Target, AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import { createPortal } from 'react-dom';
import { totalDataStore } from '../../lib/dataStore';

export const ManagerCampaignsScreen: React.FC = () => {
    const now = new Date();
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
    const [subTab, setSubTab] = useState<'approved' | 'rejected'>('approved');
    const [investments, setInvestments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    
    const [filterYear, setFilterYear] = useState<number>(now.getFullYear());
    const [filterMonth, setFilterMonth] = useState<number | 'all'>(now.getMonth() + 1);
    
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    const monthsNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    useEffect(() => {
        fetchInvestments();
    }, [viewMode, subTab, filterYear, filterMonth]);

    const fetchInvestments = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('investimentos')
                .select('*, clientes(*), usuarios(id, nome)')
                .order('criado_em', { ascending: false });

            if (viewMode === 'pending') {
                query = query.eq('status', 'pendente');
            } else {
                query = query.eq('status', subTab);
                query = query.gte('data', `${filterYear}-01-01`).lte('data', `${filterYear}-12-31`);
                if (filterMonth !== 'all') {
                    const monthStr = String(filterMonth).padStart(2, '0');
                    query = query.gte('data', `${filterYear}-${monthStr}-01`).lte('data', `${filterYear}-${monthStr}-31`);
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            setInvestments(data || []);
        } catch (error) {
            console.error('Erro ao buscar investimentos:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const teamStats = useMemo(() => {
        if (viewMode !== 'history') return [];
        const reps = totalDataStore.users;
        const targets = totalDataStore.targets;
        const allInvs = totalDataStore.investments;
        return reps.map(rep => {
            const annualTarget = targets.filter(t => t.usuario_id === rep.id && t.ano === filterYear).reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
            const investmentPool = annualTarget * 0.05;
            const annualSpent = allInvs.filter(inv => {
                const d = new Date(inv.data + 'T00:00:00');
                return inv.usuario_id === rep.id && d.getUTCFullYear() === filterYear && inv.status === 'approved';
            }).reduce((acc, curr) => acc + (Number(curr.valor_total_investimento) || 0), 0);
            const remaining = investmentPool - annualSpent;
            const consumptionPct = investmentPool > 0 ? (annualSpent / investmentPool) * 100 : 0;
            return { repId: rep.id, nome: rep.nome, metaAnual: annualTarget, verbaTotal: investmentPool, gastoAnual: annualSpent, saldo: remaining, consumoPct: consumptionPct };
        }).sort((a, b) => b.metaAnual - a.metaAnual);
    }, [viewMode, filterYear, investments]);

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
        if (isActionLoading || !selectedDetail) return;
        
        if (status === 'rejected' && !rejectionReason.trim()) {
            alert('Por favor, informe o motivo da recusa.');
            return;
        }

        setIsActionLoading(true);
        try {
            const currentObs = selectedDetail.observacao || '';
            const cleanObs = currentObs.replace(/\[RECUSADO:.*?\]\s*/, '');
            const finalObs = status === 'rejected' ? `[RECUSADO: ${rejectionReason.toUpperCase()}] ${cleanObs}` : cleanObs;

            const { error } = await supabase
                .from('investimentos')
                .update({ status, observacao: finalObs.trim() })
                .eq('id', id);

            if (error) throw error;

            if (status === 'approved') {
                totalDataStore.investments = [...totalDataStore.investments, { ...selectedDetail, status: 'approved' }];
            }

            setInvestments(prev => prev.filter(i => i.id !== id));
            setSelectedDetail(null);
            setShowRejectionModal(false);
            setRejectionReason('');
            
            alert(status === 'approved' ? 'Investimento aprovado com sucesso!' : 'Investimento recusado.');
        } catch (error: any) {
            console.error('Erro na atualização:', error);
            alert('Erro ao processar: ' + (error.message || 'Falha na conexão com o banco de dados.'));
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteInvestment = async () => {
        if (!selectedDetail || isActionLoading) return;

        setIsActionLoading(true);
        try {
            const { error } = await supabase
                .from('investimentos')
                .delete()
                .eq('id', selectedDetail.id);

            if (error) throw error;

            // Atualiza store local e lista da tela
            totalDataStore.investments = totalDataStore.investments.filter(i => i.id !== selectedDetail.id);
            setInvestments(prev => prev.filter(i => i.id !== selectedDetail.id));
            setSelectedDetail(null);
            setShowDeleteModal(false);
        } catch (error: any) {
            alert('Erro ao excluir: ' + error.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-32">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <PieChart className="w-7 h-7 text-blue-600" /> Auditoria de Campanhas
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Validação de ROI e Verbas (Teto 5% da Meta)</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-slate-100 p-1.5 rounded-2xl">
                    <button onClick={() => setViewMode('pending')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'pending' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Solicitações ({investments.length})</button>
                    <button onClick={() => setViewMode('history')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'history' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Histórico e Saldo Verba</button>
                </div>
            </div>

            {viewMode === 'history' && (
                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-8 animate-slideUp">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-6">
                        <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-blue-600" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saldo de Investimento por Representante</span>
                        </div>
                        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black uppercase outline-none">
                            <option value={2024}>Ano 2024</option>
                            <option value={2025}>Ano 2025</option>
                            <option value={2026}>Ano 2026</option>
                            <option value={2027}>Ano 2027</option>
                        </select>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <tr><th className="px-6 py-4">Vendedor</th><th className="px-6 py-4 text-right">Meta Anual</th><th className="px-6 py-4 text-right">Verba (5%)</th><th className="px-6 py-4 text-right">Consumido</th><th className="px-6 py-4 text-right">Saldo</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {teamStats.map(stat => (
                                    <tr key={stat.repId} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4"><p className="font-black text-slate-800 text-xs uppercase">{stat.nome}</p></td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-400 tabular-nums">{formatCurrency(stat.metaAnual)}</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-700 tabular-nums">{formatCurrency(stat.verbaTotal)}</td>
                                        <td className="px-6 py-4 text-right font-black text-purple-600 tabular-nums">{formatCurrency(stat.gastoAnual)}</td>
                                        <td className="px-6 py-4 text-right"><p className={`font-black tabular-nums ${stat.saldo >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(stat.saldo)}</p></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4">
                        <div className="flex gap-2">
                            <button onClick={() => setSubTab('approved')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${subTab === 'approved' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-600 border-emerald-100'}`}>Aprovadas</button>
                            <button onClick={() => setSubTab('rejected')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase border transition-all ${subTab === 'rejected' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-100'}`}>Recusadas</button>
                        </div>
                        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none">
                            <option value="all">Todos os Meses</option>{monthsNames.map((m, i) => <option key={i} value={i + 1}>{m.toUpperCase()}</option>)}
                        </select>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400"><Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-2" /><p className="text-[10px] font-black uppercase tracking-widest">Sincronizando auditoria...</p></div>
                ) : investments.length === 0 ? (
                    <div className="col-span-full bg-white rounded-[32px] p-24 text-center border border-dashed border-slate-200"><ShieldCheck className="w-16 h-16 text-slate-100 mx-auto mb-4" /><p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Nenhuma solicitação para este critério.</p></div>
                ) : (
                    investments.map(inv => {
                        const obs = inv.observacao || '';
                        const orderMatch = obs.match(/\[PEDIDO:\s*R\$\s*(.*?)\]/);
                        const pedidoValue = orderMatch ? orderMatch[1] : 'N/I';
                        const cleanObs = obs.replace(/\[PEDIDO:.*?\]\s*/, '').replace(/\[RECUSADO:.*?\]\s*/, '');
                        
                        const orderNum = Number(pedidoValue.replace(/\./g, '').replace(',', '.')) || 1;
                        const roi = (inv.valor_total_investimento / orderNum) * 100;

                        return (
                            <div key={inv.id} onClick={() => setSelectedDetail(inv)} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-xl transition-all cursor-pointer group flex flex-col h-full animate-slideUp">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2.5 py-1 rounded-lg">Rep: {inv.usuarios?.nome}</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${roi > 7 ? 'text-red-500 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>{roi.toFixed(1)}% ROI</span>
                                </div>
                                <h3 className="font-black text-slate-800 uppercase text-sm leading-tight group-hover:text-blue-600 transition-colors mb-2">{inv.clientes?.nome_fantasia}</h3>
                                <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Pedido Relacionado</p>
                                    <p className="text-md font-black text-slate-900">R$ {pedidoValue}</p>
                                </div>
                                <p className="text-[10px] text-slate-400 italic line-clamp-2 mb-6">"{cleanObs || 'Sem justificativa detalhada'}"</p>
                                
                                <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-end">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Verba Solicitada</p>
                                        <p className="text-xl font-black text-blue-600 leading-none">{formatCurrency(inv.valor_total_investimento)}</p>
                                    </div>
                                    <div className={`p-2 rounded-xl ${inv.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : inv.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {inv.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : inv.status === 'rejected' ? <XCircle className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {selectedDetail && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-slideUp">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div><h3 className="text-md font-black text-slate-900 uppercase tracking-tight">{selectedDetail.clientes?.nome_fantasia}</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Representante: {selectedDetail.usuarios?.nome}</p></div>
                            <button onClick={() => setSelectedDetail(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-900 p-5 rounded-2xl text-white">
                                    <p className="text-[9px] font-black text-blue-400 uppercase mb-1">Investimento</p>
                                    <p className="text-2xl font-black tabular-nums">{formatCurrency(selectedDetail.valor_total_investimento)}</p>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pedido Vinculado</p>
                                    <p className="text-md font-black text-slate-900">R$ {(selectedDetail.observacao || '').match(/\[PEDIDO:\s*R\$\s*(.*?)\]/)?.[1] || '---'}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {selectedDetail.valor_caju > 0 && <div className="flex-1 p-3 bg-pink-50 text-pink-700 rounded-xl text-center border border-pink-100"><p className="text-[8px] font-black uppercase">Caju</p><p className="text-xs font-black">{formatCurrency(selectedDetail.valor_caju)}</p></div>}
                                {selectedDetail.valor_dinheiro > 0 && <div className="flex-1 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-center border border-emerald-100"><p className="text-[8px] font-black uppercase">Cash</p><p className="text-xs font-black">{formatCurrency(selectedDetail.valor_dinheiro)}</p></div>}
                                {selectedDetail.valor_produto > 0 && <div className="flex-1 p-3 bg-blue-50 text-blue-700 rounded-xl text-center border border-blue-100"><p className="text-[8px] font-black uppercase">Produto</p><p className="text-xs font-black">{formatCurrency(selectedDetail.valor_produto)}</p></div>}
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 flex items-center gap-2"><Quote className="w-3 h-3"/> Justificativa do Representante</p>
                                <p className="text-sm font-medium text-slate-700 italic leading-relaxed">"{(selectedDetail.observacao || '').replace(/\[PEDIDO:.*?\]\s*/, '').replace(/\[RECUSADO:.*?\]\s*/, '') || 'Sem justificativa adicional.'}"</p>
                            </div>
                        </div>
                        
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                            {selectedDetail.status === 'pendente' ? (
                                <div className="flex gap-3">
                                    <Button variant="outline" fullWidth onClick={() => setShowRejectionModal(true)} className="bg-white text-red-600 border-red-200 h-14 rounded-2xl font-black text-xs uppercase">Negar Verba</Button>
                                    <Button fullWidth onClick={() => handleUpdateStatus(selectedDetail.id, 'approved')} className="h-14 rounded-2xl font-black text-xs uppercase shadow-xl shadow-blue-500/20">Aprovar Verba</Button>
                                </div>
                            ) : null}

                            {/* Botão de Excluir para registros no histórico */}
                            <Button 
                                variant="outline" 
                                fullWidth 
                                onClick={() => setShowDeleteModal(true)} 
                                className="h-14 rounded-2xl font-black text-xs uppercase border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50 flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> Excluir Registro
                            </Button>
                        </div>
                    </div>
                    {showRejectionModal && (
                        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
                             <div className="bg-white w-full max-w-xs rounded-[32px] p-8 shadow-2xl animate-slideUp border border-white/20">
                                <div className="text-center mb-6"><div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8" /></div><h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Recusar Campanha</h4><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Informe o motivo para o representante</p></div>
                                <textarea 
                                    value={rejectionReason} 
                                    onChange={e => setRejectionReason(e.target.value)} 
                                    placeholder="Ex: Percentual de investimento muito alto..." 
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-red-100 transition-all mb-6" 
                                    rows={3}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant="outline" onClick={() => setShowRejectionModal(false)} className="rounded-xl h-12 font-black uppercase text-[10px]">Voltar</Button>
                                    <Button onClick={() => handleUpdateStatus(selectedDetail.id, 'rejected')} isLoading={isActionLoading} className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 font-black uppercase text-[10px]">Confirmar Recusa</Button>
                                </div>
                             </div>
                        </div>
                    )}

                    {showDeleteModal && (
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fadeIn">
                            <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center border border-white/20">
                                <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                                    <AlertTriangle className="w-12 h-12" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Excluir Registro</h3>
                                <p className="text-sm text-slate-500 mt-4 font-medium leading-relaxed">Deseja realmente apagar este registro de investimento permanentemente? Esta ação não pode ser desfeita.</p>
                                <div className="grid grid-cols-1 gap-3 mt-10">
                                    <Button onClick={handleDeleteInvestment} isLoading={isActionLoading} className="bg-red-600 hover:bg-red-700 h-16 rounded-2xl font-black uppercase text-xs tracking-widest">Sim, Excluir</Button>
                                    <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="h-14 rounded-2xl font-black uppercase text-[10px] border-slate-200">Cancelar</Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};