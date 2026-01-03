
import React, { useState, useEffect, useRef } from 'react';
import { Target, Users, Calendar, TrendingUp, ChevronRight, Loader2, Calculator, Percent, Save, CheckCircle2, AlertCircle, BarChart3, ChevronDown, ListTodo, Database, RefreshCw, ArrowRightLeft, Wand2, Building2, Search, Zap, CheckCircle, Cloud, DollarSign, Eye, X, Info, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';

type TabType = 'team' | 'clients';

export const ManagerTargetsScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('team');
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [managerTotalTarget, setManagerTotalTarget] = useState<number>(0);
    const [displayTarget, setDisplayTarget] = useState<string>('0,00');
    const [isLoading, setIsLoading] = useState(false);
    
    const [reps, setReps] = useState<any[]>([]);
    const [repShares, setRepShares] = useState<Record<string, number>>({}); 
    const [monthlyWeights, setMonthlyWeights] = useState<Record<string, number[]>>({}); 
    const [savedReps, setSavedReps] = useState<Set<string>>(new Set());
    const [expandedRepId, setExpandedRepId] = useState<string | null>(null);
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [isSavingId, setIsSavingId] = useState<string | null>(null);

    const [selectedRepId, setSelectedRepId] = useState<string>('');
    const [clientData, setClientData] = useState<any[]>([]);
    const [clientShares, setClientShares] = useState<Record<string, number>>({});
    const [repAnnualHistory, setRepAnnualHistory] = useState({ year1: 0, year2: 0 });
    const [isClientsLoading, setIsClientsLoading] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [previewClient, setPreviewClient] = useState<any | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const availableYears = [2024, 2025, 2026, 2027];

    useEffect(() => {
        fetchInitialData();
    }, [selectedYear]);

    useEffect(() => {
        if (selectedRepId && activeTab === 'clients') {
            fetchClientHistory();
        }
    }, [selectedRepId, selectedYear]);

    // Lógica para capturar importação de Previsão enviada pelo Gestor
    useEffect(() => {
        const importDataRaw = sessionStorage.getItem('pcn_import_engineering');
        if (importDataRaw) {
            const data = JSON.parse(importDataRaw);
            setSelectedRepId(data.repId);
            setActiveTab('clients');
            
            // Note: O carregamento dos valores importados será feito dentro de fetchClientHistory
            // após os dados de faturamento serem carregados para o rep correto.
        }
    }, []);

    useEffect(() => {
        const formatted = new Intl.NumberFormat('pt-BR', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }).format(managerTotalTarget);
        setDisplayTarget(formatted);
    }, [managerTotalTarget]);

    const handleDisplayTargetChange = (val: string) => {
        const cleanValue = val.replace(/\D/g, '');
        const numericValue = parseFloat(cleanValue) / 100 || 0;
        setManagerTotalTarget(numericValue);
    };

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
            setManagerTotalTarget(totalYear);

            repsData?.forEach(rep => {
                const repItems = targetsData?.filter(t => t.usuario_id === rep.id) || [];
                if (repItems.length > 0) syncedReps.add(rep.id);
                
                const repTotal = repItems.reduce((acc, curr) => acc + Number(curr.valor), 0);
                initialShares[rep.id] = totalYear > 0 ? Number(((repTotal / totalYear) * 100).toFixed(2)) : 0;
                
                const weights = new Array(12).fill(0);
                repItems.forEach(t => { 
                    weights[t.mes - 1] = repTotal > 0 ? Number(((Number(t.valor) / repTotal) * 100).toFixed(2)) : 0; 
                });
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
            const { data, error } = await supabase.from('dados_vendas').select('faturamento, cnpj, data').eq('usuario_id', repId).gte('data', start).lte('data', end).range(from, to);
            if (error) throw error;
            if (data && data.length > 0) {
                allSales = [...allSales, ...data];
                if (data.length < 1000) hasMore = false;
                from += 1000;
                to += 1000;
            } else { hasMore = false; }
        }
        return allSales;
    };

    const fetchClientHistory = async () => {
        setIsClientsLoading(true);
        try {
            const year1 = Number(selectedYear) - 1;
            const year2 = Number(selectedYear) - 2;
            const { data: clients } = await supabase.from('clientes').select('id, nome_fantasia, cnpj').eq('usuario_id', selectedRepId).order('nome_fantasia');
            const salesArray = await fetchAllSalesPaged(selectedRepId, `${year2}-01-01`, `${year1}-12-31`);
            const { data: existingClientTargets } = await supabase.from('metas_clientes').select('valor, cliente_id').eq('ano', selectedYear);

            const totalRepYear1 = salesArray.filter(s => new Date(s.data + 'T00:00:00').getFullYear() === year1).reduce((acc: number, curr: any) => acc + (Number(curr.faturamento) || 0), 0);
            const totalRepYear2 = salesArray.filter(s => new Date(s.data + 'T00:00:00').getFullYear() === year2).reduce((acc: number, curr: any) => acc + (Number(curr.faturamento) || 0), 0);
            setRepAnnualHistory({ year1: totalRepYear1, year2: totalRepYear2 });

            const repShareValue = Number(repShares[selectedRepId] || 0);
            const repAnnualForRep = (repShareValue / 100) * managerTotalTarget;

            // Verificar se temos uma importação pendente na sessão
            const importDataRaw = sessionStorage.getItem('pcn_import_engineering');
            let importedMap = new Map<string, number>();
            if (importDataRaw) {
                const data = JSON.parse(importDataRaw);
                if (data.repId === selectedRepId) {
                    data.clients.forEach((c: any) => importedMap.set(c.id, c.value));
                    sessionStorage.removeItem('pcn_import_engineering'); // Limpa após usar
                }
            }

            const clientStats = (clients || []).map(c => {
                const cleanCnpj = c.cnpj.replace(/\D/g, '');
                const salesValueYear1 = salesArray.filter(s => s.cnpj.replace(/\D/g, '') === cleanCnpj && new Date(s.data + 'T00:00:00').getFullYear() === year1).reduce((acc: number, curr: any) => acc + (Number(curr.faturamento) || 0), 0);
                const salesValueYear2 = salesArray.filter(s => s.cnpj.replace(/\D/g, '') === cleanCnpj && new Date(s.data + 'T00:00:00').getFullYear() === year2).reduce((acc: number, curr: any) => acc + (Number(curr.faturamento) || 0), 0);
                
                // Prioridade: 1. Valor importado agora, 2. Valor já salvo no banco
                const savedTotal = importedMap.has(c.id) ? importedMap.get(c.id)! : ((existingClientTargets || []) as any[]).filter(t => t.cliente_id === c.id).reduce((acc: number, curr: any) => acc + (Number(curr.valor) || 0), 0);
                
                return {
                    ...c,
                    valYear1: salesValueYear1,
                    valYear2: salesValueYear2,
                    shareYear1: totalRepYear1 > 0 ? (salesValueYear1 / totalRepYear1) * 100 : 0,
                    shareYear2: totalRepYear2 > 0 ? (salesValueYear2 / totalRepYear2) * 100 : 0,
                    currentShare: repAnnualForRep > 0 ? (savedTotal / repAnnualForRep) * 100 : 0,
                    isConfigured: savedTotal > 0
                };
            });

            setClientData(clientStats);
            const initialClientShares: Record<string, number> = {};
            clientStats.forEach(c => { initialClientShares[c.id] = Number(c.currentShare.toFixed(2)); });
            setClientShares(initialClientShares);
            
            if (importedMap.size > 0) alert('Previsão do representante carregada com sucesso! Revise e sincronize.');

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
        const totalShare = (Object.values(clientShares) as number[]).reduce((a, b) => a + (b || 0), 0);
        if (totalShare < 99.9) {
            alert(`A alocação deve ser no mínimo 100.00%. Atualmente: ${totalShare.toFixed(2)}%`);
            return;
        }

        setIsSavingId('clients-all');
        try {
            const repShareValue = Number(repShares[selectedRepId] || 0);
            const repAnnualValue = (repShareValue / 100) * managerTotalTarget;
            const repWeights = monthlyWeights[selectedRepId] || new Array(12).fill(0);
            
            const inserts: any[] = [];
            clientData.forEach(client => {
                const share = Number(clientShares[client.id] || 0);
                const clientAnnualTotal = (share / 100) * repAnnualValue;
                
                repWeights.forEach((weight, idx) => {
                    const monthVal = (Number(weight) / 100) * clientAnnualTotal;
                    inserts.push({
                        cliente_id: client.id,
                        mes: idx + 1,
                        ano: selectedYear,
                        valor: Math.round(monthVal * 100) / 100
                    });
                });
            });

            const clientIds = clientData.map(c => c.id);
            await supabase.from('metas_clientes').delete().in('cliente_id', clientIds).eq('ano', selectedYear);
            
            if (inserts.length > 0) {
                const { error } = await supabase.from('metas_clientes').insert(inserts);
                if (error) throw error;
            }
            await fetchClientHistory();
            alert(`Engenharia de Carteira sincronizada com sucesso!`);
        } catch (e) { console.error(e); alert('Erro ao salvar.'); }
        finally { setIsSavingId(null); }
    };

    const handleSaveIndividual = async (repId: string) => {
        const share = Number(repShares[repId] || 0);
        const weights = monthlyWeights[repId] || new Array(12).fill(0);
        const sumWeights = weights.reduce((a, b) => a + (b || 0), 0);
        if (share === 0) { alert('Defina um Share para o representante.'); return; }
        if (Math.abs(sumWeights - 100) > 0.01) { alert(`A soma dos meses deve ser exatamente 100% (Atual: ${sumWeights.toFixed(2)}%)`); return; }
        
        setIsSavingId(repId);
        try {
            const repAnnualValue = (share / 100) * managerTotalTarget;
            const inserts = weights.map((pct, idx) => ({ 
                usuario_id: repId, 
                mes: idx + 1, 
                ano: selectedYear, 
                valor: Math.round((Number(pct) / 100) * repAnnualValue * 100) / 100 
            })).filter(i => i.valor > 0);
            await supabase.from('metas_usuarios').delete().eq('usuario_id', repId).eq('ano', selectedYear);
            if (inserts.length > 0) await supabase.from('metas_usuarios').insert(inserts);
            
            setSavedReps(prev => new Set(prev).add(repId));
            alert('Sazonalidade do representante atualizada!');
        } catch (e) { console.error(e); } finally { setIsSavingId(null); }
    };

    const handleSaveAll = async () => {
        const totalShare = (Object.values(repShares) as number[]).reduce((acc: number, curr: number) => acc + (curr || 0), 0);
        if (totalShare < 99.9) { alert('A soma dos shares da equipe deve ser no mínimo 100.00%'); return; }
        for (const rep of reps) {
            const share = Number(repShares[rep.id] || 0);
            if (share > 0) {
                const weights = monthlyWeights[rep.id] || new Array(12).fill(0);
                const sumW = weights.reduce((a, b) => a + (b || 0), 0);
                if (Math.abs(sumW - 100) > 0.05) {
                    alert(`O representante ${rep.nome} está com a soma mensal em ${sumW.toFixed(2)}%. Ajuste para 100% antes de sincronizar.`);
                    return;
                }
            }
        }
        setIsSavingAll(true);
        try {
            const allInserts: any[] = [];
            for (const rep of reps) {
                const share = Number(repShares[rep.id] || 0);
                const weights = monthlyWeights[rep.id] || new Array(12).fill(0);
                const repAnnualValue = (share / 100) * managerTotalTarget;
                weights.forEach((pct, idx) => {
                    const val = Math.round((Number(pct) / 100) * repAnnualValue * 100) / 100;
                    if (val > 0) allInserts.push({ usuario_id: rep.id, mes: idx + 1, ano: selectedYear, valor: val });
                });
            }
            const repIds = reps.map(r => r.id);
            await supabase.from('metas_usuarios').delete().in('usuario_id', repIds).eq('ano', selectedYear);
            if (allInserts.length > 0) await supabase.from('metas_usuarios').insert(allInserts);
            setSavedReps(new Set(reps.map(r => r.id)));
            alert('Equipe Completa Sincronizada!');
        } catch (error: any) { console.error(error); } finally { setIsSavingAll(false); }
    };

    const handleDownloadPreview = async () => {
        if (!previewRef.current) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(previewRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                   const header = clonedDoc.getElementById('preview-header-export');
                   if (header) header.style.display = 'block';
                   const el = clonedDoc.getElementById('preview-export-container');
                   if (el) {
                       el.style.padding = '40px';
                       el.style.borderRadius = '0';
                   }
                }
            });
            const link = document.createElement('a');
            link.download = `Sazonalidade_${previewClient.nome_fantasia.replace(/\s/g, '_')}_${selectedYear}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
        } catch (e) {
            console.error('Erro ao exportar PNG:', e);
        } finally {
            setIsExporting(false);
        }
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    const totalRepShare: number = (Object.values(repShares) as number[]).reduce((a: number, b: number) => (a || 0) + (b || 0), 0);
    const totalClientShare: number = (Object.values(clientShares) as number[]).reduce((a: number, b: number) => (a || 0) + (b || 0), 0);

    const pendingClients = clientData.filter(c => c.nome_fantasia.toLowerCase().includes(clientSearch.toLowerCase())).sort((a,b) => b.valYear1 - a.valYear1);

    return (
        <div className="w-full max-w-6xl mx-auto space-y-4 animate-fadeIn pb-32 text-slate-900">
            <div className="flex justify-center mb-6">
                <div className="bg-white p-1.5 rounded-3xl border border-slate-200 shadow-sm flex gap-1">
                    <button onClick={() => setActiveTab('team')} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'team' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                        Engenharia de Equipe
                    </button>
                    <button onClick={() => setActiveTab('clients')} className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'clients' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>
                        Engenharia de Carteira
                    </button>
                </div>
            </div>

            {activeTab === 'team' ? (
                <>
                    <header className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100"><BarChart3 className="w-6 h-6" /></div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight uppercase leading-none">Equipe Regional</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2 flex items-center">
                                    Ano Base: 
                                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="ml-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-lg border-none font-black outline-none cursor-pointer text-[11px]">
                                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </p>
                            </div>
                        </div>
                        <div className="flex-1 max-w-lg w-full bg-slate-900 p-5 rounded-3xl text-white flex items-center justify-between border border-white/10 shadow-2xl">
                            <div className="flex-1">
                                <p className="text-[9px] font-black text-blue-400 uppercase mb-2 tracking-[0.3em]">Meta Total Anual Planejada</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-black text-white/20">R$</span>
                                    <input type="text" value={displayTarget} onChange={(e) => handleDisplayTargetChange(e.target.value)} className="bg-transparent border-none text-3xl font-black outline-none w-full text-white p-0 focus:ring-0 tabular-nums" placeholder="0,00" />
                                </div>
                            </div>
                            <div className="text-right pl-6 border-l border-white/10 ml-4">
                                <p className="text-[9px] font-black text-slate-500 uppercase mb-1 tracking-widest">Alocação</p>
                                <p className={`text-xl font-black tabular-nums ${totalRepShare >= 99.9 ? 'text-emerald-400' : 'text-red-400'}`}>{totalRepShare.toFixed(2)}%</p>
                            </div>
                        </div>
                    </header>

                    <div className="space-y-3">
                        {reps.map(rep => {
                            const share = Number(repShares[rep.id] || 0);
                            const repAnnual = (share / 100) * managerTotalTarget;
                            const isExpanded = expandedRepId === rep.id;
                            const currentWeights = monthlyWeights[rep.id] || new Array(12).fill(0);
                            const isSynced = savedReps.has(rep.id);
                            const sumWeights = currentWeights.reduce((a, b) => a + (b || 0), 0);
                            return (
                                <div key={rep.id} className={`bg-white rounded-[24px] border transition-all ${isExpanded ? 'border-blue-500 ring-4 ring-blue-50 shadow-xl' : isSynced ? 'border-emerald-100' : 'border-slate-200 shadow-sm'}`}>
                                    <div className="p-4 flex items-center justify-between gap-6">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-inner transition-colors ${isExpanded ? 'bg-blue-600 text-white' : isSynced ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-300'}`}>
                                                {rep.nome.charAt(0)}
                                            </div>
                                            <div className="truncate">
                                                <h4 className="font-black text-slate-800 uppercase text-xs truncate tracking-tight">{rep.nome}</h4>
                                                <p className="text-[11px] font-bold text-blue-600 tabular-nums mt-0.5">{formatBRL(repAnnual)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cota Individual (%)</p>
                                                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 focus-within:border-blue-300 transition-all">
                                                    <input type="number" step="0.01" value={share || ''} onChange={(e) => setRepShares(prev => ({ ...prev, [rep.id]: Number(e.target.value) }))} className="w-12 bg-transparent text-sm font-black text-slate-900 outline-none text-center p-0" placeholder="0" />
                                                    <Percent className="w-3.5 h-3.5 text-slate-300" />
                                                </div>
                                            </div>
                                            <button onClick={() => setExpandedRepId(isExpanded ? null : rep.id)} className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-sm ${isExpanded ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
                                                SAZONALIDADE <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 animate-fadeIn">
                                            <div className="flex justify-between items-center mb-6">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Distribuição de Peso Mensal</p>
                                                    <p className={`text-[10px] font-black mt-1 uppercase ${Math.abs(sumWeights - 100) < 0.1 ? 'text-emerald-600' : 'text-red-500'}`}>Soma Atual: {sumWeights.toFixed(2)}% (Deve ser 100%)</p>
                                                </div>
                                                <Button size="sm" onClick={() => handleSaveIndividual(rep.id)} disabled={Math.abs(sumWeights - 100) > 0.1 || isSavingId === rep.id} isLoading={isSavingId === rep.id} className="rounded-2xl px-6 py-3 font-black text-[10px] tracking-widest shadow-lg">
                                                    {isSynced ? 'ATUALIZAR' : 'CONFIRMAR'}
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                                {months.map((m, i) => (
                                                    <div key={i} className="p-3 bg-white border border-slate-200 rounded-[20px] shadow-sm hover:border-blue-200 transition-all">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2 text-center tracking-widest">{m}</p>
                                                        <div className="flex items-center justify-center gap-1 mb-2">
                                                            <input type="number" step="0.01" value={currentWeights[i] || ''} onChange={(e) => { const newW = [...currentWeights]; newW[i] = Number(e.target.value); setMonthlyWeights(prev => ({ ...prev, [rep.id]: newW })); }} className="w-full bg-slate-50 rounded-lg py-1 px-2 text-center text-xs font-black text-slate-900 outline-none" placeholder="0" />
                                                            <span className="text-[10px] font-bold text-slate-300">%</span>
                                                        </div>
                                                        <p className="text-[9px] font-black text-blue-600 text-center truncate">{formatBRL((Number(currentWeights[i]) / 100) * repAnnual)}</p>
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
                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-8 justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100"><Building2 className="w-6 h-6" /></div>
                                <div>
                                    <h2 className="text-xl font-black tracking-tight uppercase leading-none">Carteira Estratégica</h2>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Ano Meta: 
                                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="ml-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-lg border-none font-black outline-none cursor-pointer">
                                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </p>
                                </div>
                            </div>
                            <div className="flex-1 max-sm">
                                <select value={selectedRepId} onChange={(e) => setSelectedRepId(e.target.value)} className="w-full bg-slate-900 text-white border-none rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-[0.2em] outline-none focus:ring-4 focus:ring-blue-100 shadow-2xl">
                                    <option value="">SELECIONE O REPRESENTANTE...</option>
                                    {reps.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                                </select>
                            </div>
                        </div>
                    </header>

                    {selectedRepId && (
                        <div className="bg-white p-5 rounded-[24px] border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" placeholder="Pesquisar cliente na carteira..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-12 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100"/>
                            </div>
                            <button onClick={handleApplyAverage} className="w-full md:w-auto bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 border border-blue-100">
                                <Wand2 className="w-4 h-4" /> Sugerir Automático
                            </button>
                        </div>
                    )}

                    {!selectedRepId ? (
                        <div className="p-32 text-center bg-white rounded-[40px] border-2 border-slate-100 border-dashed animate-pulse">
                            <Users className="w-16 h-16 text-slate-100 mx-auto mb-6" />
                            <p className="text-slate-300 font-black uppercase text-xs tracking-[0.4em]">Selecione um representante para mapear carteira</p>
                        </div>
                    ) : isClientsLoading ? (
                        <div className="p-32 text-center">
                            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
                            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Analisando volumes financeiros históricos...</p>
                        </div>
                    ) : (
                        <div className="space-y-8 pb-32">
                            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden border-b-0">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">
                                        <tr>
                                            <th className="px-8 py-5">Cliente / Entidade</th>
                                            <th className="px-6 py-5 text-right">Faturado {Number(selectedYear) - 2}</th>
                                            <th className="px-6 py-5 text-right">Faturado {Number(selectedYear) - 1}</th>
                                            <th className="px-8 py-5 text-center bg-blue-50/50 text-blue-600">Alocação Meta (%)</th>
                                            <th className="px-8 py-5 text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {pendingClients.map(c => {
                                            const share = Number(clientShares[c.id] || 0);
                                            const repShareVal = Number(repShares[selectedRepId] || 0);
                                            const repAnnual = (repShareVal / 100) * managerTotalTarget;
                                            const projected = (share / 100) * repAnnual;

                                            return (
                                                <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                                    <td className="px-8 py-5">
                                                        <p className="font-black text-slate-800 uppercase text-xs tracking-tight group-hover:text-blue-600 transition-colors">{c.nome_fantasia}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{c.cnpj}</p>
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-bold text-slate-400 tabular-nums text-xs">{formatBRL(c.valYear2)}</td>
                                                    <td className="px-6 py-5 text-right font-bold text-slate-400 tabular-nums text-xs">{formatBRL(c.valYear1)}</td>
                                                    <td className="px-8 py-5 text-center bg-blue-50/30">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <input type="number" step="0.01" value={share || ''} onChange={e => setClientShares(prev => ({ ...prev, [c.id]: Number(e.target.value) }))} className="w-16 bg-white border border-blue-200 rounded-xl px-2 py-1.5 text-center font-black text-blue-600 outline-none focus:ring-4 focus:ring-blue-100 shadow-sm" />
                                                            <span className="text-[10px] font-black text-blue-300">%</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-right">
                                                        <div className="flex items-center justify-end gap-3">
                                                            <div className="text-right mr-2">
                                                                <p className="text-[10px] font-black text-slate-900 tabular-nums">{formatBRL(projected)}</p>
                                                            </div>
                                                            <button onClick={() => setPreviewClient(c)} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm group/btn"><Eye className="w-4 h-4" /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {previewClient && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
                    <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{previewClient.nome_fantasia}</h3>
                                <p className="text-[9px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1">Sazonalidade Mensal Simulada</p>
                            </div>
                            <button onClick={() => setPreviewClient(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto bg-white" ref={previewRef} id="preview-export-container">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {months.map((m, i) => {
                                    const repWeight = Number(monthlyWeights[selectedRepId]?.[i] || 0);
                                    const repShareVal = Number(repShares[selectedRepId] || 0);
                                    const repAnnualForThisRep = (repShareVal / 100) * managerTotalTarget;
                                    const clientShareVal = Number(clientShares[previewClient.id] || 0);
                                    const clientAnnual = (clientShareVal / 100) * repAnnualForThisRep;
                                    const monthTargetValue = (repWeight / 100) * clientAnnual;

                                    return (
                                        <div key={i} className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-200 transition-all group">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase">{m}</span>
                                                <span className="text-[8px] font-black text-blue-500 bg-blue-50 px-1.5 rounded">{repWeight.toFixed(1)}%</span>
                                            </div>
                                            <p className="text-xs font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                                                {formatBRL(monthTargetValue)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <Button onClick={() => setPreviewClient(null)} variant="outline" className="rounded-xl px-8 h-10 font-black text-[10px] uppercase">Fechar</Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-[100]">
                <div className="bg-slate-900/95 backdrop-blur-2xl p-5 rounded-[32px] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center justify-between gap-6">
                    <div className="text-white">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Alocação Total {selectedYear}</p>
                        <p className={`text-md font-black tabular-nums ${ (activeTab === 'team' ? totalRepShare : totalClientShare) >= 99.9 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {(activeTab === 'team' ? totalRepShare : totalClientShare).toFixed(2)}% de Alocação
                        </p>
                    </div>
                    {activeTab === 'team' ? (
                        <Button onClick={handleSaveAll} disabled={totalRepShare < 99.9 || isSavingAll} isLoading={isSavingAll} className="rounded-[20px] px-10 h-14 font-black uppercase text-[11px] tracking-[0.2em] bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-900/40">Sincronizar Meta Equipe</Button>
                    ) : (
                        <Button onClick={handleSaveClientTargets} disabled={!selectedRepId || totalClientShare < 99.9 || isSavingId === 'clients-all'} isLoading={isSavingId === 'clients-all'} className="rounded-[20px] px-10 h-14 font-black uppercase text-[11px] tracking-[0.2em] bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-900/40">Sincronizar Carteira</Button>
                    )}
                </div>
            </div>
        </div>
    );
};
