// Compatibility hook - budget system removed
import { useAppContext } from '@/contexts/AppContext';

export const useOrcamentos = () => {
  const context = useAppContext();
  
  return {
    orcamentos: [],
    templates: context.templates,
    origens: context.origens,
    clientes: context.clientes,
    categorias: context.categorias,
    produtos: context.produtos,
    pacotes: context.pacotes,
    metricas: { totalMes: 0, enviados: 0, fechados: 0, perdidos: 0, pendentes: 0, taxaConversao: 0 },
    adicionarOrcamento: () => ({ id: '', cliente: { id: '', nome: '', email: '', telefone: '' }, data: '', hora: '', categoria: '', detalhes: '', valorFinal: 0, desconto: 0, status: 'pendente' as const, origemCliente: '', criadoEm: '' }),
    atualizarOrcamento: () => {},
    excluirOrcamento: () => {},
    adicionarTemplate: context.adicionarTemplate,
    atualizarTemplate: context.atualizarTemplate,
    excluirTemplate: context.excluirTemplate,
    definirTemplatePadrao: context.definirTemplatePadrao,
    adicionarOrigem: context.adicionarOrigem,
    atualizarOrigem: context.atualizarOrigem,
    excluirOrigem: context.excluirOrigem,
    adicionarCliente: context.adicionarCliente,
    adicionarCategoria: context.adicionarCategoria,
    removerCategoria: context.removerCategoria,
  };
};