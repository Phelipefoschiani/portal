import React, { useState, useRef } from 'react';
import { TrendingUp, User, Calendar, ChevronDown, ChevronUp, Download, CheckCircle2, XCircle, AlertCircle, Filter } from 'lucide-react';
import { mockForecasts, representatives, updateForecastStatus } from '../../lib/mockData';
import { Button } from '../Button';
import html2canvas from 'html2canvas';

export const ManagerForecastScreen: React.FC = () => {
    // Filtros
    const [selectedRep, setSelectedRep] = useState('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [monthFilter, setMonthFilter] = useState<string>('all');
    const [yearFilter, setYearFilter] = useState<string>('2024'); // Default para o ano atual do mock

    // Estados de UI
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const cardRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Forçar update
    const [tick, setTick] = useState(0);

    // Lógica de Filtragem Avançada
    const filteredForecasts = mockForecasts.filter(f => {
        const date = new Date(f.date);
        
        // Filtro Rep
        const matchRep = selectedRep === 'all' || f.repId === selectedRep;
        
        // Filtro Status
        const matchStatus = statusFilter === 'all' || f.status === statusFilter;
        
        // Filtro Mês
        const matchMonth = monthFilter === 'all' || (date.getMonth() + 1).toString() === monthFilter;
        
        // Filtro Ano
        const matchYear = yearFilter === 'all' || date.getFullYear().toString() === yearFilter;

        return matchRep && matchStatus && matchMonth && matchYear;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const handleApprove = (id: string) => {
        setIsProcessing(id);
        setTimeout(() => {
            updateForecastStatus(id, 'approved');
            setIsProcessing(null);
            setTick(t => t + 1);
        }, 500);
    };

    const handleRejectSubmit = () => {
        if (!rejectId || !rejectReason) return;
        setIsProcessing(rejectId);
        setTimeout(() => {
            updateForecastStatus(rejectId, 'rejected', rejectReason);
            setRejectId(null);
            setRejectReason('');
            setIsProcessing(null);
            setTick(t => t + 1);
        }, 500);
    };

    const handleDownloadImage = async (id: string, repName: string) => {
        const element = cardRefs.current[id];
        if (!element) return;

        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = `previsao_${repName.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL();
            link.click();
        } catch (error) {
            console.error('Erro ao baixar imagem', error);
        }
    };

    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'approved': return <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Aprovada</span>;
            case 'rejected': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><XCircle className="w-3 h-3"/> Recusada</span>;
            default: return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Pendente</span>;
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
             
             {/* Header */}
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="w-7 h-7 text-blue-600" />
                        Previsões Recebidas
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Acompanhe as estimativas de fechamento enviadas pela equipe.
                    </p>
                </div>
            </div>

            {/* Barra de Filtros */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* Filtro Representante */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <User className="w-3 h-3" /> Representante
                    </label>
                    <select 
                        value={selectedRep}
                        onChange={(e) => setSelectedRep(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todos</option>
                        {representatives.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
                </div>

                {/* Filtro Status */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Filter className="w-3 h-3" /> Status
                    </label>
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="pending">Pendentes</option>
                        <option value="approved">Aprovadas</option>
                        <option value="rejected">Recusadas</option>
                    </select>
                </div>

                {/* Filtro Mês */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Mês
                    </label>
                    <select 
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todos os Meses</option>
                        {Array.from({length: 12}, (_, i) => (
                            <option key={i+1} value={i+1}>
                                {new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Filtro Ano */}
                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Ano
                    </label>
                    <select 
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todos</option>
                        <option value="2024">2024</option>
                        <option value="2023">2023</option>
                    </select>
                </div>
            </div>

            {/* Lista de Previsões */}
            <div className="space-y-4">
                {filteredForecasts.length === 0 ? (
                    <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400">
                        <Filter className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>Nenhuma previsão encontrada com os filtros selecionados.</p>
                    </div>
                ) : (
                    filteredForecasts.map(forecast => (
                        <div key={forecast.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-slideUp" ref={el => cardRefs.current[forecast.id] = el}>
                            <div 
                                onClick={() => setExpandedId(expandedId === forecast.id ? null : forecast.id)}
                                className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                            {forecast.repName}
                                            {getStatusBadge(forecast.status)}
                                        </h3>
                                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                            <Calendar className="w-3 h-3" />
                                            Enviado em: {new Date(forecast.date).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-slate-500 uppercase font-bold">Total Previsto</p>
                                        <p className="text-lg font-bold text-blue-700">{formatCurrency(forecast.totalValue)}</p>
                                    </div>
                                    {expandedId === forecast.id ? <ChevronUp className="text-slate-400"/> : <ChevronDown className="text-slate-400"/>}
                                </div>
                            </div>

                            {/* Detalhes Expandidos */}
                            {expandedId === forecast.id && (
                                <div className="bg-slate-50 border-t border-slate-100 p-5 animate-slideUp">
                                    
                                    {/* Botão de Download */}
                                    <div className="flex justify-end mb-4">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDownloadImage(forecast.id, forecast.repName); }}
                                            className="text-xs flex items-center gap-1 text-slate-500 hover:text-blue-600 font-medium"
                                        >
                                            <Download className="w-4 h-4" /> Baixar Imagem (WhatsApp)
                                        </button>
                                    </div>

                                    <table className="w-full text-sm text-left mb-6">
                                        <thead>
                                            <tr className="text-slate-500 border-b border-slate-200">
                                                <th className="pb-2 font-medium">Cliente</th>
                                                <th className="pb-2 font-medium text-right">Meta</th>
                                                <th className="pb-2 font-medium text-right">Previsão</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {forecast.items.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="py-2 text-slate-700">{item.clientName}</td>
                                                    <td className="py-2 text-right text-slate-500">{formatCurrency(item.targetValue)}</td>
                                                    <td className={`py-2 text-right font-bold ${item.forecastValue < item.targetValue ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                        {formatCurrency(item.forecastValue)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Ações do Gerente */}
                                    {forecast.status === 'pending' && !rejectId && (
                                        <div className="flex gap-3 justify-end border-t border-slate-200 pt-4">
                                            <Button 
                                                variant="outline" 
                                                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                                onClick={() => setRejectId(forecast.id)}
                                                disabled={!!isProcessing}
                                            >
                                                Recusar / Devolver
                                            </Button>
                                            <Button 
                                                className="bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                                                onClick={() => handleApprove(forecast.id)}
                                                disabled={!!isProcessing}
                                            >
                                                Aprovar Previsão
                                            </Button>
                                        </div>
                                    )}

                                    {/* Área de Motivo de Recusa */}
                                    {rejectId === forecast.id && (
                                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 mt-4 animate-fadeIn">
                                            <h4 className="text-sm font-bold text-red-800 mb-2">Motivo da Recusa</h4>
                                            <textarea 
                                                className="w-full p-2 border border-red-200 rounded-lg text-sm mb-3"
                                                placeholder="Explique o motivo para o representante corrigir..."
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="ghost" onClick={() => { setRejectId(null); setRejectReason(''); }} className="text-slate-500">Cancelar</Button>
                                                <Button onClick={handleRejectSubmit} className="bg-red-600 hover:bg-red-700">Confirmar Recusa</Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Exibição se Recusado */}
                                    {forecast.status === 'rejected' && forecast.rejectionReason && (
                                        <div className="bg-red-50 p-3 rounded-lg border border-red-100 mt-2">
                                            <span className="text-xs font-bold text-red-800 uppercase">Motivo:</span>
                                            <p className="text-sm text-red-700 italic">{forecast.rejectionReason}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};