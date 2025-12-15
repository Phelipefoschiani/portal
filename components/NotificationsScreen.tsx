import React, { useState } from 'react';
import { Bell, Clock, AlertOctagon, Info, MailOpen, ChevronRight, Paperclip, CheckCircle2, Check, CheckCheck } from 'lucide-react';
import { mockNotifications, Notification } from '../lib/mockData';
import { NotificationDetailModal } from './NotificationDetailModal';

interface NotificationsScreenProps {
  onFixForecast?: (id: string) => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ onFixForecast }) => {
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const stats = {
    urgent: notifications.filter(n => n.priority === 'urgent').length,
    medium: notifications.filter(n => n.priority === 'medium').length,
    info: notifications.filter(n => n.priority === 'info').length,
    unread: notifications.filter(n => !n.isRead).length
  };

  const handleUpdate = () => {
    // Recarrega do mock (simulando fetch)
    setNotifications([...mockNotifications]);
  };

  const filteredList = notifications
    .filter(n => filter === 'all' ? true : !n.isRead)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getPriorityIcon = (p: string) => {
    switch(p) {
        case 'urgent': return <AlertOctagon className="w-5 h-5 text-red-500" />;
        case 'medium': return <Clock className="w-5 h-5 text-amber-500" />;
        default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  // Lógica visual dos "Ticks" (Estilo WhatsApp)
  const getDeliveryStatusIcon = (n: Notification) => {
    if (n.isRead) {
        // Azul/Verde: Lido e Confirmado
        return (
            <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs font-medium border border-emerald-100" title="Leitura Confirmada">
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lido</span>
            </div>
        );
    }
    if (n.firstSeenAt) {
        // Dois Ticks Cinza: Entregue no Portal (Usuário logou, mas não confirmou)
        return (
            <div className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-xs font-medium border border-slate-200" title="Entregue no Sistema (Pendente Confirmação)">
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Entregue</span>
            </div>
        );
    }
    // Um Tick Cinza: Apenas Enviado (Usuário não logou ainda desde o envio)
    return (
        <div className="flex items-center gap-1 text-slate-400" title="Enviado (Aguardando acesso)">
            <Check className="w-3.5 h-3.5" />
        </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-fadeIn pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Central de Notificações
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Clique em uma notificação para ver detalhes, anexos e confirmar leitura.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-2xl font-bold text-slate-800">{stats.urgent}</p>
                <p className="text-xs text-slate-500 uppercase font-bold">Urgentes</p>
            </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <Clock className="w-6 h-6" />
            </div>
            <div>
                <p className="text-2xl font-bold text-slate-800">{stats.medium}</p>
                <p className="text-xs text-slate-500 uppercase font-bold">Média Prio.</p>
            </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Info className="w-6 h-6" />
            </div>
            <div>
                <p className="text-2xl font-bold text-slate-800">{stats.info}</p>
                <p className="text-xs text-slate-500 uppercase font-bold">Informativos</p>
            </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                <MailOpen className="w-6 h-6" />
            </div>
            <div>
                <p className="text-2xl font-bold text-slate-800">{stats.unread}</p>
                <p className="text-xs text-slate-500 uppercase font-bold">Não Lidos</p>
            </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        <button 
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${filter === 'all' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
            Todos
        </button>
        <button 
             onClick={() => setFilter('unread')}
             className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${filter === 'unread' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
            Apenas Não Lidos
        </button>
      </div>

      {/* Notification List (Summary View) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {filteredList.length === 0 ? (
            <div className="py-12 text-center">
                <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Nenhuma notificação encontrada.</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
                {filteredList.map(item => (
                    <div 
                        key={item.id} 
                        onClick={() => setSelectedNotification(item)}
                        className={`p-5 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors group relative ${!item.isRead ? 'bg-blue-50/10' : ''}`}
                    >
                        {/* Status Indicator Bar */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.priority === 'urgent' ? 'bg-red-500' : item.priority === 'medium' ? 'bg-amber-500' : item.priority === 'info' ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                        
                        {/* Icon */}
                        <div className="flex-shrink-0">
                            {getPriorityIcon(item.priority)}
                        </div>

                        {/* Summary Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className={`text-base font-semibold truncate ${!item.isRead ? 'text-slate-900' : 'text-slate-600'}`}>
                                    {item.title}
                                </h3>
                                {!item.isRead && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
                                )}
                                {item.attachments && item.attachments.length > 0 && (
                                    <Paperclip className="w-3 h-3 text-slate-400" />
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 mt-1">
                                <span>{new Date(item.date).toLocaleDateString('pt-BR')}</span>
                                {getDeliveryStatusIcon(item)}
                            </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                ))}
            </div>
        )}
      </div>

      {selectedNotification && (
        <NotificationDetailModal 
            notification={selectedNotification}
            onClose={() => setSelectedNotification(null)}
            onUpdate={handleUpdate}
            onFixForecast={onFixForecast}
        />
      )}

    </div>
  );
};