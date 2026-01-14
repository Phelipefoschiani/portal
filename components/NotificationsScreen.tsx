import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Clock, AlertOctagon, Info, MailOpen, ChevronDown, CheckCircle2, RefreshCw, Loader2, Paperclip, Download, FileText, Image as ImageIcon, Filter, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';

interface NotificationsScreenProps {
  onFixForecast?: (id: string) => void;
}

type FilterType = 'all' | 'info' | 'important' | 'urgent' | 'attachments';

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onFixForecast }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  useEffect(() => {
    if (userId) fetchNotifications();
  }, [userId]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*, notificacao_anexos(*)')
        .eq('para_usuario_id', userId)
        .order('lida', { ascending: true }) 
        .order('criada_em', { ascending: false });
      
      if (error) throw error;
      setNotifications(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
        case 'info': return notifications.filter(n => n.prioridade === 'info');
        case 'important': return notifications.filter(n => n.prioridade === 'medium');
        case 'urgent': return notifications.filter(n => n.prioridade === 'urgent');
        case 'attachments': return notifications.filter(n => n.notificacao_anexos && n.notificacao_anexos.length > 0);
        default: return notifications;
    }
  }, [notifications, activeFilter]);

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    } catch (e) {
      console.error(e);
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

  const parseMessage = (msg: string) => {
    if (msg.startsWith('[')) {
      const parts = msg.split(']');
      const title = parts[0].replace('[', '');
      const content = parts.slice(1).join(']').trim();
      return { title, content };
    }
    return { title: 'COMUNICADO', content: msg };
  };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Sincronizando mural...</p>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" /> Mural de Avisos
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clique para expandir os detalhes</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar max-w-full">
            <button onClick={() => setActiveFilter('all')} className={`whitespace-nowrap px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeFilter === 'all' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Todos</button>
            <button onClick={() => setActiveFilter('info')} className={`whitespace-nowrap px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeFilter === 'info' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Informativos</button>
            <button onClick={() => setActiveFilter('important')} className={`whitespace-nowrap px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeFilter === 'important' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Importantes</button>
            <button onClick={() => setActiveFilter('urgent')} className={`whitespace-nowrap px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeFilter === 'urgent' ? 'bg-white text-red-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Urgentes</button>
            <button onClick={() => setActiveFilter('attachments')} className={`whitespace-nowrap px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${activeFilter === 'attachments' ? 'bg-white text-purple-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                <Paperclip className="w-3 h-3" /> Anexos
            </button>
        </div>
      </div>

      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-[32px] p-20 text-center border border-dashed border-slate-200">
             <MailOpen className="w-12 h-12 text-slate-100 mx-auto mb-4" />
             <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">Nenhum aviso encontrado</p>
          </div>
        ) : (
          filteredNotifications.map(notif => {
            const { title, content } = parseMessage(notif.mensagem);
            const isExpanded = expandedId === notif.id;
            const hasAnexo = notif.notificacao_anexos?.length > 0;

            return (
              <div 
                key={notif.id} 
                className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                    !notif.lida 
                    ? (notif.prioridade === 'urgent' ? 'border-red-500 shadow-lg ring-1 ring-red-100' : notif.prioridade === 'medium' ? 'border-amber-400 shadow-md' : 'border-blue-400 shadow-sm')
                    : 'border-slate-200 opacity-90'
                }`}
              >
                {/* Resumo (Sempre visível) */}
                <div 
                    onClick={() => setExpandedId(isExpanded ? null : notif.id)}
                    className="p-4 md:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`p-2.5 rounded-xl shrink-0 ${
                            notif.prioridade === 'urgent' ? 'bg-red-50 text-red-600' :
                            notif.prioridade === 'medium' ? 'bg-amber-50 text-amber-600' :
                            'bg-blue-50 text-blue-600'
                        }`}>
                            {notif.prioridade === 'urgent' ? <AlertOctagon className="w-5 h-5 animate-pulse"/> : <Info className="w-5 h-5"/>}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className={`text-xs md:text-sm font-black uppercase tracking-tight truncate ${!notif.lida ? 'text-slate-900' : 'text-slate-500'}`}>
                                {title}
                            </h3>
                            <div className="flex items-center gap-3 mt-0.5">
                                <span className="text-[8px] font-black text-slate-400 uppercase flex items-center gap-1">
                                    <Calendar className="w-2.5 h-2.5" />
                                    {new Date(notif.criada_em).toLocaleDateString('pt-BR')}
                                </span>
                                {hasAnexo && (
                                    <span className="text-[8px] font-black text-purple-500 uppercase flex items-center gap-1 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                        <Paperclip className="w-2.5 h-2.5" />
                                        {notif.notificacao_anexos[0].arquivo_nome}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                        {!notif.lida && <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>}
                        <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} />
                    </div>
                </div>

                {/* Detalhes (Expansível) */}
                {isExpanded && (
                    <div className="px-5 pb-6 pt-2 border-t border-slate-50 animate-fadeIn bg-slate-50/30">
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-inner mb-5">
                            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                {content}
                            </p>
                        </div>

                        {hasAnexo && (
                            <div className="mb-5 space-y-2">
                                <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                                    <Paperclip className="w-3 h-3" /> Arquivos anexados ({notif.notificacao_anexos.length})
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {notif.notificacao_anexos.map((file: any) => (
                                        <div 
                                          key={file.id} 
                                          onClick={() => handleDownload(file)}
                                          className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-purple-300 transition-colors cursor-pointer group/file shadow-sm"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                {file.tipo_mime.includes('image') ? <ImageIcon className="w-3.5 h-3.5 text-purple-500" /> : <FileText className="w-3.5 h-3.5 text-slate-400" />}
                                                <span className="text-[10px] font-bold text-slate-700 truncate">{file.arquivo_nome}</span>
                                            </div>
                                            <Download className="w-3.5 h-3.5 text-slate-300 group-hover/file:text-purple-500 transition-colors" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
                            {!notif.lida ? (
                                <Button 
                                    size="sm"
                                    onClick={() => {
                                        if (notif.metadata?.type === 'forecast_rejected' && notif.metadata?.relatedId && onFixForecast) {
                                            onFixForecast(notif.metadata.relatedId);
                                        }
                                        markAsRead(notif.id);
                                    }}
                                    className={`rounded-xl px-10 font-black uppercase text-[10px] tracking-widest ${
                                        notif.prioridade === 'urgent' ? 'bg-red-600' : 'bg-blue-600'
                                    }`}
                                >
                                    {notif.metadata?.type === 'forecast_rejected' ? 'Ir para Correção' : 'Confirmar Ciência'} 
                                    <CheckCircle2 className="w-4 h-4 ml-2" />
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Lida e confirmada
                                </div>
                            )}
                        </div>
                    </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};