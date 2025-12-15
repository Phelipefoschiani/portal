import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Filter, Building2, User, CreditCard, Package, Banknote, Loader2, Quote } from 'lucide-react';
import { mockInvestments, representatives, updateInvestmentStatus, PaymentChannelType } from '../../lib/mockData';
import { Button } from '../Button';

export const ManagerCampaignsScreen: React.FC = () => {
    const [viewMode, setViewMode] = useState<'pending' | 'all'>('pending');
    const [selectedRep, setSelectedRep] = useState('all');
    // Estado para controlar carregamento individual dos botões
    const [processingId, setProcessingId] = useState<string | null>(null);
    // Forçar re-render após update
    const [updater, setUpdater] = useState(0); 

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const filteredInvestments = mockInvestments.filter(inv => {
        const statusMatch = viewMode === 'pending' ? inv.status === 'pending' : true;
        const repMatch = selectedRep === 'all' ? true : inv.repId === selectedRep;
        return statusMatch && repMatch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
        // Inicia carregamento visual
        setProcessingId(id);
        
        // Simula delay de rede e processamento
        setTimeout(() => {
            updateInvestmentStatus(id, status);
            setProcessingId(null);
            setUpdater(prev => prev + 1);
        }, 600);
    };

    const getChannelIcon = (type: PaymentChannelType) => {
        switch (type) {
            case 'Caju': return <CreditCard className="w-3 h-3 text-pink-500" />;
            case 'Dinheiro': return <Banknote className="w-3 h-3 text-emerald-500" />;
            case 'Produto': return <Package className="w-3 h-3 text-blue-500" />;
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ShieldCheck className="w-7 h-7 text-blue-600" />
                        Análise de Campanhas
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Aprove ou recuse solicitações de verba dos representantes.
                    </p>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-4">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setViewMode('pending')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'pending' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Solicitações Pendentes
                    </button>
                    <button 
                        onClick={() => setViewMode('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${viewMode === 'all' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        Histórico Geral
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select 
                        value={selectedRep}
                        onChange={(e) => setSelectedRep(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todos Representantes</option>
                        {representatives.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 gap-4">
                {filteredInvestments.length === 0 ? (
                    <div className="py-12 text-center bg-white rounded-2xl border border-slate-200">
                        <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500">Nenhuma solicitação encontrada.</p>
                    </div>
                ) : (
                    filteredInvestments.map(inv => (
                        <div key={inv.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 animate-fadeIn">
                            
                            {/* Info Principal */}
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                                    <User className="w-4 h-4" />
                                    <span className="font-medium text-slate-700">{inv.repName}</span>
                                    <span>•</span>
                                    <span>{new Date(inv.date).toLocaleString('pt-BR')}</span>
                                </div>
                                
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Building2 className="w-5 h-5 text-slate-400" />
                                    {inv.clientName}
                                </h3>

                                {/* Descrição com Destaque */}
                                <div className="relative">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-200 rounded-l-lg"></div>
                                    <div className="bg-slate-50 p-4 rounded-r-lg border border-l-0 border-slate-100">
                                        <div className="flex gap-2 mb-1">
                                            <Quote className="w-4 h-4 text-blue-400 rotate-180" />
                                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Descrição</span>
                                        </div>
                                        <p className="text-slate-700 text-sm leading-relaxed italic">
                                            {inv.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Canais */}
                                <div className="flex gap-4 pt-1">
                                    {inv.channels.map((ch, idx) => (
                                        <div key={idx} className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 px-2.5 py-1.5 rounded-lg text-slate-600 border border-slate-200">
                                            {getChannelIcon(ch.type)}
                                            {ch.type}: {formatCurrency(ch.value)}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Valor e Ações */}
                            <div className="flex flex-col justify-between items-end min-w-[200px] border-l border-slate-100 pl-6 border-dashed">
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 uppercase font-bold">Valor Total</p>
                                    <p className="text-3xl font-bold text-blue-600 tracking-tight">{formatCurrency(inv.totalValue)}</p>
                                </div>

                                <div className="mt-6 w-full">
                                    {inv.status === 'pending' ? (
                                        <div className="flex gap-3 w-full">
                                            <Button 
                                                variant="outline" 
                                                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 h-10"
                                                onClick={() => handleUpdateStatus(inv.id, 'rejected')}
                                                disabled={processingId === inv.id}
                                            >
                                                {processingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Recusar'}
                                            </Button>
                                            <Button 
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-10 shadow-emerald-200"
                                                onClick={() => handleUpdateStatus(inv.id, 'approved')}
                                                disabled={processingId === inv.id}
                                            >
                                                 {processingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Aprovar'}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className={`w-full py-3 text-center rounded-xl font-bold text-sm border flex items-center justify-center gap-2 ${inv.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                            {inv.status === 'approved' ? <CheckCircle2 className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>}
                                            {inv.status === 'approved' ? 'APROVADO' : 'RECUSADO'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};