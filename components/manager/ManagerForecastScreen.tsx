import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, CheckCircle2, XCircle, Loader2, X, Users, Trash2, ArrowRight, DollarSign, Building2, RefreshCw, Layers, History, MousePointer2, AlertTriangle, CheckSquare, ListTodo, ShieldCheck, UserX, RotateCcw, ChevronRight, Edit3, Save, AlertCircle, Search, MapPin, MessageSquareText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import { createPortal } from 'react-dom';
import { totalDataStore } from '../../lib/dataStore';

type ViewType = 'mensais' | 'mapeamentos' | 'weekly_checkin';

export const ManagerForecastScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<ViewType>('weekly_checkin');
    const [previsoes, setPrevisoes] = useState<any[]>([]);
    const [showMissingRepsModal, setShowMissingRepsModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    
    // Previsões Enviadas
    const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    // Modal de Recusa com Motivo
    const [rejectionModalReport, setRejectionModalReport] = useState<any | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

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
                    .ilike('observacao', 'CONFIRMAÇÃO ANUAL%')
                    .order('criado_em', { ascending: false });
                setPrevisoes(data || []);
            } else if (view === 'weekly_checkin') {
                const { data } = await supabase
                    .from('previsoes')
                    .select(`
                        id,
                        usuario_id,
                        data,
                        previsao_total,
                        status,
                        observacao,
                        criado_em,
                        usuarios(nome)
                    `)
                    .ilike('observacao', '%WEEKLY_CHECKIN%') // Busca flexível
                    .order('criado_em', { ascending: false });
                
                setWeeklyReports(data || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const weeklyKPIs = useMemo(() => {
        const reports = weeklyReports;
        const totalValid = reports
            .filter(r => r.status === 'pending' || r.status === 'approved')
            .reduce((acc, curr) => acc + Number(curr.previsao_total), 0);
            
        const repsWhoSent = new Set(reports.map(r => r.usuario_id));
        const missingRepsList = totalDataStore.users.filter(u => !repsWhoSent.has(u.id));
        return { totalValid, missingCount: missingRepsList.length, missingList: missingRepsList };
    }, [weeklyReports]);

    const handlePrevisaoAction = async (id: string, status: 'approved' | 'rejected') => {
        if (status === 'rejected') {
            const report = weeklyReports.find(r => r.id === id);
            setRejectionModalReport(report);
            setRejectionReason('');
            return;
        }

        setIsActionLoading(true);
        try {
            const { error } = await supabase.from('previsoes').update({ status }).eq('id', id);
            if (error) throw error;
            await fetchData();
            alert('Previsão aprovada com sucesso!');
        } catch (e: any) { 
            alert('Erro ao aprovar: ' + e.message);
        } finally { 
            setIsActionLoading(false); 
        }
    };

    const confirmRejection = async () => {
        if (!rejectionReason.trim()) {
            alert('Informe o motivo da recusa.');
            return;
        }
        setIsActionLoading(true);
        try {
            // Importante: Manter o prefixo WEEKLY_CHECKIN para que o representante continue vendo o registro
            const currentObs = rejectionModalReport.observacao || '';
            const cleanObs = currentObs.replace(/\[REVISÃO GERENTE:.*?\]\s*/, '').replace('WEEKLY_CHECKIN:', '').trim();
            const finalObs = `[REVISÃO GERENTE: ${rejectionReason.toUpperCase()}] WEEKLY_CHECKIN: ${cleanObs}`;

            const { error } = await supabase
                .from('previsoes')
                .update({ 
                    status: 'rejected', 
                    observacao: finalObs
                })
                .eq('id', rejectionModalReport.id);

            if (error) throw error;

            await fetchData();
            setRejectionModalReport(null);
            alert('Solicitação de revisão enviada ao representante.');
        } catch (e: any) {
            alert('Erro ao recusar: ' + e.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteForecast = async (id: string) => {
        if (!confirm('Deseja realmente EXCLUIR permanentemente?')) return;
        setIsActionLoading(true);
        try {
            const { error } = await supabase.from('previsoes').delete().eq('id', id);
            if (error) throw error;
            await fetchData();
            alert('Removido.');
        } catch (e: any) { alert(e.message); } finally { setIsActionLoading(false); }
    };

    const executeResetCycle = async () => {
        setIsActionLoading(true);
        try {
            const { data: weeklies } = await supabase
                .from('previsoes')
                .select('id')
                .ilike('observacao', '%WEEKLY_CHECKIN%');
            
            if (weeklies && weeklies.length > 0) {
                const ids = weeklies.map(w => w.id);
                const { error: errHeader } = await supabase.from('previsoes').delete().in('id', ids);
                if (errHeader) throw errHeader;
            }

            await fetchData();
            setShowResetModal(false);
            alert('Ciclo resetado. Todos os lançamentos foram apagados.');
        } catch (e: any) { 
            alert('Falha ao resetar: ' + e.message); 
        } finally { 
            setIsActionLoading(false); 
        }
    };

    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-20">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-blue-600" /> Gestão de Previsões
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aprovação e Controle de Faturamento Semanal</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                    <button onClick={() => setView('weekly_checkin')} className={`whitespace-nowrap px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${view === 'weekly_checkin' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                        <MousePointer2 className="w-4 h-4" /> Previsões Enviadas
                    </button>
                    <button onClick={() => setView('mensais')} className={`whitespace-nowrap px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'mensais' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Sazonalidade Anual</button>
                </div>
            </div>

            {view === 'weekly_checkin' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl relative overflow-hidden border-b-4 border-blue-600">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign className="w-16 h-16" /></div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Previsão Semanal Consolidada</p>
                        <h3 className="text-3xl font-black tabular-nums">{formatBRL(weeklyKPIs.totalValid)}</h3>
                        <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">Soma de todos os envios válidos da semana</p>
                    </div>

                    <div onClick={() => setShowMissingRepsModal(true)} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-blue-400 transition-all active:scale-95">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><UserX className="w-16 h-16 text-slate-900" /></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pendentes de Envio</p>
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-3xl font-black text-slate-900">{weeklyKPIs.missingCount}</h3>
                          <span className="text-xs text-slate-400 font-bold">/ {totalDataStore.users.length}</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-blue-600 uppercase">Ver lista <ChevronRight className="w-3 h-3" /></div>
                    </div>

                    <button onClick={() => setShowResetModal(true)} disabled={isActionLoading} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-center items-center gap-2 group hover:bg-red-50 hover:border-red-200 transition-all active:scale-95">
                        <div className="p-3 bg-red-50 text-red-600 rounded-2xl group-hover:bg-red-600 group-hover:text-white transition-all shadow-inner">
                           <RotateCcw className={`w-6 h-6 ${isActionLoading ? 'animate-spin' : ''}`} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 group-hover:text-red-700 uppercase tracking-widest">Zerar Ciclo de Previsão</p>
                    </button>
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>
            ) : view === 'mensais' ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                         <CheckCircle2 className="w-5 h-5 text-blue-600" />
                         <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Mural de Ciência Anual</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {previsoes.length === 0 ? (
                            <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-[32px]">
                                <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">Nenhuma ciência anual confirmada</p>
                            </div>
                        ) : (
                            previsoes.map(p => (
                                <div key={p.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-500 transition-all">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black group-hover:bg-blue-600 transition-colors">{p.usuarios?.nome.charAt(0)}</div>
                                        <div>
                                            <h4 className="font-black text-slate-800 uppercase text-xs">{p.usuarios?.nome}</h4>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tabular-nums">CIÊNCIA EM {new Date(p.criado_em).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>
                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase border border-emerald-100">Confirmado</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-6 animate-slideUp">
                    {weeklyReports.length === 0 ? (
                        <div className="bg-white rounded-[32px] p-24 text-center border border-dashed border-slate-200">
                             <CheckCircle2 className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                             <p className="text-slate-300 font-bold uppercase text-[10px] tracking-[0.3em]">Nenhuma previsão aguardando análise.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-8 py-5">Representante</th>
                                        <th className="px-6 py-5">Previsão / Justificativa</th>
                                        <th className="px-6 py-5 text-right">Valor Total</th>
                                        <th className="px-6 py-5 text-center">Status</th>
                                        <th className="px-8 py-5 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {weeklyReports.map(report => (
                                        <tr key={report.id} className={`hover:bg-slate-50 transition-colors group ${report.status === 'pending' ? 'bg-amber-50/20' : ''}`}>
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">{report.usuarios?.nome.charAt(0)}</div>
                                                    <span className="font-black text-slate-700 uppercase text-[11px]">{report.usuarios?.nome}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-[10px] font-medium text-slate-500 line-clamp-2 max-w-md">
                                                    <MessageSquareText className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
                                                    {report.observacao.replace(/\[REVISÃO GERENTE:.*?\]/, '').replace('WEEKLY_CHECKIN:', '').trim()}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-black text-slate-900 text-xs tabular-nums">{formatBRL(report.previsao_total)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase border ${
                                                    report.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                                    report.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                                                }`}>
                                                    {report.status === 'approved' ? 'Aceito' : report.status === 'rejected' ? 'Recusado' : 'Aguardando'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {report.status === 'pending' ? (
                                                        <>
                                                            <button onClick={() => handlePrevisaoAction(report.id, 'approved')} className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"><CheckCircle2 className="w-4 h-4" /></button>
                                                            <button onClick={() => handlePrevisaoAction(report.id, 'rejected')} className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all shadow-md shadow-red-100"><XCircle className="w-4 h-4" /></button>
                                                        </>
                                                    ) : (
                                                        <button onClick={() => handleDeleteForecast(report.id)} className="p-2 bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Recusa Simplificado */}
            {rejectionModalReport && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-slideUp border border-white/20">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-8 h-8" />
                            </div>
                            <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">Recusar Previsão</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Representante: {rejectionModalReport.usuarios?.nome}</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Motivo da Recusa</label>
                                <textarea 
                                    value={rejectionReason} 
                                    onChange={e => setRejectionReason(e.target.value)} 
                                    placeholder="Explique ao representante o que ele deve ajustar..." 
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-red-100 transition-all" 
                                    rows={3}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setRejectionModalReport(null)} className="rounded-xl h-12 border border-slate-200 text-[10px] font-black uppercase">Voltar</button>
                                <Button onClick={confirmRejection} isLoading={isActionLoading} className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 font-black uppercase text-[10px]">Confirmar Recusa</Button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Reset de Ciclo */}
            {showResetModal && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center border border-white/20 animate-slideUp">
                        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                            <AlertTriangle className="w-12 h-12" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Reiniciar Semana</h3>
                        <p className="text-sm text-slate-500 mt-4 font-medium leading-relaxed">Isso apagará <strong className="text-red-600">TODOS</strong> os envios desta semana. Esta ação não pode ser desfeita.</p>
                        <div className="grid grid-cols-1 gap-3 mt-10">
                            <Button onClick={executeResetCycle} isLoading={isActionLoading} className="bg-red-600 hover:bg-red-700 text-white h-16 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-red-200"><Trash2 className="w-4 h-4 mr-2" /> Confirmar e Apagar Tudo</Button>
                            <button onClick={() => setShowResetModal(false)} disabled={isActionLoading} className="h-14 rounded-2xl font-black uppercase text-[10px] border border-slate-200">Voltar / Cancelar</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal Missing Reps */}
            {showMissingRepsModal && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden animate-slideUp border border-white/20">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Reps s/ Previsão</h3>
                            <button onClick={() => setShowMissingRepsModal(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {weeklyKPIs.missingList.length === 0 ? (
                                <div className="text-center py-10">
                                    <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                                    <p className="text-xs font-black text-slate-800 uppercase">Equipe Completa!</p>
                                </div>
                            ) : (
                                weeklyKPIs.missingList.map(rep => (
                                    <div key={rep.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
                                        <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xs">{rep.nome.charAt(0)}</div>
                                        <span className="font-black text-slate-700 uppercase text-[10px]">{rep.nome}</span>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100">
                             <Button onClick={() => setShowMissingRepsModal(false)} fullWidth className="rounded-2xl h-14 font-black uppercase text-[10px]">Fechar Lista</Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};