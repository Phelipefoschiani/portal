
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Package, FileSpreadsheet, Filter, Calendar, Search, TrendingUp, DollarSign, Hash } from 'lucide-react';
import * as XLSX from 'xlsx';
import { totalDataStore } from '../lib/dataStore';
import { useSalesData } from '../hooks/useSalesData';

interface Product {
  id: string;
  name: string;
  quantity: number;
  totalValue: number;
  lastPurchaseDate: string;
  category: string;
}

interface ClientProductsModalProps {
  client: {
    id: string;
    cnpj: string;
    nome_fantasia: string;
  };
  onClose: () => void;
  onBack?: () => void;
}

export const ClientProductsModal: React.FC<ClientProductsModalProps> = ({ client, onClose, onBack }) => {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  
  useSalesData(selectedYear === 'all' ? 'all' : parseInt(selectedYear, 10));

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

  const filteredProducts = useMemo(() => {
    const clientSales = totalDataStore.vendasProdutosMes.filter(s => s.cnpj === client.cnpj);
    
    const productMap = new Map<string, Product>();
    
    clientSales.forEach(s => {
      const year = String(s.ano);
      const month = String(s.mes).padStart(2, '0');
      const category = (s.grupo || 'GERAL').trim().toUpperCase();
      
      if (selectedYear !== 'all' && year !== selectedYear) return;
      if (selectedMonth !== 'all' && month !== selectedMonth) return;
      if (selectedCategory !== 'all' && category !== selectedCategory) return;
      
      const prodName = s.produto || 'Produto sem nome';
      if (searchTerm && !prodName.toLowerCase().includes(searchTerm.toLowerCase()) && !s.codigo_produto?.toLowerCase().includes(searchTerm.toLowerCase())) return;

      const current = productMap.get(prodName) || { 
        id: s.codigo_produto || prodName, 
        name: prodName, 
        quantity: 0, 
        totalValue: 0, 
        lastPurchaseDate: '0000-00-00',
        category
      };
      
      const saleDate = `${year}-${month}-01`;

      productMap.set(prodName, {
        ...current,
        quantity: current.quantity + (Number(s.qtde_total) || 0),
        totalValue: current.totalValue + (Number(s.faturamento_total) || 0),
        lastPurchaseDate: saleDate > current.lastPurchaseDate ? saleDate : current.lastPurchaseDate
      });
    });
    
    return Array.from(productMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [client.cnpj, selectedYear, selectedMonth, selectedCategory, searchTerm]);

  const stats = useMemo(() => {
    const totalValue = filteredProducts.reduce((acc, p) => acc + p.totalValue, 0);
    const totalUnits = filteredProducts.reduce((acc, p) => acc + p.quantity, 0);
    const totalSkus = filteredProducts.length;
    return { totalValue, totalUnits, totalSkus };
  }, [filteredProducts]);

  const handleDownloadExcel = () => {
    if (filteredProducts.length === 0) return;
    
    const excelData = filteredProducts.map(p => ({ 
      "SKU": p.id,
      "Produto": p.name, 
      "Categoria": p.category,
      "QTD": p.quantity, 
      "Valor Total": p.totalValue,
      "Última Compra": p.lastPurchaseDate !== '0000-00-00' ? new Date(p.lastPurchaseDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mix");
    XLSX.writeFile(wb, `mix_${client.nome_fantasia.replace(/\s/g, '_')}.xlsx`);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  const isLoading = Object.values(totalDataStore.loading).some(v => v === true);

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 md:p-4 bg-slate-900/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white w-full max-w-6xl rounded-[40px] shadow-2xl flex flex-col max-h-[94vh] overflow-hidden border border-white/20">
        
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-600 text-white rounded-2xl shadow-lg">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">Mix Ativo</h3>
              <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mt-1.5">{client.nome_fantasia}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 text-purple-600 rounded-full animate-pulse">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
                <span className="text-[8px] font-black uppercase tracking-widest">Carregando Dados...</span>
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

        {/* Filters & Stats */}
        <div className="p-6 bg-white border-b border-slate-100 space-y-6 shrink-0">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-lg border-b-4 border-purple-600">
              <div className="flex items-center gap-3 mb-2">
                <Hash className="w-4 h-4 text-purple-400" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total SKUs</p>
              </div>
              <h4 className="text-2xl font-black">{stats.totalSkus}</h4>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Faturamento Total</p>
              </div>
              <h4 className="text-2xl font-black text-slate-900">{formatCurrency(stats.totalValue)}</h4>
            </div>
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Quantidade</p>
              </div>
              <h4 className="text-2xl font-black text-slate-900">{stats.totalUnits} <span className="text-xs font-bold text-slate-400">UN</span></h4>
            </div>
          </div>

          {/* Filter Row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="BUSCAR POR SKU OU NOME..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-purple-500 outline-none transition-all"
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

            <button 
              onClick={handleDownloadExcel}
              className="px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4" /> EXCEL
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar">
          <div className="p-6">
            <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest sticky top-0 z-10">
                  <tr className="border-b border-slate-200">
                    <th className="px-8 py-5">SKU</th>
                    <th className="px-6 py-5">Produto</th>
                    <th className="px-6 py-5 text-center">Qtd</th>
                    <th className="px-6 py-5 text-right">Valor Total</th>
                    <th className="px-6 py-5 text-center">Part. %</th>
                    <th className="px-8 py-5 text-right">Última Compra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p, idx) => {
                    const participation = stats.totalValue > 0 ? (p.totalValue / stats.totalValue) * 100 : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-8 py-5 text-[10px] font-bold text-slate-400 font-mono">{p.id}</td>
                        <td className="px-6 py-5">
                          <p className="font-black text-slate-700 uppercase text-[11px] tracking-tight group-hover:text-purple-600 transition-colors">{p.name}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{p.category}</p>
                        </td>
                        <td className="px-6 py-5 text-center font-black text-slate-900 tabular-nums">{p.quantity}</td>
                        <td className="px-6 py-5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(p.totalValue)}</td>
                        <td className="px-6 py-5 text-center">
                          <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg">{participation.toFixed(1)}%</span>
                        </td>
                        <td className="px-8 py-5 text-right text-[10px] font-bold text-slate-500">
                          {p.lastPurchaseDate !== '0000-00-00' ? new Date(p.lastPurchaseDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Package className="w-12 h-12 text-slate-200" />
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum produto encontrado com os filtros aplicados</p>
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
