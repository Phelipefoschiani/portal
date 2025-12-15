import React, { useState } from 'react';
import { Search, Filter, Users, Building2, User, Percent } from 'lucide-react';
import { clients, representatives } from '../../lib/mockData';
import { ClientDetailModal } from '../ClientDetailModal';

export const ManagerClientsScreen: React.FC = () => {
    const [selectedRep, setSelectedRep] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<any | null>(null);

    // Cálculo da Meta Global (Soma das metas de todos os representantes)
    const globalTarget = representatives.reduce((acc, r) => acc + r.annualTarget, 0);

    const filteredClients = clients.filter(c => {
        const repMatch = selectedRep === 'all' ? true : c.repId === selectedRep;
        const searchMatch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.city.toLowerCase().includes(searchTerm.toLowerCase());
        return repMatch && searchMatch;
    });

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
            
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="w-7 h-7 text-blue-600" />
                        Carteira Global
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Visualize clientes de todos os representantes e seu impacto nos resultados.
                    </p>
                </div>
                 <div className="flex gap-4 w-full md:w-auto">
                     <select 
                        value={selectedRep}
                        onChange={(e) => setSelectedRep(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg text-sm px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 shadow-sm flex-1"
                    >
                        <option value="all">Todos Representantes</option>
                        {representatives.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar cliente..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                         <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-slate-500">
                                <th className="px-6 py-4 font-medium">Cliente / Cidade</th>
                                <th className="px-6 py-4 font-medium">Representante</th>
                                <th className="px-6 py-4 font-medium text-right">Total Compras</th>
                                <th className="px-6 py-4 font-medium text-center w-[200px]">
                                    <div className="flex items-center justify-center gap-1">
                                        <Percent className="w-3 h-3" />
                                        Representatividade
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-medium text-right">Última Compra</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredClients.map(client => {
                                const rep = representatives.find(r => r.id === client.repId);
                                const repName = rep?.name || 'Desconhecido';
                                const repTarget = rep?.annualTarget || 0;

                                // Cálculos de Porcentagem (Baseado no Total de Compras vs Meta Anual)
                                // Nota: Mock totalPurchase é acumulado, annualTarget é anual. Comparação válida para "Share of Target".
                                const pctRep = repTarget > 0 ? (client.totalPurchase / repTarget) * 100 : 0;
                                const pctGlobal = globalTarget > 0 ? (client.totalPurchase / globalTarget) * 100 : 0;

                                return (
                                    <tr 
                                        key={client.id} 
                                        className="hover:bg-slate-50 cursor-pointer group"
                                        onClick={() => setSelectedClient(client)}
                                    >
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{client.name}</p>
                                                <p className="text-xs text-slate-500">{client.city}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            <div className="flex items-center gap-1">
                                                <User className="w-3 h-3 text-slate-400" />
                                                {repName}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium text-slate-700">{formatCurrency(client.totalPurchase)}</td>
                                        
                                        {/* Coluna de Representatividade */}
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-2">
                                                {/* Representante */}
                                                <div className="flex items-center justify-between text-[10px] text-slate-500">
                                                    <span>Rep</span>
                                                    <span className="font-bold text-blue-600">{pctRep.toFixed(2)}%</span>
                                                </div>
                                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(pctRep, 100)}%` }}></div>
                                                </div>

                                                {/* Global */}
                                                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                                                    <span>Global</span>
                                                    <span className="font-bold text-purple-600">{pctGlobal.toFixed(2)}%</span>
                                                </div>
                                                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                    {/* Multipliquei visualmente por 5 para ser visível, já que global é pequeno, ou deixe real */}
                                                    <div className="h-full bg-purple-500" style={{ width: `${Math.min(pctGlobal * 5, 100)}%` }}></div>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-right text-slate-500">{new Date(client.lastPurchaseDate).toLocaleDateString('pt-BR')}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedClient && (
                <ClientDetailModal client={selectedClient} onClose={() => setSelectedClient(null)} />
            )}
        </div>
    );
};