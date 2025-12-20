
import React, { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Loader2, Quote, X, History, TrendingUp, Calendar, Info, MessageCircleQuestion } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import { createPortal } from 'react-dom';

export const ManagerCampaignsScreen: React.FC = () => {
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
    const [subTab, setSubTab] = useState<'approved' | 'rejected'>('approved');
    const [investments, setInvestments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
    const [clientPerformance, setClientPerformance] = useState<any[]>([]);
    const [isClientLoading, setIsClientLoading] = useState(false);
    
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    useEffect(() => {
        fetchInvestments();
    }, [viewMode, subTab]);

    const fetchInvestments = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('investimentos')
                .select('*, clientes(*), usuarios(nome)')
                .order('criado_em', { ascending: false });

            if (viewMode === 'pending') {
                query = query.eq('status', 'pendente');
            } else {
                query = query.eq('status', subTab);
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

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
        if (isActionLoading) return;
        
        setIsActionLoading(true);
        try {
            // Removido 'motivo_recusa' pois a coluna não existe no banco (Erro PGRST204)
            const { data, error } = await supabase
                .from('investimentos')
                .update({ 
                    status: status
                })
                .eq('id', id)
                .select();
            
            if (error) throw error;

            if (!data || data.length === 0) {
                throw new Error('Permissão negada ou registro não encontrado.');
            }

            // Sucesso
            setInvestments(prev => prev.filter(i => i.id !== id));
            setSelectedDetail(null);
            setShowRejectionModal(false);
            setRejectionReason('');
        } catch (error: any) {
            console.error('Falha na atualização:', error);
            alert('Erro ao processar: ' + (error.message || 'Erro desconhecido.'));
        } finally {
            setIsActionLoading(false);
        }
    };

    const fetchClientHistory = async (client: any) => {
        setIsClientLoading(true);
        setSelectedDetail(client);
        try {
            const currentYear = new Date().getFullYear();
            const { data: sales } = await supabase
                .from('dados_vendas')
                .select('faturamento, data')
                .eq('cnpj', client.clientes?.cnpj)
                .gte('data', `${currentYear}-01-01`);

            const monthly: any = {};
            sales?.forEach(s => {
                const m = new Date(s.data).getUTCMonth() + 1;
                monthly[m] = (monthly[m] || 0) + (Number(s.faturamento) || 0);
            });

            const history = Array.from({ length: 12 }, (_, i) => ({
                month: i + 1,
                value: monthly[i + 1] || 0
            }));
            setClientPerformance(history);
        } catch (error) {
            console.error(error);
        } finally {
            setIsClientLoading(false);
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20">
            <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">Análise de Campanhas</h2>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aprovação de Verbas</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setViewMode('pending')} className={`px-5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'pending' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                        Pendentes
                    </button>
                    <button onClick={() => setViewMode('history')} className={`px-5 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${viewMode === 'history' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                        Histórico
                    </button>
                </div>
            </div>

            {viewMode === 'history' && (
                <div className="flex gap-2 animate-fadeIn">
                    <button onClick={() => setSubTab('approved')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${subTab === 'approved' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50'}`}>
                        Autorizadas
                    </button>
                    <button onClick={() => setSubTab('rejected')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${subTab === 'rejected' ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white text-red-600 border-red-100 hover:bg-red-50'}`}>
                        Recusadas
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Sincronizando...</p>
                    </div>
                ) : investments.length === 0 ? (
                    <div className="col-span-full bg-white rounded-[24px] p-20 text-center border border-dashed border-slate-200">
                        <ShieldCheck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhuma solicitação encontrada.</p>
                    </div>
                ) : (
                    investments.map(inv => (
                        <div key={inv.id} onClick={() => fetchClientHistory(inv)} className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm hover:border-blue-500 transition-all cursor-pointer group animate-slideUp flex flex-col justify-between h-full">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[8px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-md">Rep: {inv.usuarios?.nome}</span>
                                    <span className="text-[8px] text-slate-400 font-bold uppercase">{new Date(inv.criado_em).toLocaleDateString()}</span>
                                </div>
                                <h3 className="font-black text-slate-800 uppercase text-sm leading-tight group-hover:text-blue-600 line-clamp-2">{inv.clientes?.nome_fantasia}</h3>
                            </div>
                            <div className="mt-4 flex justify-between items-end border-t border-slate-50 pt-3">
                                <div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Verba</p>
                                    <p className="text-lg font-black text-slate-900 leading-none">{formatCurrency(inv.valor_total_investimento)}</p>
                                </div>
                                <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <TrendingUp className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selectedDetail && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-md rounded-[28px] shadow-2xl overflow-hidden animate-slideUp">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate max-w-[300px]">{selectedDetail.clientes?.nome_fantasia}</h3>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Análise de Proposta</p>
                            </div>
                            <button onClick={() => setSelectedDetail(null)} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400" disabled={isActionLoading}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-900 p-4 rounded-xl">
                                    <p className="text-[8px] font-black text-blue-400 uppercase mb-1">Solicitado</p>
                                    <p className="text-lg font-black text-white">{formatCurrency(selectedDetail.valor_total_investimento)}</p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Fat. Ano</p>
                                    <p className="text-md font-black text-slate-900 truncate">
                                        {formatCurrency(clientPerformance.reduce((acc, curr) => acc + curr.value, 0))}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                {selectedDetail.valor_caju > 0 && (
                                    <div className="flex-1 min-w-[70px] p-2 bg-pink-50 border border-pink-100 rounded-lg text-center">
                                        <p className="text-[7px] font-black text-pink-500 uppercase">Caju</p>
                                        <p className="text-[9px] font-black text-slate-900">{formatCurrency(selectedDetail.valor_caju)}</p>
                                    </div>
                                )}
                                {selectedDetail.valor_dinheiro > 0 && (
                                    <div className="flex-1 min-w-[70px] p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-center">
                                        <p className="text-[7px] font-black text-emerald-500 uppercase">Cash</p>
                                        <p className="text-[9px] font-black text-slate-900">{formatCurrency(selectedDetail.valor_dinheiro)}</p>
                                    </div>
                                )}
                                {selectedDetail.valor_produto > 0 && (
                                    <div className="flex-1 min-w-[70px] p-2 bg-blue-50 border border-blue-100 rounded-lg text-center">
                                        <p className="text-[7px] font-black text-blue-500 uppercase">Prod</p>
                                        <p className="text-[9px] font-black text-slate-900">{formatCurrency(selectedDetail.valor_produto)}</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1.5"><Quote className="w-2.5 h-2.5"/> Justificativa</p>
                                <p className="text-[10px] font-medium text-slate-700 leading-tight italic">"{selectedDetail.observacao}"</p>
                            </div>

                            <div className="bg-white p-3 rounded-xl border border-slate-100">
                                <p className="text-[8px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1.5"><History className="w-2.5 h-2.5"/> Performance {new Date().getFullYear()}</p>
                                {isClientLoading ? (
                                    <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-slate-300" /></div>
                                ) : (
                                    <div className="space-y-1">
                                        <div className="grid grid-cols-12 items-end h-8 gap-0.5 px-0.5 border-b border-slate-50">
                                            {clientPerformance.map((p, i) => {
                                                const maxVal = Math.max(...clientPerformance.map(cp => cp.value)) || 1;
                                                const height = (p.value / maxVal) * 100;
                                                return (
                                                    <div key={i} className="col-span-1 bg-blue-500/30 rounded-t-[1px]" style={{ height: `${Math.max(height, 5)}%` }}></div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedDetail.status === 'pendente' ? (
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                                <Button 
                                    variant="outline" 
                                    fullWidth 
                                    onClick={() => setShowRejectionModal(true)} 
                                    isLoading={isActionLoading && showRejectionModal}
                                    disabled={isActionLoading}
                                    className="bg-white text-red-600 border-red-200 hover:bg-red-50 py-2.5 font-black text-[9px] uppercase tracking-widest rounded-xl h-10"
                                >
                                    Recusar
                                </Button>
                                <Button 
                                    fullWidth 
                                    onClick={() => handleUpdateStatus(selectedDetail.id, 'approved')} 
                                    isLoading={isActionLoading && !showRejectionModal}
                                    disabled={isActionLoading}
                                    className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg py-2.5 font-black text-[9px] uppercase tracking-widest rounded-xl h-10"
                                >
                                    Aprovar
                                </Button>
                            </div>
                        ) : (
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                                <Button variant="outline" onClick={() => setSelectedDetail(null)} className="rounded-xl px-6 py-2 font-black text-[9px] uppercase h-10">Fechar</Button>
                            </div>
                        )}
                    </div>

                    {showRejectionModal && (
                        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
                             <div className="bg-white w-full max-w-xs rounded-[24px] p-5 shadow-2xl animate-slideUp">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-red-100 text-red-600 rounded-lg"><MessageCircleQuestion className="w-4 h-4" /></div>
                                    <h4 className="text-sm font-black text-slate-900 tracking-tight">Motivo</h4>
                                </div>
                                <textarea 
                                    value={rejectionReason} 
                                    onChange={e => setRejectionReason(e.target.value)}
                                    placeholder="Informe o motivo..."
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-medium text-slate-700 outline-none focus:ring-2 focus:ring-red-100 transition-all mb-4"
                                    rows={3}
                                    disabled={isActionLoading}
                                />
                                <div className="flex gap-2">
                                    <Button variant="outline" fullWidth onClick={() => setShowRejectionModal(false)} disabled={isActionLoading} className="rounded-lg font-black uppercase text-[8px] py-2 h-8">Sair</Button>
                                    <Button 
                                        fullWidth 
                                        disabled={isActionLoading} 
                                        isLoading={isActionLoading}
                                        onClick={() => handleUpdateStatus(selectedDetail.id, 'rejected')} 
                                        className="bg-red-600 hover:bg-red-700 text-white rounded-lg font-black uppercase text-[8px] py-2 h-8"
                                    >
                                        Confirmar
                                    </Button>
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
