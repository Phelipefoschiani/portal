
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, DollarSign, UserX } from 'lucide-react';
import { Client } from '../lib/mockData';

interface InactiveClientsModalProps {
  clients: Client[];
  months: number;
  onClose: () => void;
}

export const InactiveClientsModal: React.FC<InactiveClientsModalProps> = ({ clients, months, onClose }) => {
  // Filtrar clientes baseados nos meses passados
  const thresholdDate = new Date();
  thresholdDate.setMonth(thresholdDate.getMonth() - months);
  
  const inactiveClients = clients.filter(c => new Date(c.lastPurchaseDate) < thresholdDate);

  // Helper para encontrar o valor da última compra no histórico
  const getLastPurchaseValue = (client: Client) => {
    // Pega todos os registros com valor > 0
    const purchases = client.history.filter(h => h.value > 0);
    // Retorna o último (mais recente) ou 0
    return purchases.length > 0 ? purchases[purchases.length - 1].value : 0;
  };

  return createPortal(
    // Z-Index 100 para garantir que fique acima da Sidebar (Z-40)
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${months >= 6 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
               <UserX className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                Inativos há {months} meses
              </h3>
              <p className="text-sm text-slate-500">Lista de clientes sem compras recentes</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List Content */}
        <div className="overflow-y-auto p-0 bg-white flex-1">
          {inactiveClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <UserX className="w-12 h-12 mb-2 opacity-20" />
              <p>Nenhum cliente encontrado com este critério.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr className="text-slate-500">
                  <th className="py-4 px-6 font-medium">Cliente</th>
                  <th className="py-4 px-6 font-medium">Última Compra</th>
                  <th className="py-4 px-6 font-medium text-right">Valor Últ. Compra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inactiveClients.map((client) => {
                  const lastValue = getLastPurchaseValue(client);
                  
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                           {/* Fixed: changed client.name to client.nome_fantasia */}
                           <p className="font-semibold text-slate-800">{client.nome_fantasia}</p>
                           <p className="text-xs text-slate-500">{client.city}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        <div className="flex items-center gap-2">
                           <Calendar className="w-4 h-4 text-slate-400" />
                           {new Date(client.lastPurchaseDate).toLocaleDateString('pt-BR')}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-medium text-slate-700">
                        <div className="flex items-center justify-end gap-1">
                           <span className="text-slate-400 text-xs">R$</span>
                           {lastValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
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
           <span className="text-sm text-slate-500">Total de Clientes: <strong className="text-slate-800">{inactiveClients.length}</strong></span>
        </div>
      </div>
    </div>,
    document.body
  );
};
