import { User, Client, Sale, Target, Investment, ClientTarget, VendaConsolidada, ClienteUltimaCompra, VendaClienteMes, VendaCanalMes, VendaProdutoMes } from '../types';

// Store de dados unificado para evitar múltiplos fetches
export const totalDataStore = {
    users: [] as User[],
    clients: [] as Client[],
    sales: [] as Sale[],
    targets: [] as Target[],
    investments: [] as Investment[],
    clientTargets: [] as ClientTarget[],
    
    // Novas Views
    vendasConsolidadas: [] as VendaConsolidada[],
    clientesUltimaCompra: [] as ClienteUltimaCompra[],
    vendasClientesMes: [] as VendaClienteMes[],
    vendasCanaisMes: [] as VendaCanalMes[],
    vendasProdutosMes: [] as VendaProdutoMes[],

    // Estados de carregamento para Progressive Loading
    loading: {
        vendasConsolidadas: false,
        clientesUltimaCompra: false,
        vendasClientesMes: false,
        vendasCanaisMes: false,
        vendasProdutosMes: false,
        targets: false,
        investments: false,
    },

    fetchedMonths: new Set<string>(),
    isHydrated: false,
    userId: '',
    userRole: '',
    
    clear() {
        this.users = [];
        this.clients = [];
        this.sales = [];
        this.targets = [];
        this.investments = [];
        this.clientTargets = [];
        this.vendasConsolidadas = [];
        this.clientesUltimaCompra = [];
        this.vendasClientesMes = [];
        this.vendasCanaisMes = [];
        this.vendasProdutosMes = [];
        this.fetchedMonths.clear();
        this.isHydrated = false;
    }
};
