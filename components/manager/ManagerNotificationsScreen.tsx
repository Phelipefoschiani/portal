
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Plus, Trash2, Eye, Paperclip, X, Loader2, Send, List, CheckCircle, Clock, FileText, CheckSquare, Square, Download, Search } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../Input';
import { supabase } from '../../lib/supabase';
import { createPortal } from 'react-dom';

type TabType = 'new' | 'history';

export const ManagerNotificationsScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('new');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [priority, setPriority] = useState('info');
    const [selectedRepIds, setSelectedRepIds] = useState<string[]>([]);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [repSearchTerm, setRepSearchTerm] = useState('');
    
    const [reps, setReps] = useState<any[]>([]);
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [viewingNotification, setViewingNotification] = useState<any | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
    const managerId = session.id;

    useEffect(() => {
        fetchReps();
        if (activeTab === 'history') fetchHistory();
    }, [activeTab]);

    const fetchReps = async () => {
        const { data } = await supabase.from('usuarios').select('id, nome').eq('nivel_acesso', 'representante').order('nome');
        setReps(data || []);
    };

    const fetchHistory = async () => {
        setIsLoading(true);
        const { data } = await supabase.from('notificacoes').select('*, para:usuarios!notificacoes_para_usuario_id_fkey(nome), notificacao_anexos(*)').order('criada_em', { ascending: false }).limit(20);
        setHistory(data || []);
        setIsLoading(false);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        setIsLoading(true);
        const filePromises = Array.from(files).map(async (file: File) => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({ arquivo_nome: file.name, tipo_mime: file.type || 'application/octet-stream', arquivo_url: reader.result as string });
                reader.readAsDataURL(file);
            });
        });
        const newFiles = await Promise.all(filePromises);
        setAttachments(prev => [...prev, ...newFiles]);
        setIsLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !content || selectedRepIds.length === 0) return;
        setIsSending(true);
        try {
            const fullMessage = `[${title.toUpperCase()}]\n\n${content}`;
            const { data: insertedNotifs } = await supabase.from('notificacoes').insert(selectedRepIds.map(id => ({ de_usuario_id: managerId, para_usuario_id: id, mensagem: fullMessage, prioridade: priority, lida: false }))).select('id');
            if (attachments.length > 0 && insertedNotifs) {
                const atts = insertedNotifs.flatMap(n => attachments.map(a => ({ notificacao_id: n.id, ...a })));
                await supabase.from('notificacao_anexos').insert(atts);
            }
            setTitle(''); setContent(''); setAttachments([]); setSelectedRepIds([]); setActiveTab('history');
        } catch (e) { console.error(e); } finally { setIsSending(false); }
    };

    const filteredReps = reps.filter(r => r.nome.toLowerCase().includes(repSearchTerm.toLowerCase()));

    return (
        <div className="w-full max-w-5xl mx-auto space-y-4 animate-fadeIn pb-8">
            <header className="flex justify-between items-center bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <Bell className="w-4 h-4 text-blue-600" /> Comunicados
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setActiveTab('new')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'new' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Novo</button>
                    <button onClick={() => setActiveTab('history')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Histórico</button>
                </div>
            </header>

            {activeTab === 'new' ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input type="text" placeholder="Buscar..." value={repSearchTerm} onChange={e => setRepSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                            {filteredReps.map(rep => (
                                <label key={rep.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${selectedRepIds.includes(rep.id) ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                                    <input type="checkbox" className="hidden" checked={selectedRepIds.includes(rep.id)} onChange={() => setSelectedRepIds(prev => prev.includes(rep.id) ? prev.filter(i => i !== rep.id) : [...prev, rep.id])} />
                                    {selectedRepIds.includes(rep.id) ? <CheckCircle className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 border-2 border-slate-200 rounded-full" />}
                                    <span className="text-[10px] font-bold uppercase truncate">{rep.nome}</span>
                                </label>
                            ))}
                        </div>
                        <button onClick={() => setSelectedRepIds(selectedRepIds.length === reps.length ? [] : reps.map(r => r.id))} className="mt-2 text-[9px] font-black text-blue-600 uppercase text-center py-2 border-t border-slate-100">Selecionar Todos</button>
                    </div>

                    <form onSubmit={handleSubmit} className="md:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Assunto" value={title} onChange={e => setTitle(e.target.value)} required className="!bg-slate-50 !h-10 text-xs font-bold" labelClassName="text-[9px] font-black uppercase text-slate-400" />
                            <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase mb-2 block">Prioridade</label>
                                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none">
                                    <option value="info">INFORMATIVO</option>
                                    <option value="medium">IMPORTANTE</option>
                                    <option value="urgent">URGENTE</option>
                                </select>
                            </div>
                        </div>
                        <textarea value={content} onChange={e => setContent(e.target.value)} rows={6} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-700 outline-none focus:ring-1 focus:ring-blue-500" placeholder="Escreva aqui..." required />
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-wrap gap-2">
                                {attachments.map((a, i) => <div key={i} className="flex items-center gap-2 bg-blue-50 text-blue-600 px-2 py-1 rounded text-[9px] font-black uppercase"><FileText className="w-3 h-3" /> {a.arquivo_nome.slice(0, 10)}...</div>)}
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1.5 p-1.5 hover:text-blue-600 transition-colors"><Paperclip className="w-3 h-3" /> Anexar</button>
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple />
                            </div>
                            <Button type="submit" isLoading={isSending} className="h-10 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest">Enviar Agora</Button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase">
                            <tr>
                                <th className="px-6 py-3">Data</th>
                                <th className="px-6 py-3">Para</th>
                                <th className="px-6 py-3">Mensagem</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {history.map(item => (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-3 text-[10px] font-bold text-slate-400">{new Date(item.criada_em).toLocaleDateString()}</td>
                                    <td className="px-6 py-3 text-[10px] font-black text-slate-700 uppercase">{item.para?.nome || 'Vários'}</td>
                                    <td className="px-6 py-3 text-[10px] text-slate-500 truncate max-w-xs">{item.mensagem}</td>
                                    <td className="px-6 py-3 text-center">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${item.lida ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                            {item.lida ? 'Lido' : 'Pendente'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <button onClick={() => setViewingNotification(item)} className="p-1.5 text-slate-300 hover:text-blue-600"><Eye className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
