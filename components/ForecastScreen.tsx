import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, AlertTriangle, TrendingUp, Calendar, Search, X, ChevronRight, Eye, CheckCircle2, XCircle, RefreshCw, PenTool } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { clients, getClientCurrentTarget, ForecastItem, ForecastEntry, Client, addForecast, mockForecasts } from '../lib/mockData';
import { createPortal } from 'react-dom';

interface ForecastScreenProps {
  initialForecastId?: string | null;
  onDraftLoaded?: () => void;
}

export const ForecastScreen: React.FC<ForecastScreenProps> = ({ initialForecastId, onDraftLoaded }) => {
  // Estado do Formulário
  const [selectedClientId, setSelectedClientId] = useState('');
  const [forecastValue, setForecastValue] = useState('');
  
  // Estado dos Dados
  const [draftItems, setDraftItems] = useState<ForecastItem[]>([]);
  // Inicializa o histórico com dados globais do mock para o representante atual (rep-1)
  const [history, setHistory] = useState<ForecastEntry[]>(() => 
      mockForecasts
        .filter(f => f.repId === 'rep-1')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  );
  
  // Estado dos Modais
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<ForecastItem | null>(null);
  const [detailModalItem, setDetailModalItem] = useState<ForecastEntry | null>(null);

  // Efeito para carregar rascunho automaticamente se vier de notificação
  useEffect(() => {
    if (initialForecastId) {
        const target = mockForecasts.find(f => f.id === initialForecastId);
        if (target) {
            // Carrega itens no rascunho
            setDraftItems(target.items);
            // Avisa o pai que carregou (para limpar o ID)
            if (onDraftLoaded) onDraftLoaded();
        }
    }
  }, [initialForecastId, onDraftLoaded]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Calcula totais
  const draftTotal = draftItems.reduce((acc, curr) => acc + curr.forecastValue, 0);
  
  // Calcula cobertura da carteira
  const totalClientsInPortfolio = clients.length;
  const coveragePercent = totalClientsInPortfolio > 0 
    ? (draftItems.length / totalClientsInPortfolio) * 100 
    : 0;

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || !forecastValue) return;

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    const numValue = parseFloat(forecastValue.replace(/\./g, '').replace(',', '.')); // Ajuste simples para conversão
    if (isNaN(numValue)) return;

    const currentTarget = getClientCurrentTarget(client);

    const newItem: ForecastItem = {
      clientId: client.id,
      clientName: client.name,
      forecastValue: numValue,
      targetValue: currentTarget
    };

    // Validação: Valor menor que a meta?
    if (numValue < currentTarget) {
      setPendingItem(newItem);
      setWarningModalOpen(true);
    } else {
      confirmAddItem(newItem);
    }
  };

  const confirmAddItem = (item: ForecastItem) => {
    // Adiciona ou Atualiza se já existir o cliente na lista
    setDraftItems(prev => {
      const exists = prev.findIndex(i => i.clientId === item.clientId);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = item;
        return updated;
      }
      return [...prev, item];
    });

    // Reset form
    setSelectedClientId('');
    setForecastValue('');
    setPendingItem(null);
    setWarningModalOpen(false);
  };

  const handleSaveForecast = () => {
    if (draftItems.length === 0) return;

    const newEntry: ForecastEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      totalValue: draftTotal,
      items: [...draftItems],
      repId: 'rep-1', // Mock ID
      repName: 'Ricardo Souza', // Mock Name
      status: 'pending' // Novo status inicial
    };

    // Atualiza o "Banco de Dados" global
    addForecast(newEntry);

    // Atualiza a visualização local
    setHistory(prev => [newEntry, ...prev]);
    
    // Limpa o rascunho
    setDraftItems([]);
    setSelectedClientId('');
    setForecastValue('');
  };

  const handleDiscardForecast = () => {
    // Uso explícito de window.confirm para evitar ambiguidades
    if (window.confirm('Tem certeza que deseja descartar todos os itens da previsão atual?')) {
      setDraftItems([]);
      setSelectedClientId('');
      setForecastValue('');
    }
  };

  // Função para carregar itens de uma previsão recusada para edição
  const handleLoadDraftForCorrection = (entry: ForecastEntry) => {
      if (draftItems.length > 0) {
          if (!window.confirm('Você já tem itens no rascunho atual. Deseja substituí-los pela previsão selecionada para correção?')) {
              return;
          }
      }
      setDraftItems(entry.items);
      // Opcional: Remover do histórico ou marcar como "em correção", aqui apenas copiamos
      setDetailModalItem(null); // Fecha modal se aberto
      
      // Scroll para o topo para o usuário ver que carregou
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStatusIcon = (status: string) => {
      switch(status) {
          case 'approved': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
          case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
          default: return <div className="w-2 h-2 rounded-full bg-amber-400"></div>;
      }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fadeIn pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-600" />
            Previsão de Fechamento
          </h2>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Referência: {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA 1: Formulário e Rascunho Atual */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card de Input */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Adicionar Cliente na Previsão</h3>
            <form onSubmit={handleAddItem} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-48">
                 <label className="block text-sm font-medium text-slate-700 mb-1">Valor Previsto (R$)</label>
                 <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={forecastValue}
                    onChange={(e) => setForecastValue(e.target.value)}
                    required
                    step="0.01"
                    min="0"
                 />
              </div>
              <Button type="submit" className="w-full md:w-auto h-[46px]">
                <Plus className="w-5 h-5 md:mr-2" />
                <span className="hidden md:inline">Adicionar</span>
              </Button>
            </form>
          </div>

          {/* Lista de Rascunho (Previsão Atual) - Removido h-full, adicionado max-h no content */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Previsão em Construção</h3>
              
              <div className="flex items-center gap-3">
                  {/* Barra de progresso da cobertura */}
                  <div className="hidden sm:block w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                     <div 
                        className="h-full bg-blue-500 transition-all duration-500" 
                        style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                     ></div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-blue-700">
                        {draftItems.length} Clientes
                    </span>
                    <span className="text-xs text-blue-500 font-medium">
                        {coveragePercent.toFixed(1)}% da carteira
                    </span>
                  </div>
              </div>
            </div>
            
            {/* Altura máxima definida aqui para forçar scroll se crescer muito, sem empurrar o footer */}
            <div className="overflow-y-auto max-h-[350px]">
              {draftItems.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <TrendingUp className="w-12 h-12 mb-3 opacity-20" />
                  <p>Adicione clientes para montar sua previsão.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm relative">
                  <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
                    <tr className="text-slate-500">
                      <th className="py-3 px-6 font-medium bg-slate-50">Cliente</th>
                      <th className="py-3 px-6 font-medium text-right bg-slate-50">Meta</th>
                      <th className="py-3 px-6 font-medium text-right bg-slate-50">Previsão</th>
                      <th className="py-3 px-6 font-medium w-10 bg-slate-50"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draftItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 group">
                        <td className="py-3 px-6 font-medium text-slate-700">{item.clientName}</td>
                        <td className="py-3 px-6 text-right text-slate-500">{formatCurrency(item.targetValue)}</td>
                        <td className={`py-3 px-6 text-right font-bold ${item.forecastValue < item.targetValue ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {formatCurrency(item.forecastValue)}
                          {item.forecastValue < item.targetValue && (
                            <AlertTriangle className="w-3 h-3 inline ml-1 mb-0.5" />
                          )}
                        </td>
                        <td className="py-3 px-6 text-right">
                          <button 
                            type="button"
                            onClick={() => setDraftItems(prev => prev.filter((_, i) => i !== idx))}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer com Total e Ações */}
            {draftItems.length > 0 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 animate-slideUp">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-slate-500 font-medium text-sm">Total Previsto</span>
                  <span className="text-xl font-bold text-blue-700">{formatCurrency(draftTotal)}</span>
                </div>
                <div className="flex gap-3">
                  <Button 
                    type="button" // Importante: Previne submissão acidental
                    variant="outline" 
                    fullWidth 
                    onClick={handleDiscardForecast}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 h-10"
                  >
                    Descartar
                  </Button>
                  <Button 
                    type="button" // Importante: Previne submissão acidental
                    fullWidth 
                    onClick={handleSaveForecast}
                    className="h-10"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Enviar Previsão
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUNA 2: Histórico */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full max-h-[800px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Histórico de Envios</h3>
              <p className="text-xs text-slate-500 mt-1">Acompanhe o status</p>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  Nenhuma previsão salva ainda.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.map(entry => (
                    <div 
                      key={entry.id} 
                      className={`p-4 hover:bg-slate-50 transition-colors group border-l-4 ${entry.status === 'approved' ? 'border-emerald-500' : entry.status === 'rejected' ? 'border-red-500' : 'border-amber-400'}`}
                    >
                      <div className="flex justify-between items-start mb-2" onClick={() => setDetailModalItem(entry)}>
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded cursor-pointer">
                          {new Date(entry.date).toLocaleDateString('pt-BR')}
                        </span>
                        {getStatusIcon(entry.status)}
                      </div>
                      
                      <div className="flex justify-between items-end">
                        <div onClick={() => setDetailModalItem(entry)} className="cursor-pointer">
                          <p className="text-sm font-bold text-slate-800">{formatCurrency(entry.totalValue)}</p>
                          <p className="text-xs text-slate-500">{entry.items.length} clientes</p>
                        </div>
                        
                        {/* Botão de Ação Direta se Recusado */}
                        {entry.status === 'rejected' ? (
                            <button 
                                onClick={() => handleLoadDraftForCorrection(entry)}
                                className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 hover:shadow-sm transition-all flex items-center gap-1"
                                title="Corrigir previsão"
                            >
                                <PenTool className="w-4 h-4" />
                                <span className="text-[10px] font-bold">Corrigir</span>
                            </button>
                        ) : (
                            <div className="p-2 bg-white rounded-full border border-slate-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setDetailModalItem(entry)}>
                                <Eye className="w-4 h-4 text-blue-600" />
                            </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* --- MODAIS --- */}

      {/* Modal de Aviso (Meta) */}
      {warningModalOpen && pendingItem && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border-t-4 border-amber-500">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-amber-100 text-amber-600 rounded-full shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Atenção: Abaixo da Meta</h3>
                <p className="text-sm text-slate-600 mt-1">
                  O valor inserido <strong>({formatCurrency(pendingItem.forecastValue)})</strong> é inferior à meta estipulada para o cliente <strong>{pendingItem.clientName}</strong> ({formatCurrency(pendingItem.targetValue)}).
                </p>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-800 mb-6 text-center">
              Deseja confirmar essa previsão abaixo da meta?
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                fullWidth 
                type="button"
                onClick={() => setWarningModalOpen(false)}
              >
                Não, quero editar
              </Button>
              <Button 
                fullWidth 
                type="button"
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => confirmAddItem(pendingItem)}
              >
                Sim, confirmar
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Detalhes do Histórico */}
      {detailModalItem && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    Detalhes da Previsão
                    {detailModalItem.status === 'approved' && <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded">Aprovada</span>}
                    {detailModalItem.status === 'rejected' && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">Recusada</span>}
                </h3>
                <p className="text-sm text-slate-500">
                  Enviado em {new Date(detailModalItem.date).toLocaleString('pt-BR')}
                </p>
              </div>
              <button onClick={() => setDetailModalItem(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Aviso de Recusa se houver */}
            {detailModalItem.status === 'rejected' && (
                <div className="bg-red-50 p-4 border-b border-red-100">
                    <p className="text-sm text-red-800 font-bold mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4"/> Atenção: Previsão Recusada
                    </p>
                    <p className="text-sm text-red-700 italic mb-3">"{detailModalItem.rejectionReason}"</p>
                    <Button 
                        className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto shadow-md shadow-red-200"
                        onClick={() => handleLoadDraftForCorrection(detailModalItem)}
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Carregar itens para correção
                    </Button>
                </div>
            )}

            <div className="overflow-y-auto p-0 flex-1">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 sticky top-0 shadow-sm">
                  <tr className="text-slate-500">
                    <th className="py-3 px-6 font-medium">Cliente</th>
                    <th className="py-3 px-6 font-medium text-right">Meta</th>
                    <th className="py-3 px-6 font-medium text-right">Valor Previsto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailModalItem.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 px-6 font-medium text-slate-700">{item.clientName}</td>
                      <td className="py-3 px-6 text-right text-slate-500">{formatCurrency(item.targetValue)}</td>
                      <td className={`py-3 px-6 text-right font-bold ${item.forecastValue < item.targetValue ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {formatCurrency(item.forecastValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl text-right">
              <span className="text-sm text-slate-500 mr-2">Total desta previsão:</span>
              <strong className="text-xl text-slate-800">{formatCurrency(detailModalItem.totalValue)}</strong>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
};