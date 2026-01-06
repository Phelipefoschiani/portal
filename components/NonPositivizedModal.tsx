
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, AlertCircle, Loader2, CalendarClock } from 'lucide-react';
import { totalDataStore } from '../lib/dataStore';

interface NonPositivizedModalProps {
  onClose: () => void;
  selectedMonths: number[];
  selectedYear: number;
}

export const NonPositivizedModal: React.FC<NonPositivizedModalProps> = ({ onClose, selectedMonths, selectedYear }) => {
  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  // Função de limpeza de CNPJ com preenchimento de zeros à esquerda (essencial para Excel)
  const cleanCnpj = (val: any) => {
    const numeric = String(val || '').replace(/\D/g, '');
    if (numeric.length > 11) return numeric.padStart(14, '0'); // CNPJ
    return numeric.padStart(11, '0'); // CPF
  };

  const pendingClients = useMemo(() => {
    if (!totalDataStore.isHydrated) return [];

    const allSales = totalDataStore.sales;
    const myClients = totalDataStore.clients;

    // 1. Mapeia a última data de compra histórica de CADA cliente (independente do período filtrado)
    const lastPurchaseMap = new Map<string, string>();
    allSales.forEach(s => {
        const cleanedS = cleanCnpj(s.cnpj);
        const current = lastPurchaseMap.get(cleanedS) || '0000-00-00';
        if (s.data > current) lastPurchaseMap.set(cleanedS, s.data);
    });

    // 2. Identifica quem comprou DENTRO do período que o usuário filtrou no dashboard
    const salesInPeriodCnpjs = new Set<string>();
    allSales.forEach(s => {
      const d = new Date(s.data + 'T00:00:00');
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      
      if (y === selectedYear && selectedMonths.includes(m)) {
          salesInPeriodCnpjs.add(cleanCnpj(s.cnpj));
      }
    });
    
    // 3. Filtra quem é da minha carteira mas NÃO está na lista de quem comprou no período
    return myClients.filter(client => {
      const clientCnpjClean = cleanCnpj(client.cnpj);
      return !salesInPeriodCnpjs.has(clientCnpjClean);
    }).map(client => ({
        ...client,
        lastPurchaseDate: lastPurchaseMap.get(cleanCnpj(client.cnpj)) || null
    })).sort((a, b) => {
        // Ordena por quem comprou há mais tempo primeiro para priorizar a visita
        if (!a.lastPurchaseDate) return 1;
        if (!b.lastPurchaseDate) return -1;
        return a.lastPurchaseDate.localeCompare(b.lastPurchaseDate);
    });
  }, [selectedMonths, selectedYear, userId]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-slideUp overflow-hidden border border-white/20">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-100 text-amber-600 shadow-sm border border-amber-200/50">
               <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Pendentes</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Clientes sem compra no período filtrado</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 bg-white p-2 custom-scrollbar">
          {!totalDataStore.isHydrated ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
              <p className="text-sm font-black uppercase tracking-widest animate-pulse">Sincronizando base comercial...</p>
            </div>
          ) : pendingClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <AlertCircle className="w-10 h-10" />
              </div>
              <p className="font-black text-slate-800 text-2xl tracking-tight">Toda a Carteira Ativa!</p>
              <p className="text-sm font-medium mt-2">Nenhum cliente pendente para este período.</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {pendingClients.map((client) => (
                <div key={client.id} className="p-5 rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-between group border border-transparent hover:border-slate-100">
                  <div className="flex-1">
                    <h4 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors text-lg uppercase tracking-tight">{client.nome_fantasia}</h4>
                    <div className="flex flex-wrap gap-4 mt-2">
                       <p className="text-[10px] text-slate-400 flex items-center gap-1.5 font-bold uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-lg">
                          CNPJ: {client.cnpj}
                       </p>
                       <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${client.lastPurchaseDate ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                          <CalendarClock className="w-3.5 h-3.5" />
                          Últ. Compra: {client.lastPurchaseDate ? new Date(client.lastPurchaseDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'NÃO IDENTIFICADA NO HISTÓRICO'}
                       </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/80 rounded-b-[32px] flex justify-between items-center px-10">
           <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Atenção Prioritária</span>
           <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-500">Total:</span>
              <span className="bg-slate-900 text-white text-sm font-black px-4 py-1.5 rounded-full shadow-lg">{pendingClients.length}</span>
           </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
