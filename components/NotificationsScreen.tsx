import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Clock, AlertOctagon, Info, MailOpen, ChevronDown, CheckCircle2, RefreshCw, Loader2, Paperclip, Download, FileText, Image as ImageIcon, Filter, Calendar, Send, User, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from './Button';
import { Input } from './Input';

interface NotificationsScreenProps {
  onFixForecast?: (id: string) => void;
}

type FilterType = 'all' | 'info' | 'important' | 'urgent' | 'attachments';
type TabType = 'inbox' | 'compose';

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onFixForecast }) => {
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  
  // States Inbox
  const [notifications, setNotifications] = useState<any[]>([]);
  const [sentMessages, setSentMessages] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSent, setIsLoadingSent] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState<Record<string, boolean>>({});
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Added state variables for the compose form to fix "Cannot find name" errors
  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  useEffect(() => {
    if (userId) {
        if (activeTab === 'inbox') fetchNotifications();
        if (activeTab === 'compose') fetchSentMessages();
    }
  }, [userId, activeTab]);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      // Otimização: Busca apenas IDs e nomes dos anexos para o filtro funcionar, sem a URL pesada
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*, notificacao_anexos(id, arquivo_nome)')
        .eq('para_usuario_id', userId)
        .order('lida', { ascending: true }) 
        .order('criada_em', { ascending: false });
      
      if (error) throw error;
      
      const normalizedData = (data || []).map((item: any) => ({
          ...item,
          para_usuario_id: item.para_usuario_id || item.Para_usuario_id || item.para_Usuario_Id,
          de_usuario_id: item.de_usuario_id || item.De_usuario_id || item.de_Usuario_Id
      }));

      setNotifications(normalizedData);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSentMessages = async () => {
      setIsLoadingSent(true);
      try {
          const { data, error } = await supabase
            .from('notificacoes')
            .select('*, notificacao_anexos(id, arquivo_nome)')
            .eq('de_usuario_id', userId)
            .order('criada_em', { ascending: false });
          
          if (error) throw error;

          const normalizedData = (data || []).map((item: any) => ({
              ...item,
              para_usuario_id: item.para_usuario_id || item.Para_usuario_id || item.para_Usuario_Id,
              de_usuario_id: item.de_usuario_id || item.De_usuario_id || item.de_Usuario_Id
          }));

          setSentMessages(normalizedData);
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoadingSent(false);
      }
  };

  // Função para buscar anexos completos sob demanda
  const fetchAttachmentDetails = async (notificationId: string) => {
    if (loadingAttachments[notificationId]) return;
    
    setLoadingAttachments(prev => ({ ...prev, [notificationId]: true }));
    try {
      const { data, error } = await supabase
        .from('notificacao_anexos')
        .select('*')
        .eq('notificacao_id', notificationId);
      
      if (error) throw error;

      const updateList = (list: any[]) => 
        list.map(n => n.id === notificationId ? { ...n, notificacao_anexos: data } : n);

      if (activeTab === 'inbox') setNotifications(updateList);
      else setSentMessages(updateList);

    } catch (e) {
      console.error("Erro ao carregar detalhes do anexo:", e);
    } finally {
      setLoadingAttachments(prev => ({ ...prev, [notificationId]: false }));
    }
  };

  const handleExpand = (id: string) => {
    const isExpanding = expandedId !== id;
    setExpandedId(isExpanding ? id : null);

    if (isExpanding) {
      const currentList = activeTab === 'inbox' ? notifications : sentMessages;
      const notification = currentList.find(n => n.id === id);
      // Se tem anexos mas ainda não tem a URL (indicado pela falta de arquivo_url no primeiro item)
      if (notification?.notificacao_anexos?.length > 0 && !notification.notificacao_anexos[0].arquivo_url) {
        fetchAttachmentDetails(id);
      }
    }
  };

  const handleSendToManager = async (e: React.FormEvent) => {
      e.preventDefault();
      // Added missing state variables: subject, messageBody
      if (!subject || !messageBody) {
          alert('Preencha o assunto e a mensagem.');
          return;
      }

      // Added missing setIsSending state setter
      setIsSending(true);
      try {
          const { data: managers, error: managerError } = await supabase
              .from('usuarios')
              .select('id')
              .or('nivel_acesso.ilike.admin,nivel_acesso.ilike.gerente')
              .limit(1);

          const manager = managers && managers.length > 0 ? managers[0] : null;

          if (managerError || !manager) {
              console.error('Erro busca gerente:', managerError);
              throw new Error('Gerente regional não encontrado no sistema.');
          }

          // Added missing state variables: subject, messageBody
          const fullMessage = `[${subject.toUpperCase()}]\n\n${messageBody}`;

          const { error: insertError } = await supabase.from('notificacoes').insert({
              de_usuario_id: userId,
              para_usuario_id: manager.id,
              mensagem: fullMessage,
              prioridade: 'info', 
              lida: false
          });

          if (insertError) throw insertError;

          alert('Mensagem enviada ao gerente com sucesso!');
          // Added missing state setters: setSubject, setMessageBody
          setSubject('');
          setMessageBody('');
          fetchSentMessages(); 

      } catch (error: any) {
          console.error('Erro envio:', error);
          alert('Erro ao enviar: ' + (error.message || 'Falha de comunicação.'));
      } finally {
          // Added missing setIsSending state setter
          setIsSending(false);
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
      alert('Arquivo ainda sendo processado ou indisponível.');
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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fadeIn pb-24 md:pb-12">
      
      {/* --- MOBILE LAYOUT --- */}
      <div className="md:hidden space-y-4 px-1">
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <Bell className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Notificações</h2>
            </div>
            
            <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex">
                <button 
                    onClick={() => setActiveTab('inbox')} 
                    className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'inbox' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
                >
                    Recebidos
                </button>
                <button 
                    onClick={() => setActiveTab('compose')} 
                    className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'compose' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}
                >
                    Falar com Gerente
                </button>
            </div>
        </div>

        {activeTab === 'compose' ? (
            <div className="space-y-6">
                <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Send className="w-4 h-4 text-blue-600" /> Nova Mensagem
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Assunto</label>
                            <input 
                                type="text"
                                // Added missing subject value
                                value={subject}
                                // Added missing setSubject state setter
                                onChange={e => setSubject(e.target.value)}
                                className="w-full h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="Motivo..."
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Mensagem</label>
                            <textarea 
                                // Added missing messageBody value
                                value={messageBody}
                                // Added missing setMessageBody state setter
                                onChange={e => setMessageBody(e.target.value)}
                                rows={5}
                                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                                placeholder="Digite sua mensagem..."
                            />
                        </div>
                        <Button 
                            fullWidth 
                            onClick={handleSendToManager} 
                            // Added missing isSending state variable
                            isLoading={isSending}
                            className="h-14 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg"
                        >
                            Enviar
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">Histórico de Envios</h3>
                    {isLoadingSent ? (
                        <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" /></div>
                    ) : sentMessages.length === 0 ? (
                        <div className="py-10 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase">Nenhuma mensagem enviada</p>
                        </div>
                    ) : (
                        sentMessages.map(msg => {
                            const { title, content } = parseMessage(msg.mensagem);
                            const isExpandedLocal = expandedId === msg.id;
                            return (
                                <div key={msg.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2">
                                    <div onClick={() => handleExpand(msg.id)} className="flex justify-between items-start cursor-pointer">
                                        <div className="min-w-0 pr-2">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                                {new Date(msg.criada_em).toLocaleDateString('pt-BR')}
                                            </p>
                                            <h4 className="font-black text-slate-800 uppercase text-xs truncate">{title}</h4>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${isExpandedLocal ? 'rotate-180' : ''}`} />
                                    </div>
                                    {isExpandedLocal && (
                                        <div className="pt-2 border-t border-slate-50 mt-1">
                                            <p className="text-[10px] text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">
                                                {content}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        ) : (
            <div className="space-y-4">
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto no-scrollbar gap-1">
                    {['all', 'info', 'important', 'urgent', 'attachments'].map(f => (
                        <button 
                            key={f}
                            onClick={() => setActiveFilter(f as any)} 
                            className={`flex-none px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${
                                activeFilter === f 
                                ? (f === 'urgent' ? 'bg-red-600 text-white' : f === 'important' ? 'bg-amber-50 text-white' : f === 'attachments' ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white') 
                                : 'text-slate-400 bg-slate-50'
                            }`}
                        >
                            {f === 'all' ? 'Todos' : f === 'important' ? 'Importante' : f === 'urgent' ? 'Urgente' : f === 'attachments' ? 'Anexos' : 'Info'}
                        </button>
                    ))}
                </div>

                <div className="space-y-3">
                    {isLoading ? (
                        <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" /></div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className="py-20 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                            <MailOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-[10px] font-black text-slate-400 uppercase">Caixa de entrada vazia</p>
                        </div>
                    ) : (
                        filteredNotifications.map(notif => {
                            const { title, content } = parseMessage(notif.mensagem);
                            const isExpanded = expandedId === notif.id;
                            const hasAnexo = notif.notificacao_anexos?.length > 0;
                            const isUrgent = notif.prioridade === 'urgent';
                            const isDetailLoading = loadingAttachments[notif.id];

                            return (
                                <div key={notif.id} className={`bg-white rounded-[24px] border shadow-sm overflow-hidden ${
                                    !notif.lida 
                                    ? (isUrgent ? 'border-red-200 ring-2 ring-red-50' : 'border-blue-200 ring-1 ring-blue-50')
                                    : 'border-slate-200 opacity-90'
                                }`}>
                                    <div 
                                        onClick={() => handleExpand(notif.id)}
                                        className="p-4 cursor-pointer active:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${!notif.lida ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                    {new Date(notif.criada_em).toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                {hasAnexo && <Paperclip className="w-3 h-3 text-purple-400" />}
                                                {isUrgent && <span className="bg-red-100 text-red-600 text-[8px] font-black uppercase px-2 py-0.5 rounded">Urgente</span>}
                                            </div>
                                        </div>
                                        <h4 className={`font-black uppercase text-xs mb-1 ${!notif.lida ? 'text-slate-900' : 'text-slate-500'}`}>{title}</h4>
                                        {!isExpanded && <p className="text-[10px] text-slate-400 line-clamp-1">{content}</p>}
                                    </div>

                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-0">
                                            <div className="bg-slate-50 p-3 rounded-xl text-[10px] text-slate-600 leading-relaxed border border-slate-100 mb-4 whitespace-pre-wrap">
                                                {content}
                                            </div>

                                            {hasAnexo && (
                                                <div className="mb-4">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                        <Paperclip className="w-3 h-3" /> Arquivos Vinculados
                                                    </p>
                                                    {isDetailLoading ? (
                                                        <div className="flex items-center gap-2 py-2 text-blue-600">
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            <span className="text-[9px] font-bold">Carregando links...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                                            {notif.notificacao_anexos.map((file: any) => (
                                                                <button 
                                                                    key={file.id} 
                                                                    onClick={() => handleDownload(file)}
                                                                    className="flex items-center gap-2 bg-purple-50 border border-purple-100 px-3 py-2 rounded-xl text-[9px] font-bold text-purple-700 whitespace-nowrap active:bg-purple-100 transition-colors"
                                                                >
                                                                    <Download className="w-3 h-3" /> {file.arquivo_nome.slice(0, 15)}...
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                {!notif.lida ? (
                                                    <Button 
                                                        fullWidth
                                                        onClick={() => {
                                                            if (notif.metadata?.type === 'forecast_rejected' && notif.metadata?.relatedId && onFixForecast) {
                                                                onFixForecast(notif.metadata.relatedId);
                                                            }
                                                            markAsRead(notif.id);
                                                        }}
                                                        className={`h-10 rounded-xl font-black uppercase text-[9px] tracking-widest ${isUrgent ? 'bg-red-600' : 'bg-blue-600'}`}
                                                    >
                                                        {notif.metadata?.type === 'forecast_rejected' ? 'Corrigir' : 'Ciente'}
                                                    </Button>
                                                ) : (
                                                    <div className="w-full bg-emerald-50 text-emerald-600 py-2 rounded-xl text-center text-[9px] font-black uppercase border border-emerald-100">
                                                        Lida
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
        )}
      </div>

      {/* --- DESKTOP LAYOUT --- */}
      <div className="hidden md:block space-y-6">
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" /> Central de Notificações
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {activeTab === 'inbox' ? 'Mural de Avisos da Gerência' : 'Enviar Mensagem ao Gerente'}
          </p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('inbox')} className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'inbox' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                Recebidos
            </button>
            <button onClick={() => setActiveTab('compose')} className={`whitespace-nowrap px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${activeTab === 'compose' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                <Send className="w-3 h-3" /> Falar com Gerente
            </button>
        </div>
      </div>

      {activeTab === 'compose' ? (
          <div className="space-y-8 animate-slideUp">
              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                  <form onSubmit={handleSendToManager} className="space-y-6 max-w-2xl mx-auto">
                      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-slate-400" />
                          </div>
                          <div>
                              <h3 className="text-sm font-black text-slate-900 uppercase">Nova Mensagem</h3>
                              <p className="text-xs text-slate-500">Enviando para: <span className="font-bold text-blue-600">Gerência Regional</span></p>
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assunto</label>
                          <Input 
                              placeholder="Motivo do contato..." 
                              // Added missing subject value
                              value={subject} 
                              // Added missing setSubject state setter
                              onChange={e => setSubject(e.target.value)} 
                              required
                              className="!bg-slate-50 !h-12 text-sm font-bold" 
                          />
                      </div>

                      <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mensagem</label>
                          <textarea 
                              // Added missing messageBody value
                              value={messageBody} 
                              // Added missing setMessageBody state setter
                              onChange={e => setMessageBody(e.target.value)} 
                              rows={6} 
                              required
                              placeholder="Digite sua mensagem detalhada aqui..." 
                              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-600 outline-none focus:ring-4 focus:ring-blue-100 transition-all resize-none" 
                          />
                      </div>

                      <div className="pt-4">
                          <Button 
                              type="submit" 
                              fullWidth 
                              // Added missing isSending state variable
                              isLoading={isSending} 
                              className="h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20"
                          >
                              <Send className="w-4 h-4 mr-2" /> Enviar Notificação
                          </Button>
                      </div>
                  </form>
              </div>

              <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                      <History className="w-5 h-5 text-blue-600" />
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Histórico de Envios</h3>
                  </div>
                  
                  <div className="space-y-3">
                      {isLoadingSent ? (
                          <div className="py-10 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" /></div>
                      ) : sentMessages.length === 0 ? (
                          <div className="text-center py-10 text-slate-400">
                              <p className="text-[10px] font-black uppercase">Nenhuma mensagem enviada.</p>
                          </div>
                      ) : (
                          sentMessages.map(msg => {
                              const { title, content } = parseMessage(msg.mensagem);
                              const isExpandedLocal = expandedId === msg.id;
                              
                              return (
                                  <div key={msg.id} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                                      <div 
                                          onClick={() => handleExpand(msg.id)}
                                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                      >
                                          <div className="flex items-center gap-4 min-w-0">
                                              <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 shrink-0">
                                                  <Send className="w-4 h-4" />
                                              </div>
                                              <div className="min-w-0">
                                                  <p className="text-[10px] font-black text-slate-900 uppercase truncate">{title}</p>
                                                  <p className="text-[8px] font-bold text-slate-400 uppercase">{new Date(msg.criada_em).toLocaleDateString('pt-BR')} às {new Date(msg.criada_em).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                                              </div>
                                          </div>
                                          <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${isExpandedLocal ? 'rotate-180' : ''}`} />
                                      </div>
                                      {isExpandedLocal && (
                                          <div className="px-4 pb-4 pt-2 border-t border-slate-200/50">
                                              <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                                                  {content}
                                              </p>
                                          </div>
                                      )}
                                  </div>
                              );
                          })
                      )}
                  </div>
              </div>
          </div>
      ) : (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto no-scrollbar max-w-full w-fit mx-auto md:mx-0">
                <button onClick={() => setActiveFilter('all')} className={`whitespace-nowrap px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeFilter === 'all' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Todos</button>
                <button onClick={() => setActiveFilter('info')} className={`whitespace-nowrap px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeFilter === 'info' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Informativos</button>
                <button onClick={() => setActiveFilter('important')} className={`whitespace-nowrap px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeFilter === 'important' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Importantes</button>
                <button onClick={() => setActiveFilter('urgent')} className={`whitespace-nowrap px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeFilter === 'urgent' ? 'bg-white text-red-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Urgentes</button>
                <button onClick={() => setActiveFilter('attachments')} className={`whitespace-nowrap px-5 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${activeFilter === 'attachments' ? 'bg-white text-purple-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>
                    <Paperclip className="w-3 h-3" /> Anexos
                </button>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Sincronizando mural...</p>
                </div>
            ) : filteredNotifications.length === 0 ? (
                <div className="bg-white rounded-[32px] p-20 text-center border border-dashed border-slate-200">
                    <MailOpen className="w-12 h-12 text-slate-100 mx-auto mb-4" />
                    <p className="text-slate-300 font-bold uppercase text-[10px] tracking-widest italic">Nenhum aviso encontrado</p>
                </div>
            ) : (
                filteredNotifications.map(notif => {
                    const { title, content } = parseMessage(notif.mensagem);
                    const isExpanded = expandedId === notif.id;
                    const hasAnexo = notif.notificacao_anexos?.length > 0;
                    const isUrgent = notif.prioridade === 'urgent';
                    const isDetailLoading = loadingAttachments[notif.id];

                    return (
                    <div 
                        key={notif.id} 
                        className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                            !notif.lida 
                            ? (notif.prioridade === 'urgent' ? 'border-red-500 shadow-lg ring-1 ring-red-100' : notif.prioridade === 'medium' ? 'border-amber-400 shadow-md' : 'border-blue-400 shadow-sm')
                            : 'border-slate-200 opacity-90'
                        }`}
                    >
                        <div 
                            onClick={() => handleExpand(notif.id)}
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
                                        {isDetailLoading ? (
                                            <div className="flex items-center gap-2 p-4 bg-white border border-slate-100 rounded-xl">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                                <span className="text-[10px] font-bold text-slate-400">Recuperando arquivos...</span>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {notif.notificacao_anexos.map((file: any) => (
                                                    <div 
                                                    key={file.id} 
                                                    onClick={() => handleDownload(file)}
                                                    className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl hover:border-purple-300 transition-colors cursor-pointer group/file shadow-sm"
                                                    >
                                                        <div className="flex items-center gap-2 truncate">
                                                            {file.tipo_mime?.includes('image') ? <ImageIcon className="w-3.5 h-3.5 text-purple-500" /> : <FileText className="w-3.5 h-3.5 text-slate-400" />}
                                                            <span className="text-[10px] font-bold text-slate-700 truncate">{file.arquivo_nome}</span>
                                                        </div>
                                                        <Download className="w-3.5 h-3.5 text-slate-300 group-hover/file:text-purple-500 transition-colors" />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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
      )}
      </div>
    </div>
  );
};