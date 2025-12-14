
export interface Product {
  id: string;
  name: string;
  category: string;
  totalValue: number;
  quantity: number;
  lastPurchaseDate: string; // ISO Date
}

export interface MonthlyData {
  month: number; // 1-12
  year: number;
  value: number; // 0 if no purchase
  target: number;
  positivou: boolean;
}

export interface Client {
  id: string;
  name: string;
  cnpj: string;
  city: string;
  totalPurchase: number; // Total acumulado
  lastPurchaseDate: string; // ISO Date
  portfolioShare: number; // %
  history: MonthlyData[];
  products: Product[]; // Simplificado para demo, idealmente seria separado por mes/ano
}

// Interfaces para Previsão
export interface ForecastItem {
  clientId: string;
  clientName: string;
  forecastValue: number;
  targetValue: number;
}

export interface ForecastEntry {
  id: string;
  date: string; // ISO string
  totalValue: number;
  items: ForecastItem[];
}

// Helper para gerar dados aleatórios
const generateHistory = (years: number[]): MonthlyData[] => {
  const history: MonthlyData[] = [];
  years.forEach(year => {
    for (let m = 1; m <= 12; m++) {
      const hasPurchase = Math.random() > 0.3; // 70% chance de compra
      history.push({
        month: m,
        year: year,
        value: hasPurchase ? Math.floor(Math.random() * 5000) + 1000 : 0,
        target: 3000, // Meta fixa para exemplo
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
    // Gerar data aleatória nos últimos 2 anos
    const today = new Date();
    const daysAgo = Math.floor(Math.random() * 730); // 0 a 730 dias atrás
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

export const clients: Client[] = Array.from({ length: 25 }).map((_, i) => {
  const history = generateHistory([2023, 2024]);
  const totalPurchase = history.reduce((acc, curr) => acc + curr.value, 0);
  
  // Simular datas de última compra variadas para o cliente (baseado no histórico ou aleatório para demo)
  const today = new Date();
  const daysAgo = Math.floor(Math.random() * 200); 
  const lastPurchase = new Date(today.setDate(today.getDate() - daysAgo));

  return {
    id: `cli-${i + 1}`,
    name: `Comercial ${['Silva', 'Souza', 'Oliveira', 'Santos', 'Pereira'][i % 5]} & Cia ${i+1}`,
    cnpj: '00.000.000/0001-00',
    city: ['São Paulo', 'Campinas', 'Sorocaba', 'Jundiaí'][i % 4],
    totalPurchase: totalPurchase,
    lastPurchaseDate: lastPurchase.toISOString(),
    portfolioShare: 0, // Será calculado na tela
    history: history,
    products: generateProducts()
  };
}).sort((a, b) => b.totalPurchase - a.totalPurchase);

// Helper para pegar meta do mês atual
export const getClientCurrentTarget = (client: Client): number => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    const data = client.history.find(h => h.month === currentMonth && h.year === currentYear);
    return data ? data.target : 3000; // Retorna 3000 se não achar (fallback)
};
