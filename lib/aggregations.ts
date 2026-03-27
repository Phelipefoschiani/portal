import { Sale, VendaConsolidada, ClienteUltimaCompra, VendaClienteMes, VendaCanalMes, VendaProdutoMes } from '../types';

export function aggregateSales(sales: Sale[]) {
  const vendasConsolidadasMap = new Map<string, VendaConsolidada>();
  const clientesUltimaCompraMap = new Map<string, ClienteUltimaCompra>();
  const vendasClientesMesMap = new Map<string, VendaClienteMes>();
  const vendasCanaisMesMap = new Map<string, VendaCanalMes>();
  const vendasProdutosMesMap = new Map<string, VendaProdutoMes>();

  for (const s of sales) {
    const d = new Date(s.data + 'T00:00:00');
    const ano = d.getUTCFullYear();
    const mes = d.getUTCMonth() + 1;
    const fat = Number(s.faturamento) || 0;
    const qtd = Number(s.quantidade || s.qtde_faturado) || 0;

    // 1. Vendas Consolidadas
    const vcKey = `${s.usuario_id}_${s.cnpj}_${ano}_${mes}`;
    if (!vendasConsolidadasMap.has(vcKey)) {
      vendasConsolidadasMap.set(vcKey, { 
        cnpj: s.cnpj, 
        ano, 
        mes, 
        faturamento_total: 0, 
        qtde_total: 0,
        cliente_nome: s.cliente_nome,
        cidade: s.cidade || '',
        estado: '', // Assuming estado is not in Sale, or we can leave it empty
        usuario_id: s.usuario_id,
        representante_nome: '', // Assuming we don't have it here
        canal_vendas: s.canal_vendas
      });
    }
    const vc = vendasConsolidadasMap.get(vcKey)!;
    vc.faturamento_total += fat;
    vc.qtde_total += qtd;

    // 2. Cliente Última Compra
    const cucKey = s.cnpj;
    if (!clientesUltimaCompraMap.has(cucKey)) {
      clientesUltimaCompraMap.set(cucKey, { cnpj: s.cnpj, ultima_compra: s.data, valor_ultima_compra: fat });
    } else {
      const cuc = clientesUltimaCompraMap.get(cucKey)!;
      if (s.data > cuc.ultima_compra) {
        cuc.ultima_compra = s.data;
        cuc.valor_ultima_compra = fat;
      } else if (s.data === cuc.ultima_compra) {
        cuc.valor_ultima_compra += fat;
      }
    }

    // 3. Vendas Clientes Mês
    const vcmKey = `${s.usuario_id}_${s.cnpj}_${ano}_${mes}`;
    if (!vendasClientesMesMap.has(vcmKey)) {
      vendasClientesMesMap.set(vcmKey, { usuario_id: s.usuario_id, cnpj: s.cnpj, cliente_nome: s.cliente_nome, ano, mes, faturamento_total: 0 });
    }
    const vcm = vendasClientesMesMap.get(vcmKey)!;
    vcm.faturamento_total += fat;

    // 4. Vendas Canais Mês
    const vcanKey = `${s.usuario_id}_${s.cnpj}_${s.canal_vendas}_${ano}_${mes}`;
    if (!vendasCanaisMesMap.has(vcanKey)) {
      vendasCanaisMesMap.set(vcanKey, { usuario_id: s.usuario_id, cnpj: s.cnpj, cliente_nome: s.cliente_nome, canal_vendas: s.canal_vendas, ano, mes, faturamento_total: 0 });
    }
    const vcan = vendasCanaisMesMap.get(vcanKey)!;
    vcan.faturamento_total += fat;

    // 5. Vendas Produtos Mês
    const vpmKey = `${s.usuario_id}_${s.cnpj}_${s.codigo_produto}_${ano}_${mes}`;
    if (!vendasProdutosMesMap.has(vpmKey)) {
      vendasProdutosMesMap.set(vpmKey, { usuario_id: s.usuario_id, cnpj: s.cnpj, cliente_nome: s.cliente_nome, produto: s.produto_nome || s.produto, codigo_produto: s.codigo_produto, grupo: s.grupo, ano, mes, faturamento_total: 0, qtde_total: 0 });
    }
    const vpm = vendasProdutosMesMap.get(vpmKey)!;
    vpm.faturamento_total += fat;
    vpm.qtde_total += qtd;
  }

  return {
    vendasConsolidadas: Array.from(vendasConsolidadasMap.values()),
    clientesUltimaCompra: Array.from(clientesUltimaCompraMap.values()),
    vendasClientesMes: Array.from(vendasClientesMesMap.values()),
    vendasCanaisMes: Array.from(vendasCanaisMesMap.values()),
    vendasProdutosMes: Array.from(vendasProdutosMesMap.values()),
  };
}
