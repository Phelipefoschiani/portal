
// --- Types and Interfaces ---
export type NotificationPriority = 'info' | 'medium' | 'urgent';
export type PaymentChannelType = 'Caju' | 'Dinheiro' | 'Produto';

export interface Attachment {
  name: string;
  url: string;
  type: 'pdf' | 'image' | 'doc';
  size: string;
}

export interface InvestmentChannel {
  type: PaymentChannelType;
  value: number;
}

export interface Product { id: string; name: string; category: string; totalValue: number; quantity: number; lastPurchaseDate: string; }
export interface MonthlyData { month: number; year: number; value: number; target: number; positivou: boolean; }
export interface Client { 
  id: string; 
  usuario_id: string; 
  nome_fantasia: string; 
  cnpj: string; 
  city: string; 
  totalPurchase: number; 
  lastPurchaseDate: string; 
  history: MonthlyData[]; 
  products: Product[]; 
  ativo?: boolean;
  canal_vendas?: string;
}

export interface Representative { 
  id: string; 
  name: string; 
  region: string; 
  annualTarget: number; 
  monthlyTargets?: { [year: number]: { [month: number]: number } };
}

export interface ForecastItem { clientId: string; clientName: string; forecastValue: number; targetValue: number; }
export interface ForecastEntry { 
  id: string; 
  usuario_id: string; 
  repName?: string;
  data: string; 
  previsao_total: number; 
  items: ForecastItem[]; 
  status: 'pending' | 'approved' | 'rejected'; 
  rejectionReason?: string; 
}

export interface Notification { 
  id: string; 
  de_usuario_id?: string; 
  para_usuario_id?: string; 
  mensagem: string; 
  lida: boolean; 
  criada_em: string; 
  titulo?: string; 
  prioridade?: NotificationPriority; 
  attachments?: Attachment[];
  readBy?: string[];
  deliveredTo?: string[];
  metadata?: {
    type?: string;
    relatedId?: string;
  };
  firstSeenAt?: string;
  readAt?: string;
  revisionRequested?: boolean;
}

export interface Investment { 
  id: string; 
  data: string; 
  cliente_id: string; 
  clientName?: string;
  usuario_id: string; 
  repName?: string;
  valor_total_investimento: number; 
  valor_caju: number; 
  valor_dinheiro: number; 
  valor_produto: number; 
  status: 'approved' | 'pending' | 'rejected' | 'pendente'; 
  observacao?: string; 
  channels?: InvestmentChannel[];
}

// --- ARRAYS LIMPOS ---
export const representatives: Representative[] = [];
export const clients: Client[] = [];
export const mockInvestments: Investment[] = [];
export const mockForecasts: ForecastEntry[] = [];
export let mockNotifications: Notification[] = [];

export const repSettings = {
    annualTarget: 0, 
    investmentRate: 0.05 
};

// --- Funções de Ação ---

export const checkAndMarkDeliveredNotifications = () => {};
export const getUnreadCount = () => 0;

// Obtém meta atual do cliente
export const getClientCurrentTarget = (client: Client) => {
    const now = new Date();
    const entry = client.history.find(h => h.month === now.getMonth() + 1 && h.year === now.getFullYear());
    return entry?.target || 0;
};

// Adiciona investimento
export const addInvestment = (inv: Investment) => {
    mockInvestments.push(inv);
};

// Adiciona previsão
export const addForecast = (f: ForecastEntry) => {
    mockForecasts.push(f);
};

// Atualiza status de investimento
export const updateInvestmentStatus = (id: string, status: 'approved' | 'rejected') => {
    const inv = mockInvestments.find(i => i.id === id);
    if (inv) inv.status = status;
};

// Atualiza status de previsão
export const updateForecastStatus = (id: string, status: 'approved' | 'rejected', reason?: string) => {
    const f = mockForecasts.find(i => i.id === id);
    if (f) {
        f.status = status;
        if (reason) f.rejectionReason = reason;
    }
};

// Marca notificação como lida
export const markNotificationAsRead = (id: string) => {
    const n = mockNotifications.find(i => i.id === id);
    if (n) n.lida = true;
};

// Solicita revisão de notificação
export const requestRevision = (id: string, requester: string) => {
    const n = mockNotifications.find(i => i.id === id);
    if (n) n.revisionRequested = true;
};

// Cria nova notificação
export const createNotification = (data: any) => {
    const n: Notification = {
        id: Date.now().toString(),
        mensagem: data.content,
        titulo: data.title,
        prioridade: data.priority,
        criada_em: new Date().toISOString(),
        lida: false,
        attachments: data.attachments || [],
        readBy: [],
        deliveredTo: [],
    };
    mockNotifications.push(n);
};

// Deleta notificação
export const deleteNotification = (id: string) => {
    const index = mockNotifications.findIndex(n => n.id === id);
    if (index !== -1) mockNotifications.splice(index, 1);
};

// Atualiza meta de representante
export const updateRepTarget = (id: string, monthlyTargets: { [month: number]: number }, year: number) => {
    const rep = representatives.find(r => r.id === id);
    if (rep) {
        if (!rep.monthlyTargets) rep.monthlyTargets = {};
        rep.monthlyTargets[year] = monthlyTargets;
    }
};

// Atualiza meta de cliente
export const updateClientTarget = (clientId: string, month: number, year: number, val: number) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
        const entry = client.history.find(h => h.month === month && h.year === year);
        if (entry) {
            entry.target = val;
        } else {
            client.history.push({ month, year, value: 0, target: val, positivou: false });
        }
    }
};
