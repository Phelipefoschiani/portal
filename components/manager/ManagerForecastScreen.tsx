import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TrendingUp, CheckCircle2, XCircle, Loader2, X, Users, Trash2, ArrowRight, DollarSign, Building2, RefreshCw, Layers, History, MousePointer2, AlertTriangle, CheckSquare, ListTodo, ShieldCheck, UserX, RotateCcw, ChevronRight, Edit3, Save, AlertCircle, Search, MapPin, Camera, Share2, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import { createPortal } from 'react-dom';
import { totalDataStore } from '../../lib/dataStore';
import html2canvas from 'html2canvas';

type ViewType = 'mensais' | 'mapeamentos' | 'weekly_checkin';

export const ManagerForecastScreen: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [view, setView] = useState<ViewType>('weekly_checkin');
    const [previsoes, setPrevisoes] = useState<any[]>([]);
    const [showMissingRepsModal, setShowMissingRepsModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    
    // Check-in Semanal
    const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    // Modal de Revisão Detalhada
    const [reviewModalReport, setReviewModalReport] = useState<any | null>(null);
    const [reviewItems, setReviewItems] = useState<any[]>([]);
    const [rejectionReason, setRejectionReason] = useState('');

    // Modal de Detalhe do Histórico
    const [selectedHistoryReport, setSelectedHistoryReport] = useState<any | null>(null);

    // Ref para a área de exportação oculta
    const exportContainerRef = useRef<HTMLDivElement>(null);

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
                    .order('previsao_total', { ascending: false });
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

    const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

    // --- LÓGICA DE CONSOLIDAÇÃO DO HISTÓRICO DE CHECK-IN ---
    const consolidatedHistory = useMemo(() => {
        if (view !== 'weekly_checkin') return [];

        const processed = weeklyReports.filter(r => r.status !== 'pending');
        const groups = new Map<string, any>();

        processed.forEach(report => {
            const userId = report.usuario_id;
            if (!groups.has(userId)) {
                groups.set(userId, {
                    usuario_id: userId,
                    usuarios: report.usuarios,
                    previsao_total: 0,
                    status: 'approved', // Se houver um aprovado, o consolidado assume approved
                    criado_em: report.criado_em, // Pega a data do mais recente
                    itemsMap: new Map<string, any>()
                });
            }

            const group = groups.get(userId);
            group.previsao_total += Number(report.previsao_total);
            
            // Se houver algum recusado no bolo, sinaliza (opcional, mas ajuda o gerente a ver que houve recusa no período)
            if (report.status === 'rejected') group.status = 'rejected';

            // Mesclar itens (clientes)
            (report.previsao_clientes || []).forEach((item: any) => {
                const cId = item.cliente_id;
                if (!group.itemsMap.has(cId)) {
                    group.itemsMap.set(cId, {
                        ...item,
                        valor_previsto_cliente: 0
                    });
                }
                // Fix: Cast existingItem to any to avoid "Property 'valor_previsto_cliente' does not exist on type 'unknown'"
                const existingItem = group.itemsMap.get(cId) as any;
                if (existingItem) {
                    existingItem.valor_previsto_cliente += Number(item.valor_previsto_cliente);
                }
            });
        });

        return Array.from(groups.values()).map(g => ({
            ...g,
            previsao_clientes: Array.from(g.itemsMap.values()).sort((a,b) => b.valor_previsto_cliente - a.valor_previsto_cliente)
        })).sort((a, b) => b.previsao_total - a.previsao_total);
    }, [weeklyReports, view]);

    const handleDownloadImage = async () => {
        if (!exportContainerRef.current) return;
        setIsExporting(true);
        
        try {
            await new Promise(r => setTimeout(r, 200));

            const canvas = await html2canvas(exportContainerRef.current, {
                scale: 3, 
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: 1200,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('export-area-container');
                    if (el) el.style.backgroundColor = '#ffffff';
                }
            });
            
            const link = document.createElement('a');
            const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
            link.download = `Relatorio_Regional_${date}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
        } catch (err) {
            console.error('Erro ao capturar imagem:', err);
        } finally {
            setIsExporting(false);
        }
    };

    const kpis = useMemo(() => {
        if (view === 'mensais') {
            const totalAnnualConfirmed = previsoes.reduce((acc, curr) => acc + Number(curr.previsao_total), 0);
            return { mainValue: totalAnnualConfirmed, label: 'Metas Confirmadas', count: previsoes.length };
        } else {
            const totalValid = weeklyReports
                .filter(r => r.status === 'pending' || r.status === 'approved')
                .reduce((acc, curr) => acc + Number(curr.previsao_total), 0);
            const repsWhoSent = new Set(weeklyReports.map(r => r.usuario_id));
            const missingRepsList = totalDataStore.users.filter(u => !repsWhoSent.has(u.id));
            return { mainValue: totalValid, label: 'Previsão Semanal', missingCount: missingRepsList.length, missingList: missingRepsList };
        }
    }, [weeklyReports, previsoes, view]);

    const handlePrevisaoAction = async (id: string, status: 'approved' | 'rejected') => {
        setIsActionLoading(true);
        try {
            await supabase.from('previsoes').update({ status }).eq('id', id);
            await fetchData();
            alert(status === 'approved' ? 'Previsão aprovada!' : 'Previsão enviada para revisão.');
        } catch (e) { console.error(e); } finally { setIsActionLoading(false); }
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
            alert('Informe o motivo da revisão.');
            return;
        }
        setIsActionLoading(true);
        try {
            for (const item of reviewItems) {
                await supabase.from('previsao_clientes').update({ valor_previsto_cliente: item.valor_previsto_cliente }).eq('id', item.id);
            }
            const newTotal = reviewItems.reduce((acc, curr) => acc + Number(curr.valor_previsto_cliente), 0);
            await supabase.from('previsoes').update({ status: 'rejected', previsao_total: newTotal, observacao: `WEEKLY_CHECKIN: [REVISÃO GERENTE: ${rejectionReason.toUpperCase()}]` }).eq('id', reviewModalReport.id);
            await fetchData();
            setReviewModalReport(null);
        } catch (e: any) { alert(e.message); } finally { setIsActionLoading(false); }
    };

    const handleDeleteForecast = async (id: string) => {
        if (!confirm('Excluir permanentemente?')) return;
        setIsActionLoading(true);
        try {
            await supabase.from('previsao_clientes').delete().eq('previsao_id', id);
            await supabase.from('previsoes').delete().eq('id', id);
            await fetchData();
        } catch (e: any) { alert(e.message); } finally { setIsActionLoading(false); }
    };

    const executeResetCycle = async () => {
        if (!confirm('Deseja realmente apagar TODOS os check-ins desta semana?')) return;
        setIsActionLoading(true);
        try {
            const { data: weeklies } = await supabase.from('previsoes').select('id').ilike('observacao', 'WEEKLY_CHECKIN%');
            if (weeklies && weeklies.length > 0) {
                const ids = weeklies.map(w => w.id);
                await supabase.from('previsao_clientes').delete().in('previsao_id', ids);
                await supabase.from('previsoes').delete().in('id', ids);
            }
            await fetchData();
            setShowResetModal(false);
            alert('Ciclo resetado.');
        } catch (e: any) { alert(e.message); } finally { setIsActionLoading(false); }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-20">
            
            <div className="space-y-6">
                <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">
                                {view === 'mensais' ? 'Confirmação de Meta Anual' : 'Gestão de Previsões Regional'}
                            </h2>
                            <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mt-2">Acompanhamento do faturamento semanal projetado</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button 
                            onClick={handleDownloadImage}
                            disabled={isExporting || isLoading}
                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-lg text-[10px] font-black uppercase tracking-widest h-12"
                        >
                            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                            {isExporting ? 'Processando...' : 'Capturar Painel'}
                        </button>

                        <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                            <button onClick={() => setView('weekly_checkin')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${view === 'weekly_checkin' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Check-in</button>
                            <button onClick={() => setView('mensais')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'mensais' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Ciência Anual</button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-slate-900 p-6 md:p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden border-b-4 border-blue-600">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{kpis.label}</p>
                        <h3 className="text-3xl font-black tabular-nums">{formatBRL(kpis.mainValue)}</h3>
                    </div>

                    {view === 'weekly_checkin' ? (
                        <>
                            <div onClick={() => setShowMissingRepsModal(true)} className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm relative cursor-pointer hover:border-blue-400 transition-all">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reps s/ Check-in</p>
                                <div className="flex items-baseline gap-2">
                                    <h3 className="text-3xl font-black text-slate-900">{kpis.missingCount}</h3>
                                    <span className="text-xs text-slate-400 font-bold">/ {totalDataStore.users.length}</span>
                                </div>
                            </div>

                            <button onClick={() => setShowResetModal(true)} disabled={isActionLoading} className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-center items-center gap-2 hover:bg-red-50 transition-all">
                                <RotateCcw className={`w-6 h-6 text-red-600 ${isActionLoading ? 'animate-spin' : ''}`} />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resetar Ciclo</p>
                            </button>
                        </>
                    ) : (
                        <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cotas Aceitas</p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-3xl font-black text-slate-900">{kpis.count}</h3>
                                <span className="text-xs text-slate-400 font-bold">Reps deram ciência</span>
                            </div>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>
                ) : (
                    <div className="space-y-12">
                        {view === 'weekly_checkin' && weeklyReports.filter(r => r.status === 'pending').length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest px-4">Fila de Aprovação (Envios Pendentes)</h3>
                                {weeklyReports.filter(r => r.status === 'pending').map(report => (
                                    <div key={report.id} className="bg-white rounded-[32px] border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black">{report.usuarios?.nome.charAt(0)}</div>
                                            <div><h4 className="font-black text-slate-900 uppercase text-md">{report.usuarios?.nome}</h4><p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(report.criado_em).toLocaleDateString('pt-BR')}</p></div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right"><p className="text-[9px] font-black text-blue-600 uppercase">Montante</p><p className="text-xl font-black text-slate-900">{formatBRL(report.previsao_total)}</p></div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handlePrevisaoAction(report.id, 'approved')} className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-lg"><CheckCircle2 className="w-6 h-6" /></button>
                                                <button onClick={() => openReviewModal(report)} className="p-3 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg"><Edit3 className="w-6 h-6" /></button>
                                                <button onClick={() => handleDeleteForecast(report.id)} className="p-3 bg-white border border-slate-200 text-slate-300 hover:text-red-500 rounded-xl"><Trash2 className="w-6 h-6" /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-4">
                                {view === 'mensais' ? 'Ciência de Metas Anuais' : 'Histórico Consolidado por Representante'}
                            </h3>
                            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-900 uppercase tracking-widest">
                                        <tr>
                                            <th className="px-8 py-6">Representante</th>
                                            <th className="px-6 py-6">{view === 'mensais' ? 'Data Envio' : 'Última Atividade'}</th>
                                            <th className="px-6 py-6 text-right">Montante Total</th>
                                            <th className="px-6 py-6 text-center">Status</th>
                                            <th className="px-8 py-6 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(view === 'mensais' ? previsoes : consolidatedHistory).map(report => (
                                            <tr key={view === 'mensais' ? report.id : report.usuario_id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-8 py-5 font-black text-slate-800 uppercase text-xs">{report.usuarios?.nome}</td>
                                                <td className="px-6 py-5 text-xs font-bold text-slate-500">
                                                    {new Date(report.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-5 text-right font-black text-slate-900">{formatBRL(report.previsao_total)}</td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${report.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                        {report.status === 'approved' ? 'Aceito' : 'Recusado'}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <button onClick={() => setSelectedHistoryReport(report)} className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-blue-600 hover:text-white transition-all"><Search className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ÁREA DE EXPORTAÇÃO (PNG) */}
            <div 
                id="export-area-container"
                ref={exportContainerRef}
                style={{ 
                    position: 'fixed', 
                    left: '-9999px', 
                    top: '0', 
                    width: '1200px', 
                    backgroundColor: '#ffffff', 
                    padding: '60px',
                    color: '#000000',
                    fontFamily: 'Inter, sans-serif'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '30px', borderBottom: '3px solid #0f172a', paddingBottom: '30px', marginBottom: '40px' }}>
                    <div style={{ width: '80px', height: '80px', backgroundColor: '#1d4ed8', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
                        <TrendingUp size={48} style={{ margin: 'auto' }} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '42px', fontWeight: '900', textTransform: 'uppercase', margin: '0', color: '#0f172a' }}>
                            {view === 'mensais' ? 'Confirmação de Meta Anual' : 'Gestão de Previsões Regional'}
                        </h2>
                        <p style={{ fontSize: '14px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '4px', marginTop: '8px' }}>
                            Acompanhamento do faturamento semanal projetado
                        </p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '50px' }}>
                    <div style={{ backgroundColor: '#0f172a', padding: '40px', borderRadius: '40px', color: '#ffffff' }}>
                        <p style={{ fontSize: '12px', fontWeight: '900', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '4px', marginBottom: '10px' }}>{kpis.label}</p>
                        <h3 style={{ fontSize: '56px', fontWeight: '900', margin: '0' }}>{formatBRL(kpis.mainValue)}</h3>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '40px', border: '4px solid #f1f5f9' }}>
                        <p style={{ fontSize: '12px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '4px', marginBottom: '10px' }}>{view === 'mensais' ? 'Total de Aceites' : 'Reps s/ Check-in'}</p>
                        <h3 style={{ fontSize: '56px', fontWeight: '900', margin: '0', color: '#0f172a' }}>
                            {view === 'mensais' ? kpis.count : kpis.missingCount} <span style={{ fontSize: '24px', color: '#cbd5e1' }}>/ {totalDataStore.users.length}</span>
                        </h3>
                    </div>
                </div>

                <div style={{ marginTop: '40px' }}>
                    <h3 style={{ fontSize: '20px', fontWeight: '900', textTransform: 'uppercase', color: '#0f172a', marginBottom: '20px', borderLeft: '10px solid #1d4ed8', paddingLeft: '20px' }}>
                        Previsões {view === 'mensais' ? 'por Vendedor' : 'Consolidadas Regional'}
                    </h3>
                    <div style={{ border: '2px solid #f1f5f9', borderRadius: '40px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#ffffff' }}>
                            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #f1f5f9' }}>
                                <tr style={{ color: '#0f172a', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase' }}>
                                    <th style={{ padding: '25px 40px', textAlign: 'left' }}>Representante</th>
                                    <th style={{ padding: '25px 30px', textAlign: 'left' }}>Status</th>
                                    <th style={{ padding: '25px 30px', textAlign: 'right' }}>Montante</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(view === 'mensais' ? previsoes : consolidatedHistory).map(report => (
                                    <tr key={view === 'mensais' ? report.id : report.usuario_id} style={{ borderBottom: '2px solid #f8fafc' }}>
                                        <td style={{ padding: '20px 40px', fontWeight: '900', textTransform: 'uppercase', fontSize: '14px', color: '#1e293b' }}>{report.usuarios?.nome}</td>
                                        <td style={{ padding: '20px 30px' }}>
                                            <div style={{ display: 'inline-block', padding: '6px 15px', borderRadius: '10px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', backgroundColor: report.status === 'approved' ? '#f0fdf4' : '#fef2f2', color: report.status === 'approved' ? '#166534' : '#991b1b', border: `1px solid ${report.status === 'approved' ? '#bbf7d0' : '#fecaca'}` }}>
                                                {report.status === 'approved' ? 'Aceito' : 'Recusado'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 30px', textAlign: 'right', fontWeight: '900', fontSize: '18px', color: '#0f172a' }}>{formatBRL(report.previsao_total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div style={{ marginTop: '50px', textAlign: 'center', borderTop: '2px solid #f1f5f9', paddingTop: '30px' }}>
                    <p style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#cbd5e1', letterSpacing: '5px' }}>Portal Centro-Norte • Inteligência de Dados</p>
                </div>
            </div>

            {/* Modais */}
            {selectedHistoryReport && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Detalhamento Unificado</h3>
                                <p className="text-[10px] font-black text-blue-600 uppercase mt-1">Rep: {selectedHistoryReport.usuarios?.nome}</p>
                            </div>
                            <button onClick={() => setSelectedHistoryReport(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="bg-slate-900 p-6 rounded-3xl text-white mb-6 flex justify-between items-center">
                                <div><p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Montante Agregado</p><h4 className="text-2xl font-black">{formatBRL(selectedHistoryReport.previsao_total)}</h4></div>
                                <div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Itens na Lista</p><h4 className="text-2xl font-black">{selectedHistoryReport.previsao_clientes?.length || 0}</h4></div>
                            </div>
                            <table className="w-full text-left border-collapse bg-white rounded-3xl border border-slate-200 overflow-hidden">
                                <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase border-b border-slate-100">
                                    <tr><th className="px-6 py-4">Cliente / CNPJ</th><th className="px-6 py-4 text-right">Previsão Somada</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(selectedHistoryReport.previsao_clientes || []).map((item: any, idx: number) => (
                                        <tr key={idx}>
                                            <td className="px-6 py-4">
                                                <p className="font-black text-slate-800 uppercase text-[11px] truncate">{item.clientes?.nome_fantasia}</p>
                                                <p className="text-[9px] font-bold text-slate-400">{item.clientes?.cnpj}</p>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-blue-600 text-[11px] tabular-nums">{formatBRL(item.valor_previsto_cliente)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>, document.body
            )}

            {/* Modal de Revisão / Ajustes */}
            {reviewModalReport && createPortal(
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div><h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Sugerir Ajustes</h3><p className="text-[10px] font-black text-red-500 uppercase mt-1">Rep: {reviewModalReport.usuarios?.nome}</p></div>
                            <button onClick={() => setReviewModalReport(null)} className="p-2 hover:bg-white rounded-full text-slate-400"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">
                            <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
                                <label className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2 block">Motivo da Recusa / Observação</label>
                                <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Ex: Aumentar previsão no cliente X, diminuir no Y..." className="w-full p-4 bg-white border border-red-200 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:ring-4 focus:ring-red-100" rows={3} />
                            </div>
                            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase"><tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4 text-right">Valor Previsto</th></tr></thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {reviewItems.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 font-black text-slate-700 uppercase text-[10px]">{item.clientes?.nome_fantasia}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <input 
                                                        type="number" 
                                                        value={item.valor_previsto_cliente} 
                                                        onChange={e => handleUpdateReviewItem(item.id, Number(e.target.value))}
                                                        className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right font-black text-blue-600 text-xs outline-none focus:ring-2 focus:ring-blue-100"
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <Button variant="outline" fullWidth onClick={() => setReviewModalReport(null)} className="rounded-2xl h-14 font-black uppercase text-[10px]">Cancelar</Button>
                            <Button fullWidth onClick={confirmRejectionWithAdjustments} isLoading={isActionLoading} className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black uppercase text-[10px] shadow-xl">Confirmar e Notificar</Button>
                        </div>
                    </div>
                </div>, document.body
            )}

            {/* Reset Modal */}
            {showResetModal && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[40px] p-10 shadow-2xl text-center border border-white/20">
                        <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                            <AlertTriangle className="w-12 h-12" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Resetar Ciclo</h3>
                        <p className="text-sm text-slate-500 mt-4 font-medium leading-relaxed">Isso apagará <strong className="text-red-600">TODOS</strong> os check-ins lançados nesta semana.</p>
                        <div className="grid grid-cols-1 gap-3 mt-10">
                            <Button onClick={executeResetCycle} isLoading={isActionLoading} className="bg-red-600 hover:bg-red-700 h-16 rounded-2xl font-black uppercase text-xs tracking-widest">Apagar Tudo</Button>
                            <Button variant="outline" onClick={() => setShowResetModal(false)} className="h-14 rounded-2xl font-black uppercase text-[10px] border-slate-200">Cancelar</Button>
                        </div>
                    </div>
                </div>, document.body
            )}
        </div>
    );
};
