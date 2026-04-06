import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, ShieldCheck, Loader2, RefreshCcw, RotateCcw, CalendarDays } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '../Button';
import { supabase } from '../../lib/supabase';
import { totalDataStore } from '../../lib/dataStore';
import { createPortal } from 'react-dom';

type ActiveTab = 'import' | 'reset';

interface Rep {
  id: string;
  nome: string;
  nivel_acesso: string;
}

interface ManagerImportScreenProps {
  updateTrigger?: number;
}

export const ManagerImportScreen: React.FC<ManagerImportScreenProps> = ({ updateTrigger = 0 }) => {
  const now = new Date();
  const [activeTab, setActiveTab] = useState<ActiveTab>('import');
  
  // Estados Importação
  const [reps, setReps] = useState<Rep[]>([]);
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

  const fetchReps = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, nivel_acesso')
      .not('nivel_acesso', 'ilike', 'admin')
      .not('nivel_acesso', 'ilike', 'gerente')
      .not('nivel_acesso', 'ilike', 'director')
      .not('nivel_acesso', 'ilike', 'diretor')
      .order('nome');
    setReps(data || []);
  };

  const calculateBillingSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
        const monthStr = String(resetMonth).padStart(2, '0');
        const lastDay = new Date(resetYear, resetMonth, 0).getDate();
        const start = `${resetYear}-${monthStr}-01`;
        const end = `${resetYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabase
            .from('dados_vendas')
            .select('usuario_id, faturamento')
            .gte('data', start)
            .lte('data', end);

        if (error) throw error;

        const summary: Record<string, number> = {};
        data?.forEach(s => {
            summary[s.usuario_id] = (summary[s.usuario_id] || 0) + Number(s.faturamento || 0);
        });
        setBillingSummary(summary);
    } catch (e) {
        console.error('Erro ao calcular resumo:', e);
    } finally {
        setIsLoadingSummary(false);
    }
  }, [resetMonth, resetYear]);

  useEffect(() => {
    void updateTrigger;
    fetchReps();
  }, [updateTrigger]);

  useEffect(() => {
    if (activeTab === 'reset') calculateBillingSummary();
  }, [activeTab, calculateBillingSummary]);

  const executeReset = async () => {
    if (!confirmResetId) return;
    setIsProcessing(true);
    try {
        const monthStr = String(resetMonth).padStart(2, '0');
        const lastDay = new Date(resetYear, resetMonth, 0).getDate();
        const start = `${resetYear}-${monthStr}-01`;
        const end = `${resetYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        let query = supabase
            .from('dados_vendas')
            .delete()
            .gte('data', start)
            .lte('data', end);
            
        if (confirmResetId !== 'all') {
            query = query.eq('usuario_id', confirmResetId);
        }

        const { error } = await query;

        if (error) throw error;

        setConfirmResetId(null);
        
        // Clear store to force re-fetch
        totalDataStore.sales = [];
        totalDataStore.fetchedMonths.clear();
        totalDataStore.vendasConsolidadas = [];
        totalDataStore.vendasClientesMes = [];
        totalDataStore.vendasCanaisMes = [];
        totalDataStore.vendasProdutosMes = [];
        
        // Trigger update across the app
        window.dispatchEvent(new CustomEvent('pcn_data_update'));
        
        await calculateBillingSummary();
        alert('Dados removidos com sucesso!');
    } catch (e: unknown) {
        alert('Erro ao resetar: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        setIsProcessing(false);
    }
  };

  const cleanCnpj = (val: string | number | null | undefined) => String(val || '').replace(/\D/g, '');
  const normalizeRepName = (name: string) => name ? name.split('(')[0].trim().toUpperCase() : "";

  const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

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
      setCurrentAction('Lendo arquivo Excel...');
      await yieldToMain();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const X = (XLSX as any).utils ? XLSX : (XLSX as any).default;
      const data = await file.arrayBuffer();
      
      // Otimização de leitura: desativar formatação pesada
      const workbook = X.read(data, { 
        type: 'array', 
        cellDates: true, 
        cellNF: false, 
        cellText: false 
      });
      
      setCurrentAction('Convertendo dados...');
      await yieldToMain();
      const jsonData: Record<string, unknown>[] = X.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      if (jsonData.length === 0) throw new Error('A planilha está vazia.');
      setStats(prev => ({ ...prev, totalRows: jsonData.length }));
      await yieldToMain();

      // 1. Mapeamento de Colunas Otimizado (evita Object.keys repetidos)
      const columnMap = new Map<string, string>();
      const firstRow = jsonData[0];
      const allKeys = Object.keys(firstRow);
      const fieldConfigs = [
          { name: 'rep', keys: ['Representante', 'Vendedor', 'RCA'] },
          { name: 'date', keys: ['Data', 'Emissão', 'Data Faturamento'] },
          { name: 'cnpj', keys: ['CNPJ', 'C.N.P.J', 'CGC'] },
          { name: 'client', keys: ['Cliente', 'Razão Social', 'Nome Fantasia'] },
          { name: 'order', keys: ['Pedido', 'Nr. Pedido'] },
          { name: 'invoice', keys: ['Nota Fiscal', 'NF', 'Danfe'] },
          { name: 'sku', keys: ['Codigo Produto', 'Cod. Prod', 'SKU'] },
          { name: 'product', keys: ['Produto', 'Descrição', 'Item'] },
          { name: 'billing', keys: ['Faturamento', 'Valor Total', 'Venda Liquida'] },
          { name: 'qty', keys: ['Qtde faturado', 'Quantidade', 'Qtd'] },
          { name: 'channel', keys: ['Canal Vendas', 'Canal', 'Canal de Vendas'] },
          { name: 'group', keys: ['Grupo', 'Grupo Econômico', 'Rede'] }
      ];
      fieldConfigs.forEach(f => {
          const found = allKeys.find(k => f.keys.some(key => k.toLowerCase().trim() === key.toLowerCase().trim()));
          if (found) columnMap.set(f.name, found);
      });

      const repNameToIdMap = new Map<string, string>();
      reps.forEach(r => repNameToIdMap.set(normalizeRepName(r.nome), r.id));

      // 2. Normalização e Agrupamento
      setCurrentAction('Mapeando representantes...');
      const dataByRep = new Map<string, Record<string, unknown>[]>();
      const allRelevantMonths = new Set<string>();
      const allRelevantRepIds = new Set<string>();

      for (let i = 0; i < jsonData.length; i += 1000) {
        const chunk = jsonData.slice(i, i + 1000);
        chunk.forEach(row => {
          const rawRepName = String(row[columnMap.get('rep') || ''] || '');
          const repId = repNameToIdMap.get(normalizeRepName(rawRepName));
          if (!repId) return;

          const rawDate = row[columnMap.get('date') || ''];
          let formattedDate = '';
          try {
              if (rawDate instanceof Date) {
                  formattedDate = rawDate.toISOString().split('T')[0];
              } else if (typeof rawDate === 'number') {
                  formattedDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000)).toISOString().split('T')[0];
              } else if (rawDate) {
                  formattedDate = new Date(String(rawDate)).toISOString().split('T')[0];
              }
          } catch { return; }
          if (!formattedDate || formattedDate === 'NaN-NaN-NaN') return;

          const d = new Date(formattedDate + 'T00:00:00');
          allRelevantMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
          allRelevantRepIds.add(repId);

          const normalized: Record<string, unknown> = {
            usuario_id: repId,
            cnpj: cleanCnpj(row[columnMap.get('cnpj') || ''] as string | number),
            cliente_nome: String(row[columnMap.get('client') || ''] || '').trim(),
            data: formattedDate,
            pedido: String(row[columnMap.get('order') || ''] || '').trim(),
            nota_fiscal: String(row[columnMap.get('invoice') || ''] || '').trim(),
            codigo_produto: String(row[columnMap.get('sku') || ''] || '').trim(),
            produto: String(row[columnMap.get('product') || ''] || '').trim(),
            faturamento: parseFloat(String(row[columnMap.get('billing') || ''] || '0').replace(',', '.')),
            qtde_faturado: parseFloat(String(row[columnMap.get('qty') || ''] || '0').replace(',', '.')),
            canal_vendas: String(row[columnMap.get('channel') || ''] || '').trim(),
            grupo: String(row[columnMap.get('group') || ''] || '').trim()
          };
          if (!dataByRep.has(repId)) dataByRep.set(repId, []);
          dataByRep.get(repId)?.push(normalized);
        });
        setProgress(Math.round((i / jsonData.length) * 10));
        await yieldToMain();
      }

      // 3. Verificação de Duplicidades (Batch por Mês e Reps)
      setCurrentAction('Verificando duplicidades...');
      const existingFingerprints = new Set<string>();
      const monthPairs = Array.from(allRelevantMonths).map(m => {
          const [y, mon] = m.split('-').map(Number);
          return { year: y, month: mon };
      });
      const repIdsList = Array.from(allRelevantRepIds);

      for (let mIdx = 0; mIdx < monthPairs.length; mIdx++) {
          const { year, month } = monthPairs[mIdx];
          const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
          const endDate = new Date(year, month, 0).toISOString().split('T')[0];
          
          // Buscar em blocos de representantes para não estourar a URL da query
          for (let k = 0; k < repIdsList.length; k += 15) {
              const currentReps = repIdsList.slice(k, k + 15);
              const { data: monthData, error } = await supabase.from('dados_vendas')
                  .select('cnpj, data, pedido, nota_fiscal, codigo_produto, faturamento, qtde_faturado')
                  .in('usuario_id', currentReps)
                  .gte('data', startDate)
                  .lte('data', endDate);
              
              if (error) console.error('Erro ao buscar vendas:', error);
              monthData?.forEach(s => {
                  const f = `${cleanCnpj(s.cnpj)}|${String(s.data).split('T')[0]}|${String(s.codigo_produto || '').trim().toUpperCase()}|${Number(s.qtde_faturado || 0).toFixed(2)}|${Number(s.faturamento || 0).toFixed(2)}`;
                  existingFingerprints.add(f);
              });
              await yieldToMain();
          }
          setProgress(10 + Math.round(((mIdx + 1) / monthPairs.length) * 20));
      }

      // 4. Sincronização de Clientes (Batch)
      setCurrentAction('Sincronizando clientes...');
      const existingClientsSet = new Set<string>();
      for (let k = 0; k < repIdsList.length; k += 20) {
          const { data: cData } = await supabase.from('clientes').select('cnpj, usuario_id').in('usuario_id', repIdsList.slice(k, k + 20));
          cData?.forEach(c => existingClientsSet.add(`${c.usuario_id}|${cleanCnpj(c.cnpj)}`));
          await yieldToMain();
      }

      const newClientsToInsert: Record<string, unknown>[] = [];
      dataByRep.forEach((rows, repId) => {
          const uniqueInFile = new Map();
          rows.forEach(r => {
              if (r.cnpj && !existingClientsSet.has(`${repId}|${r.cnpj}`)) {
                  uniqueInFile.set(r.cnpj, { 
                      usuario_id: repId, nome_fantasia: r.cliente_nome, cnpj: r.cnpj, 
                      ativo: true, canal_vendas: r.canal_vendas !== 'null' ? r.canal_vendas : null, 
                      grupo: r.grupo !== 'null' ? r.grupo : null 
                  });
              }
          });
          uniqueInFile.forEach(c => {
              newClientsToInsert.push(c);
              existingClientsSet.add(`${repId}|${c.cnpj}`); // Evitar duplicatas no mesmo insert
          });
      });

      if (newClientsToInsert.length > 0) {
          for (let k = 0; k < newClientsToInsert.length; k += 100) {
              await supabase.from('clientes').insert(newClientsToInsert.slice(k, k + 100));
              await yieldToMain();
          }
          setStats(prev => ({ ...prev, newClientsInserted: newClientsToInsert.length }));
      }
      setProgress(40);

      // 5. Inserção de Vendas Otimizada
      setCurrentAction('Importando vendas...');
      let totalNewSales = 0;
      let totalIgnored = 0;
      const allToInsert: Record<string, unknown>[] = [];

      dataByRep.forEach((rows) => {
          rows.forEach(row => {
              const f = `${row.cnpj}|${row.data}|${String(row.codigo_produto || '').trim().toUpperCase()}|${Number(row.qtde_faturado || 0).toFixed(2)}|${Number(row.faturamento || 0).toFixed(2)}`;
              if (existingFingerprints.has(f)) {
                  totalIgnored++;
              } else {
                  existingFingerprints.add(f);
                  allToInsert.push(row);
              }
          });
      });

      if (allToInsert.length > 0) {
          for (let k = 0; k < allToInsert.length; k += 500) {
              const chunk = allToInsert.slice(k, k + 500);
              const { error } = await supabase.from('dados_vendas').insert(chunk);
              if (error) throw error;
              totalNewSales += chunk.length;
              setProgress(40 + Math.round((k / allToInsert.length) * 60));
              await yieldToMain();
          }
      }

      setStats(prev => ({ ...prev, processedRows: totalNewSales, ignoredRows: totalIgnored }));
      setStatus({ type: 'success', message: `Concluído! ${totalNewSales} novas vendas importadas. ${totalIgnored} duplicados ignorados.` });
      setFile(null);
      setProgress(100);
      
      // Limpar cache local para forçar atualização
      totalDataStore.sales = [];
      totalDataStore.fetchedMonths.clear();
      window.dispatchEvent(new CustomEvent('pcn_data_update'));

    } catch (err: unknown) {
      const error = err as Error;
      console.error('Erro na importação:', error);
      setStatus({ type: 'error', message: error.message || 'Erro no processamento.' });
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
                <div className="p-4 border-b border-slate-100 flex justify-end bg-slate-50/50">
                    <button 
                        onClick={() => setConfirmResetId('all')} 
                        disabled={Object.values(billingSummary).reduce((a, b) => a + b, 0) === 0 || isProcessing} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${Object.values(billingSummary).reduce((a, b) => a + b, 0) > 0 ? 'bg-red-600 text-white hover:bg-red-700 shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    >
                        <RotateCcw className="w-4 h-4" /> Apagar Todos do Mês
                    </button>
                </div>
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
                  <p className="text-sm text-slate-500 mt-4 font-medium leading-relaxed">
                    Você está prestes a apagar <strong>TODO</strong> o faturamento de <span className="text-red-600 font-bold">{confirmResetId === 'all' ? 'TODOS OS REPRESENTANTES' : reps.find(r => r.id === confirmResetId)?.nome}</span> em <span className="text-slate-900 font-black">{monthNames[resetMonth-1]} / {resetYear}</span>.
                  </p>
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