
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, AlertCircle, Loader2, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NonPositivizedModalProps {
  onClose: () => void;
}

export const NonPositivizedModal: React.FC<NonPositivizedModalProps> = ({ onClose }) => {
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  const cleanCnpj = (val: string) => String(val || '').replace(/\D/g, '');

  useEffect(() => {
    if (userId) fetchNonPositivized();
  }, [userId]);

  const fetchNonPositivized = async () => {
    setIsLoading(true);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const firstDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

    try {
      // 1. Pega todos os clientes do representante
      const { data: allClients } = await supabase
        .from('clientes')
        .select('*')
        .eq('usuario_id', userId);

      // 2. Pega as vendas do mês atual
      const { data: sales } = await supabase
        .from('dados_vendas')
        .select('cnpj')
        .eq('usuario_id', userId)
        .gte('data', firstDayStr);

      // 3. Normaliza CNPJs de vendas para comparação
      const salesCnpjsCleaned = new Set(
        sales?.map(s => cleanCnpj(s.cnpj)).filter(c => c !== '')
      );
      
      // 4. Filtra clientes da carteira cujo CNPJ limpo NÃO está nas vendas limpas
      const pending = allClients?.filter(client => {
        const clientCnpjClean = cleanCnpj(client.cnpj);
        return !salesCnpjsCleaned.has(clientCnpjClean);
      }) || [];
      
      setClients(pending);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-slideUp overflow-hidden border border-white/20">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-100 text-amber-600 shadow-sm border border-amber-200/50">
               <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Pendentes de Compra</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Ainda não positivados este mês</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 bg-white p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p className="text-sm font-black uppercase tracking-widest animate-pulse">Cruzando dados de vendas...</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <AlertCircle className="w-10 h-10" />
              </div>
              <p className="font-black text-slate-800 text-2xl tracking-tight">Meta Batida!</p>
              <p className="text-sm font-medium mt-2">Toda a sua carteira já comprou este mês.</p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {clients.map((client) => (
                <div key={client.id} className="p-5 rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-between group border border-transparent hover:border-slate-100">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-lg">{client.nome_fantasia}</h4>
                    <div className="flex flex-wrap gap-4 mt-2">
                       <p className="text-[10px] text-slate-500 flex items-center gap-1.5 font-bold uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-lg">
                          CNPJ: {client.cnpj}
                       </p>
                       <p className="text-[10px] text-slate-500 flex items-center gap-1.5 font-bold uppercase tracking-wider bg-slate-100 px-2 py-1 rounded-lg">
                          Local: {client.city || 'Não Informado'}
                       </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <button 
                        title="Entrar em contato"
                        className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100"
                      >
                        <Phone className="w-5 h-5" />
                     </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/80 rounded-b-[32px] flex justify-between items-center px-10">
           <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Atenção Necessária</span>
           <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-500">Total:</span>
              <span className="bg-slate-900 text-white text-sm font-black px-4 py-1.5 rounded-full shadow-lg">{clients.length}</span>
           </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
