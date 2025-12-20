
import React, { useState, useEffect } from 'react';
import { Bell, Clock, AlertOctagon, Info, MailOpen, ChevronRight, CheckCircle2, RefreshCw, Loader2, Zap, Paperclip, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';

// Added interface to support onFixForecast prop passed from App.tsx
interface NotificationsScreenProps {
  onFixForecast?: (id: string) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onFixForecast }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    
    // Criar link temporário e simular clique para baixar
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
      <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" /> Mural de Avisos
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informações da Gerência Comercial</p>
        </div>
        <div className="flex gap-2">
            <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-4 py-1.5 rounded-full border border-blue-100 uppercase tracking-widest">
               {notifications.filter(n => !n.lida).length} Pendentes
            </span>
        </div>
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-[32px] p-20 text-center border border-dashed border-slate-200">
             <MailOpen className="w-12 h-12 text-slate-100 mx-auto mb-4" />
             <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">Nenhum aviso recebido</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map(notif => {
              const { title, content } = parseMessage(notif.mensagem);
              return (
                <div 
                  key={notif.id} 
                  className={`bg-white rounded-[32px] border transition-all p-6 relative overflow-hidden group ${
                      !notif.lida 
                      ? (notif.prioridade === 'urgent' ? 'border-red-500 ring-4 ring-red-50' : notif.prioridade === 'medium' ? 'border-amber-400' : 'border-blue-400')
                      : 'border-slate-200 opacity-80 shadow-sm'
                  }`}
                >
                  {!notif.lida && (
                      <div className={`absolute top-0 right-0 px-4 py-1 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest text-white ${
                          notif.prioridade === 'urgent' ? 'bg-red-500' :
                          notif.prioridade === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                      }`}>
                         Novo
                      </div>
                  )}

                  <div className="flex items-start gap-5">
                      <div className={`p-4 rounded-2xl shrink-0 shadow-sm border ${
                          notif.prioridade === 'urgent' ? 'bg-red-50 border-red-100 text-red-600' :
                          notif.prioridade === 'medium' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                          'bg-blue-50 border-blue-100 text-blue-600'
                      }`}>
                          {notif.prioridade === 'urgent' ? <AlertOctagon className="w-7 h-7 animate-pulse"/> : <Info className="w-7 h-7"/>}
                      </div>

                      <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-2">
                              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-tight">
                                  {title}
                              </h3>
                              <span className="text-[9px] font-black text-slate-400 uppercase tabular-nums">
                                  {new Date(notif.criada_em).toLocaleDateString()}
                              </span>
                          </div>
                          
                          <p className="text-slate-600 text-sm leading-relaxed mb-6 whitespace-pre-wrap">
                              {content}
                          </p>

                          {notif.notificacao_anexos?.length > 0 && (
                              <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                      <Paperclip className="w-3 h-3" /> Arquivos vinculados ({notif.notificacao_anexos.length})
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {notif.notificacao_anexos.map((file: any) => (
                                          <div 
                                            key={file.id} 
                                            onClick={() => handleDownload(file)}
                                            className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition-colors cursor-pointer group/file"
                                          >
                                              <div className="flex items-center gap-2 truncate">
                                                  {file.tipo_mime.includes('image') ? <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> : <FileText className="w-3.5 h-3.5 text-slate-400" />}
                                                  <span className="text-[10px] font-bold text-slate-700 truncate">{file.arquivo_nome}</span>
                                              </div>
                                              <Download className="w-3.5 h-3.5 text-slate-300 group-hover/file:text-blue-500 transition-colors" />
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          )}
                          
                          <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-50">
                              {!notif.lida ? (
                                  <Button 
                                      size="sm"
                                      onClick={() => {
                                          // Added logic to handle forecast corrections directly from mural
                                          if (notif.metadata?.type === 'forecast_rejected' && notif.metadata?.relatedId && onFixForecast) {
                                              onFixForecast(notif.metadata.relatedId);
                                          }
                                          markAsRead(notif.id);
                                      }}
                                      className={`rounded-xl px-8 font-black uppercase text-[10px] tracking-widest ${
                                          notif.prioridade === 'urgent' ? 'bg-red-600 shadow-red-100' : 'bg-blue-600 shadow-blue-100'
                                      }`}
                                  >
                                      {notif.metadata?.type === 'forecast_rejected' ? 'Corrigir Previsão' : 'Ciente da Informação'} 
                                      {notif.metadata?.type === 'forecast_rejected' ? <RefreshCw className="w-4 h-4 ml-2" /> : <CheckCircle2 className="w-4 h-4 ml-2" />}
                                  </Button>
                              ) : (
                                  <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Lida e confirmada
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
