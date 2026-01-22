import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp, CheckCircle2, XCircle, Loader2, X, Users, Trash2, ArrowRight, DollarSign, Building2, RefreshCw, Layers, History, MousePointer2, AlertTriangle, CheckSquare, ListTodo, ShieldCheck, UserX, RotateCcw, ChevronRight, Edit3, Save, AlertCircle, Search, MapPin } from 'lucide-react';
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
    
    // Check-in Semanal
    const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    // Modal de Revisão Detalhada (Gerente ajustando valores)
    const [reviewModalReport, setReviewModalReport] = useState<any | null>(null);
    const [reviewItems, setReviewItems] = useState<any[]>([]);
    const [rejectionReason, setRejectionReason] = useState('');

    // Modal de Detalhe do Histórico (Drill-down)
    const [selectedHistoryReport, setSelectedHistoryReport] = useState<any | null>(null);

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
                        *, 
                        usuarios(nome),
                        previsao_clientes (
                            id,
                            cliente_id,
                            valor_previsto_cliente,
                            clientes (nome_fantasia, cnpj)
                        )
                    `)
                    .ilike('observacao', 'WEEKLY_CHECKIN%')
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
        // Agora soma PENDENTES e APROVADOS para dar a visão real da semana
        const totalValid = reports
            .filter(r => r.status === 'pending' || r.status === 'approved')
            .reduce((acc, curr) => acc + Number(curr.previsao_total), 0);
            
        const repsWhoSent = new Set(reports.map(r => r.usuario_id));
        const missingRepsList = totalDataStore.users.filter(u => !repsWhoSent.has(u.id));
        return { totalValid, missingCount: missingRepsList.length, missingList: missingRepsList };
    }, [weeklyReports]);

    const handlePrevisaoAction = async (id: string, status: 'approved' | 'rejected') => {
        setIsActionLoading(true);
        try {
            await supabase.from('previsoes').update({ status }).eq('id', id);
            
            // Recarrega dados para atualizar UI e KPI
            await fetchData();
            alert(status === 'approved' ? 'Previsão aprovada!' : 'Previsão enviada para revisão.');
        } catch (e) { 
            console.error(e); 
        } finally { 
            setIsActionLoading(false); 
        }
    };

    const openReviewModal = (report: any) => {
        setReviewModalReport(report);
        setReviewItems(report.previsao_clientes ? [...report.previsao_clientes] : []);
        setRejectionReason('');
    };

    const handleUpdateReviewItem = (id: string, newVal: number) => {
        setReviewItems(prev => prev.map(item => item.id === id ? { ...item, valor_previsto_cliente: newVal } : item));
    };

    const confirmRejectionWithAdjustments = async () => {
        if (!rejectionReason.trim()) {
            alert('Informe o motivo da revisão para o representante.');
            return;
        }
        setIsActionLoading(true);
        try {
            for (const item of reviewItems) {
                await supabase
                    .from('previsao_clientes')
                    .update({ valor_previsto_cliente: item.valor_previsto_cliente })
                    .eq('id', item.id);
            }

            const newTotal = reviewItems.reduce((acc, curr) => acc + Number(curr.valor_previsto_cliente), 0);
            await supabase
                .from('previsoes')
                .update({ 
                    status: 'rejected', 
                    previsao_total: newTotal,
                    observacao: `WEEKLY_CHECKIN: [REVISÃO GERENTE: ${rejectionReason.toUpperCase()}]`
                })
                .eq('id', reviewModalReport.id);

            await fetchData();
            setReviewModalReport(null);
            alert('Relatório enviado para correção.');
        } catch (e: any) {
            alert('Erro: ' + e.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteForecast = async (id: string) => {
        if (!confirm('Deseja realmente EXCLUIR permanentemente?')) return;
        setIsActionLoading(true);
        try {
            await supabase.from('previsao_clientes').delete().eq('previsao_id', id);
            await supabase.from('previsoes').delete().eq('id', id);
            await fetchData();
            alert('Removido.');
        } catch (e: any) { alert(e.message); } finally { setIsActionLoading(false); }
    };

    const executeResetCycle = async () => {
        setIsActionLoading(true);
        try {
            // 1. Buscar todos os IDs de previsões semanais
            const { data: weeklies } = await supabase
                .from('previsoes')
                .select('id')
                .ilike('observacao', 'WEEKLY_CHECKIN%');
            
            if (weeklies && weeklies.length > 0) {
                const ids = weeklies.map(w => w.id);
                
                // 2. Apagar dependências (filhos)
                const { error: errItems } = await supabase
                    .from('previsao_clientes')
                    .delete()
                    .in('previsao_id', ids);
                
                if (errItems) throw errItems;

                // 3. Apagar cabeçalhos (pai)
                const { error: errHeader } = await supabase
                    .from('previsoes')
                    .delete()
                    .in('id', ids);

                if (errHeader) throw errHeader;
            }

            await fetchData();
            setShowResetModal(false);
            alert('Ciclo semanal resetado com sucesso! Todos os lançamentos foram apagados.');
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
                        <MousePointer2 className="w-4 h-4" /> Check-in Semanal
                    </button>
                    <button onClick={() => setView('mensais')} className={`whitespace-nowrap px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'mensais' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Sazonalidade Anual</button>
                </div>
            </div>

            {view === 'weekly_checkin' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl relative overflow-hidden border-b-4 border-blue-600">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign className="w-16 h-16" /></div>
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Previsão Semanal</p>
                        <h3 className="text-3xl font-black tabular-nums">{formatBRL(weeklyKPIs.totalValid)}</h3>
                        <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase">Total de novos negócios (Em análise + Aprovados)</p>
                    </div>

                    <div onClick={() => setShowMissingRepsModal(true)} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-blue-400 transition-all active:scale-95">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><UserX className="w-16 h-16 text-slate-900" /></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reps s/ Check-in</p>
                        <div className="flex items-baseline gap-2">
                          <h3 className="text-3xl font-black text-slate-900">{weeklyKPIs.missingCount}</h3>
                          <span className="text-xs text-slate-400 font-bold">/ {totalDataStore.users.length}</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-[9px] font-black text-blue-600 uppercase">Ver nomes <ChevronRight className="w-3 h-3" /></div>
                    </div>

                    <button onClick={() => setShowResetModal(true)} disabled={isActionLoading} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-center items-center gap-2 group hover:bg-red-50 hover:border-red-200 transition-all active:scale-95">
                        <div className="p-3 bg-red-50 text-red-600 rounded-2xl group-hover:bg-red-600 group-hover:text-white transition-all shadow-inner">
                           <RotateCcw className={`w-6 h-6 ${isActionLoading ? 'animate-spin' : ''}`} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 group-hover:text-red-700 uppercase tracking-widest">Resetar Ciclo Semanal</p>
                    </button>
                </div>
            )}

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>
            ) : view === 'mensais' ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 px-2">
                         <CheckCircle2 className="w-5 h-5 text-blue-600" />
                         <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Representantes Cientes das Metas Anuais</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {previsoes.length === 0 ? (
                            <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-[32px]">
                                <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">Nenhuma ciência registrada até o momento</p>
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
                                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[8px] font-black uppercase border border-emerald-100">Ciente</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-slideUp">
                    {/* Fila de Aprovação (Somente PENDENTES) */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                             <RefreshCw className="w-5 h-5 text-blue-600" />
                             <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Fila de Aprovação</h3>
                        </div>
                        
                        {weeklyReports.filter(r => r.status === 'pending').length === 0 ? (
                            <div className="bg-white rounded-[32px] p-12 text-center border border-dashed border-slate-200">
                                 <CheckCircle2 className="w-10 h-10 text-emerald-100 mx-auto mb-3" />
                                 <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em]">Nenhuma previsão pendente</p>
                            </div>
                        ) : (
                            weeklyReports.filter(r => r.status === 'pending').map(report => (
                                <div key={report.id} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden animate-slideUp border-l-8 border-l-amber-500">
                                    <div className="p-6 md:p-8 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black shadow-lg">{report.usuarios?.nome.charAt(0)}</div>
                                            <div>
                                                <h4 className="font-black text-slate-900 uppercase text-md">{report.usuarios?.nome}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Enviado em {new Date(report.criado_em).toLocaleDateString('pt-BR')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-6">
                                            <div>
                                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Total Relatado</p>
                                                <p className="text-2xl font-black text-slate-900 tabular-nums">{formatBRL(report.previsao_total)}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handlePrevisaoAction(report.id, 'approved')} className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg" title="Aprovar"><CheckCircle2 className="w-6 h-6" /></button>
                                                <button onClick={() => openReviewModal(report)} className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg" title="Ajustar e Recusar"><Edit3 className="w-6 h-6" /></button>
                                                <button onClick={() => handleDeleteForecast(report.id)} className="p-3 bg-white border border-slate-200 text-slate-300 hover:text-red-500 rounded-xl transition-all" title="Excluir"><Trash2 className="w-6 h-6" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Histórico por Representante (APROVADOS e RECUSADOS) */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                             <History className="w-5 h-5 text-slate-400" />
                             <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Histórico de Check-ins</h3>
                        </div>

                        <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-8 py-5">Representante</th>
                                        <th className="px-6 py-5">Data Envio</th>
                                        <th className="px-6 py-5 text-right">Montante</th>
                                        <th className="px-6 py-5 text-center">Status</th>
                                        <th className="px-8 py-5 text-right">Ver Clientes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {weeklyReports.filter(r => r.status !== 'pending').length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-10 text-center text-slate-300 font-black uppercase text-[10px]">Sem registros processados</td>
                                        </tr>
                                    ) : (
                                        weeklyReports.filter(r => r.status !== 'pending').map(report => (
                                            <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-8 py-4 font-black text-slate-700 uppercase text-xs">{report.usuarios?.nome}</td>
                                                <td className="px-6 py-4 text-xs font-bold text-slate-400">{new Date(report.criado_em).toLocaleString('pt-BR')}</td>
                                                <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">{formatBRL(report.previsao_total)}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${
                                                        report.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                                                    }`}>
                                                        {report.status === 'approved' ? 'Aceito' : 'Recusado'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-4 text-right">
                                                    <button 
                                                        onClick={() => setSelectedHistoryReport(report)}
                                                        className="p-2 bg-slate-50 border border-slate-200 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"
                                                    >
                                                        <Search className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Drill-down do Histórico */}
            {selectedHistoryReport && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[85vh]">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Detalhamento da Previsão</h3>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Representante: {selectedHistoryReport.usuarios?.nome}</p>
                            </div>
                            <button onClick={() => setSelectedHistoryReport(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4">Cliente / Entidade</th>
                                            <th className="px-6 py-4">CNPJ</th>
                                            <th className="px-6 py-4 text-right">Vlr. Previsto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(selectedHistoryReport.previsao_clientes || []).map((item: any) => (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-black text-slate-800 uppercase text-[11px] truncate leading-tight">{item.clientes?.nome_fantasia}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-[10px] font-bold text-slate-400 tabular-nums">{item.clientes?.cnpj}</p>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <p className="text-[11px] font-black text-blue-600 tabular-nums">{formatBRL(item.valor_previsto_cliente)}</p>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={2} className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Total Consolidado</td>
                                            <td className="px-6 py-4 text-right text-sm font-black text-slate-900 tabular-nums">{formatBRL(selectedHistoryReport.previsao_total)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button onClick={() => setSelectedHistoryReport(null)} className="rounded-2xl px-10 h-12 font-black uppercase text-[10px]">Fechar Detalhe</Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal de Revisão Detalhada (Ajustes do Gerente) */}
            {reviewModalReport && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-slideUp flex flex-col max-h-[90vh]">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Sugestão de Revisão</h3>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Representante: {reviewModalReport.usuarios?.nome}</p>
                            </div>
                            <button onClick={() => setReviewModalReport(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                <p className="text-[10px] font-black text-amber-800 uppercase leading-tight">Ajuste os valores sugeridos abaixo. O representante receberá estas alterações para validar e reenviar.</p>
                            </div>

                            <div className="space-y-3">
                                {reviewItems.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                        <div className="flex-1 min-w-0 pr-4">
                                            <p className="font-black text-slate-700 uppercase text-[10px] truncate leading-tight">{item.clientes?.nome_fantasia || 'Cliente não Identificado'}</p>
                                            <p className="text-[9px] font-bold text-slate-400 mt-1 tabular-nums">{item.clientes?.cnpj}</p>
                                        </div>
                                        <div className="w-40 relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">R$</span>
                                            <input 
                                              type="number"
                                              value={item.valor_previsto_cliente}
                                              onChange={(e) => handleUpdateReviewItem(item.id, Number(e.target.value))}
                                              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Justificativa da Revisão</label>
                                <textarea 
                                    value={rejectionReason}
                                    onChange={e => setRejectionReason(e.target.value)}
                                    placeholder="Ex: Verba reduzida para esta regional ou ajustes de mix..."
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-50"
                                    rows={3}
                                />
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                            <Button variant="outline" onClick={() => setReviewModalReport(null)} className="flex-1 h-14 rounded-2xl font-black text-xs uppercase">Voltar</Button>
                            <Button 
                                onClick={confirmRejectionWithAdjustments} 
                                isLoading={isActionLoading}
                                className="flex-[2] h-14 rounded-2xl font-black text-xs uppercase bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-200"
                            >
                                <Save className="w-4 h-4 mr-2" /> Enviar Revisão ao Rep
                            </Button>
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
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Reps s/ Check-in</h3>
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

            {/* MODAL DE CONFIRMAÇÃO DO RESET DE CICLO SEMANAL */}
            {showResetModal && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center border border-white/20 animate-slideUp">
                        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                            <AlertTriangle className="w-12 h-12" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Limpeza Total</h3>
                        <p className="text-sm text-slate-500 mt-4 font-medium leading-relaxed">
                            Atenção: Isso apagará <strong className="text-red-600">TODOS</strong> os relatórios de check-in semanal desta semana, tanto os aprovados quanto os pendentes.
                        </p>
                        <p className="text-xs text-slate-400 mt-2 italic font-bold">Esta ação não pode ser desfeita.</p>
                        
                        <div className="grid grid-cols-1 gap-3 mt-10">
                            <Button 
                                onClick={executeResetCycle}
                                isLoading={isActionLoading}
                                className="bg-red-600 hover:bg-red-700 text-white h-16 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-red-200"
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Confirmar e Apagar Tudo
                            </Button>
                            <Button 
                                variant="outline" 
                                onClick={() => setShowResetModal(false)}
                                disabled={isActionLoading}
                                className="h-14 rounded-2xl font-black uppercase text-[10px] border-slate-200"
                            >
                                Voltar / Cancelar
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};