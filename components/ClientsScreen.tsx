import React, { useState } from 'react';
import { Search, Users, UserX, Clock, ChevronRight } from 'lucide-react';
import { clients, Client } from '../lib/mockData';
import { ClientDetailModal } from './ClientDetailModal';
import { InactiveClientsModal } from './InactiveClientsModal';

export const ClientsScreen: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [inactiveModalMonths, setInactiveModalMonths] = useState<number | null>(null);

  // Filtra clientes
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCarteira = clients.reduce((acc, curr) => acc + curr.totalPurchase, 0);

  const getInactiveCount = (months: number) => {
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - months);
    return clients.filter(c => new Date(c.lastPurchaseDate) < thresholdDate).length;
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
      
      {/* Header e Busca */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div className="w-full md:w-auto">
          <h2 className="text-2xl font-bold text-slate-900">Carteira de Clientes</h2>
          <p className="text-slate-500 text-sm mt-1">Gerencie seus clientes e acompanhe o desempenho individual.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou cidade..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-default">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total de Clientes</p>
            <p className="text-2xl font-bold text-slate-900">{clients.length}</p>
          </div>
        </div>

        <div 
          onClick={() => setInactiveModalMonths(3)}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-amber-200 transition-all group"
        >
           <div className="p-3 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 group-hover:text-amber-600 transition-colors">3 Meses sem compra</p>
            <p className="text-2xl font-bold text-slate-900">{getInactiveCount(3)}</p>
          </div>
        </div>

        <div 
          onClick={() => setInactiveModalMonths(6)}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-red-200 transition-all group"
        >
           <div className="p-3 bg-red-50 text-red-600 rounded-xl group-hover:scale-110 transition-transform">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 group-hover:text-red-600 transition-colors">6 Meses sem compra</p>
            <p className="text-2xl font-bold text-slate-900">{getInactiveCount(6)}</p>
          </div>
        </div>
      </div>

      {/* TABLE VIEW (Desktop Only) */}
      <div className="flex bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-col">
        <div className="overflow-x-auto bg-slate-50/50 border-b border-slate-200">
           <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-6 py-4 w-[10%]">Ranking</th>
                <th className="px-6 py-4 w-[35%]">Cliente / Cidade</th>
                <th className="px-6 py-4 w-[20%] text-right">Compra Total</th>
                <th className="px-6 py-4 w-[25%] text-right">% da Carteira</th>
                <th className="px-6 py-4 w-[10%] text-center">Ação</th>
              </tr>
            </thead>
           </table>
        </div>

        <div className="overflow-y-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map((client, index) => {
                const share = (client.totalPurchase / totalCarteira) * 100;
                
                return (
                  <tr 
                    key={client.id} 
                    className="group hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedClient(client)}
                  >
                    <td className="px-6 py-4 w-[10%]">
                      <span className={`
                        inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                        ${index < 3 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}
                      `}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 w-[35%]">
                      <div>
                        <p className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{client.name}</p>
                        <p className="text-xs text-slate-500">{client.city}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 w-[20%] text-right font-medium text-slate-700">
                      {formatCurrency(client.totalPurchase)}
                    </td>
                    <td className="px-6 py-4 w-[25%] text-right">
                       <div className="flex items-center justify-end gap-2">
                         <span className="text-xs text-slate-500 font-medium">{share.toFixed(1)}%</span>
                         <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-500" style={{ width: `${share}%` }}></div>
                         </div>
                       </div>
                    </td>
                    <td className="px-6 py-4 w-[10%] text-center">
                      <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    Nenhum cliente encontrado para sua busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedClient && (
        <ClientDetailModal 
          client={selectedClient} 
          onClose={() => setSelectedClient(null)} 
        />
      )}

      {inactiveModalMonths !== null && (
        <InactiveClientsModal
          clients={clients}
          months={inactiveModalMonths}
          onClose={() => setInactiveModalMonths(null)}
        />
      )}
    </div>
  );
};