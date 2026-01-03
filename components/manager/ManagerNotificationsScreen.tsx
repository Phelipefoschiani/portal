
import React, { useState, useEffect, useRef } from 'react';
import { Bell, Plus, Trash2, Eye, Paperclip, X, Loader2, Send, List, CheckCircle, Clock, FileText, CheckSquare, Square, Download, Search, AlertCircle, AlertTriangle } from 'lucide-react';
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
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
    const managerId = session.id;

    useEffect(() => {
        fetchReps();
        if (activeTab === 'history') fetchHistory();
    }, [activeTab]);

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
            const { data } = await supabase
                .from('notificacoes')
                .select('*, para:usuarios!notificacoes_para_usuario_id_fkey(nome), notificacao_anexos(*)')
                .order('criada_em', { ascending: false })
                .limit(50);
            setHistory(data || []);
        } catch (e) {
            console.error('Erro ao carregar histórico:', e);
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

    const executeDelete = async () => {
        if (!confirmDeleteId) return;
        
        setIsLoading(true);
        const idToDelete = confirmDeleteId;
        setConfirmDeleteId(null);

        try {
            // 1. Remover Anexos
            await supabase.from('notificacao_anexos').delete().eq('notificacao_id', idToDelete);
            
            // 2. Remover a Notificação
            const { error: errNotif } = await supabase.from('notificacoes').delete().eq('id', idToDelete);

            if (errNotif) throw errNotif;

            setHistory(prev => prev.filter(h => h.id !== idToDelete));
            alert('Comunicado removido com sucesso.');
        } catch (e: any) {
            console.error('Erro na exclusão:', e);
            alert(`Falha na exclusão: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredReps = reps.filter(r => 
        r.nome.toLowerCase().includes(repSearchTerm.toLowerCase())
    );

    return (
        <div className="w-full max-w-5xl mx-auto space-y-4 animate-fadeIn pb-12">
            <header className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm gap-4">
                <div>
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                        <Bell className="w-6 h-6 text-blue-600" /> Central de Comunicados
                    </h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Envio de informações e diretrizes comerciais</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                    <button 
                        onClick={() => setActiveTab('new')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'new' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Novo Comunicado
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Histórico de Envios
                    </button>
                </div>
            </header>

            {activeTab === 'new' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col h-[600px]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Destinatários</h3>
                            <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded-lg">{selectedRepIds.length} Selecionados</span>
                        </div>
                        
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Filtrar equipe..." 
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
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={selectedRepIds.includes(rep.id)}
                                        onChange={() => setSelectedRepIds(prev => 
                                            prev.includes(rep.id) ? prev.filter(i => i !== rep.id) : [...prev, rep.id]
                                        )}
                                    />
                                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedRepIds.includes(rep.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'}`}>
                                        {selectedRepIds.includes(rep.id) && <CheckCircle className="w-3.5 h-3.5" />}
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-700 uppercase truncate">{rep.nome}</span>
                                </label>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-slate-100 flex gap-2">
                             <button 
                                onClick={() => setSelectedRepIds(reps.map(r => r.id))}
                                className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-all"
                             >
                                Selecionar Todos
                             </button>
                             <button 
                                onClick={() => setSelectedRepIds([])}
                                className="flex-1 py-2 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase hover:bg-slate-200 transition-all"
                             >
                                Limpar
                             </button>
                        </div>
                    </div>

                    <div className="lg:col-span-8 space-y-6">
                        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assunto do Comunicado</label>
                                    <Input 
                                        placeholder="Ex: Nova Tabela de Preços" 
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="!bg-slate-50 !h-12 text-sm font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível de Prioridade</label>
                                    <select 
                                        value={priority}
                                        onChange={e => setPriority(e.target.value)}
                                        className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                    >
                                        <option value="info">INFORMATIVO (PADRÃO)</option>
                                        <option value="medium">IMPORTANTE (ALERTA EM 5 MIN)</option>
                                        <option value="urgent">URGENTE (BLOQUEIO DE TELA)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Corpo do Comunicado</label>
                                <textarea 
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    rows={8}
                                    placeholder="Escreva as instruções ou informações aqui..."
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arquivos em Anexo</label>
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase hover:text-blue-700"
                                    >
                                        <Plus className="w-4 h-4" /> Adicionar Arquivos
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        multiple 
                                        onChange={handleFileSelect}
                                    />
                                </div>

                                {attachments.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {attachments.map((file, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                                <div className="flex items-center gap-3 truncate">
                                                    <FileText className="w-4 h-4 text-blue-500" />
                                                    <span className="text-[10px] font-bold text-blue-800 truncate">{file.arquivo_nome}</span>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                    className="p-1 hover:bg-blue-100 rounded-lg text-blue-400 hover:text-blue-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-300">
                                        <Paperclip className="w-8 h-8 mb-2 opacity-20" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Nenhum anexo selecionado</p>
                                    </div>
                                )}
                            </div>

                            <Button 
                                type="submit" 
                                fullWidth 
                                isLoading={isSending}
                                className="h-16 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/20"
                            >
                                <Send className="w-5 h-5 mr-3" /> Disparar Comunicado Regional
                            </Button>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden animate-slideUp min-h-[400px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <th className="px-8 py-5">Data/Hora</th>
                                    <th className="px-6 py-5">Assunto</th>
                                    <th className="px-6 py-5">Para</th>
                                    <th className="px-6 py-5 text-center">Nível</th>
                                    <th className="px-6 py-5 text-center">Status</th>
                                    <th className="px-8 py-5 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando histórico...</p>
                                        </td>
                                    </tr>
                                ) : history.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-20 text-center">
                                            <Bell className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                                            <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">Nenhum comunicado enviado recentemente</p>
                                        </td>
                                    </tr>
                                ) : (
                                    history.map(item => {
                                        const titleRegex = /\[(.*?)\]/;
                                        const titleMatch = item.mensagem.match(titleRegex);
                                        const displayTitle = titleMatch ? titleMatch[1] : 'COMUNICADO';
                                        
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-8 py-4">
                                                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {new Date(item.criada_em).toLocaleString('pt-BR')}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-[11px] font-black text-slate-800 uppercase truncate max-w-[200px]">{displayTitle}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-[10px] font-bold text-slate-600 uppercase bg-slate-100 px-2 py-1 rounded-lg">
                                                        {item.para?.nome || 'Destinatário'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full border ${
                                                        item.prioridade === 'urgent' ? 'bg-red-50 text-red-600 border-red-100' :
                                                        item.prioridade === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                        'bg-blue-50 text-blue-600 border-blue-100'
                                                    }`}>
                                                        {item.prioridade === 'urgent' ? 'Urgente' : item.prioridade === 'medium' ? 'Importante' : 'Informativo'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                     <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase ${item.lida ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        {item.lida ? <CheckCircle className="w-3 h-3" /> : <Loader2 className="w-3 h-3" />}
                                                        {item.lida ? 'Visualizado' : 'Pendente'}
                                                     </div>
                                                </td>
                                                <td className="px-8 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button 
                                                            onClick={() => setViewingNotification(item)}
                                                            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                                            title="Ver Detalhes"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => setConfirmDeleteId(item.id)}
                                                            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm disabled:opacity-30"
                                                            disabled={isLoading}
                                                            title="Excluir Definitivamente"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
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
            )}

            {/* Modal de Confirmação Customizado (Substitui o window.confirm) */}
            {confirmDeleteId && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-slideUp text-center border border-white/20">
                        <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Exclusão Permanente</h3>
                        <p className="text-sm text-slate-500 mt-2 font-medium">Deseja realmente apagar este comunicado? Ele será removido do mural do representante imediatamente.</p>
                        <div className="grid grid-cols-2 gap-4 mt-8">
                            <Button 
                                variant="outline" 
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-2xl h-14 font-black uppercase text-[10px]"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                onClick={executeDelete}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black uppercase text-[10px] shadow-xl shadow-red-200"
                            >
                                Sim, Excluir
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {viewingNotification && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Comunicado Enviado</h3>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Para: {viewingNotification.para?.nome}</p>
                            </div>
                            <button onClick={() => setViewingNotification(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                    {viewingNotification.mensagem}
                                </p>
                            </div>

                            {viewingNotification.notificacao_anexos?.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Arquivos Anexados</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {viewingNotification.notificacao_anexos.map((anexo: any) => (
                                            <div key={anexo.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                                                <div className="flex items-center gap-3 truncate">
                                                    <FileText className="w-4 h-4 text-slate-400" />
                                                    <span className="text-[10px] font-bold text-slate-600 truncate">{anexo.arquivo_nome}</span>
                                                </div>
                                                <Download className="w-4 h-4 text-slate-300" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Status de Recebimento</p>
                                    <div className="flex items-center gap-2">
                                        {viewingNotification.lida ? (
                                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                                        ) : (
                                            <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />
                                        )}
                                        <span className={`text-[10px] font-black uppercase ${viewingNotification.lida ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {viewingNotification.lida ? 'Lido pelo representante' : 'Aguardando leitura'}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Prioridade</p>
                                    <span className={`text-[10px] font-black uppercase ${
                                        viewingNotification.prioridade === 'urgent' ? 'text-red-600' :
                                        viewingNotification.prioridade === 'medium' ? 'text-amber-600' :
                                        'text-blue-600'
                                    }`}>
                                        {viewingNotification.prioridade?.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button onClick={() => setViewingNotification(null)} variant="outline" className="rounded-xl px-10 font-black uppercase text-[10px]">Fechar Visualização</Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
