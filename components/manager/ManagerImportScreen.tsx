
import React, { useState, useRef, useEffect } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Loader2, Database, Users, BarChart3, X, UserPlus, RefreshCcw, CopyX } from 'lucide-react';
import XLSX from 'xlsx';
import { Button } from '../Button';
import { supabase } from '../../lib/supabase';

export const ManagerImportScreen: React.FC = () => {
  const [selectedRepId, setSelectedRepId] = useState('');
  const [reps, setReps] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentAction, setCurrentAction] = useState('');
  const [currentItemName, setCurrentItemName] = useState('');
  
  const [stats, setStats] = useState({
    totalRows: 0,
    uniqueClientsDetected: 0,
    newClientsInserted: 0,
    processedRows: 0,
    ignoredRows: 0,
  });

  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchReps = async () => {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nome, nivel_acesso')
        .not('nivel_acesso', 'ilike', 'admin')
        .not('nivel_acesso', 'ilike', 'gerente')
        .order('nome');
      setReps(data || []);
    };
    fetchReps();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStatus({ type: 'idle', message: '' });
    }
  };

  const cleanCnpj = (val: any) => String(val || '').replace(/\D/g, '');

  const generateRowFingerprint = (row: any) => {
    return `${cleanCnpj(row.cnpj)}|${row.data}|${row.pedido}|${row.nota_fiscal}|${row.codigo_produto}|${row.faturamento}|${row.qtde_faturado}`;
  };

  // Função para encontrar valor em colunas com nomes parecidos
  const getVal = (row: any, keys: string[]) => {
    const foundKey = Object.keys(row).find(k => keys.some(key => k.toLowerCase().trim() === key.toLowerCase().trim()));
    return foundKey ? row[foundKey] : null;
  };

  const processImport = async () => {
    if (!file || !selectedRepId) return;
    setIsProcessing(true);
    setProgress(0);
    setStatus({ type: 'idle', message: '' });
    setStats({ totalRows: 0, uniqueClientsDetected: 0, newClientsInserted: 0, processedRows: 0, ignoredRows: 0 });

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) throw new Error('A planilha está vazia.');

      setCurrentAction('Normalizando dados e mapeando colunas...');
      const uniqueClientsInFile = new Map();
      const datesInFile: string[] = [];

      const normalizedData = jsonData.map(row => {
        const cnpj = cleanCnpj(getVal(row, ['CNPJ', 'C.N.P.J', 'CGC']));
        const nome = String(getVal(row, ['Cliente', 'Razão Social', 'Nome Fantasia']) || '').trim();
        const canal = String(getVal(row, ['Canal Vendas', 'Canal', 'Canal de Vendas']) || '').trim();
        const grupo = String(getVal(row, ['Grupo', 'Grupo Econômico', 'Rede']) || '').trim();
        
        let rawDate = getVal(row, ['Data', 'Emissão', 'Data Faturamento']);
        let formattedDate = typeof rawDate === 'number' 
          ? new Date(Math.round((rawDate - 25569) * 86400 * 1000)).toISOString().split('T')[0]
          : new Date(rawDate).toISOString().split('T')[0];

        if (cnpj && nome) {
          uniqueClientsInFile.set(cnpj, { 
            usuario_id: selectedRepId, 
            nome_fantasia: nome, 
            cnpj: cnpj, 
            ativo: true,
            canal_vendas: canal !== 'null' ? canal : null,
            grupo: grupo !== 'null' ? grupo : null
          });
        }
        if (!datesInFile.includes(formattedDate)) datesInFile.push(formattedDate);

        return {
          ...row,
          data: formattedDate,
          cnpj: cnpj,
          canal: canal,
          grupo: grupo,
          faturamento: parseFloat(String(getVal(row, ['Faturamento', 'Valor Total', 'Venda Liquida']) || '0').replace(',', '.')),
          qtde_faturado: parseFloat(String(getVal(row, ['Qtde faturado', 'Quantidade', 'Qtd']) || '0').replace(',', '.')),
          pedido: String(getVal(row, ['Pedido', 'Nr. Pedido']) || ''),
          nota_fiscal: String(getVal(row, ['Nota Fiscal', 'NF', 'Danfe']) || ''),
          codigo_produto: String(getVal(row, ['Codigo Produto', 'Cod. Prod', 'SKU']) || ''),
          produto: String(getVal(row, ['Produto', 'Descrição', 'Item']) || ''),
          bonificado: String(getVal(row, ['Bonificado', 'Bonificação']) || '').toLowerCase().includes('sim'),
          qtde_bonificada: parseFloat(String(getVal(row, ['Qtde bonificada', 'Qtd Bonif']) || '0').replace(',', '.'))
        };
      });

      const clientsDetected = Array.from(uniqueClientsInFile.values());
      setStats(prev => ({ ...prev, totalRows: jsonData.length, uniqueClientsDetected: clientsDetected.length }));

      // 1. Cadastrar clientes novos
      setCurrentAction('Sincronizando carteira de clientes...');
      const { data: existingClients } = await supabase.from('clientes').select('id, cnpj').eq('usuario_id', selectedRepId);
      const existingCnpjsMap = new Map(existingClients?.map(c => [cleanCnpj(c.cnpj), c.id]) || []);
      
      const newClients = clientsDetected.filter(c => !existingCnpjsMap.has(c.cnpj));
      if (newClients.length > 0) {
        await supabase.from('clientes').insert(newClients);
      }

      // 2. Buscar TODOS os clientes (agora com os novos) para ter o cliente_id
      setCurrentAction('Vinculando registros...');
      const { data: allClients } = await supabase.from('clientes').select('id, cnpj').eq('usuario_id', selectedRepId);
      const cnpjToIdMap = new Map(allClients?.map(c => [cleanCnpj(c.cnpj), c.id]) || []);

      // 3. Buscar vendas existentes para evitar duplicidade
      const { data: existingSales } = await supabase
        .from('dados_vendas')
        .select('cnpj, data, pedido, nota_fiscal, codigo_produto, faturamento, qtde_faturado')
        .eq('usuario_id', selectedRepId)
        .in('data', datesInFile);

      const existingFingerprints = new Set(existingSales?.map(s => generateRowFingerprint(s)) || []);

      // 4. Inserir vendas vinculadas
      setCurrentAction('Salvando faturamento detalhado...');
      const salesBatchSize = 200;
      let totalVendasSalvas = 0;
      let totalIgnoradas = 0;

      for (let i = 0; i < normalizedData.length; i += salesBatchSize) {
        const batch = normalizedData.slice(i, i + salesBatchSize);
        
        const toInsert = batch.filter(row => {
          const fingerprint = generateRowFingerprint(row);
          if (existingFingerprints.has(fingerprint)) {
            totalIgnoradas++;
            return false;
          }
          return true;
        }).map(row => ({
          data: row.data,
          pedido: row.pedido,
          nota_fiscal: row.nota_fiscal,
          usuario_id: selectedRepId,
          cliente_id: cnpjToIdMap.get(row.cnpj), // VÍNCULO OBRIGATÓRIO
          cnpj: row.cnpj,
          cliente_nome: row.nome,
          canal_vendas: row.canal !== 'null' ? row.canal : null,
          grupo: row.grupo !== 'null' ? row.grupo : null,
          codigo_produto: row.codigo_produto,
          produto: row.produto,
          faturamento: row.faturamento,
          qtde_faturado: row.qtde_faturado,
          bonificado: row.bonificado,
          qtde_bonificada: row.qtde_bonificada
        }));

        if (toInsert.length > 0) {
          setCurrentItemName(toInsert[0].cliente_nome);
          const { error } = await supabase.from('dados_vendas').insert(toInsert);
          if (error) throw error;
          totalVendasSalvas += toInsert.length;
        }

        setStats(prev => ({ ...prev, processedRows: totalVendasSalvas, ignoredRows: totalIgnoradas, newClientsInserted: newClients.length }));
        setProgress(Math.round(((i + batch.length) / normalizedData.length) * 100));
      }

      setStatus({ 
        type: 'success', 
        message: `Sucesso! ${totalVendasSalvas} vendas vinculadas e ${newClients.length} novos clientes.` 
      });
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      setStatus({ type: 'error', message: err.message || 'Erro crítico na importação.' });
    } finally {
      setIsProcessing(false);
      setCurrentItemName('');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      <div className="bg-white px-8 py-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Importar Faturamento</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vinculação Automática de Clientes e Verbas</p>
          </div>
        </div>
        <div className="bg-slate-900 px-4 py-2 rounded-xl border border-white/10">
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Integridade</p>
            <p className="text-xs font-black text-white">Vínculo ID Ativo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-blue-600" /> Destino
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">Vendedor</label>
                <select 
                  value={selectedRepId}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all appearance-none"
                >
                  <option value="">Selecione...</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
                </select>
              </div>
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-[10px] text-blue-700 font-bold leading-relaxed uppercase tracking-tight">
                O sistema buscará o ID do cliente pelo CNPJ automaticamente.
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {!isProcessing ? (
            <div className="bg-white p-8 rounded-[36px] border border-slate-200 shadow-xl flex flex-col items-center justify-center text-center space-y-8 group transition-all">
              <div 
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className="w-full cursor-pointer flex flex-col items-center p-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] hover:bg-blue-50/50 hover:border-blue-400 transition-all group/box"
              >
                <div className="w-12 h-12 bg-white rounded-2xl shadow-md flex items-center justify-center mb-4 group-hover/box:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-blue-600" />
                </div>
                <h4 className="text-lg font-black text-slate-800 tracking-tight">
                  {file ? file.name : 'Selecionar Arquivo'}
                </h4>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Excel (XLSX, XLS) ou CSV</p>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
              </div>

              {status.message && (
                <div className={`w-full p-4 rounded-2xl text-[10px] font-black flex items-center gap-3 animate-slideUp border ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                  {status.type === 'success' ? <CheckCircle2 className="w-4 h-4"/> : <AlertTriangle className="w-4 h-4"/>}
                  <span className="uppercase tracking-widest">{status.message}</span>
                </div>
              )}

              <Button 
                fullWidth 
                size="lg" 
                onClick={processImport}
                disabled={!file || !selectedRepId}
                className="h-14 text-sm font-black shadow-xl shadow-blue-500/20 rounded-2xl"
              >
                Processar e Vincular <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-[36px] p-8 shadow-2xl border border-white/10 text-white space-y-8 animate-fadeIn overflow-hidden">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-400 block mb-1">{currentAction}</span>
                  <h5 className="text-md font-black text-white truncate max-w-xs">{currentItemName || 'Sincronizando...'}</h5>
                </div>
                <span className="text-3xl font-black text-white tabular-nums">{progress}%</span>
              </div>
              
              <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-1">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${progress}%` }}></div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <Users className="w-4 h-4 text-blue-400 mx-auto mb-2" />
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Novos Clientes</p>
                    <p className="text-lg font-black text-white tabular-nums">{stats.newClientsInserted}</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <BarChart3 className="w-4 h-4 text-emerald-400 mx-auto mb-2" />
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Vendas Novas</p>
                    <p className="text-lg font-black text-white tabular-nums">{stats.processedRows}</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <CopyX className="w-4 h-4 text-amber-400 mx-auto mb-2" />
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ignorados</p>
                    <p className="text-lg font-black text-amber-400 tabular-nums">{stats.ignoredRows}</p>
                 </div>
                 <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                    <RefreshCcw className="w-4 h-4 text-purple-400 mx-auto mb-2" />
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Linhas</p>
                    <p className="text-lg font-black text-white tabular-nums">{stats.totalRows}</p>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
