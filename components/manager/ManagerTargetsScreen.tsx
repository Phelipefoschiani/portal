
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Target, Users, Calendar, TrendingUp, ChevronRight, Loader2, Calculator, Percent, Save, CheckCircle2, AlertCircle, BarChart3, ChevronDown, ListTodo, Database, RefreshCw, ArrowRightLeft, Wand2, Building2, Search, Zap, CheckCircle, Cloud, DollarSign, Eye, X, Info, Download, Wand, AlertTriangle, LayoutGrid, ArrowDown, User, Layers, History, Play } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import { totalDataStore } from '../../lib/dataStore';
import { createPortal } from 'react-dom';

type TabType = 'team' | 'clients';

const MonthlyCard: React.FC<{
    month: string;
    weight: number;
    totalTarget: number;
    onChangeWeight: (val: number) => void;
    onChangeValue: (valStr: string) => void;
}> = ({ month, weight, totalTarget, onChangeWeight, onChangeValue }) => {
    const value = (weight / 100) * totalTarget;
    const [localValue, setLocalValue] = useState('');

    useEffect(() => {
        setLocalValue(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value));
    }, [value]);

    return (
        <div className="bg-slate-50 p-4 rounded-[24px] border border-slate-100 flex flex-col gap-2 group hover:border-blue-200 transition-all">
            <span className="text-[10px] font-black text-slate-400 uppercase text-center group-hover:text-blue-600">{month}</span>
            <div className="flex items-center gap-1 bg-white rounded-xl px-2 py-1.5 border border-slate-200 shadow-sm">
                <span className="text-[8px] font-black text-slate-300 uppercase">Peso</span>
                <input type="number" step="0.01" value={weight || ''} onChange={(e) => onChangeWeight(Number(e.target.value))} className="w-full bg-transparent text-center text-xs font-black text-slate-900 outline-none" placeholder="0,00" />
                <span className="text-[10px] font-bold text-slate-300">%</span>
            </div>
            <div className="flex items-center gap-1 bg-blue-600/5 rounded-xl px-2 py-1.5 border border-blue-100/50 focus-within:border-blue-400 focus-within:bg-white shadow-sm transition-all">
                <span className="text-[8px] font-black text-blue-300 uppercase">R$</span>
                <input type="text" value={localValue} onChange={(e) => { setLocalValue(e.target.value); onChangeValue(e.target.value); }} className="w-full bg-transparent text-center text-[10px] font-black text-blue-600 outline-none tabular-nums" placeholder="0,00" />
            </div>
        </div>
    );
};

export const ManagerTargetsScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('team');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [managerTotalTarget, setManagerTotalTarget] = useState<number>(0);
    const [displayTarget, setDisplayTarget] = useState('0,00');
    
    const [regionalMonthlyWeights, setRegionalMonthlyWeights] = useState<number[]>(new Array(12).fill(0));
    const [reps, setReps] = useState<any[]>([]);
    const [repShares, setRepShares] = useState<Record<string, number>>({}); 
    const [monthlyRepShares, setMonthlyRepShares] = useState<Record<string, number[]>>({}); 
    const [savedReps, setSavedReps] = useState<Set<string>>(new Set());
    const [expandedRepId, setExpandedRepId] = useState<string | null>(null);
    const [isSavingId, setIsSavingId] = useState<string | null>(null);

    const [selectedRepId, setSelectedRepId] = useState<string>('');
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);
    const [genProgress, setGenProgress] = useState(0);
    const [clientEngineeringData, setClientEngineeringData] = useState<any[]>([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const availableYears = [2024, 2025, 2026, 2027];

    useEffect(() => { fetchInitialData(); }, [selectedYear]);
    useEffect(() => { if (activeTab === 'clients' && selectedRepId) fetchClientWeights(); }, [selectedRepId, activeTab, selectedYear]);

    useEffect(() => {
        const formatted = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(managerTotalTarget);
        setDisplayTarget(formatted);
    }, [managerTotalTarget]);

    const handleDisplayTargetChange = (valStr: string) => {
        const cleanValue = valStr.replace(/\D/g, '');
        const numericValue = parseFloat(cleanValue) / 100 || 0;
        setManagerTotalTarget(numericValue);
    };

    const fetchInitialData = async () => {
        try {
            const { data: repsData } = await supabase.from('usuarios').select('id, nome, nivel_acesso').not('nivel_acesso', 'ilike', 'admin').not('nivel_acesso', 'ilike', 'gerente').order('nome');
            const { data: targetsData } = await supabase.from('metas_usuarios').select('*').eq('ano', selectedYear);
            setReps(repsData || []);
            const totalYear = targetsData?.reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;
            if (totalYear > 0) {
                setManagerTotalTarget(totalYear);
                const regWeights = new Array(12).fill(0);
                for(let i=0; i<12; i++) {
                    const monthTotal = targetsData?.filter(t => t.mes === i+1).reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;
                    regWeights[i] = (monthTotal / totalYear) * 100;
                }
                setRegionalMonthlyWeights(regWeights);
            }
            const initialGlobalShares: Record<string, number> = {};
            const initialMonthlyShares: Record<string, number[]> = {};
            const syncedReps = new Set<string>();
            repsData?.forEach(rep => {
                const repItems = targetsData?.filter(t => t.usuario_id === rep.id) || [];
                if (repItems.length > 0) syncedReps.add(rep.id);
                const repTotal = repItems.reduce((acc, curr) => acc + Number(curr.valor), 0);
                initialGlobalShares[rep.id] = totalYear > 0 ? (repTotal / totalYear) * 100 : 0;
                const shares = new Array(12).fill(0);
                repItems.forEach(t => { 
                    const monthRegTotal = targetsData?.filter(mt => mt.mes === t.mes).reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;
                    shares[t.mes - 1] = monthRegTotal > 0 ? (Number(t.valor) / monthRegTotal) * 100 : 0; 
                });
                initialMonthlyShares[rep.id] = shares;
            });
            setRepShares(initialGlobalShares);
            setMonthlyRepShares(initialMonthlyShares);
            setSavedReps(syncedReps);
        } catch (e) { console.error(e); }
    };

    const fetchClientWeights = async () => {
        setIsLoadingClients(true);
        try {
            const prevYear = selectedYear - 1;
            const sales = totalDataStore.sales;
            const clients = totalDataStore.clients.filter(c => c.usuario_id === selectedRepId);
            
            // Faturamento Total do Representante no ano anterior
            const repTotalPrev = sales.filter(s => {
                const d = new Date(s.data + 'T00:00:00');
                return s.usuario_id === selectedRepId && d.getUTCFullYear() === prevYear;
            }).reduce((a, b) => a + Number(b.faturamento), 0);

            const engineering = clients.map(client => {
                const cleanCnpj = String(client.cnpj || '').replace(/\D/g, '');
                const clientSalesPrev = sales.filter(s => {
                    const d = new Date(s.data + 'T00:00:00');
                    return String(s.cnpj || '').replace(/\D/g, '') === cleanCnpj && d.getUTCFullYear() === prevYear;
                }).reduce((a, b) => a + Number(b.faturamento), 0);

                const weight = repTotalPrev > 0 ? (clientSalesPrev / repTotalPrev) : 0;
                return { ...client, salesPrev: clientSalesPrev, weight: weight };
            }).filter(c => c.weight > 0).sort((a, b) => b.salesPrev - a.salesPrev);

            setClientEngineeringData(engineering);
        } catch (e) { console.error(e); } finally { setIsLoadingClients(false); }
    };

    const handleGenerateAll = async () => {
        if (!selectedRepId) {
            alert('Por favor, selecione um representante primeiro.');
            return;
        }

        if (clientEngineeringData.length === 0) {
            alert('Nenhum cliente com peso histórico encontrado para este representante.');
            return;
        }

        // Abre o modal de progresso IMEDIATAMENTE
        setIsGeneratingAll(true);
        setGenProgress(0);

        try {
            // 1. Busca metas mensais do representante
            const { data: repMonthlyTargets, error: repError } = await supabase
                .from('metas_usuarios')
                .select('mes, valor')
                .eq('usuario_id', selectedRepId)
                .eq('ano', selectedYear);

            if (repError) throw repError;

            if (!repMonthlyTargets || repMonthlyTargets.length === 0) {
                setIsGeneratingAll(false);
                alert('ERRO: O representante selecionado não possui metas salvas para ' + selectedYear + '. \n\nDefina as metas na aba "Metas por Equipe" antes de gerar a engenharia.');
                return;
            }

            // 2. Prepara limpeza da carteira
            const clientIds = clientEngineeringData.map(c => c.id);
            await supabase.from('metas_clientes').delete().in('cliente_id', clientIds).eq('ano', selectedYear);

            // 3. Processamento com Delay de UX (5 segundos)
            const totalClients = clientEngineeringData.length;
            const delayStep = 5000 / totalClients;

            for (let i = 0; i < totalClients; i++) {
                const client = clientEngineeringData[i];
                
                // Calcula meta para os 12 meses do cliente baseado no seu peso histórico
                const inserts = repMonthlyTargets.map(t => ({
                    cliente_id: client.id,
                    mes: t.mes,
                    ano: selectedYear,
                    valor: Math.round(Number(t.valor) * client.weight * 100) / 100
                })).filter(ins => ins.valor >= 0);

                if (inserts.length > 0) {
                    await supabase.from('metas_clientes').insert(inserts);
                }

                // Atualiza progresso e espera o delay para dar o efeito visual
                setGenProgress(Math.round(((i + 1) / totalClients) * 100));
                await new Promise(resolve => setTimeout(resolve, delayStep));
            }

            // Finaliza
            setGenProgress(100);
            setTimeout(() => {
                setIsGeneratingAll(false);
                alert('Engenharia de Carteira concluída com sucesso para ' + totalClients + ' clientes!');
            }, 500);

        } catch (e: any) {
            console.error(e);
            setIsGeneratingAll(false);
            alert('Falha crítica na Engenharia: ' + e.message);
        }
    };

    const handleGenerateSingle = async (client: any) => {
        try {
            const { data: repMonthlyTargets } = await supabase.from('metas_usuarios').select('mes, valor').eq('usuario_id', selectedRepId).eq('ano', selectedYear);
            if (!repMonthlyTargets || repMonthlyTargets.length === 0) {
                alert('Defina a meta do representante primeiro.');
                return;
            }
            
            const inserts = repMonthlyTargets.map(t => ({
                cliente_id: client.id,
                mes: t.mes,
                ano: selectedYear,
                valor: Math.round(Number(t.valor) * client.weight * 100) / 100
            })).filter(i => i.valor > 0);

            await supabase.from('metas_clientes').delete().eq('cliente_id', client.id).eq('ano', selectedYear);
            if (inserts.length > 0) await supabase.from('metas_clientes').insert(inserts);
            alert(`Metas projetadas para ${client.nome_fantasia}`);
        } catch(e) { console.error(e); }
    };

    const handleRegionalWeightChange = (idx: number, val: number) => {
        const newWeights = [...regionalMonthlyWeights];
        newWeights[idx] = val;
        setRegionalMonthlyWeights(newWeights);
    };

    const handleRegionalValueChange = (idx: number, valStr: string) => {
        const cleanValue = valStr.replace(/\D/g, '');
        const numericValue = parseFloat(cleanValue) / 100 || 0;
        if (managerTotalTarget > 0) {
            const newPct = (numericValue / managerTotalTarget) * 100;
            handleRegionalWeightChange(idx, newPct);
        }
    };

    const handleSaveIndividual = async (repId: string) => {
        const shares = monthlyRepShares[repId] || new Array(12).fill(0);
        setIsSavingId(repId);
        try {
            const inserts = shares.map((pct, idx) => {
                const regionalMonthValue = (regionalMonthlyWeights[idx] / 100) * managerTotalTarget;
                return { usuario_id: repId, mes: idx + 1, ano: selectedYear, valor: Math.round((pct / 100) * regionalMonthValue * 100) / 100 };
            }).filter(i => i.valor > 0);

            await supabase.from('metas_usuarios').delete().eq('usuario_id', repId).eq('ano', selectedYear);
            if (inserts.length > 0) await supabase.from('metas_usuarios').insert(inserts);
            setSavedReps(prev => new Set(prev).add(repId));
            alert('Metas salvas com sucesso!');
        } catch (e) { console.error(e); } finally { setIsSavingId(null); }
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    const sumRegionalWeights = Number(regionalMonthlyWeights.reduce((a, b) => a + (Number(b) || 0), 0).toFixed(2));

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-32 text-slate-900">
            <header className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100"><LayoutGrid className="w-6 h-6" /></div>
                    <div>
                        <h2 className="text-xl font-black tracking-tight uppercase leading-none">Regional Centro-Norte</h2>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 flex items-center">
                            Ano Base: 
                            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="ml-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-lg border-none font-black outline-none cursor-pointer text-[11px]">
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-2xl shrink-0">
                    <button onClick={() => setActiveTab('team')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Metas por Equipe</button>
                    <button onClick={() => setActiveTab('clients')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'clients' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Metas por Cliente</button>
                </div>

                <div className="flex-1 max-w-sm w-full bg-slate-900 p-5 rounded-3xl text-white flex items-center justify-between border border-white/10 shadow-2xl">
                    <div className="flex-1">
                        <p className="text-[9px] font-black text-blue-400 uppercase mb-2 tracking-[0.3em]">Meta Regional Anual</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-white/20">R$</span>
                            <input type="text" value={displayTarget} onChange={(e) => handleDisplayTargetChange(e.target.value)} className="bg-transparent border-none text-2xl font-black outline-none w-full text-white p-0 focus:ring-0 tabular-nums" placeholder="0,00" />
                        </div>
                    </div>
                </div>
            </header>

            {activeTab === 'team' ? (
                <div className="space-y-6 animate-slideUp">
                    <div className="space-y-3 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between px-2 mb-4">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sazonalidade Regional (Peso Mensal)</h3>
                            </div>
                            <p className={`text-[10px] font-black tabular-nums ${Math.abs(sumRegionalWeights - 100) < 0.05 ? 'text-emerald-500' : 'text-red-400'}`}>Soma: {sumRegionalWeights.toFixed(2)}%</p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {months.map((m, i) => (
                                <MonthlyCard key={i} month={m} weight={regionalMonthlyWeights[i] || 0} totalTarget={managerTotalTarget} onChangeWeight={(v) => handleRegionalWeightChange(i, v)} onChangeValue={(v) => handleRegionalValueChange(i, v)} />
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {reps.map(rep => {
                            const globalShare = repShares[rep.id] || 0;
                            const isExpanded = expandedRepId === rep.id;
                            const monthlyShares = monthlyRepShares[rep.id] || new Array(12).fill(0);
                            const isSynced = savedReps.has(rep.id);
                            return (
                                <div key={rep.id} className={`bg-white rounded-[24px] border transition-all ${isExpanded ? 'border-blue-500 ring-4 ring-blue-50 shadow-xl' : isSynced ? 'border-emerald-100' : 'border-slate-200 shadow-sm'}`}>
                                    <div className="p-4 flex items-center justify-between gap-6">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-colors ${isExpanded ? 'bg-blue-600 text-white' : isSynced ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-300'}`}>{rep.nome.charAt(0)}</div>
                                            <div className="truncate"><h4 className="font-black text-slate-800 uppercase text-xs truncate">{rep.nome}</h4><p className="text-[11px] font-bold text-blue-600 tabular-nums">{formatBRL((globalShare / 100) * managerTotalTarget)}/Ano</p></div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cota Global (%)</p>
                                                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 focus-within:border-blue-300">
                                                    <input type="number" step="0.01" value={globalShare ? Number(globalShare.toFixed(2)) : ''} onChange={(e) => setRepShares(prev => ({ ...prev, [rep.id]: Number(e.target.value) }))} className="w-12 bg-transparent text-sm font-black text-slate-900 outline-none text-center p-0" /><Percent className="w-3.5 h-3.5 text-slate-300" />
                                                </div>
                                            </div>
                                            <button onClick={() => setExpandedRepId(isExpanded ? null : rep.id)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm ${isExpanded ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>SAZONALIDADE <ChevronDown className={`w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 animate-fadeIn space-y-6">
                                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                                                <div className="flex items-center gap-4"><div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Info className="w-4 h-4" /></div><p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed">Defina a participação do representante sobre o <span className="text-blue-600 font-black">Regional</span>.</p></div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setMonthlyRepShares(prev => ({ ...prev, [rep.id]: new Array(12).fill(globalShare) }))} className="flex items-center gap-2 px-6 py-3 bg-white border border-blue-100 text-blue-600 rounded-2xl text-[10px] font-black uppercase hover:bg-blue-50"><ArrowDown className="w-4 h-4" /> Aplicar Share</button>
                                                    <Button size="sm" onClick={() => handleSaveIndividual(rep.id)} isLoading={isSavingId === rep.id} className="rounded-2xl px-8 h-12 font-black text-[10px] uppercase shadow-lg">Salvar</Button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                                {months.map((m, i) => (
                                                    <div key={i} className="p-4 bg-white border border-slate-200 rounded-[24px] shadow-sm">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-3 text-center">{m}</p>
                                                        <div className="space-y-3">
                                                            <div className="flex items-center gap-1 bg-slate-50 rounded-xl px-2 py-1.5 border border-slate-100 focus-within:border-blue-400">
                                                                <input type="number" step="0.01" value={monthlyShares[i] ? Number(monthlyShares[i].toFixed(2)) : ''} onChange={(e) => { const next = [...monthlyShares]; next[i] = Number(e.target.value); setMonthlyRepShares(prev => ({ ...prev, [rep.id]: next })); }} className="w-full bg-transparent text-center text-xs font-black text-slate-900 outline-none" placeholder="0,00" /><span className="text-[10px] font-bold text-slate-300">%</span>
                                                            </div>
                                                            <div className="bg-blue-50/30 rounded-xl py-1.5 px-1 text-center"><p className="text-[9px] font-black text-blue-600 tabular-nums">{formatBRL((monthlyShares[i] / 100) * ((regionalMonthlyWeights[i] / 100) * managerTotalTarget))}</p></div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="space-y-6 animate-slideUp">
                    <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex-1">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3"><Building2 className="w-6 h-6 text-blue-600" /> Engenharia de Carteira</h3>
                            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-2">Distribua a meta mensal do representante entre seus clientes baseada no faturamento histórico do ano anterior.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select value={selectedRepId} onChange={(e) => setSelectedRepId(e.target.value)} className="pl-10 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black uppercase outline-none focus:ring-4 focus:ring-blue-100 min-w-[240px]">
                                    <option value="">Selecione o Representante...</option>
                                    {reps.map(r => <option key={r.id} value={r.id}>{r.nome.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <Button onClick={handleGenerateAll} disabled={!selectedRepId || isGeneratingAll} className="h-12 px-8 rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-blue-500/20">
                                <Zap className="w-4 h-4 mr-2" /> Gerar Todas as Metas da Carteira
                            </Button>
                        </div>
                    </div>

                    {selectedRepId ? (
                        <div className="bg-white rounded-[40px] border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr><th className="px-8 py-6">Cliente / CNPJ</th><th className="px-6 py-6 text-right">Faturado {selectedYear - 1}</th><th className="px-6 py-6 text-center">Peso (%)</th><th className="px-8 py-6 text-right">Ação</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoadingClients ? (
                                        <tr><td colSpan={4} className="px-8 py-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" /></td></tr>
                                    ) : clientEngineeringData.length === 0 ? (
                                        <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-300 font-bold uppercase text-[10px]">Nenhum cliente com histórico de faturamento encontrado.</td></tr>
                                    ) : (
                                        clientEngineeringData.map((client, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-8 py-5"><p className="font-black text-slate-800 uppercase text-xs">{client.nome_fantasia}</p><p className="text-[9px] text-slate-400 font-bold">{client.cnpj}</p></td>
                                                <td className="px-6 py-5 text-right font-bold text-slate-500 text-xs tabular-nums">{formatBRL(client.salesPrev)}</td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col items-center gap-1.5"><span className="text-[11px] font-black text-blue-600">{(client.weight * 100).toFixed(2)}%</span><div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${client.weight * 100}%` }}></div></div></div>
                                                </td>
                                                <td className="px-8 py-5 text-right"><button onClick={() => handleGenerateSingle(client)} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all shadow-sm"><RefreshCw className="w-3.5 h-3.5" /></button></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-[40px] p-24 text-center border-2 border-dashed border-slate-200">
                             <User className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                             <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.3em]">Selecione um representante para iniciar a engenharia</p>
                        </div>
                    )}
                </div>
            )}

            {isGeneratingAll && createPortal(
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-sm rounded-[32px] p-10 shadow-2xl text-center border border-white/20">
                        <div className="w-20 h-20 bg-blue-600 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-blue-500/20">
                            <RefreshCw className="w-12 h-12 text-white animate-spin" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Processando Engenharia</h3>
                        <p className="text-[10px] text-slate-500 mt-2 font-black uppercase tracking-widest">Distribuindo metas por peso histórico...</p>
                        <div className="mt-8 space-y-3">
                            <div className="flex justify-between text-[10px] font-black uppercase text-blue-600 tracking-tighter">
                                <span>Sincronizando Carteira</span>
                                <span>{genProgress}%</span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                                <div className="h-full bg-blue-600 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(37,99,235,0.4)]" style={{ width: `${genProgress}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
