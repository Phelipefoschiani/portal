import React, { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Loader2, Database, Users, BarChart3, X, UserPlus, RefreshCcw, CopyX, SearchCheck, LayoutList, RotateCcw, CalendarDays, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '../Button';
import { supabase } from '../../lib/supabase';
import { totalDataStore } from '../../lib/dataStore';
import { createPortal } from 'react-dom';

type ActiveTab = 'import' | 'reset';

export const ManagerImportScreen: React.FC = () => {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<ActiveTab>('import');
  
  // Estados Importação
  const [reps, setReps] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentAction, setCurrentAction] = useState('');
  const [currentItemName, setCurrentItemName] = useState('');
  const [stats, setStats] = useState({ totalRows: 0, newClientsInserted: 0, processedRows: 0, ignoredRows: 0 });
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  
  // Estados Reset
  const [resetYear, setResetYear] = useState(now.getFullYear());
  const [resetMonth, setResetMonth] = useState(now.getMonth() + 1);
  const [billingSummary, setBillingSummary] = useState<Record<string, number>>({});
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  useEffect(() => {
    fetchReps();
  }, []);

  useEffect(() => {
    if (activeTab === 'reset') calculateBillingSummary();
  }, [activeTab, resetYear, resetMonth]);

  const fetchReps = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, nivel_acesso')
      .not('nivel_acesso', 'ilike', 'admin')
      .not('nivel_acesso', 'ilike', 'gerente')
      .order('nome');
    setReps(data || []);
  };

  const calculateBillingSummary = () => {
    setIsLoadingSummary(true);
    const summary: Record<string, number> = {};
    const filteredSales = totalDataStore.sales.filter(s => {
        const d = new Date(s.data + 'T00:00:00');
        return (d.getUTCMonth() + 1) === resetMonth && d.getUTCFullYear() === resetYear;
    });
    filteredSales.forEach(s => {
        summary[s.usuario_id] = (summary[s.usuario_id] || 0) + Number(s.faturamento || 0);
    });
    setBillingSummary(summary);
    setIsLoadingSummary(false);
  };

  const executeReset = async () => {
    if (!confirmResetId) return;
    setIsProcessing(true);
    try {
        const monthStr = String(resetMonth).padStart(2, '0');
        const lastDay = new Date(resetYear, resetMonth, 0).getDate();
        const start = `${resetYear}-${monthStr}-01`;
        const end = `${resetYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        const { error } = await supabase
            .from('dados_vendas')
            .delete()
            .eq('usuario_id', confirmResetId)
            .gte('data', start)
            .lte('data', end);

        if (error) throw error;

        totalDataStore.sales = totalDataStore.sales.filter(s => {
            const d = new Date(s.data + 'T00:00:00');
            return !(s.usuario_id === confirmResetId && (d.getUTCMonth() + 1) === resetMonth && d.getUTCFullYear() === resetYear);
        });

        setConfirmResetId(null);
        calculateBillingSummary();
        alert('Dados removidos com sucesso!');
    } catch (e: any) {
        alert('Erro ao resetar: ' + e.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const cleanCnpj = (val: any) => String(val || '').replace(/\D/g, '');
  const normalizeRepName = (name: string) => name ? name.split('(')[0].trim().toUpperCase() : "";

  // FINGERPRINT BLINDADO: Usa toFixed(2) e Trim para evitar duplicação por arredondamento
  const generateRowFingerprint = (row: any) => {
    const cnpj = cleanCnpj(row.cnpj);
    const date = String(row.data).trim();
    const pedido = String(row.pedido || '').trim();
    const nf = String(row.nota_fiscal || '').trim();
    const sku = String(row.codigo_produto || '').trim();
    const vlr = Number(row.faturamento || 0).toFixed(2);
    const qtd = Number(row.qtde_faturado || 0).toFixed(2);
    return `${cnpj}|${date}|${pedido}|${nf}|${sku}|${vlr}|${qtd}`;
  };

  const getVal = (row: any, keys: string[]) => {
    const foundKey = Object.keys(row).find(k => keys.some(key => k.toLowerCase().trim() === key.toLowerCase().trim()));
    return foundKey ? row[foundKey] : null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus({ type: 'idle', message: '' });
    }
  };

  const processImport = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(0);
    setStatus({ type: 'idle', message: '' });
    setStats({ totalRows: 0, newClientsInserted: 0, processedRows: 0, ignoredRows: 0 });

    try {
      const X = (XLSX as any).utils ? XLSX : (XLSX as any).default;
      const data = await file.arrayBuffer();
      const workbook = X.read(data);
      const jsonData: any[] = X.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      if (jsonData.length === 0) throw new Error('A planilha está vazia.');

      const repNameToIdMap = new Map();
      reps.forEach(r => repNameToIdMap.set(normalizeRepName(r.nome), r.id));

      setCurrentAction('Mapeando estrutura do arquivo...');
      const dataByRep = new Map<string, any[]>();

      jsonData.forEach(row => {
        const rawRepName = String(getVal(row, ['Representante', 'Vendedor', 'RCA']) || '');
        const repId = repNameToIdMap.get(normalizeRepName(rawRepName));

        if (repId) {
          let rawDate = getVal(row, ['Data', 'Emissão', 'Data Faturamento']);
          let formattedDate = typeof rawDate === 'number' 
            ? new Date(Math.round((rawDate - 25569) * 86400 * 1000)).toISOString().split('T')[0]
            : new Date(rawDate).toISOString().split('T')[0];

          const normalizedRow = {
            usuario_id: repId,
            cnpj: cleanCnpj(getVal(row, ['CNPJ', 'C.N.P.J', 'CGC'])),
            cliente_nome: String(getVal(row, ['Cliente', 'Razão Social', 'Nome Fantasia']) || '').trim(),
            data: formattedDate,
            pedido: String(getVal(row, ['Pedido', 'Nr. Pedido']) || '').trim(),
            nota_fiscal: String(getVal(row, ['Nota Fiscal', 'NF', 'Danfe']) || '').trim(),
            codigo_produto: String(getVal(row, ['Codigo Produto', 'Cod. Prod', 'SKU']) || '').trim(),
            produto: String(getVal(row, ['Produto', 'Descrição', 'Item']) || '').trim(),
            faturamento: parseFloat(String(getVal(row, ['Faturamento', 'Valor Total', 'Venda Liquida']) || '0').replace(',', '.')),
            qtde_faturado: parseFloat(String(getVal(row, ['Qtde faturado', 'Quantidade', 'Qtd']) || '0').replace(',', '.')),
            canal_vendas: String(getVal(row, ['Canal Vendas', 'Canal', 'Canal de Vendas']) || '').trim(),
            grupo: String(getVal(row, ['Grupo', 'Grupo Econômico', 'Rede']) || '').trim()
          };

          if (!dataByRep.has(repId)) dataByRep.set(repId, []);
          dataByRep.get(repId)?.push(normalizedRow);
        }
      });

      setStats(prev => ({ ...prev, totalRows: jsonData.length }));
      const repIdsToProcess = Array.from(dataByRep.keys());
      let totalNewSales = 0, totalIgnored = 0, totalNewClients = 0;

      for (let i = 0; i < repIdsToProcess.length; i++) {
        const repId = repIdsToProcess[i];
        const repRows = dataByRep.get(repId) || [];
        const repName = reps.find(r => r.id === repId)?.nome || 'Vendedor';

        setCurrentAction(`Processando Vendedor...`);
        setCurrentItemName(repName.toUpperCase());

        // A. Sincronizar Clientes
        const uniqueClients = new Map();
        repRows.forEach(r => {
          if (r.cnpj) uniqueClients.set(r.cnpj, { 
            usuario_id: repId, nome_fantasia: r.cliente_nome, cnpj: r.cnpj, 
            ativo: true, canal_vendas: r.canal_vendas !== 'null' ? r.canal_vendas : null, 
            grupo: r.grupo !== 'null' ? r.grupo : null 
          });
        });

        const { data: existingClients } = await supabase.from('clientes').select('cnpj').eq('usuario_id', repId);
        const existingCnpjs = new Set(existingClients?.map(c => cleanCnpj(c.cnpj)) || []);
        const newClients = Array.from(uniqueClients.values()).filter(c => !existingCnpjs.has(c.cnpj));
        if (newClients.length > 0) { await supabase.from('clientes').insert(newClients); totalNewClients += newClients.length; }

        // B. Anti-Duplicidade (Fingerprint Matching)
        const dates = Array.from(new Set(repRows.map(r => r.data)));
        const { data: existingSales } = await supabase.from('dados_vendas')
            .select('cnpj, data, pedido, nota_fiscal, codigo_produto, faturamento, qtde_faturado')
            .eq('usuario_id', repId).in('data', dates);

        const existingFingerprints = new Set(existingSales?.map(s => generateRowFingerprint(s)) || []);

        const toInsert = repRows.filter(row => {
          const fingerprint = generateRowFingerprint(row);
          if (existingFingerprints.has(fingerprint)) { totalIgnored++; return false; }
          return true;
        }).map(row => ({
          data: row.data, pedido: row.pedido, nota_fiscal: row.nota_fiscal, usuario_id: row.usuario_id,
          cnpj: row.cnpj, cliente_nome: row.cliente_nome, canal_vendas: row.canal_vendas !== 'null' ? row.canal_vendas : null,
          grupo: row.grupo !== 'null' ? row.grupo : null, codigo_produto: row.codigo_produto,
          produto: row.produto, faturamento: row.faturamento, qtde_faturado: row.qtde_faturado
        }));

        if (toInsert.length > 0) {
          const { error } = await supabase.from('dados_vendas').insert(toInsert);
          if (error) throw error;
          totalNewSales += toInsert.length;
          totalDataStore.sales = [...totalDataStore.sales, ...toInsert];
        }

        setStats(prev => ({ ...prev, processedRows: totalNewSales, ignoredRows: totalIgnored, newClientsInserted: totalNewClients }));
        setProgress(Math.round(((i + 1) / repIdsToProcess.length) * 100));
      }

      setStatus({ type: 'success', message: `Concluído! ${totalNewSales} novas vendas importadas. ${totalIgnored} já existiam.` });
      setFile(null);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Erro no processamento.' });
    } finally {
      setIsProcessing(false);
      setCurrentItemName('');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      <div className="bg-white px-8 py-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Gestão de Faturamento</h2>
            <div className="flex bg-slate-100 p-1 rounded-xl mt-2">
                <button onClick={() => setActiveTab('import')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'import' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Importar Excel</button>
                <button onClick={() => setActiveTab('reset')} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'reset' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400'}`}>Reset de Dados</button>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 px-4 py-2 rounded-xl border border-white/10 hidden md:block">
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Sincronizador</p>
            <p className="text-xs font-black text-white">Centro-Norte Engine</p>
        </div>
      </div>

      {activeTab === 'import' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm space-y-6">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-blue-600" /> Segurança
                    </h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-2xl text-[9px] text-blue-800 font-bold uppercase leading-relaxed">
                            O sistema ignorará automaticamente qualquer linha que já tenha sido importada anteriormente.
                        </div>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-3">
            {!isProcessing ? (
                <div className="bg-white p-8 rounded-[36px] border border-slate-200 shadow-xl flex flex-col items-center justify-center text-center space-y-8">
                    <div onClick={() => !isProcessing && fileInputRef.current?.click()} className="w-full cursor-pointer flex flex-col items-center p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] hover:bg-blue-50/50 hover:border-blue-400 transition-all">
                        <Upload className="w-12 h-12 text-blue-600 mb-4" />
                        <h4 className="text-lg font-black text-slate-800">{file ? file.name : 'Selecione o Excel Geral'}</h4>
                        <p className="text-slate-400 text-[10px] font-black uppercase mt-1">Varredura Completa da Regional</p>
                        <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
                    </div>
                    {status.message && (
                        <div className={`w-full p-4 rounded-2xl text-[10px] font-black flex items-center gap-3 border ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {status.type === 'success' ? <CheckCircle2 className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
                            <span className="uppercase tracking-widest">{status.message}</span>
                        </div>
                    )}
                    <Button fullWidth size="lg" onClick={processImport} disabled={!file} className="h-14 text-sm font-black rounded-2xl">Processar Carteira</Button>
                </div>
            ) : (
                <div className="bg-slate-900 rounded-[36px] p-10 shadow-2xl border border-white/10 text-white space-y-8 animate-fadeIn">
                    <div className="flex justify-between items-end">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 block mb-2">{currentAction}</span>
                            <h5 className="text-2xl font-black text-white truncate max-w-xs">{currentItemName || 'Sincronizando...'}</h5>
                        </div>
                        <span className="text-4xl font-black text-white tabular-nums">{progress}%</span>
                    </div>
                    <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden p-1">
                        <div className="h-full bg-blue-500 rounded-full transition-all shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                        <div className="bg-white/5 p-4 rounded-xl text-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-1">Novos</p><p className="text-lg font-black">{stats.processedRows}</p></div>
                        <div className="bg-white/5 p-4 rounded-xl text-center"><p className="text-[8px] font-black text-amber-500 uppercase mb-1">Duplicados</p><p className="text-lg font-black text-amber-400">{stats.ignoredRows}</p></div>
                        <div className="bg-white/5 p-4 rounded-xl text-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-1">Clientes</p><p className="text-lg font-black">{stats.newClientsInserted}</p></div>
                        <div className="bg-white/5 p-4 rounded-xl text-center"><p className="text-[8px] font-black text-slate-500 uppercase mb-1">Total</p><p className="text-lg font-black">{stats.totalRows}</p></div>
                    </div>
                </div>
            )}
            </div>
        </div>
      ) : (
        <div className="animate-slideUp space-y-6">
            <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
                <div className="flex items-center gap-3">
                    <CalendarDays className="w-5 h-5 text-blue-600" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período para Limpeza</span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <select value={resetYear} onChange={e => setResetYear(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black uppercase outline-none">
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={resetMonth} onChange={e => setResetMonth(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-black uppercase outline-none">
                        {monthNames.map((m, i) => <option key={i+1} value={i+1}>{m.toUpperCase()}</option>)}
                    </select>
                    <button onClick={calculateBillingSummary} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md">
                        <RefreshCcw className={`w-4 h-4 ${isLoadingSummary ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-8 py-5">Representante</th>
                            <th className="px-6 py-5 text-right">Faturado Local</th>
                            <th className="px-8 py-5 text-right">Ação Crítica</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {isLoadingSummary ? (
                            <tr><td colSpan={3} className="px-8 py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" /></td></tr>
                        ) : reps.length === 0 ? (
                            <tr><td colSpan={3} className="px-8 py-20 text-center text-slate-300 font-bold uppercase">Nenhum rep cadastrado</td></tr>
                        ) : (
                            reps.map(rep => {
                                const value = billingSummary[rep.id] || 0;
                                return (
                                    <tr key={rep.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-5"><p className="font-black text-slate-800 uppercase text-xs">{rep.nome}</p></td>
                                        <td className="px-6 py-5 text-right font-black text-slate-900 text-sm tabular-nums">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}</td>
                                        <td className="px-8 py-5 text-right">
                                            <button onClick={() => setConfirmResetId(rep.id)} disabled={value === 0 || isProcessing} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ml-auto ${value > 0 ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white shadow-sm' : 'bg-slate-50 text-slate-300 cursor-not-allowed'}`}>
                                                <RotateCcw className="w-3.5 h-3.5" /> Resetar Dados
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {confirmResetId && createPortal(
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
              <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-slideUp text-center border border-white/20">
                  <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-10 h-10" /></div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Excluir Dados</h3>
                  <p className="text-sm text-slate-500 mt-4 font-medium leading-relaxed">Você está prestes a apagar <strong>TODO</strong> o faturamento de <span className="text-red-600 font-bold">{reps.find(r => r.id === confirmResetId)?.nome}</span> em <span className="text-slate-900 font-black">{monthNames[resetMonth-1]} / {resetYear}</span>.</p>
                  <div className="grid grid-cols-2 gap-4 mt-8">
                      <Button variant="outline" onClick={() => setConfirmResetId(null)} className="rounded-2xl h-14 font-black uppercase text-[10px]">Cancelar</Button>
                      <Button onClick={executeReset} className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black uppercase text-[10px]">Sim, Apagar</Button>
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};