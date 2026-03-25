
export interface User {
  id: string;
  email?: string;
  nome: string;
  name?: string;
  role?: 'admin' | 'rep' | 'director' | 'manager';
  nivel_acesso?: string;
}

export interface Sale {
  id?: string;
  data: string;
  faturamento: number | string;
  qtde_faturado: number | string;
  quantidade?: number | string;
  cliente_nome: string;
  cnpj: string;
  produto: string;
  produto_nome?: string;
  produto_id?: string;
  codigo_produto: string;
  grupo: string;
  canal_vendas: string;
  cidade?: string;
  usuario_id: string;
  cliente_id?: string;
}

export interface Client {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  cidade: string;
  city?: string;
  estado: string;
  usuario_id: string;
  lastPurchaseDate?: string;
  canal_vendas?: string;
  grupo?: string;
}

export interface Target {
  id: string;
  usuario_id: string;
  mes: number;
  ano: number;
  valor: number | string;
}

export interface Investment {
  id: string;
  data: string;
  cliente_id: string;
  usuario_id: string;
  valor_total_investimento: number;
  valor_caju: number;
  valor_dinheiro: number;
  valor_produto: number;
  status: string;
  observacao?: string;
}

export interface ClientTarget {
  id: string;
  cliente_id: string;
  usuario_id: string;
  mes: number;
  ano: number;
  valor_alvo: number;
}

export interface VendaConsolidada {
  cnpj: string;
  ano: number;
  mes: number;
  faturamento_total: number;
  qtde_total: number;
  cliente_nome: string;
  cidade: string;
  estado: string;
  usuario_id: string;
  representante_nome: string;
  canal_vendas: string;
}

export interface ClienteUltimaCompra {
  cnpj: string;
  ultima_compra: string;
  valor_ultima_compra: number;
}

export interface VendaClienteMes {
  usuario_id: string;
  cnpj: string;
  cliente_nome: string;
  ano: number;
  mes: number;
  faturamento_total: number;
}

export interface VendaCanalMes {
  usuario_id: string;
  canal_vendas: string;
  cnpj: string;
  cliente_nome: string;
  ano: number;
  mes: number;
  faturamento_total: number;
}

export interface VendaProdutoMes {
  usuario_id: string;
  cnpj: string;
  cliente_nome: string;
  produto: string;
  codigo_produto: string;
  grupo: string;
  ano: number;
  mes: number;
  faturamento_total: number;
  qtde_total: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}
