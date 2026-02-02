import React, { useState, useEffect, useRef } from 'react';
import { Bell, Plus, Trash2, Eye, Paperclip, X, Loader2, Send, CheckCircle, Clock, FileText, CheckSquare, Square, Download, Search, AlertTriangle, CalendarDays, User, Filter, ListChecks, AlertOctagon, Image as ImageIcon, Inbox, Mail } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../Input';
import { supabase } from '../../lib/supabase';
import { createPortal } from 'react-dom';

type TabType = 'new' | 'history' | 'inbox';

export const ManagerNotificationsScreen: React.FC = () => {
    const now = new Date();
    const [activeTab, setActiveTab] = useState<TabType>('new');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [priority, setPriority] = useState('info');
    const [selectedRepIds, setSelectedRepIds] = useState<string[]>([]);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [repSearchTerm, setRepSearchTerm] = useState('');
    
    // Filtros de Histórico
    const [historyFilterRepId, setHistoryFilterRepId] = useState('all');
    const [historyFilterYear, setHistoryFilterYear] = useState<string | 'all'>(String(now.getFullYear()));
    const [historyFilterMonth, setHistoryFilterMonth] = useState<string | 'all'>('all');
    const [historyFilterDay, setHistoryFilterDay] = useState<string | 'all'>('all');
    const [historyFilterPriority, setHistoryFilterPriority] = useState<string | 'all'>('all');

    // Seleção para deleção em massa
    const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

    const [reps, setReps] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [inbox, setInbox] = useState<any[]>([]); // New Inbox State
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [viewingNotification, setViewingNotification] = useState<any | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
    const managerId = session.id;

    const availableYears = [2024, 2025, 2026, 2027];
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

    useEffect(() => {
        fetchReps();
    }, []);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
            setSelectedHistoryIds([]);
        } else if (activeTab === 'inbox') {
            fetchInbox();
            setSelectedHistoryIds([]);
        }
    }, [activeTab, historyFilterRepId, historyFilterYear, historyFilterMonth, historyFilterDay, historyFilterPriority]);

    const fetchReps = async () => {
        const { data } = await supabase
            .from('usuarios')
            .select('id, nome, nivel_acesso')
            .not('nivel_acesso', 'ilike', 'admin')
            .not('nivel_acesso', 'ilike', 'gerente')
            .order('nome');
        setReps(data || []);
    };

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('notificacoes')
                .select('*, para:usuarios!notificacoes_para_usuario_id_fkey(nome), notificacao_anexos(*)')
                .order('criada_em', { ascending: false });

            if (historyFilterRepId !== 'all') {
                query = query.eq('para_usuario_id', historyFilterRepId);
            }

            if (historyFilterPriority !== 'all') {
                query = query.eq('prioridade', historyFilterPriority);
            }

            if (historyFilterYear !== 'all') {
                let start = `${historyFilterYear}-01-01T00:00:00`;
                let end = `${historyFilterYear}-12-31T23:59:59`;

                if (historyFilterMonth !== 'all') {
                    const m = historyFilterMonth.padStart(2, '0');
                    if (historyFilterDay !== 'all') {
                        const d = historyFilterDay.padStart(2, '0');
                        start = `${historyFilterYear}-${m}-${d}T00:00:00`;
                        end = `${historyFilterYear}-${m}-${d}T23:59:59`;
                    } else {
                        start = `${historyFilterYear}-${m}-01T00:00:00`;
                        end = `${historyFilterYear}-${m}-31T23:59:59`;
                    }
                }
                query = query.gte('criada_em', start).lte('criada_em', end);
            }

            const { data } = await query.limit(300);
            setHistory(data || []);
        } catch (e) {
            console.error('Erro ao carregar histórico:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchInbox = async () => {
        setIsLoading(true);
        try {
            // Busca notificações onde o "para_usuario_id" é o gerente
            const { data } = await supabase
                .from('notificacoes')
                .select('*, de:usuarios!notificacoes_de_usuario_id_fkey(nome)')
                .eq('para_usuario_id', managerId)
                .order('criada_em', { ascending: false })
                .limit(200);
            
            setInbox(data || []);
        } catch (e) {
            console.error('Erro ao carregar inbox:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        setIsLoading(true);
        const filePromises = Array.from(files).map(async (file: File) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve({
                        arquivo_nome: file.name,
                        tipo_mime: file.type || 'application/octet-stream',
                        arquivo_url: reader.result as string
                    });
                };
                reader.readAsDataURL(file);
            });
        });

        const newFiles = await Promise.all(filePromises);
        setAttachments(prev => [...prev, ...newFiles]);
        setIsLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !content || selectedRepIds.length === 0) {
            alert('Preencha o assunto, mensagem e selecione pelo menos um destinatário.');
            return;
        }

        setIsSending(true);
        try {
            const fullMessage = `[${title.toUpperCase()}]\n\n${content}`;
            
            const notificationsToInsert = selectedRepIds.map(id => ({
                de_usuario_id: managerId,
                para_usuario_id: id,
                mensagem: fullMessage,
                prioridade: priority,
                lida: false
            }));

            const { data: insertedNotifs, error: notifError } = await supabase
                .from('notificacoes')
                .insert(notificationsToInsert)
                .select('id');

            if (notifError) throw notifError;

            if (attachments.length > 0 && insertedNotifs) {
                const allAnexos = insertedNotifs.flatMap(n => 
                    attachments.map(a => ({
                        notificacao_id: n.id,
                        arquivo_nome: a.arquivo_nome,
                        arquivo_url: a.arquivo_url,
                        tipo_mime: a.tipo_mime
                    }))
                );

                const { error: anexoError } = await supabase
                    .from('notificacao_anexos')
                    .insert(allAnexos);
                
                if (anexoError) throw anexoError;
            }

            alert('Comunicado enviado com sucesso!');
            setTitle('');
            setContent('');
            setAttachments([]);
            setSelectedRepIds([]);
            setActiveTab('history');
        } catch (error: any) {
            alert('Erro ao enviar comunicado: ' + error.message);
        } finally {
            setIsSending(false);
        }
    };

    const toggleHistorySelection = (id: string) => {
        setSelectedHistoryIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleBulkDelete = async () => {
        setIsBulkDeleting(true);
        try {
            // Deleta anexos primeiro por conta da constraint
            await supabase.from('notificacao_anexos').delete().in('notificacao_id', selectedHistoryIds);
            const { error } = await supabase.from('notificacoes').delete().in('id', selectedHistoryIds);

            if (error) throw error;

            // Atualiza ambas as listas
            setHistory(prev => prev.filter(h => !selectedHistoryIds.includes(h.id)));
            setInbox(prev => prev.filter(h => !selectedHistoryIds.includes(h.id)));
            setSelectedHistoryIds([]);
            setShowBulkDeleteConfirm(false);
            alert('Mensagens removidas com sucesso.');
        } catch (e: any) {
            alert(`Erro na remoção: ${e.message}`);
        } finally {
            setIsBulkDeleting(false);
        }
    };

    const executeDelete = async () => {
        if (!confirmDeleteId) return;
        
        setIsLoading(true);
        const idToDelete = confirmDeleteId;
        setConfirmDeleteId(null);

        try {
            await supabase.from('notificacao_anexos').delete().eq('notificacao_id', idToDelete);
            const { error: errNotif } = await supabase.from('notificacoes').delete().eq('id', idToDelete);
            if (errNotif) throw errNotif;

            setHistory(prev => prev.filter(h => h.id !== idToDelete));
            setInbox(prev => prev.filter(h => h.id !== idToDelete));
            setSelectedHistoryIds(prev => prev.filter(i => i !== idToDelete));
            alert('Removido.');
        } catch (e: any) {
            alert(`Falha: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = (file: any) => {
        if (!file.arquivo_url || file.arquivo_url === '#') {
            alert('Arquivo indisponível para download.');
            return;
        }
        const link = document.createElement('a');
        link.href = file.arquivo_url;
        link.download = file.arquivo_nome;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredReps = reps.filter(r => 
        r.nome.toLowerCase().includes(repSearchTerm.toLowerCase())
    );

    // Função para tratar o título da mensagem na exibição do modal
    const parseModalMessage = (msg: string) => {
        if (msg.startsWith('[')) {
            const parts = msg.split(']');
            const title = parts[0].replace('[', '');
            const content = parts.slice(1).join(']').trim();
            return { title, content };
        }
        return { title: 'COMUNICADO', content: msg };
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-4 animate-fadeIn pb-12">
            <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                        <Bell className="w-6 h-6 text-blue-600" /> Central de Comunicados
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestão Regional de Avisos</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                    <button onClick={() => setActiveTab('new')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'new' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Novo Envio</button>
                    <button onClick={() => setActiveTab('inbox')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'inbox' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        <Inbox className="w-3 h-3" /> Caixa de Entrada
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Histórico Envios</button>
                </div>
            </header>

            {activeTab === 'new' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-slideUp">
                    <div className="lg:col-span-4 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col h-[600px]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Destinatários</h3>
                            <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded-lg">{selectedRepIds.length} Sel.</span>
                        </div>
                        
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Filtrar..." 
                                value={repSearchTerm}
                                onChange={e => setRepSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                            {filteredReps.map(rep => (
                                <label 
                                    key={rep.id} 
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${selectedRepIds.includes(rep.id) ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50 border border-transparent'}`}
                                >
                                    <input type="checkbox" className="hidden" checked={selectedRepIds.includes(rep.id)} onChange={() => setSelectedRepIds(prev => prev.includes(rep.id) ? prev.filter(i => i !== rep.id) : [...prev, rep.id])} />
                                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedRepIds.includes(rep.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'}`}>
                                        {selectedRepIds.includes(rep.id) && <CheckSquare className="w-3.5 h-3.5" />}
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-700 uppercase truncate">{rep.nome}</span>
                                </label>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex gap-2">
                             <button onClick={() => setSelectedRepIds(reps.map(r => r.id))} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200">Todos</button>
                             <button onClick={() => setSelectedRepIds([])} className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200">Limpar</button>
                        </div>
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assunto</label>
                                    <Input placeholder="Título do aviso" value={title} onChange={e => setTitle(e.target.value)} className="!bg-slate-50 !h-12 text-sm font-bold" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível</label>
                                    <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all">
                                        <option value="info">INFORMATIVO</option>
                                        <option value="medium">IMPORTANTE</option>
                                        <option value="urgent">URGENTE</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensagem Detalhada</label>
                                <textarea value={content} onChange={e => setContent(e.target.value)} rows={8} placeholder="Escreva aqui..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 outline-none focus:ring-4 focus:ring-blue-100 transition-all" />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Anexos</label>
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase hover:text-blue-700"><Plus className="w-4 h-4" /> Adicionar</button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        multiple 
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp"
                                        onChange={handleFileSelect} 
                                    />
                                </div>
                                {attachments.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {attachments.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                                <div className="flex items-center gap-3 truncate"><FileText className="w-4 h-4 text-blue-500" /><span className="text-[10px] font-bold text-blue-800 truncate">{file.arquivo_nome}</span></div>
                                                <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="p-1 hover:bg-blue-100 rounded-lg text-blue-400"><X className="w-4 h-4" /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Button type="submit" fullWidth isLoading={isSending} className="h-16 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-500/20"><Send className="w-5 h-5 mr-3" /> Disparar Comunicado</Button>
                        </form>
                    </div>
                </div>
            )}

            {(activeTab === 'history' || activeTab === 'inbox') && (
                <div className="space-y-4 animate-slideUp">
                    {activeTab === 'history' && (
                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                                <Filter className="w-4 h-4 text-blue-600" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Refinar Busca no Histórico</span>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <select value={historyFilterRepId} onChange={e => setHistoryFilterRepId(e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-100">
                                        <option value="all">TODOS REPRESENTANTES</option>
                                        {reps.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                                    </select>
                                </div>

                                <div className="relative">
                                    <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <select value={historyFilterPriority} onChange={e => setHistoryFilterPriority(e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-100">
                                        <option value="all">TODOS OS NÍVEIS</option>
                                        <option value="info">INFORMATIVOS</option>
                                        <option value="medium">IMPORTANTES</option>
                                        <option value="urgent">URGENTES</option>
                                    </select>
                                </div>

                                <div className="relative">
                                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <select value={historyFilterYear} onChange={e => setHistoryFilterYear(e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-100">
                                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>

                                <div className="relative">
                                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <select value={historyFilterMonth} onChange={e => setHistoryFilterMonth(e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-100">
                                        <option value="all">MÊS: TODOS</option>
                                        {monthNames.map((m, i) => <option key={i} value={String(i + 1)}>{m.toUpperCase()}</option>)}
                                    </select>
                                </div>

                                <div className="relative">
                                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <select value={historyFilterDay} onChange={e => setHistoryFilterDay(e.target.value)} className="w-full pl-9 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-100">
                                        <option value="all">DIA: TODOS</option>
                                        {days.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedHistoryIds.length > 0 && (
                        <div className="flex justify-end">
                            <button onClick={() => setShowBulkDeleteConfirm(true)} className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-red-700 transition-all animate-fadeIn">
                                <Trash2 className="w-3.5 h-3.5" />
                                Excluir Selecionados ({selectedHistoryIds.length})
                            </button>
                        </div>
                    )}

                    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        <th className="px-6 py-5 w-12">
                                            <button onClick={() => { 
                                                const currentList = activeTab === 'inbox' ? inbox : history;
                                                if (selectedHistoryIds.length === currentList.length) setSelectedHistoryIds([]); 
                                                else setSelectedHistoryIds(currentList.map(h => h.id)); 
                                            }} className="p-1 hover:bg-slate-200 rounded transition-colors">
                                                {selectedHistoryIds.length === (activeTab === 'inbox' ? inbox.length : history.length) && (activeTab === 'inbox' ? inbox.length : history.length) > 0 ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                                            </button>
                                        </th>
                                        <th className="px-6 py-5">Envio</th>
                                        <th className="px-6 py-5">Assunto</th>
                                        <th className="px-6 py-5">{activeTab === 'inbox' ? 'Remetente' : 'Para'}</th>
                                        {activeTab !== 'inbox' && <th className="px-6 py-5 text-center">Nível</th>}
                                        {activeTab !== 'inbox' && <th className="px-6 py-5 text-center">Status</th>}
                                        <th className="px-8 py-5 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {isLoading ? (
                                        <tr><td colSpan={activeTab === 'inbox' ? 5 : 7} className="px-8 py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" /><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Carregando...</p></td></tr>
                                    ) : (activeTab === 'inbox' ? inbox : history).length === 0 ? (
                                        <tr><td colSpan={activeTab === 'inbox' ? 5 : 7} className="px-8 py-20 text-center"><Bell className="w-12 h-12 text-slate-100 mx-auto mb-4" /><p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">{activeTab === 'inbox' ? 'Caixa de entrada vazia' : 'Sem correspondências no histórico'}</p></td></tr>
                                    ) : (
                                        (activeTab === 'inbox' ? inbox : history).map(item => {
                                            const titleMatch = item.mensagem.match(/\[(.*?)\]/);
                                            const displayTitle = titleMatch ? titleMatch[1] : 'COMUNICADO';
                                            const isSelected = selectedHistoryIds.includes(item.id);
                                            const personName = activeTab === 'inbox' ? (item.de?.nome || 'Desconhecido') : (item.para?.nome || 'Destinatário');
                                            
                                            return (
                                                <tr 
                                                    key={item.id} 
                                                    className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${isSelected ? 'bg-blue-50/30' : ''}`}
                                                    onClick={() => setViewingNotification(item)}
                                                >
                                                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                                        <button onClick={() => toggleHistorySelection(item.id)} className="p-1 hover:bg-slate-200 rounded transition-colors">
                                                            {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-200" />}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4"><div className="flex items-center gap-2 text-[10px] font-bold text-slate-500"><Clock className="w-3.5 h-3.5" />{new Date(item.criada_em).toLocaleString('pt-BR')}</div></td>
                                                    <td className="px-6 py-4"><p className="text-[11px] font-black text-slate-800 uppercase truncate max-w-[180px]">{displayTitle}</p></td>
                                                    <td className="px-6 py-4"><span className="text-[10px] font-bold text-slate-600 uppercase bg-slate-100 px-2 py-1 rounded-lg">{personName}</span></td>
                                                    {activeTab !== 'inbox' && (
                                                        <>
                                                            <td className="px-6 py-4 text-center"><span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full border ${item.prioridade === 'urgent' ? 'bg-red-50 text-red-600 border-red-100' : item.prioridade === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{item.prioridade === 'urgent' ? 'Urgente' : item.prioridade === 'medium' ? 'Importante' : 'Informativo'}</span></td>
                                                            <td className="px-6 py-4 text-center"><div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase ${item.lida ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>{item.lida ? <CheckCircle className="w-3 h-3" /> : <Loader2 className="w-3 h-3" />}{item.lida ? 'Visto' : 'Pendente'}</div></td>
                                                        </>
                                                    )}
                                                    <td className="px-8 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                        <div className="flex justify-end gap-2">
                                                            <button onClick={() => setViewingNotification(item)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Eye className="w-4 h-4" /></button>
                                                            <button onClick={() => setConfirmDeleteId(item.id)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm disabled:opacity-30" disabled={isLoading}><Trash2 className="w-4 h-4" /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação para Item Único */}
            {confirmDeleteId && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-slideUp text-center border border-white/20">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-10 h-10" /></div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Exclusão Permanente</h3>
                        <p className="text-sm text-slate-500 mt-2 font-medium">Deseja apagar este comunicado?</p>
                        <div className="grid grid-cols-2 gap-4 mt-8">
                            <Button variant="outline" onClick={() => setConfirmDeleteId(null)} className="rounded-2xl h-14 font-black uppercase text-[10px]">Cancelar</Button>
                            <Button onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black uppercase text-[10px]">Excluir</Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal de Confirmação para Lote (Massa) */}
            {showBulkDeleteConfirm && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-slideUp text-center border border-white/20">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6"><Trash2 className="w-10 h-10" /></div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Excluir Lote</h3>
                        <p className="text-sm text-slate-500 mt-2 font-medium">
                            Você selecionou <strong>{selectedHistoryIds.length}</strong> comunicados. Deseja excluí-los permanentemente um a um?
                        </p>
                        <div className="grid grid-cols-2 gap-4 mt-8">
                            <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)} className="rounded-2xl h-14 font-black uppercase text-[10px]">Cancelar</Button>
                            <Button 
                                onClick={handleBulkDelete} 
                                isLoading={isBulkDeleting}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black uppercase text-[10px] shadow-xl"
                            >
                                Confirmar Lote
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* MODAL DE DETALHES */}
            {viewingNotification && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp border-t-8 border-blue-600 flex flex-col max-h-[85vh]">
                        
                        {/* Header Fixo */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                    viewingNotification.prioridade === 'urgent' ? 'bg-red-100 text-red-600 animate-pulse' : 
                                    viewingNotification.prioridade === 'medium' ? 'bg-amber-100 text-amber-600' : 
                                    'bg-blue-100 text-blue-600'
                                }`}>
                                    <AlertOctagon className="w-7 h-7" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                                        {parseModalMessage(viewingNotification.mensagem).title}
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                        {activeTab === 'inbox' ? `Remetente: ${viewingNotification.de?.nome || 'N/I'}` : `Destinatário: ${viewingNotification.para?.nome || 'N/I'}`}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setViewingNotification(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Conteúdo Rolável */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30">
                            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Conteúdo do Comunicado</p>
                                        <p className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap font-medium">
                                            {parseModalMessage(viewingNotification.mensagem).content}
                                        </p>
                                    </div>

                                    {viewingNotification.notificacao_anexos?.length > 0 && (
                                        <div className="pt-6 border-t border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Arquivos Vinculados (Clique para baixar)</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {viewingNotification.notificacao_anexos.map((anexo: any) => (
                                                    <div 
                                                        key={anexo.id} 
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(anexo); }}
                                                        className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group/file"
                                                    >
                                                        <div className="flex items-center gap-3 truncate">
                                                            {anexo.tipo_mime?.includes('image') ? <ImageIcon className="w-4 h-4 text-purple-500" /> : <FileText className="w-4 h-4 text-slate-400" />}
                                                            <span className="text-[10px] font-bold text-slate-700 truncate group-hover/file:text-blue-700">{anexo.arquivo_nome}</span>
                                                        </div>
                                                        <Download className="w-4 h-4 text-slate-300 group-hover/file:text-blue-500 transition-colors" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Rodapé Fixo */}
                        <div className="p-8 border-t border-slate-100 bg-white shrink-0 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-6">
                                <div className="text-center md:text-left">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enviado em</p>
                                    <p className="text-[11px] font-bold text-slate-700">{new Date(viewingNotification.criada_em).toLocaleString('pt-BR')}</p>
                                </div>
                                <div className="text-center md:text-left">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase ${viewingNotification.lida ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {viewingNotification.lida ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                        {viewingNotification.lida ? 'Visto' : 'Pendente'}
                                    </div>
                                </div>
                            </div>
                            <Button 
                                onClick={() => setViewingNotification(null)} 
                                variant="outline"
                                className="rounded-2xl h-12 px-12 font-black uppercase text-[10px] tracking-widest"
                            >
                                Fechar Visualização
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};