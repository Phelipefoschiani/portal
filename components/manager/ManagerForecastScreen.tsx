
import React, { useState, useEffect } from 'react';
import { TrendingUp, CheckCircle2, XCircle, Loader2, X, Users, Trash2, ArrowRight, DollarSign, Building2, RefreshCw, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import { createPortal } from 'react-dom';

export const ManagerForecastScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'mensais' | 'mapeamentos'>('mensais');
    const [previsoes, setPrevisoes] = useState<any[]>([]);
    const [mapeamentos, setMapeamentos] = useState<any[]>([]);
    const [selectedMapping, setSelectedMapping] = useState<any | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    useEffect(() => {
        fetchData();
    }, [view]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            if (view === 'mensais') {
                const { data } = await supabase
                    .from('previsoes')
                    .select('*, usuarios(nome)')
                    .eq('status', 'pending')
                    .order('criado_em', { ascending: false });
                setPrevisoes(data || []);
            } else {
                const { data } = await supabase
                    .from('previsao_clientes')
                    .select('*, previsoes!inner(id, usuario_id, usuarios(nome)), clientes(id, nome_fantasia, cnpj)')
                    .eq('status', 'pending');
                
                const grouped = new Map();
                data?.forEach(item => {
                    const repId = item.previsoes.usuario_id;
                    if (!grouped.has(repId)) {
                        grouped.set(repId, { 
                            repId, 
                            repName: item.previsoes.usuarios.nome, 
                            totalMapped: 0, 
                            items: [],
                            forecastId: item.previsoes.id
                        });
                    }
                    const group = grouped.get(repId);
                    group.totalMapped += item.valor_previsto_cliente;
                    group.items.push(item);
                });
                setMapeamentos(Array.from(grouped.values()));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrevisaoAction = async (id: string, status: 'approved' | 'rejected') => {
        setIsActionLoading(true);
        try {
            await supabase.from('previsoes').update({ status }).eq('id', id);
            setPrevisoes(prev => prev.filter(p => p.id !== id));
            alert(status === 'approved' ? 'Previsão de faturamento aprovada!' : 'Previsão recusada.');
        } catch (e) { console.error(e); } finally { setIsActionLoading(false); }
    };

    const handleUseInEngineering = (mapping: any) => {
        const importPayload = {
            repId: mapping.repId,
            repName: mapping.repName,
            clients: mapping.items.map((it: any) => ({
                id: it.clientes.id,
                value: it.valor_previsto_cliente
            }))
        };
        sessionStorage.setItem('pcn_import_engineering', JSON.stringify(importPayload));
        
        // Navegação via evento global para tela de definição de metas
        const event = new CustomEvent('pcn_navigate', { detail: 'admin-targets' });
        window.dispatchEvent(event);
    };

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-20">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-blue-600" /> Gestão de Previsões
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprovação de Grades Mensais e Carteiras</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button onClick={() => setView('mensais')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'mensais' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Previsões Mensais</button>
                    <button onClick={() => setView('mapeamentos')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'mapeamentos' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}>Mapeamento Carteira</button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>
            ) : view === 'mensais' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {previsoes.length === 0 ? (
                        <div className="col-span-full bg-white rounded-[32px] p-24 text-center border border-dashed border-slate-200 text-slate-300 font-bold uppercase text-[10px]">Nenhuma previsão aguardando análise.</div>
                    ) : (
                        previsoes.map(p => (
                            <div key={p.id} className="bg-white p-8 rounded-[36px] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">{p.usuarios?.nome.charAt(0)}</div>
                                        <div><h3 className="font-black text-slate-900 uppercase text-xs">{p.usuarios?.nome}</h3><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Representante Regional</p></div>
                                    </div>
                                    {p.metadata?.is_upgrade && <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-tighter animate-pulse border border-blue-100">Proposta de Upgrade</span>}
                                </div>
                                <div className="grid grid-cols-2 gap-6 mb-8">
                                    <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Regional</p><p className="text-lg font-black text-slate-300 line-through tabular-nums opacity-50">{formatCurrency(p.metadata?.original_total || 0)}</p></div>
                                    <div><p className="text-[8px] font-black text-blue-600 uppercase tracking-widest mb-1">Previsão Proposta</p><p className="text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(p.previsao_total)}</p></div>
                                </div>
                                <div className="flex gap-3 pt-4 border-t border-slate-50">
                                    <Button variant="outline" onClick={() => handlePrevisaoAction(p.id, 'rejected')} className="bg-white text-red-600 border-red-100 flex-1 h-12 rounded-xl font-black text-[10px] uppercase">Recusar</Button>
                                    <Button onClick={() => handlePrevisaoAction(p.id, 'approved')} className="flex-1 h-12 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-blue-500/20">Aprovar Previsão</Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {mapeamentos.length === 0 ? (
                        <div className="bg-white rounded-[32px] p-24 text-center border border-dashed border-slate-200 text-slate-300 font-bold uppercase text-[10px]">Nenhum mapeamento pendente.</div>
                    ) : (
                        mapeamentos.map(m => (
                            <div key={m.repId} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 animate-slideUp">
                                <div className="flex-1">
                                    <h3 className="font-black text-slate-900 uppercase text-md tracking-tight">{m.repName}</h3>
                                    <div className="flex items-center gap-6 mt-2">
                                        <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-600" /><span className="text-xs font-bold text-slate-500 uppercase">{m.items.length} Clientes Alocados</span></div>
                                        <div className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-600" /><span className="text-sm font-black text-slate-900">{formatCurrency(m.totalMapped)}</span></div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setSelectedMapping(m)} className="p-4 bg-white text-slate-600 rounded-2xl hover:bg-slate-900 hover:text-white transition-all border border-slate-200 shadow-sm flex items-center gap-2 px-6">
                                        <ArrowRight className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Ver Mapeamento</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {selectedMapping && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-4xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Mapeamento de Carteira</h3><p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Rep: {selectedMapping.repName}</p></div>
                            <button onClick={() => setSelectedMapping(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
                            <div className="bg-slate-900 p-6 rounded-3xl text-white flex justify-between items-center mb-8 border-b-4 border-blue-600 shadow-xl">
                                <div><p className="text-[9px] font-black text-blue-400 uppercase mb-1">Previsão Anual Alocada</p><p className="text-3xl font-black">{formatCurrency(selectedMapping.totalMapped)}</p></div>
                                <div className="text-right"><p className="text-[9px] font-black text-slate-500 uppercase mb-1">Clientes</p><p className="text-2xl font-black">{selectedMapping.items.length}</p></div>
                            </div>
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        <tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4 text-right">Planejado (R$)</th><th className="px-6 py-4 text-right">Part %</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedMapping.items.map((item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4"><p className="font-black text-slate-800 uppercase text-xs truncate tracking-tight">{item.clientes?.nome_fantasia}</p><p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{item.clientes?.cnpj}</p></td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{formatCurrency(item.valor_previsto_cliente)}</td>
                                                <td className="px-6 py-4 text-right font-black text-blue-600 text-[10px]">{((item.valor_previsto_cliente / selectedMapping.totalMapped) * 100).toFixed(1)}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-xs leading-relaxed italic">Ao "Utilizar na Engenharia", o sistema carregará automaticamente as previsões sugeridas pelo representante na Engenharia de Carteira oficial.</p>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={() => setSelectedMapping(null)} className="bg-white h-14 px-8 rounded-2xl font-black text-[10px] uppercase">Ajustar depois</Button>
                                <Button onClick={() => handleUseInEngineering(selectedMapping)} className="h-14 px-10 rounded-2xl font-black text-[10px] uppercase shadow-2xl shadow-blue-500/20 flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4" /> Utilizar na Engenharia
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
