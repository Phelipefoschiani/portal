import React from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, UserX, AlertCircle } from 'lucide-react';
import { clients } from '../lib/mockData';

interface NonPositivizedModalProps {
  onClose: () => void;
}

export const NonPositivizedModal: React.FC<NonPositivizedModalProps> = ({ onClose }) => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Filtrar clientes que NÃO compraram no mês/ano atual
  // Consideramos "Não Positivado" quem tem a última compra antes do dia 1 do mês atual
  const nonPositivizedClients = clients.filter(c => {
    const lastPurchase = new Date(c.lastPurchaseDate);
    // Se o ano for menor, ou se o ano for igual mas o mês for menor
    return (
        lastPurchase.getFullYear() < currentYear || 
        (lastPurchase.getFullYear() === currentYear && lastPurchase.getMonth() < currentMonth)
    );
  }).sort((a, b) => {
    // Ordenar Data Decrescente (Mais atual -> Mais antigo)
    return new Date(b.lastPurchaseDate).getTime() - new Date(a.lastPurchaseDate).getTime();
  });

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
               <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                Clientes Não Positivados
              </h3>
              <p className="text-sm text-slate-500">Carteira pendente de compra no mês atual</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List Content */}
        <div className="overflow-y-auto p-0 bg-white flex-1">
          {nonPositivizedClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <UserX className="w-12 h-12 mb-2 opacity-20" />
              <p>Parabéns! Toda a carteira está positivada neste mês.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr className="text-slate-500">
                  <th className="py-4 px-6 font-medium">Cliente / Cidade</th>
                  <th className="py-4 px-6 font-medium">Última Compra</th>
                  <th className="py-4 px-6 font-medium text-right">Dias sem compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nonPositivizedClients.map((client) => {
                  const lastDate = new Date(client.lastPurchaseDate);
                  const daysSince = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
                  
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                           <p className="font-semibold text-slate-800">{client.name}</p>
                           <p className="text-xs text-slate-500">{client.city}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        <div className="flex items-center gap-2">
                           <Calendar className="w-4 h-4 text-slate-400" />
                           {lastDate.toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-slate-700">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${daysSince > 45 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                           {daysSince} dias
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl text-right">
           <span className="text-sm text-slate-500">Pendentes de Positivação: <strong className="text-slate-800">{nonPositivizedClients.length}</strong></span>
        </div>
      </div>
    </div>,
    document.body
  );
};