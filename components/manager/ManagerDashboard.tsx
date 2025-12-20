
import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Users, Wallet, Calendar, RefreshCw, Loader2, DollarSign, CheckCircle2, X, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { createPortal } from 'react-dom';

type KpiDetailType = 'meta' | 'faturamento' | 'positivacao' | 'verba' | null;

const KpiDetailModal: React.FC<{ 
    type: KpiDetailType; 
    details: any[]; 
    onClose: () => void; 
    formatBRL: (v: number) => string;
}> = ({ type, details, onClose, formatBRL }) => {
    const titles = {
        meta: 'Detalhamento de Metas',
        faturado: 'Detalhamento de Faturamento',
        positivacao: 'Detalhamento de Positivação',
        verba: 'Detalhamento de Verbas'
    };

    const sortedDetails = [...details].sort((a, b) => {
        if (type === 'meta') return b.meta - a.meta;
        if (type === 'faturamento') return b.faturado - a.faturado;
        if (type === 'positivacao') return (b.positivacao / (b.totalClientes || 1)) - (a.positivacao / (a.totalClientes || 1));
        if (type === 'verba') return b.verba - a.verba;
        return 0;
    });

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-slideUp border border-white/20">
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{titles[type as keyof typeof titles]}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Ranking por Representante</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                    {sortedDetails.map((rep) => (
                        <div key={rep.id} className="py-4 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 uppercase">
                                    {rep.nome.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-black text-slate-800 uppercase text-sm">{rep.nome}</p>
                                    {type === 'positivacao' && (
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                                            {rep.positivacao} de {rep.totalClientes} Clientes
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-slate-900">
                                    {type === 'meta' && formatBRL(rep.meta)}
                                    {type === 'faturamento' && formatBRL(rep.faturado)}
                                    {type === 'verba' && formatBRL(rep.verba)}
                                    {type === 'positivacao' && `${((rep.positivacao / (rep.totalClientes || 1)) * 100).toFixed(1)}%`}
                                </p>
                                {type === 'faturamento' && rep.meta > 0 && (
                                    <p className={`text-[10px] font-black uppercase ${rep.faturado >= rep.meta ? 'text-emerald-500' : 'text-blue-500'}`}>
                                        {((rep.faturado / rep.meta) * 100).toFixed(1)}% da Meta
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="bg-slate-900 text-white px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Fechar</button>
                </div>
            </div>
        </div>
    );
};

export const ManagerDashboard: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [activeKpiDetail, setActiveKpiDetail] = useState<KpiDetailType>(null);
    const [teamDetails, setTeamDetails] = useState<any[]>([]);
    
    const [data, setData] = useState({
        totalMeta: 0,
        totalFaturado: 0,
        totalClientes: 0,
        clientesPositivados: 0,
        investimentoMes: 0
    });

    const CACHE_KEY = 'pcn_manager_dashboard_cache';
    const CACHE_TIME = 5 * 60 * 1000; // 5 minutos

    useEffect(() => {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            const { timestamp, data: cachedData, teamDetails: cachedTeam } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_TIME) {
                setData(cachedData);
                setTeamDetails(cachedTeam);
                setIsLoading(false);
                return;
            }
        }
        fetchKpis();
    }, []);

    const fetchAllSalesMonth = async (start: string) => {
        let allData: any[] = [];
        let from = 0;
        let to = 999;
        let hasMore = true;
        while (hasMore) {
            const { data, error } = await supabase
                .from('dados_vendas')
                .select('faturamento, cnpj, usuario_id')
                .gte('data', start)
                .range(from, to);
            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += 1000;
                to += 1000;
                if (data.length < 1000) hasMore = false;
            } else { hasMore = false; }
        }
        return allData;
    };

    const fetchKpis = async () => {
        setIsLoading(true);
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;

        try {
            const { data: reps } = await supabase
                .from('usuarios')
                .select('id, nome, nivel_acesso')
                .not('nivel_acesso', 'ilike', 'admin')
                .not('nivel_acesso', 'ilike', 'gerente');

            const { data: metas } = await supabase.from('metas_usuarios').select('*').eq('mes', month).eq('ano', year);
            const sales = await fetchAllSalesMonth(firstDay);
            const { count: totalClientes } = await supabase.from('clientes').select('*', { count: 'exact', head: true });
            const { data: clientPortfolio } = await supabase.from('clientes').select('cnpj, usuario_id');
            const { data: invs } = await supabase.from('investimentos').select('*').eq('status', 'approved').gte('data', firstDay);

            const totalMeta = metas?.reduce((acc, curr) => acc + Number(curr.valor), 0) || 0;
            const totalFaturado = sales?.reduce((acc, curr) => acc + Number(curr.faturamento), 0) || 0;
            const uniquePositivadosGlobal = new Set(sales?.map(s => String(s.cnpj || '').replace(/\D/g, ''))).size;
            const totalInv = invs?.reduce((acc, curr) => acc + Number(curr.valor_total_investimento), 0) || 0;

            const details = reps?.map(rep => {
                const repMeta = metas?.filter(m => m.usuario_id === rep.id).reduce((a, b) => a + Number(b.valor), 0) || 0;
                const repSalesList = sales?.filter(s => s.usuario_id === rep.id) || [];
                const repSales = repSalesList.reduce((a, b) => a + Number(b.faturamento), 0) || 0;
                const repInv = invs?.filter(i => i.usuario_id === rep.id).reduce((a, b) => a + Number(b.valor_total_investimento), 0) || 0;
                
                const repClients = clientPortfolio?.filter(c => c.usuario_id === rep.id) || [];
                const repSalesCnpjs = new Set(repSalesList.map(s => String(s.cnpj || '').replace(/\D/g, '')));
                const repPosit = repClients.filter(c => repSalesCnpjs.has(String(c.cnpj || '').replace(/\D/g, ''))).length;

                return { id: rep.id, nome: rep.nome, meta: repMeta, faturado: repSales, positivacao: repPosit, totalClientes: repClients.length, verba: repInv };
            }) || [];

            const newData = { totalMeta, totalFaturado, totalClientes: totalClientes || 0, clientesPositivados: uniquePositivadosGlobal, investimentoMes: totalInv };
            
            setData(newData);
            setTeamDetails(details);
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: newData, teamDetails: details }));
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    const formatBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);
    const pctMeta = data.totalMeta > 0 ? (data.totalFaturado / data.totalMeta) * 100 : 0;
    const pctPosit = data.totalClientes > 0 ? (data.clientesPositivados / data.totalClientes) * 100 : 0;

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-96 text-slate-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-600" />
            <p className="font-black uppercase text-[10px] tracking-widest animate-pulse">Auditando Faturamentos Globais...</p>
        </div>
    );

    return (
        <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn pb-12">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Visão de Resultados</h2>
                    <p className="text-[10px] font-black text-slate-400 mt-2 flex items-center gap-2 uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" /> 
                        {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <button onClick={() => fetchKpis()} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                    <RefreshCw className="w-3 h-3" /> Atualizar Auditoria
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div onClick={() => setActiveKpiDetail('meta')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-blue-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Target className="w-20 h-20 text-blue-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Meta Global</p>
                    <h3 className="text-2xl font-black text-slate-900">{formatBRL(data.totalMeta)}</h3>
                    <div className="mt-4 flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase ${pctMeta >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{pctMeta.toFixed(1)}% Alcançado</span>
                    </div>
                </div>

                <div onClick={() => setActiveKpiDetail('faturamento')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-emerald-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><DollarSign className="w-20 h-20 text-emerald-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Faturado Real</p>
                    <h3 className="text-2xl font-black text-emerald-600">{formatBRL(data.totalFaturado)}</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase mt-4 tracking-widest">Clique para ver equipe</p>
                </div>

                <div onClick={() => setActiveKpiDetail('positivacao')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-purple-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Users className="w-20 h-20 text-purple-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Positivação</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-black text-slate-900">{data.clientesPositivados}</h3>
                        <span className="text-xs text-slate-400 font-bold">/ {data.totalClientes}</span>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                         <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                         <span className="text-[10px] font-black text-slate-600 uppercase">{pctPosit.toFixed(1)}% da Base</span>
                    </div>
                </div>

                <div onClick={() => setActiveKpiDetail('verba')} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm relative overflow-hidden group cursor-pointer hover:border-amber-500 transition-all active:scale-95">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Wallet className="w-20 h-20 text-amber-600" /></div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Verba Total</p>
                    <h3 className="text-2xl font-black text-amber-600">{formatBRL(data.investimentoMes)}</h3>
                    <div className="mt-4 flex items-center gap-2">
                         <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
                         <span className="text-[10px] font-black text-slate-600 uppercase">Investimentos Aprovados</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 p-12 opacity-10"><TrendingUp className="w-48 h-48" /></div>
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">Diferença para Meta</h4>
                    <p className="text-5xl font-black tabular-nums">{formatBRL(Math.max(0, data.totalMeta - data.totalFaturado))}</p>
                    <p className="text-slate-400 font-medium text-sm mt-6">Restam {(100 - pctMeta).toFixed(1)}% para conclusão do objetivo mensal.</p>
                </div>
                <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-center">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Efetividade da Equipe</h4>
                    <div className="space-y-8">
                        <div>
                            <div className="flex justify-between mb-2 items-end">
                                <span className="text-[10px] font-black uppercase text-slate-600">Faturamento vs Meta</span>
                                <span className="text-sm font-black text-blue-600">{pctMeta.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 rounded-full transition-all duration-1000" style={{ width: `${Math.min(pctMeta, 100)}%` }}></div>
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
                <KpiDetailModal type={activeKpiDetail} details={teamDetails} onClose={() => setActiveKpiDetail(null)} formatBRL={formatBRL} />,
                document.body
            )}
        </div>
    );
};
