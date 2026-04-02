import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, History, CheckSquare, Square, FileSpreadsheet, Filter, Calendar, Search } from 'lucide-react';
import { Button } from './Button';
import * as XLSX from 'xlsx';
import { totalDataStore } from '../lib/dataStore';
import { useSalesData } from '../hooks/useSalesData';

interface Product {
  id: string;
  name: string;
  lastPurchaseDate: string;
  quantity: number;
  totalValue: number;
  category: string;
}

interface ClientLastPurchaseModalProps {
  client: {
    id: string;
    cnpj: string;
    nome_fantasia: string;
  };
  onClose: () => void;
  onBack?: () => void;
}

export const ClientLastPurchaseModal: React.FC<ClientLastPurchaseModalProps> = ({ client, onClose, onBack }) => {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('all');
  
  useSalesData('all'); // Sempre busca histórico total para reposição

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const years = useMemo(() => {
    const yearsSet = new Set<string>();
    totalDataStore.vendasProdutosMes.forEach(s => {
      if (s.ano) yearsSet.add(String(s.ano));
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, []);

  const categories = useMemo(() => {
    const catSet = new Set<string>();
    totalDataStore.vendasProdutosMes.forEach(s => {
      if (s.grupo) catSet.add(s.grupo.trim().toUpperCase());
    });
    return Array.from(catSet).sort();
  }, []);

  const allClientProducts = useMemo(() => {
    const clientSales = totalDataStore.vendasProdutosMes.filter(s => s.cnpj === client.cnpj);
    const productMap = new Map<string, Product>();
    
    clientSales.forEach(s => {
      const prodName = s.produto || 'Produto sem nome';
      const saleDate = `${s.ano}-${String(s.mes).padStart(2, '0')}-01`;
      const current = productMap.get(prodName) || { 
        id: s.codigo_produto || prodName, 
        name: prodName, 
        lastPurchaseDate: '0000-00-00', 
        quantity: 0, 
        totalValue: 0,
        category: (s.grupo || 'GERAL').trim().toUpperCase()
      };
      
      productMap.set(prodName, {
        ...current,
        lastPurchaseDate: saleDate > current.lastPurchaseDate ? saleDate : current.lastPurchaseDate,
        quantity: saleDate === current.lastPurchaseDate ? current.quantity + (Number(s.qtde_total) || 0) : (saleDate > current.lastPurchaseDate ? (Number(s.qtde_total) || 0) : current.quantity),
        totalValue: saleDate === current.lastPurchaseDate ? current.totalValue + (Number(s.faturamento_total) || 0) : (saleDate > current.lastPurchaseDate ? (Number(s.faturamento_total) || 0) : current.totalValue)
      });
    });
    
    return Array.from(productMap.values());
  }, [client.cnpj]);

  const filteredProducts = useMemo(() => {
    return allClientProducts.filter(p => {
      const year = p.lastPurchaseDate.substring(0, 4);
      const month = p.lastPurchaseDate.substring(5, 7);
      
      if (selectedYear !== 'all' && year !== selectedYear) return false;
      if (selectedMonth !== 'all' && month !== selectedMonth) return false;
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase()) && !p.id.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      return true;
    }).sort((a, b) => new Date(a.lastPurchaseDate).getTime() - new Date(b.lastPurchaseDate).getTime());
  }, [allClientProducts, selectedYear, selectedMonth, selectedCategory, searchTerm]);

  const getDaysSince = (dateStr: string) => {
    const today = new Date();
    console.log('dateStr:', dateStr, typeof dateStr);
    const purchaseDate = new Date(String(dateStr) + 'T00:00:00');
    const diffTime = Math.abs(today.getTime() - purchaseDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isRedItem = (product: Product) => {
    const today = new Date();
    const purchaseDate = new Date(product.lastPurchaseDate + 'T00:00:00');
    const diffMonths = (today.getFullYear() * 12 + today.getMonth()) - 
                       (purchaseDate.getFullYear() * 12 + purchaseDate.getMonth());
    return diffMonths >= 3;
  };

  const redItems = filteredProducts.filter(p => isRedItem(p));
  const whiteItems = filteredProducts.filter(p => !isRedItem(p));
  const isAllRedSelected = redItems.length > 0 && redItems.every(p => selectedProductIds.includes(p.id));
  const isAllWhiteSelected = whiteItems.length > 0 && whiteItems.every(p => selectedProductIds.includes(p.id));

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  const handleDownloadExcel = () => {
    const itemsToExport = filteredProducts.filter(p => selectedProductIds.includes(p.id));
    
    if (itemsToExport.length === 0) {
      alert('Por favor, selecione pelo menos um item para exportar.');
      return;
    }

    setIsExporting(true);
    try {
      const data = itemsToExport.map(p => ({
        "SKU": p.id,
        "Produto": p.name,
        "Categoria": p.category,
        "Última Compra": new Date(p.lastPurchaseDate + 'T00:00:00').toLocaleDateString('pt-BR'),
        "Dias sem Compra": getDaysSince(p.lastPurchaseDate),
        "Quantidade Úit. Compra": p.quantity,
        "Valor Úit. Compra": p.totalValue,
        "Status": isRedItem(p) ? "VERMELHO (Atenção)" : "BRANCO (Normal)"
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sugestão_Reposição");
      
      XLSX.writeFile(wb, `Reposicao_${client.nome_fantasia.replace(/\s/g, '_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar planilha.');
    } finally {
      setIsExporting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 md:p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl flex flex-col max-h-[94vh] overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-amber-600 text-white rounded-2xl shadow-lg shrink-0">
              <History className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none truncate">Sugestão de Reposição</h3>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-1.5 truncate">{client.nome_fantasia}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {Object.values(totalDataStore.loading).some(v => v === true) && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-amber-600 rounded-full animate-bounce"></div>
                <span className="text-[8px] font-black uppercase tracking-widest">Carregando Histórico...</span>
              </div>
            )}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full">
              {onBack && (
                <button 
                  onClick={onBack} 
                  className="px-4 py-2 hover:bg-white hover:shadow-sm rounded-full text-[10px] font-black text-slate-600 uppercase transition-all"
                >
                  Voltar
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="p-6 bg-white border-b border-slate-100 space-y-4 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="BUSCAR POR SKU OU NOME..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-amber-500 outline-none transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-400 ml-2" />
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none pr-2"
              >
                <option value="all">ANO: TODOS</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div className="w-px h-4 bg-slate-200 mx-1"></div>
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none pr-2"
              >
                <option value="all">MÊS: TODOS</option>
                <option value="01">JANEIRO</option>
                <option value="02">FEVEREIRO</option>
                <option value="03">MARÇO</option>
                <option value="04">ABRIL</option>
                <option value="05">MAIO</option>
                <option value="06">JUNHO</option>
                <option value="07">JULHO</option>
                <option value="08">AGOSTO</option>
                <option value="09">SETEMBRO</option>
                <option value="10">OUTUBRO</option>
                <option value="11">NOVEMBRO</option>
                <option value="12">DEZEMBRO</option>
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
              <Filter className="w-4 h-4 text-slate-400 ml-2" />
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none pr-2"
              >
                <option value="all">CATEGORIA: TODAS</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <button 
                    onClick={() => { const ids = whiteItems.map(p => p.id); setSelectedProductIds(prev => isAllWhiteSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))); }}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-[9px] font-black uppercase px-4 py-2.5 rounded-xl border transition-all ${isAllWhiteSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-200 hover:text-blue-600'}`}
                >
                    {isAllWhiteSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 opacity-30" />} Brancos
                </button>
                <button 
                    onClick={() => { const ids = redItems.map(p => p.id); setSelectedProductIds(prev => isAllRedSelected ? prev.filter(id => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))); }}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-[9px] font-black uppercase px-4 py-2.5 rounded-xl border transition-all ${isAllRedSelected ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-600'}`}
                >
                    {isAllRedSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 opacity-30" />} Vermelhos
                </button>
            </div>
            
            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedProductIds.length} Selecionados</span>
                <Button 
                    variant="outline" 
                    onClick={handleDownloadExcel}
                    isLoading={isExporting}
                    className="h-11 px-8 rounded-xl text-[10px] font-black border-emerald-200 text-emerald-600 uppercase shadow-sm hover:bg-emerald-50"
                >
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
                </Button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto bg-slate-50 flex-1 custom-scrollbar">
            <div className="p-6">
                <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                            <tr>
                                <th className="px-8 py-5 w-16 text-center">Sel.</th>
                                <th className="px-6 py-5">SKU</th>
                                <th className="px-6 py-5">Produto</th>
                                <th className="px-6 py-5">Última Compra</th>
                                <th className="px-6 py-5 text-center">Qtd</th>
                                <th className="px-8 py-5 text-right">Último Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredProducts.map((p, idx) => {
                                const isSelected = selectedProductIds.includes(p.id);
                                const isRed = isRedItem(p);
                                return (
                                    <tr 
                                        key={idx} 
                                        className={`hover:bg-slate-50/80 cursor-pointer transition-colors group ${isSelected ? 'bg-blue-50/40' : ''}`} 
                                        onClick={() => toggleProduct(p.id)}
                                    >
                                        <td className="px-8 py-5 text-center">
                                            <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center mx-auto transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'border-slate-200 group-hover:border-blue-300'}`}>
                                                {isSelected && <span className="text-[10px] font-bold">✓</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-[10px] font-bold text-slate-400 font-mono">{p.id}</td>
                                        <td className="px-6 py-5">
                                            <p className="font-black text-slate-700 uppercase text-[11px] tracking-tight group-hover:text-amber-600 transition-colors">{p.name}</p>
                                            {isRed ? (
                                                <span className="text-[8px] font-black text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded-md border border-red-100 mt-1 inline-block">Parado há {getDaysSince(p.lastPurchaseDate)} dias</span>
                                            ) : (
                                                <span className="text-[8px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded-md mt-1 inline-block">{p.category}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-[10px] font-bold text-slate-500 tabular-nums">
                                            {p.lastPurchaseDate !== '0000-00-00' ? new Date(p.lastPurchaseDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                                        </td>
                                        <td className="px-6 py-5 text-center font-black text-slate-900 tabular-nums">{p.quantity}</td>
                                        <td className="px-8 py-5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(p.totalValue)}</td>
                                    </tr>
                                );
                            })}
                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <History className="w-12 h-12 text-slate-200" />
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum item encontrado para reposição</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
