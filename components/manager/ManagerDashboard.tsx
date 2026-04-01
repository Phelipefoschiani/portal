import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Target, TrendingUp, Users, Wallet, Calendar, Loader2, DollarSign, X, ChevronDown, CheckSquare, Square, Filter, Download, User, CalendarDays } from 'lucide-react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { totalDataStore } from '../../lib/dataStore';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';
import { RepPerformanceModal } from './RepPerformanceModal';

type KpiDetailType = 'meta' | 'faturado' | 'positivacao' | 'verba' | null;

interface TeamDetail {
    id: string;
    nome: string;
    role: string;
    meta: number;
    annualMeta: number;
    faturado: number;
    verbaAnnualUsed: number;
    positivacao: number;
    totalClientes: number;
}

// --- NOVO SUB-MODAL: DETALHAMENTO DE POSITIVAÇÃO POR CLIENTE (DRILL-DOWN) ---
const RepPositDetailModal: React.FC<{
    rep: TeamDetail;
    selectedYear: number;
    selectedMonths: number[];
    onClose: () => void;
}> = ({ rep, selectedYear, selectedMonths, onClose }) => {
    const clientData = useMemo(() => {
        const sales = totalDataStore.sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            const m = d.getUTCMonth() + 1;
            const y = d.getUTCFullYear();
            return s.usuario_id === rep.id && selectedMonths.includes(m) && y === selectedYear;
        });

        const portfolio = totalDataStore.clients.filter(c => c.usuario_id === rep.id);
        
        // Carteira base
        const basePortfolio = portfolio.filter(c => {
            if (!c.lastPurchaseDate) {
                return sales.some(s => s.cliente_id === c.id && new Date(s.data + 'T00:00:00').getUTCFullYear() === selectedYear - 1);
            }
            return new Date(c.lastPurchaseDate + 'T00:00:00').getUTCFullYear() === selectedYear - 1;
        });

        const activeCnpjsInPeriod = new Set(sales.map(s => String(s.cnpj || '').replace(/\D/g, '')));
        
        return basePortfolio.map(c => ({
            nome: c.nome_fantasia,
            cnpj: c.cnpj,
            positivado: activeCnpjsInPeriod.has(String(c.cnpj || '').replace(/\D/g, ''))
        })).sort((a, b) => (a.positivado === b.positivado ? 0 : a.positivado ? -1 : 1));
    }, [rep.id, selectedYear, selectedMonths]);

    return createPortal(
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/20">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Positivação: {rep.nome}</h3>
                            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mt-1">Clientes da Carteira Base</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                            <tr>
                                <th className="px-8 py-5">Cliente</th>
                                <th className="px-8 py-5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {clientData.map((c, i) => (
                                <tr key={i}>
                                    <td className="px-8 py-5 text-[11px] font-bold text-slate-700">{c.nome}</td>
                                    <td className="px-8 py-5 text-center">
                                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg ${c.positivado ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                            {c.positivado ? 'Positivado' : 'Não Positivado'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <Button onClick={onClose} className="rounded-2xl px-10 font-black text-[10px] uppercase">Fechar Detalhe</Button>
                </div>
            </div>
        </div>,
        document.body
    );
};

// --- KPI DETAIL MODAL ---
const KpiDetailModal: React.FC<{ 
    type: KpiDetailType; 
    details: TeamDetail[]; 
    onClose: () => void; 
    formatBRL: (v: number) => string;
    periodLabel: string;
    selectedYear: number;
}> = ({ type, details, onClose, formatBRL, periodLabel, selectedYear }) => {
    const [selectedRepForVerba, setSelectedRepForVerba] = useState<TeamDetail | null>(null);
    const [selectedRepForPosit, setSelectedRepForPosit] = useState<TeamDetail | null>(null);

    const titles = {
        meta: `RELATÓRIO ESTRATÉGICO DE METAS`,
        faturado: 'RELATÓRIO DE FATURAMENTO REALIZADO',
        positivacao: 'RELATÓRIO DE POSITIVAÇÃO DE CARTEIRA',
        verba: 'RELATÓRIO DE UTILIZAÇÃO DE VERBAS (TETO ANUAL 5%)'
    };

    const sortedDetails = [...details].sort((a, b) => {
        if (type === 'meta') return b.meta - a.meta;
        if (type === 'faturado') return b.faturado - a.faturado;
        if (type === 'verba') return b.verbaAnnualUsed - a.verbaAnnualUsed;
        if (type === 'positivacao') return b.positivacao - a.positivacao;
        return 0;
    });

    return (
        <>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white w-full max-w-7xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[95vh]">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="min-w-0">
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{type ? titles[type] : ''}</h3>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Portal Centro-Norte • {periodLabel}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-10 bg-white custom-scrollbar">
                        <div className="bg-white border border-slate-100 rounded-[32px] overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    {type === 'verba' ? (
                                        <tr>
                                            <th className="px-6 py-4">Representante</th>
                                            <th className="px-6 py-4 text-right">Investimento Total (5% Meta Anual)</th>
                                            <th className="px-6 py-4 text-right">Investimento Usado</th>
                                            <th className="px-6 py-4 text-right">Investimento Restante</th>
                                            <th className="px-6 py-4 text-center">% Utilizado</th>
                                        </tr>
                                    ) : type === 'positivacao' ? (
                                        <tr>
                                            <th className="px-6 py-4">#</th>
                                            <th className="px-6 py-4">Representante</th>
                                            <th className="px-6 py-4 text-center">Positivados</th>
                                            <th className="px-6 py-4 text-center">Total Carteira</th>
                                            <th className="px-6 py-4 text-center">% Positivação</th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <th className="px-6 py-4">#</th>
                                            <th className="px-6 py-4">Representante</th>
                                            <th className="px-6 py-4 text-right">Planejado</th>
                                            <th className="px-6 py-4 text-right">Realizado</th>
                                            <th className="px-6 py-4 text-center">Eficiência</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-bold">
                                    {sortedDetails.map((rep, idx) => {
                                        const achievement = rep.meta > 0 ? (rep.faturado / rep.meta) * 100 : 0;
                                        
                                        // Lógica da Verba Anual (5% da Meta de Janeiro a Dezembro)
                                        const budgetTotal = (rep.annualMeta || 0) * 0.05;
                                        const budgetUsed = rep.verbaAnnualUsed || 0;
                                        const budgetRemaining = budgetTotal - budgetUsed;
                                        const budgetPct = budgetTotal > 0 ? (budgetUsed / budgetTotal) * 100 : 0;
                                        const positPct = rep.totalClientes > 0 ? (rep.positivacao / rep.totalClientes) * 100 : 0;

                                        return (
                                            <tr 
                                                key={rep.id} 
                                                className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                                onClick={() => {
                                                    if (type === 'verba') setSelectedRepForVerba(rep);
                                                    if (type === 'positivacao') setSelectedRepForPosit(rep);
                                                }}
                                            >
                                                {type === 'verba' ? (
                                                    <>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center font-black text-amber-600 uppercase text-xs border border-amber-100 group-hover:bg-amber-600 group-hover:text-white transition-all">
                                                                    {rep.nome.charAt(0)}
                                                                </div>
                                                                <span className="font-black text-slate-700 uppercase text-[11px] tracking-tight">{rep.nome}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-400 text-xs tabular-nums">{formatBRL(budgetTotal)}</td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{formatBRL(budgetUsed)}</td>
                                                        <td className="px-6 py-4 text-right font-black text-xs tabular-nums">
                                                            <span className={budgetRemaining >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                                {formatBRL(budgetRemaining)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${budgetPct <= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                                    {budgetPct.toFixed(1)}%
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </>
                                                ) : type === 'positivacao' ? (
                                                    <>
                                                        <td className="px-6 py-4 text-[10px] font-black text-slate-300">{idx + 1}</td>
                                                        <td className="px-6 py-4 font-black text-slate-700 uppercase text-[11px]">{rep.nome}</td>
                                                        <td className="px-6 py-4 text-center font-black text-slate-900 text-xs tabular-nums">{rep.positivacao}</td>
                                                        <td className="px-6 py-4 text-center font-black text-slate-900 text-xs tabular-nums">{rep.totalClientes}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${positPct >= 50 ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                                {positPct.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-6 py-4 text-[10px] font-black text-slate-300">{idx + 1}</td>
                                                        <td className="px-6 py-4 font-black text-slate-700 uppercase text-[11px]">{rep.nome}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-slate-400 text-xs tabular-nums">{formatBRL(rep.meta)}</td>
                                                        <td className="px-6 py-4 text-right font-black text-slate-900 text-xs tabular-nums">{formatBRL(rep.faturado)}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${achievement >= 100 ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                                {achievement.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button onClick={onClose} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl">Fechar Relatório</button>
                    </div>
                </div>
            </div>

            {selectedRepForVerba && (
                <RepVerbaDetailModal 
                    rep={selectedRepForVerba}
                    selectedYear={selectedYear}
                    onClose={() => setSelectedRepForVerba(null)}
                    formatBRL={formatBRL}
                />
            )}
            
            {selectedRepForPosit && (
                <RepPositDetailModal 
                    rep={selectedRepForPosit} 
                    selectedYear={selectedYear} 
                    selectedMonths={selectedMonths} 
                    onClose={() => setSelectedRepForPosit(null)} 
                />
            )}
        </>
    );
};

export const ManagerDashboard: React.FC = () => {
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [activeKpiDetail, setActiveKpiDetail] = useState<KpiDetailType>(null);
    const [teamDetails, setTeamDetails] = useState<TeamDetail[]>([]);
    const [selectedRepId, setSelectedRepId] = useState<string>('all');
    const [selectedRepForPerformance, setSelectedRepForPerformance] = useState<TeamDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const session = JSON.parse(sessionStorage.getItem('pcn_session') || '{}');
    const userId = session.id;
    const userRole = session.role;
    
    // --- ESTADO ADICIONADO PARA DOWNLOAD DO RANKING ---
    const rankingRef = useRef<HTMLDivElement>(null);
    const [isExportingRanking, setIsExportingRanking] = useState(false);
    // ---------------------------------------------------

    const dropdownRef = useRef<HTMLDivElement>(null);

    const processConsolidatedData = useCallback(() => {
        const reps = totalDataStore.users.filter(u => {
            const role = u.nivel_acesso?.toLowerCase() || u.role?.toLowerCase() || '';
            return role !== 'diretor' && role !== 'gerente' && role !== 'admin';
        });
        const sales = totalDataStore.sales;
        const targets = totalDataStore.targets;
        const invs = totalDataStore.investments;
        const portfolio = totalDataStore.clients;

        const details = reps.map(rep => {
            const repMeta = targets.filter(t => t.usuario_id === rep.id && selectedMonths.includes(t.mes) && Number(t.ano) === selectedYear).reduce((a, b) => a + Number(b.valor), 0);
            const annualMeta = targets.filter(t => t.usuario_id === rep.id && Number(t.ano) === selectedYear).reduce((a, b) => a + Number(b.valor), 0);
            
            const repSalesList = sales.filter(s => {
                const d = new Date(s.data + 'T00:00:00');
                const m = d.getUTCMonth() + 1;
                const y = d.getUTCFullYear();
                return s.usuario_id === rep.id && selectedMonths.includes(m) && y === selectedYear;
            });

            const repSales = repSalesList.reduce((a, b) => a + Number(b.faturamento), 0);
            
            const verbaAnnualUsed = invs.filter(inv => {
                const d = new Date(inv.data + 'T00:00:00');
                return inv.usuario_id === rep.id && d.getUTCFullYear() === selectedYear && inv.status === 'approved';
            }).reduce((a, b) => a + Number(b.valor_total_investimento), 0);

            const repClients = portfolio.filter(c => {
                if (c.usuario_id !== rep.id) return false;
                
                // Regra de Carteira:
                // Carteira base = todos os clientes que compraram no ano anterior ao selecionado
                // Se não tem lastPurchaseDate, tentamos verificar nas vendas do ano anterior
                if (!c.lastPurchaseDate) {
                    const boughtLastYear = sales.some(s => s.cliente_id === c.id && new Date(s.data + 'T00:00:00').getUTCFullYear() === selectedYear - 1);
                    return boughtLastYear;
                }

                const lastPurchaseDate = new Date(c.lastPurchaseDate + 'T00:00:00');
                const lastPurchaseYear = lastPurchaseDate.getUTCFullYear();
                
                // Carteira base é composta por clientes que compraram no ano anterior
                return lastPurchaseYear === selectedYear - 1;
            });
            
            // Para calcular a positivação, precisamos comparar os CNPJs da carteira base com os CNPJs que compraram no período do filtro
            const basePortfolioCnpjs = new Set(repClients.map(c => String(c.cnpj || '').replace(/\D/g, '')));
            
            // repSalesList já contém as vendas do período filtrado para este representante
            const activeCnpjsInPeriod = new Set(repSalesList.map(s => String(s.cnpj || '').replace(/\D/g, '')));
            
            // Positivação: quantos clientes da carteira base compraram no período filtrado
            const repPosit = Array.from(basePortfolioCnpjs).filter(cnpj => activeCnpjsInPeriod.has(cnpj)).length;

            return { id: rep.id, nome: rep.nome, role: rep.role || '', meta: repMeta, annualMeta, faturado: repSales, verbaAnnualUsed, positivacao: repPosit, totalClientes: repClients.length };
        });

        setTeamDetails(details);
    }, [selectedMonths, selectedYear]);

    const [dataUpdateToken, setDataUpdateToken] = useState(0);

    useEffect(() => {
        const loadAllData = async () => {
            setIsLoading(true);
            try {
                totalDataStore.userId = userId;
                totalDataStore.userRole = userRole;

                // Busca dados da nova VIEW
                await supabase
                    .from('view_gerente_visao_geral')
                    .select('*')
                    .eq('ano', selectedYear);
                
                const { fetchClients, fetchSalesForMonths, fetchUsers, fetchTargets, fetchInvestments } = await import('../../lib/dataService');
                
                await Promise.all([
                    fetchUsers(),
                    fetchClients(),
                    fetchSalesForMonths(selectedYear, selectedMonths),
                    fetchTargets(selectedYear),
                    fetchInvestments(selectedYear)
                ]);

                setDataUpdateToken(prev => prev + 1);
            } catch (e) {
                console.error('Error fetching manager data:', e);
            } finally {
                setIsLoading(false);
            }
        };
        loadAllData();
    }, [selectedYear, selectedMonths, userId, userRole]);

    useEffect(() => {
        const handleUpdate = () => {
            setDataUpdateToken(prev => prev + 1);
        };
        window.addEventListener('pcn_data_update', handleUpdate);
        return () => window.removeEventListener('pcn_data_update', handleUpdate);
    }, []);

    useEffect(() => { 
        processConsolidatedData(); 
    }, [processConsolidatedData, dataUpdateToken]);

    const displayData = useMemo(() => {
        if (selectedRepId === 'all') {
            return teamDetails.reduce((acc, curr) => ({
                totalMeta: acc.totalMeta + curr.meta,
                totalFaturado: acc.totalFaturado + curr.faturado,
                totalClientes: acc.totalClientes + curr.totalClientes,
                clientesPositivados: acc.clientesPositivados + curr.positivacao,
                investimentoAno: acc.investimentoAno + curr.verbaAnnualUsed
            }), { totalMeta: 0, totalFaturado: 0, totalClientes: 0, clientesPositivados: 0, investimentoAno: 0 });
        } else {
            const rep = teamDetails.find(r => r.id === selectedRepId);
            if (!rep) return { totalMeta: 0, totalFaturado: 0, totalClientes: 0, clientesPositivados: 0, investimentoAno: 0 };
            return {
                totalMeta: rep.meta,
                totalFaturado: rep.faturado,
                totalClientes: rep.totalClientes,
                clientesPositivados: rep.positivacao,
                investimentoAno: rep.verbaAnnualUsed
            };
        }
    }, [teamDetails, selectedRepId]);

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    
    const pctMeta = displayData.totalMeta > 0 ? (displayData.totalFaturado / displayData.totalMeta) * 100 : 0;
    const diff = displayData.totalFaturado - displayData.totalMeta;

    const toggleTempMonth = (m: number) => {
        setTempSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    };

    const handleApplyFilter = () => {
        setSelectedMonths([...tempSelectedMonths]);
        setShowMonthDropdown(false);
    };

    const getMonthsLabel = () => {
        if (selectedMonths.length === 0) return "Nenhum Selecionado";
        if (selectedMonths.length === 12) return "ANO COMPLETO";
        const monthNamesArr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        if (selectedMonths.length === 1) return monthNamesArr[selectedMonths[0] - 1].toUpperCase();
        return `${selectedMonths.length} MESES SELECIONADOS`;
    };

    const monthNamesArr = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // --- FUNÇÃO DE DOWNLOAD DO RANKING ---
    const handleDownloadRanking = async () => {
        if (!rankingRef.current) return;
        setIsExportingRanking(true);
        try {
            await new Promise(r => setTimeout(r, 200));
            const canvas = await html2canvas(rankingRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });
            const link = document.createElement('a');
            link.download = `Ranking_Eficiencia_${selectedYear}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error('Download error:', e);
        } finally {
            setIsExportingRanking(false);
        }
    };

    if (isLoading) {
        return (
            <div className="w-full h-[60vh] flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-black animate-pulse uppercase text-[10px] tracking-widest">Consolidando dados da regional...</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-12">
            <header className="flex flex-col lg:flex-row justify-between items-end gap-6 px-4">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="min-w-[200px]">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Análise Regional</h2>
                        <p className="text-[10px] font-black text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-widest text-left truncate max-w-[250px]">
                            <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" /> 
                            {getMonthsLabel()} de {selectedYear}
                        </p>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 lg:flex-none">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <User className="w-3.5 h-3.5" />
                        </div>
                        <select 
                            value={selectedRepId}
                            onChange={(e) => setSelectedRepId(e.target.value)}
                            className="w-full lg:w-auto pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer transition-all"
                        >
                            <option value="all">Equipe Completa</option>
                            {teamDetails.map(rep => (
                                <option key={rep.id} value={rep.id}>{rep.nome.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative flex-1 lg:flex-none">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <CalendarDays className="w-3.5 h-3.5" />
                        </div>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-full lg:w-auto pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer transition-all"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => {
                                setTempSelectedMonths([...selectedMonths]);
                                setShowMonthDropdown(!showMonthDropdown);
                            }}
                            className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase flex items-center gap-3 shadow-sm hover:bg-slate-50 min-w-[180px] justify-between transition-all"
                        >
                            <span>{getMonthsLabel()}</span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showMonthDropdown && (
                            <div className="absolute top-full left-0 lg:left-auto lg:right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[150] overflow-hidden animate-slideUp">
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center gap-2">
                                    <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="flex-1 text-[9px] font-black text-blue-600 uppercase py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all">Todos</button>
                                    <button onClick={() => setTempSelectedMonths([])} className="flex-1 text-[9px] font-black text-red-600 uppercase py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-all">Limpar</button>
                                </div>
                                <div className="p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                    {monthNamesArr.map((m, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => toggleTempMonth(i + 1)}
                                            className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 opacity-20" />}
                                            {m}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-3 border-t border-slate-100 bg-slate-50">
                                    <button 
                                        onClick={handleApplyFilter}
                                        className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Filter className="w-3 h-3" /> Aplicar Filtro
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                <div onClick={() => setActiveKpiDetail('meta')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-blue-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Target className="w-20 h-20 text-blue-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta do Período</p>
                    <h3 className="text-2xl font-black text-slate-900">{formatBRL(displayData.totalMeta)}</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-4 tracking-widest">Clique para ver metas</p>
                </div>

                <div onClick={() => setActiveKpiDetail('faturado')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-blue-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="w-20 h-20 text-blue-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado Real</p>
                    <h3 className={`text-2xl font-black ${pctMeta >= 100 ? 'text-blue-600' : 'text-red-600'}`}>{formatBRL(displayData.totalFaturado)}</h3>
                    <div className="mt-4 flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase ${pctMeta >= 100 ? 'text-blue-600' : 'text-red-600'}`}>
                            {pctMeta.toFixed(2)}% Alcançado
                        </span>
                    </div>
                </div>

                <div onClick={() => setActiveKpiDetail('positivacao')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-purple-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Users className="w-20 h-20 text-purple-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Positivação</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-black text-slate-900">{displayData.clientesPositivados}</h3>
                        <span className="text-xs text-slate-400 font-bold">/ {displayData.totalClientes}</span>
                    </div>
                </div>

                <div onClick={() => setActiveKpiDetail('verba')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-amber-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Wallet className="w-20 h-20 text-amber-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Verba Utilizada (Ano)</p>
                    <h3 className="text-2xl font-black text-amber-600">{formatBRL(displayData.investimentoAno)}</h3>
                </div>
            </div>

            <div className="px-4">
                <div className="bg-slate-900 p-12 rounded-[40px] text-white shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center">
                    <div className="absolute bottom-0 right-0 p-12 opacity-10"><TrendingUp className="w-48 h-48" /></div>
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-6">
                        {diff < 0 ? 'Déficit para Meta' : 'Superávit Acumulado'}
                    </h4>
                    <p className={`text-6xl font-black tabular-nums ${diff < 0 ? 'text-red-500' : 'text-blue-400'}`}>
                        {diff < 0 ? `- ${formatBRL(Math.abs(diff))}` : `+ ${formatBRL(diff)}`}
                    </p>
                </div>
            </div>

            <div ref={rankingRef} className="bg-white p-8 md:p-12 rounded-[48px] border border-slate-200 shadow-sm mx-4">
                <div className="flex justify-between items-start mb-16">
                    <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Ranking de Eficiência Regional</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Ordenado do maior superávit percentual para o menor</p>
                        <p className="text-[8px] font-black text-blue-600 uppercase mt-2">Clique na barra para ver o detalhamento mensal</p>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col items-end gap-2 border-r border-slate-100 pr-6">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Meta OK ({`&gt;=`} 100%)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Abaixo (&lt; 100%)</span>
                            </div>
                        </div>
                        <button 
                            onClick={handleDownloadRanking} 
                            disabled={isExportingRanking} 
                            data-html2canvas-ignore
                            className="bg-blue-600 text-white p-3.5 rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                        >
                            {isExportingRanking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <div className="h-[400px] w-full flex items-end justify-between gap-4 px-2 overflow-x-auto no-scrollbar pt-20">
                    {teamDetails
                        .sort((a, b) => {
                            const pctA = a.meta > 0 ? a.faturado / a.meta : 0;
                            const pctB = b.meta > 0 ? b.faturado / b.meta : 0;
                            return pctB - pctA;
                        })
                        .map((rep) => {
                            const pct = rep.meta > 0 ? (rep.faturado / rep.meta) * 100 : 0;
                            const isSuccess = pct >= 100;
                            return (
                                <div 
                                    key={rep.id} 
                                    onClick={() => setSelectedRepForPerformance(rep)}
                                    className="flex-1 flex flex-col items-center group h-full min-w-[70px] cursor-pointer hover:opacity-80 transition-all"
                                >
                                    <div className="relative w-full flex-1 flex flex-col justify-end items-center">
                                        <div className="absolute -top-12 flex flex-col items-center">
                                            <span className={`text-[11px] font-black tabular-nums ${isSuccess ? 'text-blue-700' : 'text-red-700'}`}>{pct.toFixed(2)}%</span>
                                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">{formatBRL(rep.faturado)}</span>
                                        </div>
                                        <div className={`w-full max-w-[36px] rounded-t-xl transition-all duration-1000 shadow-lg ${isSuccess ? 'bg-blue-600 shadow-blue-100' : 'bg-red-600 shadow-red-100'}`} style={{ height: `${Math.min(pct, 100)}%` }}>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-t-xl"></div>
                                        </div>
                                    </div>
                                    <span className="mt-6 text-[9px] font-black text-slate-400 uppercase tracking-tight text-center leading-tight truncate w-full">{rep.nome.split(' ')[0]}</span>
                                </div>
                            );
                        })}
                </div>
            </div>

            {activeKpiDetail && createPortal(
                <KpiDetailModal 
                    type={activeKpiDetail} 
                    details={teamDetails} 
                    selectedYear={selectedYear}
                    periodLabel={getMonthsLabel()}
                    onClose={() => setActiveKpiDetail(null)} 
                    formatBRL={formatBRL}
                />,
                document.body
            )}

            {selectedRepForPerformance && (
                <RepPerformanceModal 
                    rep={selectedRepForPerformance} 
                    year={selectedYear} 
                    selectedMonths={selectedMonths}
                    onClose={() => setSelectedRepForPerformance(null)} 
                />
            )}
        </div>
    );
};