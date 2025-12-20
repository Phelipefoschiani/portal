
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, Loader2, TrendingUp, DollarSign, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PositivizedModalProps {
  onClose: () => void;
}

export const PositivizedModal: React.FC<PositivizedModalProps> = ({ onClose }) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
  const userId = session.id;

  const cleanCnpj = (val: string) => String(val || '').replace(/\D/g, '');

  useEffect(() => {
    if (userId) fetchPositivized();
  }, [userId]);

  const fetchPositivized = async () => {
    setIsLoading(true);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const firstDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

    try {
      // 1. Busca Clientes do Representante para ter os nomes corretos
      const { data: portfolioClients } = await supabase
        .from('clientes')
        .select('cnpj, nome_fantasia')
        .eq('usuario_id', userId);

      // 2. Busca todas as vendas do mês
      const { data: sales } = await supabase
        .from('dados_vendas')
        .select('cnpj, faturamento, cliente_nome')
        .eq('usuario_id', userId)
        .gte('data', firstDayStr);

      // Criar um mapa de CNPJ -> Nome Fantasia (da carteira oficial)
      const clientNameMap = new Map();
      portfolioClients?.forEach(c => {
        clientNameMap.set(cleanCnpj(c.cnpj), c.nome_fantasia);
      });

      // 3. Agrupa faturamento por CNPJ
      const summary = new Map();
      sales?.forEach(s => {
        const cleaned = cleanCnpj(s.cnpj);
        if (!cleaned) return;

        // Tenta pegar o nome da carteira, se não tiver, usa o que veio na venda
        const officialName = clientNameMap.get(cleaned) || s.cliente_nome || 'Cliente não identificado';

        const current = summary.get(cleaned) || { 
          total: 0, 
          name: officialName, 
          count: 0,
          originalCnpj: s.cnpj 
        };
        
        summary.set(cleaned, { 
          total: current.total + Number(s.faturamento || 0), 
          name: current.name,
          count: current.count + 1,
          originalCnpj: current.originalCnpj
        });
      });

      const list = Array.from(summary.values()).sort((a, b) => b.total - a.total);
      setData(list);
    } catch (error) {
      console.error('Erro ao carregar positivados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl flex flex-col max-h-[85vh] animate-slideUp overflow-hidden border border-white/20">
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/80">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-600 shadow-sm border border-emerald-200/50">
               <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-emerald-900 tracking-tight">Performance Mensal</h3>
              <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider">Clientes positivados no período</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-emerald-200 rounded-full transition-colors text-emerald-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 bg-white p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-emerald-600" />
              <p className="text-sm font-black uppercase tracking-widest animate-pulse text-emerald-700">Calculando faturamentos...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-6">
                <DollarSign className="w-10 h-10" />
              </div>
              <p className="font-black text-slate-800 text-xl tracking-tight">Aguardando Vendas</p>
              <p className="text-sm mt-2 font-medium">Nenhuma compra registrada para este mês ainda.</p>
            </div>
          ) : (
            <div className="space-y-3 p-2">
              {data.map((item, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-white border border-slate-100 flex items-center justify-between group hover:shadow-xl transition-all hover:border-emerald-200 shadow-sm">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">{item.name}</h4>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest flex items-center gap-1.5 bg-emerald-50 px-2 py-1 rounded-lg">
                        <TrendingUp className="w-3 h-3" /> 
                        {item.count} {item.count === 1 ? 'Pedido' : 'Pedidos'}
                      </p>
                      <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                      <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">CNPJ: {item.originalCnpj}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-emerald-600 leading-none tabular-nums">{formatCurrency(item.total)}</p>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.1em] mt-2">Valor Faturado</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/80 rounded-b-[32px] flex justify-between items-center px-10">
           <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Resumo Consolidado</span>
           <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-500 uppercase">Total Geral:</span>
              <span className="text-3xl font-black text-emerald-700 tabular-nums">
                {formatCurrency(data.reduce((acc, c) => acc + c.total, 0))}
              </span>
           </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
