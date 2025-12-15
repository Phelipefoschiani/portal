import React, { useState } from 'react';
import { Megaphone, Save, Wallet, CheckCircle2, CreditCard, Package, Banknote, Percent, FileText } from 'lucide-react';
import { Button } from './Button';
import { clients, addInvestment, getAvailableBudget, InvestmentChannel } from '../lib/mockData';
import { createPortal } from 'react-dom';

export const CampaignsScreen: React.FC = () => {
  // Estado do Formulário
  const [selectedClientId, setSelectedClientId] = useState('');
  const [description, setDescription] = useState(''); // Estado para Descrição
  const [orderValue, setOrderValue] = useState('');
  
  // Estado do Investimento (Múltiplos Canais)
  const [cajuValue, setCajuValue] = useState('');
  const [productValue, setProductValue] = useState('');
  const [moneyValue, setMoneyValue] = useState('');

  // Estado do Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  // Helper para converter string formatada em número
  const parseCurrencyInput = (val: string) => parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0;

  // Lógica de Cálculo
  const getCalculatedValues = () => {
    const orderNum = parseCurrencyInput(orderValue);
    const cajuNum = parseCurrencyInput(cajuValue);
    const productNum = parseCurrencyInput(productValue);
    const moneyNum = parseCurrencyInput(moneyValue);

    const totalInvestment = cajuNum + productNum + moneyNum;
    const finalPercentage = orderNum > 0 ? (totalInvestment / orderNum) * 100 : 0;

    return { orderNum, cajuNum, productNum, moneyNum, totalInvestment, finalPercentage };
  };

  const { orderNum, cajuNum, productNum, moneyNum, totalInvestment, finalPercentage } = getCalculatedValues();

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || orderNum <= 0 || totalInvestment <= 0 || !description.trim()) return;
    setIsConfirmModalOpen(true);
  };

  const handleConfirm = () => {
    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    // Constrói os canais
    const channels: InvestmentChannel[] = [];
    if (cajuNum > 0) channels.push({ type: 'Caju', value: cajuNum });
    if (productNum > 0) channels.push({ type: 'Produto', value: productNum });
    if (moneyNum > 0) channels.push({ type: 'Dinheiro', value: moneyNum });

    // Adiciona aos investimentos (Mock)
    addInvestment({
        clientId: client.id,
        clientName: client.name,
        description: description, // Usa a descrição digitada
        channels: channels,
        approvedBy: undefined // Pendente
    });

    // Feedback e Reset
    setIsConfirmModalOpen(false);
    setSuccessMessage('Solicitação de campanha enviada com sucesso!');
    
    // Reset form
    setTimeout(() => {
        setSuccessMessage('');
        setSelectedClientId('');
        setDescription('');
        setOrderValue('');
        setCajuValue('');
        setProductValue('');
        setMoneyValue('');
    }, 3000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fadeIn pb-12">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Megaphone className="w-7 h-7 text-blue-600" />
          Lançamento de Campanha
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Solicite verbas comerciais vinculadas a um pedido específico. Você pode combinar formas de pagamento.
        </p>
      </div>

      {successMessage && (
         <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-200 flex items-center gap-3 animate-slideUp">
             <CheckCircle2 className="w-6 h-6" />
             <span className="font-medium">{successMessage}</span>
         </div>
      )}

      {/* Main Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
            
            <form onSubmit={handlePreSubmit} className="space-y-6">
                
                {/* 1. Seleção de Cliente */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">1. Selecione o Cliente</label>
                    <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        required
                    >
                        <option value="">Buscar cliente...</option>
                        {clients.map(client => (
                            <option key={client.id} value={client.id}>{client.name} - {client.city}</option>
                        ))}
                    </select>
                </div>

                 {/* 2. Descrição (ALTERADO) */}
                 <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">2. Descrição da Campanha</label>
                    <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descreva o investimento (Ex: Bonificação em Cimento, Desconto Comercial...)"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                        rows={2}
                        required
                    />
                </div>

                {/* 3. Valor do Pedido */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">3. Valor Total do Pedido (R$)</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <span className="text-slate-400 font-bold">R$</span>
                        </div>
                        <input 
                            type="number"
                            placeholder="0,00"
                            value={orderValue}
                            onChange={(e) => setOrderValue(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                            min="0.01"
                            step="0.01"
                        />
                    </div>
                </div>

                {/* 4. Investimento por Canais */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                        <label className="text-sm font-semibold text-slate-700">4. Composição do Investimento</label>
                        <span className="text-xs text-slate-400">Preencha os canais desejados</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Cartão Caju */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <CreditCard className="w-3 h-3 text-pink-500" /> Cartão Caju
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">R$</div>
                                <input 
                                    type="number"
                                    placeholder="0,00"
                                    value={cajuValue}
                                    onChange={(e) => setCajuValue(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-pink-200 focus:border-pink-400 outline-none"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        </div>

                        {/* Produto */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Package className="w-3 h-3 text-blue-500" /> Produto
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">R$</div>
                                <input 
                                    type="number"
                                    placeholder="0,00"
                                    value={productValue}
                                    onChange={(e) => setProductValue(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        </div>

                        {/* Dinheiro */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Banknote className="w-3 h-3 text-emerald-500" /> Dinheiro
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 text-xs">R$</div>
                                <input 
                                    type="number"
                                    placeholder="0,00"
                                    value={moneyValue}
                                    onChange={(e) => setMoneyValue(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Totalizador */}
                    <div className="bg-slate-50 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 border border-slate-200">
                        <div className="text-center sm:text-left">
                            <p className="text-xs text-slate-500 uppercase font-bold">Total do Investimento</p>
                            <p className="text-2xl font-bold text-blue-700">{formatCurrency(totalInvestment)}</p>
                        </div>
                        
                        {orderNum > 0 && totalInvestment > 0 && (
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
                                <div className="p-1.5 bg-blue-100 rounded-full text-blue-600">
                                    <Percent className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Representatividade</p>
                                    <p className="text-sm font-bold text-slate-800">{finalPercentage.toFixed(2)}% do Pedido</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4">
                    <Button type="submit" fullWidth size="lg" className="h-12 text-base shadow-xl shadow-blue-200" disabled={totalInvestment <= 0}>
                        <Save className="w-5 h-5 mr-2" />
                        Simular e Salvar Solicitação
                    </Button>
                </div>
            </form>
        </div>
        <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100">
            A solicitação ficará pendente de aprovação gerencial na aba Investimentos.
        </div>
      </div>

      {/* --- MODAL DE CONFIRMAÇÃO --- */}
      {isConfirmModalOpen && (
        createPortal(
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    
                    <div className="bg-slate-50 p-6 border-b border-slate-100 text-center">
                        <h3 className="text-xl font-bold text-slate-800">Resumo da Solicitação</h3>
                        <p className="text-sm text-slate-500 mt-1">Confira os dados antes de enviar</p>
                    </div>

                    <div className="p-6 space-y-4">
                        {/* Cliente */}
                        <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                            <span className="text-sm text-slate-500">Cliente</span>
                            <span className="font-semibold text-slate-800 text-right max-w-[200px] truncate">
                                {clients.find(c => c.id === selectedClientId)?.name}
                            </span>
                        </div>

                         {/* Pedido */}
                         <div className="flex justify-between items-center pb-4 border-b border-slate-50">
                            <span className="text-sm text-slate-500">Valor do Pedido</span>
                            <span className="font-bold text-slate-800 text-lg">
                                {formatCurrency(orderNum)}
                            </span>
                        </div>

                        {/* Descrição */}
                        <div className="pb-4 border-b border-slate-50">
                            <span className="text-xs text-slate-500 uppercase font-bold mb-1 block">Descrição</span>
                            <p className="text-sm text-slate-700 italic bg-slate-50 p-2 rounded">"{description}"</p>
                        </div>

                        {/* Investimento Breakdown */}
                        <div className="bg-blue-50 p-4 rounded-xl space-y-3">
                             <div className="flex justify-between items-center text-blue-800 mb-2">
                                <span className="font-medium">Total Solicitado</span>
                                <span className="font-bold text-xl">{formatCurrency(totalInvestment)}</span>
                             </div>
                             
                             {/* Breakdown Items */}
                             <div className="space-y-1 pl-2 border-l-2 border-blue-200">
                                {cajuNum > 0 && (
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>• Cartão Caju</span>
                                        <span className="font-medium">{formatCurrency(cajuNum)}</span>
                                    </div>
                                )}
                                {productNum > 0 && (
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>• Produto</span>
                                        <span className="font-medium">{formatCurrency(productNum)}</span>
                                    </div>
                                )}
                                {moneyNum > 0 && (
                                    <div className="flex justify-between text-xs text-slate-600">
                                        <span>• Dinheiro</span>
                                        <span className="font-medium">{formatCurrency(moneyNum)}</span>
                                    </div>
                                )}
                             </div>

                             <div className="flex justify-between items-center text-xs text-blue-600 pt-2 border-t border-blue-100/50">
                                <span>Representatividade</span>
                                <span className="font-bold bg-white px-2 py-0.5 rounded-full border border-blue-100">
                                    {finalPercentage.toFixed(2)}% do pedido
                                </span>
                             </div>
                        </div>

                        {/* Saldo Atual (Verificação) */}
                        <div className="flex items-center gap-3 pt-2">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                                <Wallet className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-400">Saldo Atual da Carteira (Sem este débito)</p>
                                <p className={`font-bold ${getAvailableBudget() >= totalInvestment ? 'text-emerald-600' : 'text-amber-500'}`}>
                                    {formatCurrency(getAvailableBudget())}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                        <Button 
                            variant="outline" 
                            fullWidth 
                            onClick={() => setIsConfirmModalOpen(false)}
                        >
                            Voltar
                        </Button>
                        <Button 
                            fullWidth 
                            onClick={handleConfirm}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Confirmar Envio
                        </Button>
                    </div>

                </div>
            </div>,
            document.body
        )
      )}

    </div>
  );
};