
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Target, TrendingUp, Users, Wallet, Calendar, RefreshCw, Loader2, DollarSign, CheckCircle2, X, ChevronRight, Database, RotateCcw, ChevronDown, CheckSquare, Square, Filter, Download, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';

type KpiDetailType = 'meta' | 'faturado' | 'positivacao' | 'verba' | null;

const KpiDetailModal: React.FC<{ 
    type: KpiDetailType; 
    details: any[]; 
    onClose: () => void; 
    formatBRL: (v: number) => string;
    periodLabel: string;
}> = ({ type, details, onClose, formatBRL, periodLabel }) => {
    const [isExporting, setIsExporting] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);

    const titles = {
        meta: `DETALHAMENTO DE METAS - ${periodLabel}`,
        faturado: 'DETALHAMENTO DE FATURAMENTO',
        positivacao: 'DETALHAMENTO DE POSITIVAÇÃO',
        verba: 'DETALHAMENTO DE VERBAS'
    };

    const totalMeta = details.reduce((acc, curr) => acc + (curr.meta || 0), 0);

    const handleSaveImage = async () => {
        if (!exportRef.current) return;
        setIsExporting(true);
        try {
            await new Promise(r => setTimeout(r, 100));
            const canvas = await html2canvas(exportRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('modal-export-area');
                    if (el) {
                        el.style.height = 'auto';
                        el.style.maxHeight = 'none';
                        el.style.overflow = 'visible';
                    }
                }
            });
            const link = document.createElement('a');
            link.download = `Relatorio_${type}_${periodLabel.replace(/\s/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
        } catch (e) {
            console.error('Erro ao exportar imagem:', e);
            alert('Não foi possível gerar a imagem.');
        } finally {
            setIsExporting(false);
        }
    };

    const sortedDetails = [...details].sort((a, b) => {
        if (type === 'meta') return b.meta - a.meta;
        if (type === 'faturado') return b.faturado - a.faturado;
        if (type === 'positivacao') return (b.positivacao / (b.totalClientes || 1)) - (a.positivacao / (a.totalClientes || 1));
        if (type === 'verba') return b.verba - a.verba;
        return 0;
    });

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp border border-white/20 flex flex-col max-h-[90vh]">
                <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="min-w-0 flex-1">
                        <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight truncate">{titles[type as keyof typeof titles]}</h3>
                        {type !== 'meta' && <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Visão por Representante</p>}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        <button 
                            onClick={handleSaveImage}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Salvar Foto</span>
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-white" id="modal-export-area" ref={exportRef}>
                    <div className="p-8">
                        {type === 'meta' && (
                            <div className="mb-8 flex justify-between items-end pb-6 border-b-2 border-slate-900">
                                <div>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-1">Portal Centro-Norte</p>
                                    <h4 className="text-2xl font-black text-slate-900 uppercase leading-none">{titles.meta}</h4>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Equipe</p>
                                    <p className="text-xl font-black text-blue-600 leading-none">{formatBRL(totalMeta)}</p>
                                </div>
                            </div>
                        )}

                        <div className="divide-y divide-slate-100">
                            {sortedDetails.map((rep) => {
                                const share = totalMeta > 0 ? (rep.meta / totalMeta) * 100 : 0;
                                return (
                                    <div key={rep.id} className="py-5 flex justify-between items-center group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-400 uppercase text-lg border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                {rep.nome.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 uppercase text-sm tracking-tight">{rep.nome}</p>
                                                {type === 'meta' && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{ width: `${share}%` }}></div>
                                                        </div>
                                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                                            {share.toFixed(1)}% do total
                                                        </span>
                                                    </div>
                                                )}
                                                {type === 'positivacao' && (
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                                        {rep.positivacao} de {rep.totalClientes} Clientes
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-slate-900 text-base">
                                                {type === 'meta' && formatBRL(rep.meta)}
                                                {type === 'faturado' && formatBRL(rep.faturado)}
                                                {type === 'verba' && formatBRL(rep.verba)}
                                                {type === 'positivacao' && `${((rep.positivacao / (rep.totalClientes || 1)) * 100).toFixed(1)}%`}
                                            </p>
                                            {type === 'faturado' && rep.meta > 0 && (
                                                <p className={`text-[10px] font-black uppercase mt-1 ${rep.faturado >= rep.meta ? 'text-blue-600' : 'text-red-500'}`}>
                                                    {((rep.faturado / rep.meta) * 100).toFixed(1)}% atingido
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {type === 'meta' && (
                            <div className="mt-8 pt-8 border-t-4 border-slate-900 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resumo Consolidado</p>
                                    <span className="text-xs font-black text-slate-900 uppercase">Total Geral de Metas do Período</span>
                                </div>
                                <span className="text-3xl font-black text-slate-900 tabular-nums">{formatBRL(totalMeta)}</span>
                            </div>
                        )}
                        
                        <div className="hidden print-only mt-12 pt-8 border-t border-slate-100 flex justify-between items-center opacity-30">
                            <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-400 italic">Portal Centro-Norte • Inteligência Comercial</p>
                            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-[10px]">CN</div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="bg-slate-900 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all">Fechar Janela</button>
                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @media screen {
                    .print-only { display: none; }
                }
            `}} />
        </div>
    );
};

export const ManagerDashboard: React.FC = () => {
    const now = new Date();
    const [isLoading, setIsLoading] = useState(true);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStatus, setLoadingStatus] = useState('');
    const [activeKpiDetail, setActiveKpiDetail] = useState<KpiDetailType>(null);
    const [teamDetails, setTeamDetails] = useState<any[]>([]);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Filtros
    const [selectedRepId, setSelectedRepId] = useState<string>('all');
    const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [tempSelectedMonths, setTempSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    const CACHE_KEY_PREFIX = 'pcn_manager_dashboard_cache_v4';
    const CACHE_TIME = 2 * 60 * 60 * 1000;

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    // Dados Computados baseados no filtro de representante
    const displayData = useMemo(() => {
        if (selectedRepId === 'all') {
            return teamDetails.reduce((acc, curr) => ({
                totalMeta: acc.totalMeta + curr.meta,
                totalFaturado: acc.totalFaturado + curr.faturado,
                totalClientes: acc.totalClientes + curr.totalClientes,
                clientesPositivados: acc.clientesPositivados + curr.positivacao,
                investimentoMes: acc.investimentoMes + curr.verba
            }), { totalMeta: 0, totalFaturado: 0, totalClientes: 0, clientesPositivados: 0, investimentoMes: 0 });
        } else {
            const rep = teamDetails.find(r => r.id === selectedRepId);
            if (!rep) return { totalMeta: 0, totalFaturado: 0, totalClientes: 0, clientesPositivados: 0, investimentoMes: 0 };
            return {
                totalMeta: rep.meta,
                totalFaturado: rep.faturado,
                totalClientes: rep.totalClientes,
                clientesPositivados: rep.positivacao,
                investimentoMes: rep.verba
            };
        }
    }, [teamDetails, selectedRepId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowMonthDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // FIX: Added missing toggleTempMonth function
    const toggleTempMonth = (m: number) => {
        setTempSelectedMonths(prev => 
            prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
        );
    };

    // FIX: Added missing handleApplyFilter function
    const handleApplyFilter = () => {
        if (tempSelectedMonths.length === 0) {
            alert("Selecione ao menos um mês.");
            return;
        }
        setSelectedMonths([...tempSelectedMonths]);
        setShowMonthDropdown(false);
    };

    useEffect(() => {
        const cacheKey = `${CACHE_KEY_PREFIX}_${selectedMonths.sort((a,b)=>a-b).join('_')}_${selectedYear}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const { timestamp, teamDetails: cachedTeam } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TIME) {
                setTeamDetails(cachedTeam);
                setIsLoading(false);
                return;
            }
        }
        fetchKpis();
    }, [selectedMonths, selectedYear]);

    const fetchAllSalesPeriod = async (year: number, months: number[]) => {
        let allData: any[] = [];
        let from = 0;
        let hasMore = true;
        const firstMonth = Math.min(...months);
        const lastMonth = Math.max(...months);
        const start = `${year}-${String(firstMonth).padStart(2, '0')}-01`;
        const end = new Date(year, lastMonth, 0).toISOString().split('T')[0];

        while (hasMore) {
            const { data, error } = await supabase
                .from('dados_vendas')
                .select('faturamento, cnpj, usuario_id, data')
                .gte('data', start)
                .lte('data', end)
                .range(from, from + 999);
            
            if (error) throw error;
            if (data && data.length > 0) {
                const filteredBatch = data.filter(s => {
                    const m = new Date(s.data + 'T00:00:00').getUTCMonth() + 1;
                    return months.includes(m);
                });
                allData = [...allData, ...filteredBatch];
                from += 1000;
                setLoadingProgress(Math.round(Math.min(80, 40 + (allData.length / 5000) * 10)));
                if (data.length < 1000) hasMore = false;
            } else { hasMore = false; }
        }
        return allData;
    };

    const fetchKpis = async () => {
        if (selectedMonths.length === 0) return;
        setIsLoading(true);
        setLoadingProgress(5);
        setLoadingStatus('Iniciando Auditoria...');
        
        try {
            setLoadingStatus('Buscando Equipe...');
            const { data: reps } = await supabase.from('usuarios').select('id, nome, nivel_acesso').not('nivel_acesso', 'ilike', 'admin').not('nivel_acesso', 'ilike', 'gerente');

            setLoadingStatus('Sincronizando Metas...');
            const { data: metas } = await supabase.from('metas_usuarios').select('*').in('mes', selectedMonths).eq('ano', selectedYear);
            
            setLoadingStatus('Processando Faturamentos...');
            const sales = await fetchAllSalesPeriod(selectedYear, selectedMonths);
            
            setLoadingStatus('Mapeando Carteira Global...');
            const { data: clientPortfolio } = await supabase.from('clientes').select('cnpj, usuario_id');
            
            setLoadingStatus('Consolidando Verbas...');
            const firstMonth = Math.min(...selectedMonths);
            const lastMonth = Math.max(...selectedMonths);
            const startStr = `${selectedYear}-${String(firstMonth).padStart(2, '0')}-01`;
            const endStr = new Date(selectedYear, lastMonth, 0).toISOString().split('T')[0];

            const { data: invs } = await supabase.from('investimentos').select('*').eq('status', 'approved').gte('data', startStr).lte('data', endStr);
            const filteredInvs = invs?.filter(inv => selectedMonths.includes(new Date(inv.data + 'T00:00:00').getUTCMonth() + 1)) || [];

            const details = reps?.map(rep => {
                const repMeta = metas?.filter(m => m.usuario_id === rep.id).reduce((a, b) => a + Number(b.valor), 0) || 0;
                const repSalesList = sales?.filter(s => s.usuario_id === rep.id) || [];
                const repSales = repSalesList.reduce((a, b) => a + Number(b.faturamento), 0) || 0;
                const repInv = filteredInvs.filter(i => i.usuario_id === rep.id).reduce((a, b) => a + Number(b.valor_total_investimento), 0) || 0;
                const repClients = clientPortfolio?.filter(c => c.usuario_id === rep.id) || [];
                const repSalesCnpjs = new Set(repSalesList.map(s => String(s.cnpj || '').replace(/\D/g, '')));
                const repPosit = repClients.filter(c => repSalesCnpjs.has(String(c.cnpj || '').replace(/\D/g, ''))).length;

                return { id: rep.id, nome: rep.nome, meta: repMeta, faturado: repSales, positivacao: repPosit, totalClientes: repClients.length, verba: repInv };
            }) || [];

            setTeamDetails(details);
            setLoadingProgress(100);
            sessionStorage.setItem(`${CACHE_KEY_PREFIX}_${selectedMonths.sort((a,b)=>a-b).join('_')}_${selectedYear}`, JSON.stringify({ timestamp: Date.now(), teamDetails: details }));
            setTimeout(() => setIsLoading(false), 500);
        } catch (e) { 
            console.error(e); 
            setIsLoading(false);
        }
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    const pctMeta = displayData.totalMeta > 0 ? (displayData.totalFaturado / displayData.totalMeta) * 100 : 0;
    const pctPosit = displayData.totalClientes > 0 ? (displayData.clientesPositivados / displayData.totalClientes) * 100 : 0;
    const diff = displayData.totalFaturado - displayData.totalMeta;
    const isNegativeDiff = diff < 0;

    const getMonthsLabel = () => {
        if (selectedMonths.length === 0) return "Nenhum Selecionado";
        if (selectedMonths.length === 1) return monthNames[selectedMonths[0] - 1].toUpperCase();
        if (selectedMonths.length === 12) return "ANO COMPLETO";
        return `${selectedMonths.length} MESES SELECIONADOS`;
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-[70vh] text-slate-400 space-y-8 animate-fadeIn">
            <div className="relative">
                <Loader2 className="w-16 h-16 animate-spin text-blue-600 opacity-20" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <Database className="w-6 h-6 text-blue-600 animate-pulse" />
                </div>
            </div>
            <div className="w-full max-w-xs space-y-3">
                <div className="flex justify-between items-end">
                    <p className="font-black uppercase text-[10px] tracking-widest text-slate-500">{loadingStatus}</p>
                    <span className="text-sm font-black text-blue-600 tabular-nums">{loadingProgress}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-0.5 shadow-inner">
                    <div className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(37,99,235,0.4)]" style={{ width: `${loadingProgress}%` }} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-12">
            <header className="flex flex-col lg:flex-row justify-between items-end gap-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Visão de Resultados</h2>
                    <p className="text-[10px] font-black text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-widest text-left">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" /> 
                        Período: {selectedMonths.sort((a,b) => a-b).map(m => monthShort[m-1]).join(', ')} de {selectedYear}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    
                    {/* Filtro de Representante */}
                    <div className="relative flex-1 lg:flex-none">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <User className="w-3.5 h-3.5" />
                        </div>
                        <select 
                            value={selectedRepId}
                            onChange={(e) => setSelectedRepId(e.target.value)}
                            className="w-full lg:w-auto pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer transition-all"
                        >
                            <option value="all">Equipe Completa (Global)</option>
                            {teamDetails.sort((a,b) => a.nome.localeCompare(b.nome)).map(rep => (
                                <option key={rep.id} value={rep.id}>{rep.nome.toUpperCase()}</option>
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
                                <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selecionar Período</span>
                                    <button onClick={() => setTempSelectedMonths([1,2,3,4,5,6,7,8,9,10,11,12])} className="text-[9px] font-black text-blue-600 uppercase hover:underline transition-all">Todos</button>
                                </div>
                                <div className="p-2 grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
                                    {monthNames.map((m, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => toggleTempMonth(i + 1)}
                                            className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-bold uppercase transition-colors ${tempSelectedMonths.includes(i + 1) ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            {tempSelectedMonths.includes(i + 1) ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
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

                    <select 
                        value={selectedYear} 
                        onChange={e => setSelectedYear(Number(e.target.value))}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
                    >
                        <option value={2024}>2024</option>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                    </select>

                    <button onClick={() => fetchKpis()} className="bg-white border border-slate-200 rounded-xl p-2.5 hover:bg-slate-50 transition-all shadow-sm">
                        <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                            {pctMeta.toFixed(1)}% Alcançado
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
                    <div className="mt-4 flex items-center gap-2">
                         <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                         <span className="text-[10px] font-black text-slate-600 uppercase">{pctPosit.toFixed(1)}% da Base</span>
                    </div>
                </div>

                <div onClick={() => setActiveKpiDetail('verba')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-amber-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Wallet className="w-20 h-20 text-amber-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Verba Utilizada</p>
                    <h3 className="text-2xl font-black text-amber-600">{formatBRL(displayData.investimentoMes)}</h3>
                    <div className="mt-4 flex items-center gap-2">
                         <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                         <span className="text-[10px] font-black text-slate-600 uppercase">Investimentos Aprovados</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 p-12 opacity-10"><TrendingUp className="w-48 h-48" /></div>
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">
                        {isNegativeDiff ? 'Déficit para Meta' : 'Superávit Acumulado'}
                    </h4>
                    <p className={`text-5xl font-black tabular-nums ${isNegativeDiff ? 'text-red-500' : 'text-blue-400'}`}>
                        {isNegativeDiff ? `- ${formatBRL(Math.abs(diff))}` : `+ ${formatBRL(diff)}`}
                    </p>
                    <p className="text-slate-400 font-medium text-sm mt-6">
                        {isNegativeDiff 
                            ? `Restam ${Math.max(0, 100 - pctMeta).toFixed(1)}% para conclusão do objetivo.`
                            : `Objetivo superado em ${(pctMeta - 100).toFixed(1)}%.`
                        }
                    </p>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-center">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Efetividade da Equipe</h4>
                    <div className="space-y-8">
                        <div>
                            <div className="flex justify-between mb-2 items-end">
                                <span className="text-[10px] font-black uppercase text-slate-600">Faturamento vs Meta</span>
                                <span className={`text-sm font-black ${pctMeta >= 100 ? 'text-blue-600' : 'text-red-600'}`}>{pctMeta.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-1000 ${pctMeta >= 100 ? 'bg-blue-600' : 'bg-red-500'}`} style={{ width: `${Math.min(pctMeta, 100)}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between mb-2 items-end">
                                <span className="text-[10px] font-black uppercase text-slate-600">Cobertura de Carteira</span>
                                <span className="text-sm font-black text-purple-600">{pctPosit.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-600 rounded-full transition-all duration-1000" style={{ width: `${pctPosit}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {activeKpiDetail && createPortal(
                <KpiDetailModal 
                    type={activeKpiDetail} 
                    details={teamDetails} 
                    onClose={() => setActiveKpiDetail(null)} 
                    formatBRL={formatBRL}
                    periodLabel={getMonthsLabel()}
                />,
                document.body
            )}
        </div>
    );
};
