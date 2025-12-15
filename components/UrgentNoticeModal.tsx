import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertOctagon, CheckCircle2, MessageSquareWarning } from 'lucide-react';
import { Button } from './Button';
import { mockNotifications, Notification, markNotificationAsRead, requestRevision } from '../lib/mockData';

export const UrgentNoticeModal: React.FC = () => {
  const [urgentNotifications, setUrgentNotifications] = useState<Notification[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Carrega apenas as urgentes e não lidas
    const urgents = mockNotifications.filter(n => n.priority === 'urgent' && !n.isRead);
    setUrgentNotifications(urgents);
  }, []);

  if (urgentNotifications.length === 0) return null;

  const currentNotice = urgentNotifications[currentIndex];

  const handleConfirm = () => {
    markNotificationAsRead(currentNotice.id);
    handleNext();
  };

  const handleRevision = () => {
    if (window.confirm("Deseja solicitar revisão para este comunicado? O gerente será notificado.")) {
        requestRevision(currentNotice.id);
        handleNext();
    }
  };

  const handleNext = () => {
    if (currentIndex < urgentNotifications.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Se acabou, limpa o array para fechar o modal
      setUrgentNotifications([]);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-slideUp border-t-8 border-red-600">
        
        <div className="p-8 text-center">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <AlertOctagon className="w-10 h-10" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Comunicado Urgente</h2>
            <p className="text-slate-500 text-sm mb-6 uppercase tracking-wider font-semibold">
                Leitura Obrigatória
            </p>
            
            <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-left mb-8">
                <h3 className="font-bold text-red-900 text-lg mb-2">{currentNotice.title}</h3>
                <p className="text-slate-700 leading-relaxed text-sm">
                    {currentNotice.content}
                </p>
                <p className="text-xs text-red-400 mt-4 font-medium flex items-center gap-1">
                    Enviado em: {new Date(currentNotice.date).toLocaleString('pt-BR')}
                </p>
            </div>

            <div className="space-y-3">
                <Button 
                    fullWidth 
                    onClick={handleConfirm}
                    className="bg-red-600 hover:bg-red-700 py-4 text-base"
                >
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Confirmar Leitura e Ciência
                </Button>
                
                <button 
                    onClick={handleRevision}
                    className="text-slate-400 text-sm hover:text-slate-600 flex items-center justify-center gap-2 mx-auto py-2 transition-colors"
                >
                    <MessageSquareWarning className="w-4 h-4" />
                    Solicitar revisão do conteúdo
                </button>
            </div>
            
            {urgentNotifications.length > 1 && (
                <div className="mt-6 flex justify-center gap-1">
                    {urgentNotifications.map((_, idx) => (
                        <div key={idx} className={`h-1.5 rounded-full transition-all ${idx === currentIndex ? 'w-8 bg-red-500' : 'w-2 bg-slate-200'}`} />
                    ))}
                </div>
            )}
        </div>
      </div>
    </div>,
    document.body
  );
};