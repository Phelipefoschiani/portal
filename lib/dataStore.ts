
// Store de dados unificado para evitar múltiplos fetches
export const totalDataStore = {
    users: [] as any[],
    clients: [] as any[],
    sales: [] as any[],
    targets: [] as any[],
    investments: [] as any[],
    clientTargets: [] as any[],
    isHydrated: false,
    
    clear() {
        this.users = [];
        this.clients = [];
        this.sales = [];
        this.targets = [];
        this.investments = [];
        this.clientTargets = [];
        this.isHydrated = false;
    }
};
