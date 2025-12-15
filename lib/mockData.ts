
// --- Interfaces Básicas ---

export interface Product {
  id: string;
  name: string;
  category: string;
  totalValue: number;
  quantity: number;
  lastPurchaseDate: string; 
}

export interface MonthlyData {
  month: number;
  year: number;
  value: number;
  target: number;
  positivou: boolean;
}

export interface Client {
  id: string;
  repId: string; // Novo: Vínculo com representante
  name: string;
  cnpj: string;
  city: string;
  totalPurchase: number; 
  lastPurchaseDate: string; 
  portfolioShare: number; 
  history: MonthlyData[];
  products: Product[]; 
}

export interface Representative {
    id: string;
    name: string;
    region: string;
    annualTarget: number;
}

// --- Interfaces para Previsão ---
export interface ForecastItem {
  clientId: string;
  clientName: string;
  forecastValue: number;
  targetValue: number;
}

export interface ForecastEntry {
  id: string;
  repId: string; // Novo
  repName: string; // Novo
  date: string; 
  totalValue: number;
  items: ForecastItem[];
  // Novos campos para fluxo de aprovação
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
}

// --- Interfaces para Notificações ---
export type NotificationPriority = 'urgent' | 'medium' | 'info';

export interface Attachment {
  name: string;
  url: string; 
  type: 'pdf' | 'image' | 'doc';
  size: string;
}

export interface NotificationMetadata {
    type: 'forecast_rejected' | 'generic';
    relatedId?: string; // ID da previsão ou item relacionado
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  priority: NotificationPriority;
  date: string; 
  // Controle de leitura global
  readBy: string[]; // IDs dos usuários que leram
  deliveredTo: string[]; // IDs dos usuários que receberam (login)
  attachments?: Attachment[];
  revisionRequestedBy?: string[]; // IDs de quem pediu revisão
  metadata?: NotificationMetadata; // NOVO: Metadados para ações inteligentes

  // UI Helpers (Computed or Mocked per user context)
  isRead?: boolean;
  firstSeenAt?: string;
  readAt?: string;
  revisionRequested?: boolean;
}

// --- Interfaces para Investimentos ---

export type PaymentChannelType = 'Caju' | 'Produto' | 'Dinheiro';

export interface InvestmentChannel {
    type: PaymentChannelType;
    value: number;
}

export interface Investment {
    id: string;
    date: string;
    clientId: string;
    clientName: string;
    repId: string; // Novo
    repName: string; // Novo
    description: string; 
    channels: InvestmentChannel[]; 
    totalValue: number; 
    status: 'approved' | 'pending' | 'rejected';
    approvedBy?: string;
}

// --- DADOS MOCKADOS ---

export const representatives: Representative[] = [
    { id: 'rep-1', name: 'Ricardo Souza', region: 'Norte/Capital', annualTarget: 1200000 },
    { id: 'rep-2', name: 'Ana Pereira', region: 'Sul/Interior', annualTarget: 950000 },
    { id: 'rep-3', name: 'Carlos Lima', region: 'Leste', annualTarget: 1100000 },
];

export const repSettings = {
    annualTarget: 1200000.00, 
    investmentRate: 0.05 
};

// Gerador de Histórico
const generateHistory = (years: number[]): MonthlyData[] => {
  const history: MonthlyData[] = [];
  years.forEach(year => {
    for (let m = 1; m <= 12; m++) {
      const hasPurchase = Math.random() > 0.3; 
      history.push({
        month: m,
        year: year,
        value: hasPurchase ? Math.floor(Math.random() * 5000) + 1000 : 0,
        target: 3000, 
        positivou: hasPurchase
      });
    }
  });
  return history;
};

const productsList = [
  "Cimento CP-II 50kg", "Argamassa AC-III", "Tijolo 8 Furos", "Telha Cerâmica", 
  "Piso Porcelanato 60x60", "Tinta Acrílica 18L", "Tubo PVC 100mm", "Conexão T PVC", 
  "Torneira Metal", "Cola para Tubo"
];

const generateProducts = (): Product[] => {
  return productsList.map((name, idx) => {
    const today = new Date();
    const daysAgo = Math.floor(Math.random() * 730); 
    const pDate = new Date(today.setDate(today.getDate() - daysAgo));

    return {
      id: `prod-${idx}`,
      name,
      category: "Material Básico",
      totalValue: Math.floor(Math.random() * 20000) + 500,
      quantity: Math.floor(Math.random() * 500),
      lastPurchaseDate: pDate.toISOString()
    };
  }).sort((a, b) => b.totalValue - a.totalValue);
};

export const clients: Client[] = Array.from({ length: 45 }).map((_, i) => {
  const history = generateHistory([2023, 2024]);
  const totalPurchase = history.reduce((acc, curr) => acc + curr.value, 0);
  
  const today = new Date();
  const daysAgo = Math.floor(Math.random() * 200); 
  const lastPurchase = new Date(today.setDate(today.getDate() - daysAgo));

  // Distribui clientes entre os representantes
  const repIndex = i % representatives.length;

  return {
    id: `cli-${i + 1}`,
    repId: representatives[repIndex].id,
    name: `Comercial ${['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira'][i % 5]} & Cia ${i+1}`,
    cnpj: '00.000.000/0001-00',
    city: ['São Paulo', 'Campinas', 'Sorocaba', 'Jundiaí', 'Ribeirão Preto'][i % 5],
    totalPurchase: totalPurchase,
    lastPurchaseDate: lastPurchase.toISOString(),
    portfolioShare: 0, 
    history: history,
    products: generateProducts()
  };
}).sort((a, b) => b.totalPurchase - a.totalPurchase);


export const mockInvestments: Investment[] = [
    {
        id: 'inv-1',
        date: '2024-02-15T10:00:00Z',
        clientId: 'cli-1',
        repId: 'rep-1',
        repName: 'Ricardo Souza',
        clientName: 'Comercial Silva & Cia 1',
        description: 'Ação de Inauguração',
        channels: [{ type: 'Produto', value: 2500.00 }],
        totalValue: 2500.00,
        status: 'approved',
        approvedBy: 'Roberto Manager'
    },
    {
        id: 'inv-2',
        date: '2024-03-10T14:30:00Z',
        clientId: 'cli-3',
        repId: 'rep-1',
        repName: 'Ricardo Souza',
        clientName: 'Comercial Oliveira & Cia 3',
        description: 'Bonificação Mista',
        channels: [
            { type: 'Caju', value: 500.00 },
            { type: 'Dinheiro', value: 700.00 }
        ],
        totalValue: 1200.00,
        status: 'approved',
        approvedBy: 'Roberto Manager'
    },
    {
        id: 'inv-3',
        date: '2024-05-20T09:15:00Z',
        clientId: 'cli-2',
        repId: 'rep-2',
        repName: 'Ana Pereira',
        clientName: 'Comercial Souza & Cia 2',
        description: 'Café da manhã',
        channels: [{ type: 'Caju', value: 450.00 }],
        totalValue: 450.00,
        status: 'pending', 
    },
    {
        id: 'inv-4',
        date: '2024-06-05T16:00:00Z',
        clientId: 'cli-5',
        repId: 'rep-3',
        repName: 'Carlos Lima',
        clientName: 'Comercial Pereira & Cia 5',
        description: 'Kits Promocionais',
        channels: [{ type: 'Produto', value: 800.00 }],
        totalValue: 800.00,
        status: 'rejected',
        approvedBy: 'Roberto Manager'
    },
    {
        id: 'inv-5',
        date: '2024-06-15T11:00:00Z',
        clientId: 'cli-1',
        repId: 'rep-1',
        repName: 'Ricardo Souza',
        clientName: 'Comercial Silva & Cia 1',
        description: 'Verba cooperada Mista',
        channels: [
            { type: 'Produto', value: 1000.00 },
            { type: 'Caju', value: 500.00 }
        ],
        totalValue: 1500.00,
        status: 'pending'
    }
];

export const mockForecasts: ForecastEntry[] = [
    {
        id: 'forc-1',
        repId: 'rep-1',
        repName: 'Ricardo Souza',
        date: '2024-06-20T10:00:00Z',
        totalValue: 45000.00,
        items: [
            { clientId: 'cli-1', clientName: 'Comercial Silva', forecastValue: 20000, targetValue: 15000 },
            { clientId: 'cli-2', clientName: 'Comercial Souza', forecastValue: 25000, targetValue: 20000 }
        ],
        status: 'pending'
    },
    {
        id: 'forc-2',
        repId: 'rep-2',
        repName: 'Ana Pereira',
        date: '2024-06-21T09:30:00Z',
        totalValue: 32000.00,
        items: [
            { clientId: 'cli-10', clientName: 'ConstruShow', forecastValue: 12000, targetValue: 10000 },
            { clientId: 'cli-12', clientName: 'Depósito Real', forecastValue: 20000, targetValue: 20000 }
        ],
        status: 'approved'
    }
];

export let mockNotifications: Notification[] = [
  {
    id: 'not-1',
    title: 'Alteração na Tabela de Preços - Cimento',
    content: 'Atenção: A partir de 01/07 haverá um reajuste de 5% em toda a linha de cimentos e argamassas.',
    priority: 'urgent',
    date: new Date().toISOString(),
    readBy: [], 
    deliveredTo: [],
    attachments: [{ name: 'Tabela_Precos_Julho.pdf', url: '#', type: 'pdf', size: '2.4 MB' }]
  },
  {
    id: 'not-2',
    title: 'Campanha de Vendas - Julho',
    content: 'Iniciamos a campanha "Inverno Quente".',
    priority: 'medium',
    date: new Date(Date.now() - 86400000).toISOString(),
    readBy: ['rep-2'],
    deliveredTo: ['rep-1', 'rep-2', 'rep-3'],
    attachments: [{ name: 'Regulamento.pdf', url: '#', type: 'pdf', size: '500 KB' }]
  }
];

// --- HELPERS ---

export const getAvailableBudget = (repId?: string): number => {
    // Se repId for passado, calcula o dele. Se não, usa o "rep-1" (usuário logado no mock)
    // Para o gerente, precisaria somar tudo ou filtrar.
    const targetRep = repId ? representatives.find(r => r.id === repId) : representatives[0];
    if (!targetRep) return 0;

    const totalBudget = targetRep.annualTarget * repSettings.investmentRate;
    const totalUsedApproved = mockInvestments
        .filter(i => i.repId === targetRep.id && i.status === 'approved')
        .reduce((acc, curr) => acc + curr.totalValue, 0);
        
    return totalBudget - totalUsedApproved;
};

export const addInvestment = (inv: Omit<Investment, 'id' | 'date' | 'status' | 'totalValue' | 'repId' | 'repName'>) => {
    // Mock assume que quem adiciona é o rep-1 (Ricardo)
    const total = inv.channels.reduce((acc, curr) => acc + curr.value, 0);
    const newInv: Investment = {
        ...inv,
        id: `inv-${Date.now()}`,
        date: new Date().toISOString(),
        repId: 'rep-1',
        repName: 'Ricardo Souza',
        totalValue: total,
        status: 'pending'
    };
    mockInvestments.unshift(newInv);
};

export const addForecast = (forecast: ForecastEntry) => {
    mockForecasts.unshift(forecast);
};

export const updateInvestmentStatus = (id: string, status: 'approved' | 'rejected') => {
    const index = mockInvestments.findIndex(i => i.id === id);
    if (index >= 0) {
        mockInvestments[index].status = status;
        if (status === 'approved') {
            mockInvestments[index].approvedBy = 'Admin (Você)';
        }
    }
};

export const createNotification = (notif: Omit<Notification, 'id' | 'date' | 'readBy' | 'deliveredTo'>) => {
    const newNotif: Notification = {
        ...notif,
        id: `not-${Date.now()}`,
        date: new Date().toISOString(),
        readBy: [],
        deliveredTo: []
    };
    mockNotifications.unshift(newNotif);
};

export const updateForecastStatus = (id: string, status: 'approved' | 'rejected', reason?: string) => {
    const index = mockForecasts.findIndex(f => f.id === id);
    if (index >= 0) {
        mockForecasts[index].status = status;
        if (reason) mockForecasts[index].rejectionReason = reason;

        // Cria notificação automática para o representante
        const repId = mockForecasts[index].repId;
        const statusText = status === 'approved' ? 'Aprovada' : 'Recusada';
        const priority = status === 'approved' ? 'info' : 'urgent';
        const content = status === 'approved' 
            ? `Sua previsão enviada em ${new Date(mockForecasts[index].date).toLocaleDateString()} foi aprovada pela gerência.`
            : `Sua previsão foi devolvida para correção. Motivo: ${reason}`;

        // Define metadados se for recusada
        const metadata: NotificationMetadata | undefined = status === 'rejected' 
            ? { type: 'forecast_rejected', relatedId: id } 
            : undefined;

        createNotification({
            title: `Previsão ${statusText}`,
            content: content,
            priority: priority,
            attachments: [],
            metadata: metadata
        });
        
        // Marca entrega para o representante específico
        mockNotifications[0].deliveredTo.push(repId);
    }
};

export const getClientCurrentTarget = (client: Client): number => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const data = client.history.find(h => h.month === currentMonth && h.year === currentYear);
    return data ? data.target : 3000;
};

// Funções de Leitura de Notificação para Rep
// Assumindo rep-1 como current user
const CURRENT_REP_ID = 'rep-1';

export const getUnreadCount = () => mockNotifications.filter(n => !n.readBy.includes(CURRENT_REP_ID)).length;

export const markNotificationAsRead = (id: string) => {
  const index = mockNotifications.findIndex(n => n.id === id);
  if (index >= 0) {
    if (!mockNotifications[index].readBy.includes(CURRENT_REP_ID)) {
        mockNotifications[index].readBy.push(CURRENT_REP_ID);
        // Atualiza a propriedade helper 'isRead' para a UI atualizar mais fácil
        mockNotifications[index].isRead = true; 
    }
  }
};

export const requestRevision = (id: string, userName: string = 'Ricardo Souza') => {
  const index = mockNotifications.findIndex(n => n.id === id);
  if (index >= 0) {
     if (!mockNotifications[index].readBy.includes(CURRENT_REP_ID)) {
        mockNotifications[index].readBy.push(CURRENT_REP_ID);
    }
    // Lógica de revisão mockada
    if (!mockNotifications[index].revisionRequestedBy) mockNotifications[index].revisionRequestedBy = [];
    mockNotifications[index].revisionRequestedBy?.push(CURRENT_REP_ID);

    // CRIA NOTIFICAÇÃO PARA O GERENTE
    createNotification({
        title: `Solicitação de Revisão - ${userName}`,
        content: `O representante solicitou revisão na notificação: "${mockNotifications[index].title}". Por favor, verifique se há informações incorretas.`,
        priority: 'medium',
        attachments: []
    });
  }
};

export const checkAndMarkDeliveredNotifications = () => {
    mockNotifications.forEach(n => {
        if (!n.deliveredTo.includes(CURRENT_REP_ID)) {
            n.deliveredTo.push(CURRENT_REP_ID);
        }
    });
};

export const deleteNotification = (id: string) => {
    const idx = mockNotifications.findIndex(n => n.id === id);
    if(idx >= 0) mockNotifications.splice(idx, 1);
};
