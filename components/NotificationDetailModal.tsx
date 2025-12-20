
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Download, FileText, Image as ImageIcon, CheckCircle2, MessageSquareWarning, Eye, AlertOctagon, Info, Clock, Paperclip, RefreshCw } from 'lucide-react';
// Corrigido: Importando funções de ação de mockData
import { Notification, markNotificationAsRead, requestRevision } from '../lib/mockData';
import { Button } from './Button';

interface NotificationDetailModalProps {
  notification: Notification;
  onClose: () => void;
  onUpdate: () => void;
  onFixForecast?: (id: string) => void;
}

export const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({ notification, onClose, onUpdate, onFixForecast }) => {
  
  const handleConfirmRead = () => {
    markNotificationAsRead(notification.id);
    onUpdate(); // Força update no pai
  };

  const handleRequestRevision = () => {
     if (window.confirm('Solicitar revisão deste conteúdo ao gerente?')) {
        // Assume usuário padrão para mock. Em prod, passaria user context.
        requestRevision(notification.id, 'Ricardo Souza');
        onUpdate();
        alert('Solicitação de revisão enviada ao gerente.');
     }
  };

  const handleFixAction = () => {
      // 1. Marca como lida
      markNotificationAsRead(notification.id);
      
      // 2. Aciona navegação para correção se houver ID
      if (notification.metadata?.relatedId && onFixForecast) {
          onFixForecast(notification.metadata.relatedId);
      }
      
      onClose(); // Fecha o modal
  };

  const getPriorityIcon = (p: string) => {
    switch(p) {
        case 'urgent': return <AlertOctagon className="w-6 h-6 text-red-500" />;
        case 'medium': return <Clock className="w-6 h-6 text-amber-500" />;
        default: return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  const getPriorityLabel = (p: string) => {
    switch(p) {
        case 'urgent': return { text: 'Urgente', color: 'text-red-600 bg-red-50 border-red-100' };
        case 'medium': return { text: 'Média Prioridade', color: 'text-amber-600 bg-amber-50 border-amber-100' };
        default: return { text: 'Informativo', color: 'text-blue-600 bg-blue-50 border-blue-100' };
    }
  };

  // Corrigido: notification.prioridade fallback
  const labelStyle = getPriorityLabel(notification.prioridade || 'info');
  const isForecastRejected = notification.metadata?.type === 'forecast_rejected';

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-slideUp">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
           <div className="flex gap-4">
              <div className={`p-3 rounded-xl h-fit ${notification.prioridade === 'urgent' ? 'bg-red-100' : notification.prioridade === 'medium' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                {getPriorityIcon(notification.prioridade || 'info')}
              </div>
              <div>
                 <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border mb-2 ${labelStyle.color}`}>
                    {labelStyle.text}
                 </div>
                 {/* Corrigido: notification.titulo */}
                 <h2 className="text-xl font-bold text-slate-900 leading-snug">{notification.titulo || 'Notificação'}</h2>
              </div>
           </div>
           <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
             <X className="w-6 h-6" />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Message Body */}
            <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">Mensagem</h3>
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 text-slate-700 leading-relaxed text-base">
                    {/* Corrigido: notification.mensagem */}
                    {notification.mensagem}
                </div>
            </div>

            {/* Attachments */}
            {notification.attachments && notification.attachments.length > 0 && (
                <div>
                     <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide flex items-center gap-2">
                        <Paperclip className="w-4 h-4" />
                        Anexos ({notification.attachments.length})
                     </h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {notification.attachments.map((att, idx) => (
                            <div key={idx} className="flex items-center p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all group cursor-pointer">
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-500 mr-3 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                    {att.type === 'image' ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 truncate group-hover:text-blue-700">{att.name}</p>
                                    <p className="text-xs text-slate-400">{att.size}</p>
                                </div>
                                <Download className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                            </div>
                        ))}
                     </div>
                </div>
            )}

            {/* Audit Trail / Timeline */}
            <div>
                <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wide">Rastreamento</h3>
                <div className="relative pl-4 border-l-2 border-slate-100 space-y-6">
                    
                    {/* Evento: Enviado */}
                    <div className="relative">
                        <div className="absolute -left-[21px] top-0 w-3 h-3 rounded-full bg-blue-400 ring-4 ring-white"></div>
                        <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Enviado pelo Gerente</p>
                        <p className="text-sm text-slate-800 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {/* Corrigido: creada_em */}
                            {new Date(notification.criada_em).toLocaleString('pt-BR')}
                        </p>
                    </div>

                    {/* Evento: Visto no Portal (Login) */}
                    <div className="relative">
                        <div className={`absolute -left-[21px] top-0 w-3 h-3 rounded-full ring-4 ring-white ${notification.firstSeenAt ? 'bg-purple-400' : 'bg-slate-200'}`}></div>
                        <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Entregue no Portal</p>
                        {notification.firstSeenAt ? (
                            <p className="text-sm text-slate-800 flex items-center gap-2">
                                <Eye className="w-4 h-4 text-slate-400" />
                                {new Date(notification.firstSeenAt).toLocaleString('pt-BR')}
                            </p>
                        ) : (
                             <p className="text-sm text-slate-400 italic">Pendente de visualização...</p>
                        )}
                    </div>

                    {/* Evento: Lido/Aceite */}
                    <div className="relative">
                        <div className={`absolute -left-[21px] top-0 w-3 h-3 rounded-full ring-4 ring-white ${notification.lida ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                        <p className="text-xs text-slate-500 font-semibold uppercase mb-1">Confirmação de Leitura</p>
                        {notification.lida ? (
                            <p className="text-sm text-slate-800 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Confirmado em {notification.readAt ? new Date(notification.readAt).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}
                            </p>
                        ) : (
                            <p className="text-sm text-slate-400 italic">Aguardando confirmação...</p>
                        )}
                    </div>

                </div>
            </div>

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex flex-col sm:flex-row gap-3 justify-end">
            
            {/* Ação Especial: Previsão Recusada */}
            {isForecastRejected && (
                <Button 
                    onClick={handleFixAction}
                    className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200 w-full sm:w-auto"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Corrigir Previsão
                </Button>
            )}

            {!notification.lida ? (
                <>
                    {!isForecastRejected && (
                        <Button 
                            variant="outline"
                            onClick={handleRequestRevision}
                            className="text-slate-600 hover:text-amber-600 hover:border-amber-300"
                        >
                            <MessageSquareWarning className="w-4 h-4 mr-2" />
                            Pedir Revisão
                        </Button>
                    )}
                    <Button onClick={handleConfirmRead} className="bg-blue-600 hover:bg-blue-700">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Confirmar Leitura
                    </Button>
                </>
            ) : (
                <div className="w-full flex justify-between items-center">
                    <span className="text-sm font-medium text-emerald-600 flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                        <CheckCircle2 className="w-4 h-4" />
                        Leitura Confirmada
                    </span>
                    {notification.revisionRequested && (
                        <span className="text-sm font-medium text-amber-600 flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                            <MessageSquareWarning className="w-4 h-4" />
                            Revisão Solicitada
                        </span>
                    )}
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </div>
            )}
        </div>

      </div>
    </div>,
    document.body
  );
};
