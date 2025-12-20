
import React, { useState, useEffect } from 'react';
import { TrendingUp, User, ChevronRight, CheckCircle2, XCircle, Loader2, Send, X, Users, History, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import { createPortal } from 'react-dom';

export const ManagerForecastScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'pending' | 'reps'>('pending');
    const [pendingItems, setPendingItems] = useState<any[]>([]);
    const [repsList, setRepsList] = useState<any[]>([]);
    const [selectedRep, setSelectedRep] = useState<any | null>(null);
    const [repHistory, setRepHistory] = useState<any[]>([]);
    const [isRepLoading, setIsRepLoading] = useState(false);
    
    useEffect(() => {
        fetchData();
    }, [view]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            if (view === 'pending') {
                const { data } = await supabase
                    .from('previsao_clientes')
                    .select('*, clientes(nome_fantasia), previsoes!inner(usuario_id, data, usuarios(nome))')
                    .eq('status', 'pending');
                setPendingItems(data || []);
            } else {
                const { data: reps } = await supabase
                    .from('usuarios')
                    .select('id, nome')
                    .eq('nivel_acesso', 'representante')
                    .order('nome');
                
                // Para cada rep, buscar se tem pendências (para o ponto vermelho interno)
                const repsWithStatus = await Promise.all((reps || []).map(async (r) => {
                    const { count } = await supabase
                        .from('previsao_clientes')
                        .select('id', { count: 'exact', head: true })
                        .eq('status', 'pending')
                        .eq('previsoes.usuario_id', r.id);
                    return { ...r, hasPending: (count || 0) > 0 };
                }));

                setRepsList(repsWithStatus);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAction = async (itemId: string, status: 'approved' | 'rejected', reason?: string) => {
        try {
            await supabase
                .from('previsao_clientes')
                .update({ status, motivo_recusa: reason || null })
                .eq('id', itemId);
            
            setPendingItems(prev => prev.filter(i => i.id !== itemId));
        } catch (error) {
            console.error(error);
        }
    };

    const fetchRepDetail = async (rep: any) => {
        setIsRepLoading(true);
        setSelectedRep(rep);
        try {
            const { data } = await supabase
                .from('previsao_clientes')
                .select('*, clientes(nome_fantasia), previsoes!inner(usuario_id, data)')
                .eq('previsoes.usuario_id', rep.id);
            setRepHistory(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsRepLoading(false);
        }
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">Gestão de Previsões</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fluxo de Aprovação Mensal</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button 
                        onClick={() => setView('pending')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'pending' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
                    >
                        Pendentes ({pendingItems.length})
                    </button>
                    <button 
                        onClick={() => setView('reps')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'reps' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
                    >
                        Equipe
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest tracking-widest">Buscando atualizações...</p>
                </div>
            ) : view === 'pending' ? (
                <div className="space-y-4">
                    {pendingItems.length === 0 ? (
                        <div className="bg-white rounded-[32px] p-20 text-center border border-dashed border-slate-200">
                            <CheckCircle2 className="w-12 h-12 text-emerald-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhuma previsão para análise no momento.</p>
                        </div>
                    ) : (
                        pendingItems.map(item => (
                            <div key={item.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 animate-slideUp">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-lg tracking-tight">Vendedor: {item.previsoes.usuarios.nome}</span>
                                    </div>
                                    <h3 className="font-black text-slate-800 uppercase text-md">{item.clientes?.nome_fantasia}</h3>
                                    <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(item.valor_previsto_cliente)}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            const reason = prompt('Informe o motivo da recusa para o representante:');
                                            if(reason) handleAction(item.id, 'rejected', reason);
                                        }}
                                        className="p-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all border border-red-100 shadow-sm"
                                    >
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                    <button 
                                        onClick={() => handleAction(item.id, 'approved')}
                                        className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 shadow-sm"
                                    >
                                        <CheckCircle2 className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                <th className="px-8 py-5">Representante</th>
                                <th className="px-8 py-5 text-center">Status de Envio</th>
                                <th className="px-8 py-5 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {repsList.map(rep => (
                                <tr 
                                    key={rep.id} 
                                    onClick={() => fetchRepDetail(rep)}
                                    className="group hover:bg-slate-50 cursor-pointer transition-all"
                                >
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm group-hover:bg-blue-600 transition-colors">
                                                {rep.nome.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase tracking-tight">{rep.nome}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Membro da Equipe</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        {rep.hasPending ? (
                                            <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 text-[9px] font-black px-3 py-1.5 rounded-full border border-red-100 animate-pulse">
                                                <AlertCircle className="w-3 h-3" /> PENDÊNCIAS
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-[9px] font-black px-3 py-1.5 rounded-full border border-emerald-100">
                                                <CheckCircle2 className="w-3 h-3" /> EM DIA
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                            <ChevronRight className="w-5 h-5" />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedRep && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp border border-white/20">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedRep.nome}</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Consolidado Mensal</p>
                            </div>
                            <button onClick={() => setSelectedRep(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
                            {isRepLoading ? (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                                    <p className="text-[10px] font-black uppercase">Consolidando dados...</p>
                                </div>
                            ) : (
                                <>
                                    <section>
                                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" /> Aguardando Análise
                                        </h4>
                                        <div className="space-y-2">
                                            {repHistory.filter(i => i.status === 'pending').map(item => (
                                                <div key={item.id} className="p-4 rounded-2xl bg-white border border-slate-100 flex justify-between items-center shadow-sm">
                                                    <span className="font-black text-slate-700 uppercase text-xs">{item.clientes?.nome_fantasia}</span>
                                                    <span className="font-black text-slate-900">{formatCurrency(item.valor_previsto_cliente)}</span>
                                                </div>
                                            ))}
                                            {repHistory.filter(i => i.status === 'pending').length === 0 && <p className="text-[10px] text-slate-400 font-bold uppercase p-6 text-center border-2 border-dashed border-slate-50 rounded-2xl">Sem novos envios</p>}
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4" /> Itens Aprovados
                                        </h4>
                                        <div className="space-y-2">
                                            {repHistory.filter(i => i.status === 'approved').map(item => (
                                                <div key={item.id} className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex justify-between items-center">
                                                    <span className="font-black text-emerald-800 uppercase text-xs">{item.clientes?.nome_fantasia}</span>
                                                    <span className="font-black text-emerald-700">{formatCurrency(item.valor_previsto_cliente)}</span>
                                                </div>
                                            ))}
                                            {repHistory.filter(i => i.status === 'approved').length === 0 && <p className="text-[10px] text-slate-400 font-bold uppercase p-4 text-center">Nenhum aprovado</p>}
                                        </div>
                                    </section>

                                    <section>
                                        <h4 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                            <History className="w-4 h-4" /> Aguardando Correção
                                        </h4>
                                        <div className="space-y-2">
                                            {repHistory.filter(i => i.status === 'rejected').map(item => (
                                                <div key={item.id} className="p-4 rounded-2xl bg-red-50/50 border border-red-100">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-black text-red-800 uppercase text-xs">{item.clientes?.nome_fantasia}</span>
                                                        <span className="font-black text-red-700">{formatCurrency(item.valor_previsto_cliente)}</span>
                                                    </div>
                                                    <p className="text-[9px] font-bold text-red-400 mt-2 uppercase tracking-tight italic">Feed: {item.motivo_recusa}</p>
                                                </div>
                                            ))}
                                            {repHistory.filter(i => i.status === 'rejected').length === 0 && <p className="text-[10px] text-slate-400 font-bold uppercase p-4 text-center">Nenhuma correção pendente</p>}
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
