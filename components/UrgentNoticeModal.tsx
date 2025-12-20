
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertOctagon, CheckCircle2 } from 'lucide-react';
import { Button } from './Button';
import { supabase } from '../lib/supabase';

export const UrgentNoticeModal: React.FC = () => {
  const [urgentNotifications, setUrgentNotifications] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  useEffect(() => {
    if (userId) {
      fetchUrgentNotifications();
    }
  }, [userId]);

  const fetchUrgentNotifications = async () => {
    try {
      const { data } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('para_usuario_id', userId)
        .eq('lida', false)
        .eq('prioridade', 'urgent');

      if (data) setUrgentNotifications(data);
    } catch (error) {
      console.error('Erro ao buscar notificações urgentes:', error);
    }
  };

  if (urgentNotifications.length === 0) return null;

  const rawNotice = urgentNotifications[currentIndex];

  // Parser para extrair título da mensagem mesclada
  const parseUrgentMessage = (msg: string) => {
      if (msg.startsWith('[')) {
          const parts = msg.split(']');
          const title = parts[0].replace('[', '');
          const content = parts.slice(1).join(']').trim();
          return { title, content };
      }
      return { title: 'COMUNICADO URGENTE', content: msg };
  };

  const { title, content } = parseUrgentMessage(rawNotice.mensagem);

  const handleConfirm = async () => {
    try {
      await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', rawNotice.id);

      handleNext();
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const handleNext = () => {
    if (currentIndex < urgentNotifications.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
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
            <h2 className="text-2xl font-bold text-slate-900 mb-2 uppercase tracking-tighter">{title}</h2>
            <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-left mb-8">
                <p className="text-slate-700 leading-relaxed text-sm whitespace-pre-wrap font-medium">
                    {content}
                </p>
                <p className="text-[10px] text-red-400 mt-4 font-black uppercase tracking-widest">
                    Postado em: {new Date(rawNotice.criada_em).toLocaleString('pt-BR')}
                </p>
            </div>
            <Button fullWidth onClick={handleConfirm} className="bg-red-600 hover:bg-red-700 py-5 shadow-xl shadow-red-200 rounded-xl font-black uppercase tracking-widest">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Confirmar Leitura e Ciência
            </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
