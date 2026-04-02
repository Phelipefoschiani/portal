
import React from 'react';
import { createPortal } from 'react-dom';
import { X, ShoppingCart, Activity, Package, RefreshCw, ChevronRight } from 'lucide-react';

interface ClientActionMenuProps {
    client: {
        id: string;
        cnpj: string;
        nome_fantasia: string;
    };
    onClose: () => void;
    onAction: (action: 'last-purchase' | 'mix' | 'replenishment' | 'score-card') => void;
}

export const ClientActionMenu: React.FC<ClientActionMenuProps> = ({ client, onClose, onAction }) => {
    return createPortal(
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden animate-slideUp border border-white/20">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Ações do Cliente</h3>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-2">{client.nome_fantasia}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-3">
                    <button 
                        onClick={() => onAction('last-purchase')}
                        className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl hover:bg-blue-50 hover:border-blue-200 transition-all group shadow-sm"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <ShoppingCart className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Verificar Última Compra</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Detalhes do último pedido</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 transition-all" />
                    </button>

                    <button 
                        onClick={() => onAction('mix')}
                        className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl hover:bg-purple-50 hover:border-purple-200 transition-all group shadow-sm"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-all">
                                <Package className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Mix Ativo</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Produtos comprados pelo cliente</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-600 transition-all" />
                    </button>

                    <button 
                        onClick={() => onAction('replenishment')}
                        className="w-full flex items-center justify-between p-5 bg-white border border-slate-100 rounded-3xl hover:bg-amber-50 hover:border-amber-200 transition-all group shadow-sm"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all">
                                <RefreshCw className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Reposição</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Sugestão de novos pedidos</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-600 transition-all" />
                    </button>

                    <button 
                        onClick={() => onAction('score-card')}
                        className="w-full flex items-center justify-between p-5 bg-slate-900 rounded-3xl hover:bg-blue-600 transition-all group shadow-xl border-b-4 border-blue-600"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 text-white rounded-2xl group-hover:bg-white/20 transition-all">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <p className="text-xs font-black text-white uppercase tracking-tight">Score Card</p>
                                <p className="text-[9px] font-bold text-blue-400 uppercase mt-0.5">Saúde e performance do cliente</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white transition-all" />
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
