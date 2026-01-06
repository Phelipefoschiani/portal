
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Loader2, TrendingUp, DollarSign, Building2 } from 'lucide-react';
import { totalDataStore } from '../lib/dataStore';

interface PositivizedModalProps {
  onClose: () => void;
  selectedMonths: number[];
  selectedYear: number;
}

export const PositivizedModal: React.FC<PositivizedModalProps> = ({ onClose, selectedMonths, selectedYear }) => {
  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  const cleanCnpj = (val: any) => {
    const numeric = String(val || '').replace(/\D/g, '');
    if (numeric.length > 11) return numeric.padStart(14, '0');
    return numeric.padStart(11, '0');
  };

  const list = useMemo(() => {
    if (!totalDataStore.isHydrated) return [];

    const sales = totalDataStore.sales;
    const portfolioClients = totalDataStore.clients;

    const clientNameMap = new Map();
    portfolioClients.forEach(c => {
      clientNameMap.set(cleanCnpj(c.cnpj), c.nome_fantasia);
    });

    const summary = new Map();
    sales.forEach(s => {
      const d = new Date(s.data + 'T00:00:00');
      const m = d.getUTCMonth() + 1;
      const y = d.getUTCFullYear();

      if (y !== selectedYear || !selectedMonths.includes(m)) return;

      const cleaned = cleanCnpj(s.cnpj);
      const officialName = clientNameMap.get(cleaned) || s.cliente_nome || 'Cliente não identificado';

      const current = summary.get(cleaned) || { 
        total: 0, 
        name: officialName, 
        originalCnpj: s.cnpj 
      };
      
      summary.set(cleaned, { 
        total: current.total + Number(s.faturamento || 0), 
        name: current.name,
        originalCnpj: current.originalCnpj
      });
    });

    return Array.from(summary.values()).sort((a, b) => b.total - a.total);
  }, [selectedMonths, selectedYear, userId]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-[24px] md:rounded-[32px] shadow-2xl flex flex-col max-h-[92vh] md:max-h-[85vh] animate-slideUp overflow-hidden border border-white/20">
        <div className="p-5 md:p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/80 shrink-0">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm border border-emerald-200/50">
               <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h3 className="text-lg md:text-2xl font-black text-emerald-900 tracking-tight leading-none">Positivados</h3>
              <p className="text-[8px] md:text-xs text-emerald-700 font-bold uppercase tracking-wider mt-1">Clientes faturados no período</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 bg-white p-3 md:p-4 custom-scrollbar">
          {!totalDataStore.isHydrated ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-600" />
              <p className="text-[10px] font-black uppercase tracking-widest animate-pulse text-emerald-700">Sincronizando...</p>
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
              <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-6">
                <DollarSign className="w-8 h-8" />
              </div>
              <p className="font-black text-slate-800 text-lg uppercase tracking-tight">Sem Vendas</p>
              <p className="text-[10px] mt-1 font-bold uppercase tracking-widest opacity-50">Nenhum registro para este filtro.</p>
            </div>
          ) : (
            <div className="space-y-2 md:space-y-3">
              {list.map((item, idx) => (
                <div key={idx} className="p-4 md:p-6 rounded-2xl bg-white border border-slate-100 flex flex-col md:flex-row md:items-center justify-between group hover:shadow-xl transition-all hover:border-emerald-200 shadow-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        <h4 className="font-black text-slate-900 text-xs md:text-lg uppercase tracking-tight truncate">{item.name}</h4>
                    </div>
                    <p className="text-[8px] md:text-[10px] text-slate-400 font-bold tracking-wider uppercase">CNPJ: {item.originalCnpj}</p>
                  </div>
                  <div className="text-left md:text-right border-t md:border-t-0 border-slate-50 pt-2 md:pt-0">
                    <p className="text-lg md:text-2xl font-black text-emerald-600 leading-none tabular-nums">{formatCurrency(item.total)}</p>
                    <p className="text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Faturado no Período</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50/80 rounded-b-[24px] md:rounded-b-[32px] flex justify-between items-center px-6 md:px-10 shrink-0">
           <span className="text-[8px] md:text-xs font-black text-slate-400 uppercase tracking-widest">Total Consolidado</span>
           <div className="flex items-center gap-2 md:gap-4">
              <span className="text-xl md:text-3xl font-black text-emerald-700 tabular-nums">
                {formatCurrency(list.reduce((acc, c) => acc + c.total, 0))}
              </span>
           </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
