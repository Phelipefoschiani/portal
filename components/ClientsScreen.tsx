
import React, { useState, useEffect } from 'react';
import { Search, Users, UserX, Clock, ChevronRight } from 'lucide-react';
import { ClientDetailModal } from './ClientDetailModal';
import { supabase } from '../lib/supabase';

export const ClientsScreen: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  useEffect(() => {
    if (userId) {
      fetchClients();
    }
  }, [userId]);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('usuario_id', userId)
        .order('nome_fantasia', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.cnpj && c.cnpj.includes(searchTerm))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-slate-500">Carregando carteira...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div className="w-full md:w-auto">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Minha Carteira</h2>
          <p className="text-slate-500 text-sm mt-1">Gestão de clientes vinculados ao seu acesso.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome ou CNPJ..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
                <th className="px-6 py-4">Cliente</th>
                <th className="px-6 py-4">CNPJ</th>
                <th className="px-6 py-4">Canal / Grupo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.map((client) => (
                <tr 
                  key={client.id} 
                  className="group hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedClient(client)}
                >
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800">{client.nome_fantasia}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">{client.city || 'S/ Cidade'}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-600 font-mono text-xs">{client.cnpj || '---'}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded uppercase tracking-wider">
                      {client.canal_vendas || 'Geral'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-full border ${client.ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                      {client.ativo ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all mx-auto">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </td>
                </tr>
              ))}
              
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                    <div className="flex flex-col items-center">
                      <Users className="w-12 h-12 mb-3 opacity-20" />
                      <p className="italic font-medium">Nenhum cliente encontrado na sua carteira.</p>
                    </div>
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
    </div>
  );
};
