
import React, { useState, useEffect } from 'react';
import { Target, Users, Calendar, TrendingUp, ChevronRight, Loader2, Calculator, Percent, Save, CheckCircle2, AlertCircle, BarChart3, ChevronDown, ListTodo, Database, RefreshCw, ArrowRightLeft, Wand2, Building2, Search, Zap, CheckCircle, Cloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';

type TabType = 'team' | 'clients';

export const ManagerTargetsScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('team');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [managerGlobalTarget, setManagerGlobalTarget] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);
    
    // Estados Equipe
    const [reps, setReps] = useState<any[]>([]);
    const [repShares, setRepShares] = useState<Record<string, number>>({}); 
    const [monthlyWeights, setMonthlyWeights] = useState<Record<string, number[]>>({}); 
    const [savedReps, setSavedReps] = useState<Set<string>>(new Set());
    const [expandedRepId, setExpandedRepId] = useState<string | null>(null);
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [isSavingId, setIsSavingId] = useState<string | null>(null);

    // Estados Clientes
    const [selectedRepId, setSelectedRepId] = useState<string>('');
    const [clientData, setClientData] = useState<any[]>([]);
    const [clientShares, setClientShares] = useState<Record<string, number>>({});
    const [repAnnualHistory, setRepAnnualHistory] = useState({ year1: 0, year2: 0 });
    const [isClientsLoading, setIsClientsLoading] = useState(false);
    const [clientSearch, setClientSearch] = useState('');

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const availableYears = [2024, 2025, 2026, 2027];

    useEffect(() => {
        fetchInitialData();
    }, [selectedYear]);

    useEffect(() => {
        if (activeTab === 'clients' && selectedRepId) {
            fetchClientHistory();
        }
    }, [activeTab, selectedRepId, selectedYear]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const { data: repsData } = await supabase
                .from('usuarios')
                .select('id, nome, nivel_acesso')
                .not('nivel_acesso', 'ilike', 'admin')
                .not('nivel_acesso', 'ilike', 'gerente')
                .order('nome');

            const { data: targetsData } = await supabase.from('metas_usuarios').select('*').eq('ano', selectedYear);
            
            setReps(repsData || []);
            const initialShares: Record<string, number> = {};
            const initialWeights: Record<string, number[]> = {};
            const syncedReps = new Set<string>();
            const totalYear = targetsData?.reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;
            setManagerGlobalTarget(totalYear);

            repsData?.forEach(rep => {
                const repItems = targetsData?.filter(t => t.usuario_id === rep.id) || [];
                if (repItems.length > 0) syncedReps.add(rep.id);
                const repTotal = repItems.reduce((acc, curr) => acc + Number(curr.valor), 0);
                initialShares[rep.id] = totalYear > 0 ? Number(((repTotal / totalYear) * 100).toFixed(2)) : 0;
                const weights = new Array(12).fill(0);
                repItems.forEach(t => { weights[t.mes - 1] = repTotal > 0 ? Number(((Number(t.valor) / repTotal) * 100).toFixed(2)) : 0; });
                initialWeights[rep.id] = weights;
            });

            setRepShares(initialShares);
            setMonthlyWeights(initialWeights);
            setSavedReps(syncedReps);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const fetchAllSalesPaged = async (repId: string, start: string, end: string) => {
        let allSales: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('dados_vendas')
                .select('faturamento, cnpj, data')
                .eq('usuario_id', repId)
                .gte('data', start)
                .lte('data', end)
                .range(from, to);
            
            if (error) throw error;
            if (data && data.length > 0) {
                allSales = [...allSales, ...data];
                if (data.length < 1000) hasMore = false;
                from += 1000;
                to += 1000;
            } else {
                hasMore = false;
            }
        }
        return allSales;
    };

    const fetchClientHistory = async () => {
        setIsClientsLoading(true);
        try {
            const year1 = Number(selectedYear) - 1;
            const year2 = Number(selectedYear) - 2;

            const { data: clients } = await supabase.from('clientes').select('id, nome_fantasia, cnpj').eq('usuario_id', selectedRepId).order('nome_fantasia');
            
            // Busca paged para garantir que pega todo o faturamento de 2025/2024 sem limites
            const salesArray = await fetchAllSalesPaged(selectedRepId, `${year2}-01-01`, `${year1}-12-31`);

            const { data: existingClientTargets } = await supabase.from('metas_clientes')
                .select('valor, cliente_id')
                .eq('ano', selectedYear);

            const totalRepYear1 = salesArray.filter(s => new Date(s.data + 'T00:00:00').getFullYear() === year1).reduce((acc: number, curr: any) => acc + (Number(curr.faturamento) || 0), 0);
            const totalRepYear2 = salesArray.filter(s => new Date(s.data + 'T00:00:00').getFullYear() === year2).reduce((acc: number, curr: any) => acc + (Number(curr.faturamento) || 0), 0);

            setRepAnnualHistory({ year1: totalRepYear1, year2: totalRepYear2 });

            const clientStats = (clients || []).map(c => {
                const cleanCnpj = c.cnpj.replace(/\D/g, '');
                const salesYear1 = salesArray.filter(s => s.cnpj.replace(/\D/g, '') === cleanCnpj && new Date(s.data + 'T00:00:00').getFullYear() === year1).reduce((acc: number, curr: any) => acc + (Number(curr.faturamento) || 0), 0);
                const salesYear2 = salesArray.filter(s => s.cnpj.replace(/\D/g, '') === cleanCnpj && new Date(s.data + 'T00:00:00').getFullYear() === year2).reduce((acc: number, curr: any) => acc + (Number(curr.faturamento) || 0), 0);
                
                const repShareValue = Number(repShares[selectedRepId] || 0);
                const repAnnualForRep = (repShareValue / 100) * managerGlobalTarget;
                const savedTotal = ((existingClientTargets || []) as any[]).filter(t => t.cliente_id === c.id).reduce((acc: number, curr: any) => acc + (Number(curr.valor) || 0), 0);
                
                return {
                    ...c,
                    shareYear1: totalRepYear1 > 0 ? (salesYear1 / totalRepYear1) * 100 : 0,
                    shareYear2: totalRepYear2 > 0 ? (salesYear2 / totalRepYear2) * 100 : 0,
                    currentShare: repAnnualForRep > 0 ? (savedTotal / repAnnualForRep) * 100 : 0,
                    isConfigured: savedTotal > 0
                };
            });

            setClientData(clientStats);
            const initialClientShares: Record<string, number> = {};
            clientStats.forEach(c => { initialClientShares[c.id] = Number(c.currentShare.toFixed(2)); });
            setClientShares(initialClientShares);

        } catch (e) { console.error(e); } finally { setIsClientsLoading(false); }
    };

    const handleApplyAverage = () => {
        const newShares: Record<string, number> = {};
        clientData.forEach(c => {
            const avg = (c.shareYear1 + c.shareYear2) / 2;
            newShares[c.id] = Number(avg.toFixed(2));
        });
        setClientShares(newShares);
    };

    const handleSaveClientTargets = async () => {
        setIsSavingId('clients-all');
        try {
            const repShareValue = Number(repShares[selectedRepId] || 0);
            const repAnnualValue = (repShareValue / 100) * managerGlobalTarget;
            const repWeights = monthlyWeights[selectedRepId] || new Array(12).fill(0);
            
            const inserts: any[] = [];
            Object.entries(clientShares).forEach(([clientId, share]) => {
                const clientAnnual = (Number(share) / 100) * repAnnualValue;
                if (clientAnnual > 0) {
                    repWeights.forEach((weight, idx) => {
                        if (weight > 0) {
                            inserts.push({
                                cliente_id: clientId,
                                mes: idx + 1,
                                ano: selectedYear,
                                valor: (Number(weight) / 100) * clientAnnual
                            });
                        }
                    });
                }
            });

            const clientIds = clientData.map(c => c.id);
            await supabase.from('metas_clientes').delete().in('cliente_id', clientIds).eq('ano', selectedYear);
            
            if (inserts.length > 0) {
                const { error } = await supabase.from('metas_clientes').insert(inserts);
                if (error) throw error;
            }
            fetchClientHistory();
            alert(`Engenharia de Carteira para ${selectedYear} sincronizada!`);
        } catch (e) { console.error(e); alert('Erro ao salvar.'); }
        finally { setIsSavingId(null); }
    };

    const handleSaveIndividual = async (repId: string) => {
        const share = Number(repShares[repId] || 0);
        const weights = monthlyWeights[repId] || new Array(12).fill(0);
        const sumWeights = weights.reduce((a, b) => a + b, 0);
        if (share === 0 || Math.abs(sumWeights - 100) > 0.1) { alert('Ajuste o Share e 100% dos meses.'); return; }
        setIsSavingId(repId);
        try {
            const repAnnualValue = (share / 100) * managerGlobalTarget;
            const inserts = weights.map((pct, idx) => ({ usuario_id: repId, mes: idx + 1, ano: selectedYear, valor: Math.round((Number(pct) / 100) * repAnnualValue * 100) / 100 })).filter(i => i.valor > 0);
            await supabase.from('metas_usuarios').delete().eq('usuario_id', repId).eq('ano', selectedYear);
            if (inserts.length > 0) await supabase.from('metas_usuarios').insert(inserts);
            setSavedReps(prev => new Set(prev).add(repId));
            alert('Metas do representante atualizadas!');
        } catch (e) { console.error(e); } finally { setIsSavingId(null); }
    };

    const handleSaveAll = async () => {
        const totalShare = (Object.values(repShares) as number[]).reduce((acc: number, curr: number) => acc + (curr || 0), 0);
        if (Math.abs(totalShare - 100) > 0.1) { alert('A soma dos shares da equipe deve ser 100%'); return; }
        setIsSavingAll(true);
        try {
            const allInserts: any[] = [];
            for (const rep of reps) {
                const share = Number(repShares[rep.id] || 0);
                const weights = monthlyWeights[rep.id] || new Array(12).fill(0);
                const repAnnualValue = (share / 100) * managerGlobalTarget;
                weights.forEach((pct, idx) => {
                    const val = Math.round((Number(pct) / 100) * repAnnualValue * 100) / 100;
                    if (val > 0) allInserts.push({ usuario_id: rep.id, mes: idx + 1, ano: selectedYear, valor: val });
                });
            }
            const repIds = reps.map(r => r.id);
            await supabase.from('metas_usuarios').delete().in('usuario_id', repIds).eq('ano', selectedYear);
            if (allInserts.length > 0) await supabase.from('metas_usuarios').insert(allInserts);
            setSavedReps(new Set(reps.map(r => r.id)));
            alert('Equipe Sincronizada!');
        } catch (error: any) { console.error(error); } finally { setIsSavingAll(false); }
    };

    const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    const totalRepShare: number = (Object.values(repShares) as number[]).reduce((a: number, b: number) => (a || 0) + (b || 0), 0);
    const totalClientShare: number = (Object.values(clientShares) as number[]).reduce((a: number, b: number) => (a || 0) + (b || 0), 0);

    const pendingClients = clientData.filter(c => !c.isConfigured && c.nome_fantasia.toLowerCase().includes(clientSearch.toLowerCase()));

    return (
        <div className="w-full max-w-6xl mx-auto space-y-4 animate-fadeIn pb-32 text-slate-900">
            <div className="flex justify-center mb-6">
                <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm flex gap-1">
                    <button onClick={() => setActiveTab('team')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'team' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                        Engenharia de Equipe
                    </button>
                    <button onClick={() => setActiveTab('clients')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'clients' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                        Engenharia de Carteira
                    </button>
                </div>
            </div>

            {activeTab === 'team' ? (
                <>
                    <header className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-600 text-white rounded-xl"><BarChart3 className="w-5 h-5" /></div>
                            <div>
                                <h2 className="text-lg font-black tracking-tight uppercase leading-none">EQUIPE</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center">
                                    Ano de Lançamento: 
                                    <select 
                                        value={selectedYear} 
                                        onChange={(e) => setSelectedYear(Number(e.target.value))} 
                                        className="ml-2 bg-blue-50 text-blue-600 px-2 py-0.5 rounded border-none font-black outline-none cursor-pointer text-[10px]"
                                    >
                                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 max-w-md w-full bg-slate-900 p-4 rounded-2xl text-white flex items-center justify-between border border-white/10">
                            <div className="flex-1">
                                <p className="text-[8px] font-black text-blue-400 uppercase mb-1">Meta Total Anual (R$)</p>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-black text-white/30">R$</span>
                                    <input type="number" value={managerGlobalTarget || ''} onChange={(e) => setManagerGlobalTarget(Number(e.target.value))} className="bg-transparent border-none text-xl font-black outline-none w-full text-white p-0 focus:ring-0" placeholder="0"/>
                                </div>
                            </div>
                            <div className="text-right pl-4 border-l border-white/10">
                                <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Alocação</p>
                                <p className={`text-sm font-black ${Math.abs(totalRepShare - 100) < 0.1 ? 'text-emerald-400' : 'text-amber-400'}`}>{totalRepShare.toFixed(1)}%</p>
                            </div>
                        </div>
                    </header>

                    <div className="space-y-2">
                        {reps.map(rep => {
                            const share = Number(repShares[rep.id] || 0);
                            const repAnnual = (share / 100) * managerGlobalTarget;
                            const isExpanded = expandedRepId === rep.id;
                            const currentWeights = monthlyWeights[rep.id] || new Array(12).fill(0);
                            const isSynced = savedReps.has(rep.id);

                            return (
                                <div key={rep.id} className={`bg-white rounded-2xl border transition-all ${isExpanded ? 'border-blue-500 ring-4 ring-blue-50 shadow-lg' : isSynced ? 'border-emerald-100' : 'border-slate-200'}`}>
                                    <div className="p-3 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${isExpanded ? 'bg-blue-600 text-white' : isSynced ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{rep.nome.charAt(0)}</div>
                                            <div className="truncate">
                                                <h4 className="font-black text-slate-800 uppercase text-[11px] truncate">{rep.nome}</h4>
                                                <p className="text-[10px] font-black text-blue-600 leading-none">{formatCurrency(repAnnual)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                                                <input type="number" value={share || ''} onChange={(e) => setRepShares(prev => ({ ...prev, [rep.id]: Number(e.target.value) }))} className="w-10 bg-transparent text-xs font-black text-slate-900 outline-none text-center p-0" placeholder="0"/>
                                                <Percent className="w-3 h-3 text-slate-300" />
                                            </div>
                                            <button onClick={() => setExpandedRepId(isExpanded ? null : rep.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${isExpanded ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-600'}`}>
                                                MESES <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                                            <div className="flex justify-between items-center mb-4">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sazonalidade Mensal (%)</p>
                                                <Button size="sm" onClick={() => handleSaveIndividual(rep.id)} isLoading={isSavingId === rep.id} className="rounded-xl px-4 py-2 font-black text-[9px]">{isSynced ? 'ATUALIZAR' : 'SALVAR'}</Button>
                                            </div>
                                            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                                {months.map((m, i) => (
                                                    <div key={i} className="p-2 bg-white border border-slate-200 rounded-xl">
                                                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">{m}</p>
                                                        <div className="flex items-center gap-1 mb-1">
                                                            <input type="number" value={currentWeights[i] || ''} onChange={(e) => { const newW = [...currentWeights]; newW[i] = Number(e.target.value); setMonthlyWeights(prev => ({ ...prev, [rep.id]: newW })); }} className="w-full bg-transparent text-[10px] font-black text-slate-900 outline-none p-0" placeholder="0"/>
                                                            <span className="text-[9px] font-bold text-slate-300">%</span>
                                                        </div>
                                                        <p className="text-[8px] font-black text-blue-600 truncate">{formatCurrency((Number(currentWeights[i]) / 100) * repAnnual)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <>
                    <header className="space-y-4">
                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-600 text-white rounded-xl"><Building2 className="w-5 h-5" /></div>
                                <div>
                                    <h2 className="text-lg font-black tracking-tight uppercase leading-none">Fatiamento de Carteira</h2>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Meta Alvo: 
                                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="ml-2 bg-blue-50 text-blue-600 px-2 py-0.5 rounded border-none font-black outline-none cursor-pointer">
                                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </p>
                                </div>
                            </div>
                            <div className="flex-1 max-w-xs">
                                <select value={selectedRepId} onChange={(e) => setSelectedRepId(e.target.value)} className="w-full bg-slate-900 text-white border-none rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500 shadow-xl">
                                    <option value="">Selecione o Representante...</option>
                                    {reps.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                                </select>
                            </div>
                        </div>

                        {selectedRepId && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Faturado {Number(selectedYear) - 2}</p>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(repAnnualHistory.year2)}</p>
                                    <div className="absolute top-0 right-0 p-4 opacity-5"><TrendingUp className="w-12 h-12" /></div>
                                </div>
                                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Faturado {Number(selectedYear) - 1}</p>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(repAnnualHistory.year1)}</p>
                                    <div className="absolute top-0 right-0 p-4 opacity-5"><TrendingUp className="w-12 h-12 text-blue-600" /></div>
                                </div>
                                <div className="bg-slate-900 p-5 rounded-3xl border border-white/10 shadow-xl">
                                    <p className="text-[9px] font-black text-blue-400 uppercase mb-2 tracking-widest">Cota Rep. {selectedYear}</p>
                                    <p className="text-xl font-black text-white tabular-nums">{formatCurrency(((Number(repShares[selectedRepId] || 0)) / 100) * managerGlobalTarget)}</p>
                                </div>
                            </div>
                        )}
                    </header>

                    {selectedRepId && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" placeholder="Buscar na carteira..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-10 py-2.5 text-xs font-bold outline-none"/>
                            </div>
                            <button onClick={handleApplyAverage} className="bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Wand2 className="w-4 h-4" /> Sugerir por Histórico
                            </button>
                        </div>
                    )}

                    {!selectedRepId ? (
                        <div className="p-20 text-center bg-white rounded-3xl border border-slate-200 border-dashed">
                            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Selecione um representante para engenharia de carteira</p>
                        </div>
                    ) : isClientsLoading ? (
                        <div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processando milhões de registros históricos...</p></div>
                    ) : (
                        <div className="space-y-8 pb-20">
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><Zap className="w-4 h-4" /></div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.2em]">Engenharia de Carteira</h3>
                                </div>
                                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                    <table className="w-full text-left text-[11px]">
                                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest">
                                            <tr>
                                                <th className="px-6 py-4">Cliente / CNPJ</th>
                                                <th className="px-6 py-4 text-center">{Number(selectedYear) - 2} (%)</th>
                                                <th className="px-6 py-4 text-center">{Number(selectedYear) - 1} (%)</th>
                                                <th className="px-6 py-4 text-center bg-blue-50/50">{selectedYear} (%)</th>
                                                <th className="px-6 py-4 text-right">Projetado (R$)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {pendingClients.map(c => {
                                                const share = Number(clientShares[c.id] || 0);
                                                const repShareVal = Number(repShares[selectedRepId] || 0);
                                                const repAnnual = (repShareVal / 100) * managerGlobalTarget;
                                                const projected = (share / 100) * repAnnual;

                                                return (
                                                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <p className="font-black text-slate-800 uppercase truncate max-w-[200px]">{c.nome_fantasia}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold">{c.cnpj}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-bold text-slate-400">{Number(c.shareYear2).toFixed(1)}%</td>
                                                        <td className="px-6 py-4 text-center font-bold text-slate-400">{Number(c.shareYear1).toFixed(1)}%</td>
                                                        <td className="px-6 py-4 text-center bg-blue-50/30">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <input type="number" value={share || ''} onChange={e => setClientShares(prev => ({ ...prev, [c.id]: Number(e.target.value) }))} className="w-12 bg-white border border-blue-200 rounded-lg px-2 py-1 text-center font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-100"/>
                                                                <span className="text-[9px] font-black text-blue-300">%</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-900 tabular-nums">{formatCurrency(projected)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>
                    )}
                </>
            )}

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-[100]">
                <div className="bg-slate-900/95 backdrop-blur-xl p-4 rounded-3xl border border-white/10 shadow-2xl flex items-center justify-between gap-4">
                    <div className="text-white">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">{activeTab === 'team' ? 'Meta da Equipe' : 'Meta da Carteira'}</p>
                        <p className={`text-xs font-black ${Math.abs((activeTab === 'team' ? totalRepShare : totalClientShare) - 100) < 0.1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {(activeTab === 'team' ? totalRepShare : totalClientShare).toFixed(1)}% Sincronizados
                        </p>
                    </div>
                    {activeTab === 'team' ? (
                        <Button onClick={handleSaveAll} disabled={Math.abs(totalRepShare - 100) > 0.1 || isSavingAll} isLoading={isSavingAll} className="rounded-2xl px-10 h-12 font-black uppercase text-[10px] tracking-widest bg-blue-600">
                            Sincronizar Equipe
                        </Button>
                    ) : (
                        <Button onClick={handleSaveClientTargets} disabled={!selectedRepId || Math.abs(totalClientShare - 100) > 0.1 || isSavingId === 'clients-all'} isLoading={isSavingId === 'clients-all'} className="rounded-2xl px-10 h-12 font-black uppercase text-[10px] tracking-widest bg-blue-600">
                            Salvar Alterações
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
