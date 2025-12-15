import React, { useState, useRef } from 'react';
import { Bell, Plus, Trash2, CheckCircle2, Eye, Paperclip, FileText, Image as ImageIcon, X, Download } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../Input';
import { mockNotifications, representatives, createNotification, deleteNotification, NotificationPriority, Attachment } from '../../lib/mockData';

export const ManagerNotificationsScreen: React.FC = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [priority, setPriority] = useState<NotificationPriority>('info');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    
    // Referência para o input de arquivo oculto
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Forçar re-render
    const [updater, setUpdater] = useState(0);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            
            const newAttachments: Attachment[] = files.map((file: File) => {
                // Determina o tipo baseado na extensão ou mime type de forma simplificada
                let type: 'pdf' | 'image' | 'doc' = 'doc';
                if (file.type.includes('image')) type = 'image';
                else if (file.type.includes('pdf')) type = 'pdf';
                
                // Formata o tamanho
                const sizeInKb = file.size / 1024;
                const sizeString = sizeInKb > 1024 
                    ? `${(sizeInKb / 1024).toFixed(1)} MB` 
                    : `${sizeInKb.toFixed(0)} KB`;

                return {
                    name: file.name,
                    // Cria uma URL local para simular o upload e permitir download/preview imediato
                    url: URL.createObjectURL(file),
                    type: type,
                    size: sizeString
                };
            });

            setAttachments(prev => [...prev, ...newAttachments]);
        }
        
        // Limpa o input para permitir selecionar o mesmo arquivo novamente se quiser
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createNotification({
            title,
            content,
            priority,
            attachments: attachments // Envia os anexos processados
        });
        
        // Reset Form
        setTitle('');
        setContent('');
        setPriority('info');
        setAttachments([]);
        setUpdater(prev => prev + 1);
        
        alert('Notificação enviada com sucesso!');
    };

    const handleDelete = (id: string) => {
        if(window.confirm('Tem certeza que deseja apagar esta notificação?')) {
            deleteNotification(id);
            setUpdater(prev => prev + 1);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-8 animate-fadeIn pb-12">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Bell className="w-7 h-7 text-blue-600" />
                        Gestão de Notificações
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Crie comunicados para a equipe e acompanhe a leitura.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Criação */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm sticky top-6">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5" /> Nova Mensagem
                        </h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input 
                                label="Título"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                placeholder="Ex: Alteração de Tabela"
                            />
                            
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                                <select 
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as NotificationPriority)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="info">Informativo (Azul)</option>
                                    <option value="medium">Importante (Amarelo)</option>
                                    <option value="urgent">Urgente (Vermelho)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Conteúdo</label>
                                <textarea 
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    required
                                    rows={4}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder="Digite a mensagem..."
                                />
                            </div>

                            {/* Área de Anexos */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Anexos</label>
                                
                                {/* Input Oculto */}
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden" 
                                    multiple 
                                />
                                
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    fullWidth 
                                    className="border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-400 mb-3"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Paperclip className="w-4 h-4 mr-2" />
                                    Adicionar Arquivos
                                </Button>

                                {/* Lista de Anexos Pendentes */}
                                {attachments.length > 0 && (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                        {attachments.map((att, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm">
                                                <div className="flex items-center gap-2 truncate">
                                                    {att.type === 'image' ? <ImageIcon className="w-4 h-4 text-purple-500"/> : <FileText className="w-4 h-4 text-blue-500"/>}
                                                    <span className="truncate max-w-[150px] text-slate-700" title={att.name}>{att.name}</span>
                                                    <span className="text-xs text-slate-400">({att.size})</span>
                                                </div>
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeAttachment(idx)}
                                                    className="text-slate-400 hover:text-red-500 p-1"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Button type="submit" fullWidth>
                                Enviar Notificação
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Lista de Enviados */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-bold text-slate-800 mb-2">Histórico de Envios</h3>
                    {mockNotifications.length === 0 ? (
                        <p className="text-slate-400 italic">Nenhuma notificação ativa.</p>
                    ) : (
                        mockNotifications.map(notif => (
                            <div key={notif.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`w-2 h-2 rounded-full ${notif.priority === 'urgent' ? 'bg-red-500' : notif.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'}`}></span>
                                            <h4 className="font-bold text-slate-900">{notif.title}</h4>
                                        </div>
                                        <p className="text-xs text-slate-400">{new Date(notif.date).toLocaleString('pt-BR')}</p>
                                    </div>
                                    <button onClick={() => handleDelete(notif.id)} className="text-slate-300 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    {notif.content}
                                </p>
                                
                                {/* Indicador de Anexos no Histórico - AGORA COM DOWNLOAD */}
                                {notif.attachments && notif.attachments.length > 0 && (
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                                        {notif.attachments.map((att, idx) => (
                                            <a 
                                                key={idx} 
                                                href={att.url}
                                                download={att.name}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg text-xs text-slate-700 border border-slate-200 whitespace-nowrap hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors cursor-pointer group"
                                                title="Baixar anexo"
                                            >
                                                {att.type === 'image' ? <ImageIcon className="w-3.5 h-3.5"/> : <Paperclip className="w-3.5 h-3.5" />}
                                                <span className="max-w-[120px] truncate font-medium">{att.name}</span>
                                                <Download className="w-3.5 h-3.5 ml-1 opacity-50 group-hover:opacity-100" />
                                            </a>
                                        ))}
                                    </div>
                                )}
                                
                                {/* Status de Leitura */}
                                <div className="border-t border-slate-100 pt-3">
                                    <div className="flex items-center justify-between text-xs mb-2">
                                        <span className="font-bold text-slate-500 uppercase">Status de Entrega</span>
                                        <span className="text-blue-600 font-medium">
                                            {notif.readBy.length} de {representatives.length} leram
                                        </span>
                                    </div>
                                    
                                    {/* Lista simplificada de quem leu (Mockando nomes baseados em IDs) */}
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                        {representatives.map(rep => {
                                            const isRead = notif.readBy.includes(rep.id);
                                            const isDelivered = notif.deliveredTo.includes(rep.id);
                                            
                                            return (
                                                <div key={rep.id} className={`flex-shrink-0 px-2 py-1 rounded border text-[10px] font-medium flex items-center gap-1 ${isRead ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : isDelivered ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                    {isRead ? <CheckCircle2 className="w-3 h-3"/> : isDelivered ? <Eye className="w-3 h-3"/> : <span className="w-3 h-3 block bg-slate-200 rounded-full"/>}
                                                    {rep.name.split(' ')[0]}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};