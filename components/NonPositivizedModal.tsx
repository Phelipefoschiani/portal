
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

  const cleanCnpj = (val: any) => {
    const numeric = String(val || '').replace(/\D/g, '');
    if (numeric.length > 11) return numeric.padStart(14, '0'); // CNPJ
    return numeric.padStart(11, '0'); // CPF
  };

  const pendingClients = useMemo(() => {
    if (!totalDataStore.isHydrated) return [];

    const allSales = totalDataStore.sales;
    const myClients = totalDataStore.clients;

    const lastPurchaseMap = new Map<string, string>();
    allSales.forEach(s => {
        const cleanedS = cleanCnpj(s.cnpj);
        const current = lastPurchaseMap.get(cleanedS) || '0000-00-00';
        if (s.data > current) lastPurchaseMap.set(cleanedS, s.data);
    });

    const salesInPeriodCnpjs = new Set<string>();
    allSales.forEach(s => {
      const d = new Date(s.data + 'T00:00:00');
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();
      
      if (y === selectedYear && selectedMonths.includes(m)) {
          salesInPeriodCnpjs.add(cleanCnpj(s.cnpj));
      }
    });
    
    return myClients.filter(client => {
      const clientCnpjClean = cleanCnpj(client.cnpj);
      return !salesInPeriodCnpjs.has(clientCnpjClean);
    }).map(client => ({
        ...client,
        lastPurchaseDate: lastPurchaseMap.get(cleanCnpj(client.cnpj)) || null
    })).sort((a, b) => {
        if (!a.lastPurchaseDate) return 1;
        if (!b.lastPurchaseDate) return -1;
        return a.lastPurchaseDate.localeCompare(b.lastPurchaseDate);
    });
  }, [selectedMonths, selectedYear, userId]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-[24px] md:rounded-[32px] shadow-2xl flex flex-col max-h-[92vh] md:max-h-[85vh] animate-slideUp overflow-hidden border border-white/20">
        <div className="p-5 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-amber-100 text-amber-600 shadow-sm border border-amber-200/50">
               <AlertCircle className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h3 className="text-lg md:text-2xl font-black text-slate-800 tracking-tight leading-none">Pendentes</h3>
              <p className="text-[8px] md:text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Clientes sem compra no período</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 bg-white p-2 md:p-4 custom-scrollbar">
          {!totalDataStore.isHydrated ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
              <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Sincronizando...</p>
            </div>
          ) : pendingClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="font-black text-slate-800 text-lg uppercase tracking-tight">Tudo em Dia!</p>
              <p className="text-[10px] mt-1 font-bold uppercase tracking-widest opacity-50">Nenhum cliente pendente no período.</p>
            </div>
          ) : (
            <div className="space-y-1.5 md:space-y-2">
              {pendingClients.map((client) => (
                <div key={client.id} className="p-4 md:p-5 rounded-2xl hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between group border border-transparent hover:border-slate-100 gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors text-xs md:text-lg uppercase tracking-tight truncate">{client.nome_fantasia}</h4>
                    <div className="flex flex-wrap gap-2 md:gap-4 mt-1.5">
                       <p className="text-[7px] md:text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-slate-100 px-2 py-0.5 md:py-1 rounded-md md:rounded-lg">
                          CNPJ: {client.cnpj}
                       </p>
                    </div>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-2 md:px-3 py-1 rounded-lg text-[7px] md:text-[10px] font-black uppercase self-start md:self-center shrink-0 ${client.lastPurchaseDate ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                      <CalendarClock className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />
                      Últ. Compra: {client.lastPurchaseDate ? new Date(client.lastPurchaseDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/I'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50/80 rounded-b-[24px] md:rounded-b-[32px] flex justify-between items-center px-6 md:px-10 shrink-0">
           <span className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Ações Necessárias</span>
           <div className="flex items-center gap-2">
              <span className="bg-slate-900 text-white text-[10px] md:text-sm font-black px-3 md:px-4 py-1 rounded-full shadow-lg">
                {pendingClients.length} Clientes
              </span>
           </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
