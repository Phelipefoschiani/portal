import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertOctagon, CheckCircle2, X } from 'lucide-react';
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
      <div className="bg-white w-full max-w-3xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp border-t-8 border-red-600 flex flex-col max-h-[85vh]">
        
        {/* Header Fixo */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center animate-pulse">
                    <AlertOctagon className="w-7 h-7" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{title}</h2>
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mt-1">Atenção Necessária</p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aviso {currentIndex + 1} de {urgentNotifications.length}</p>
            </div>
        </div>

        {/* Conteúdo Rolável */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/30">
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                <p className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap font-medium">
                    {content}
                </p>
                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                        Data de Emissão: {new Date(rawNotice.criada_em).toLocaleString('pt-BR')}
                    </p>
                </div>
            </div>
        </div>

        {/* Rodapé Fixo com Botão */}
        <div className="p-8 border-t border-slate-100 bg-white shrink-0">
            <Button 
                fullWidth 
                onClick={handleConfirm} 
                className="bg-red-600 hover:bg-red-700 h-16 shadow-2xl shadow-red-200 rounded-2xl font-black uppercase tracking-[0.2em] text-sm transition-all active:scale-95"
            >
                <CheckCircle2 className="w-6 h-6 mr-3" />
                Confirmar Leitura e Ciência
            </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};