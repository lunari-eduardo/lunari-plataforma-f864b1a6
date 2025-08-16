
import { useAppContext } from '@/contexts/AppContext';

export const useOrcamentos = () => {
  const context = useAppContext();
  
  return {
    orcamentos: context.orcamentos,
    templates: context.templates,
    origens: context.origens,
    clientes: context.clientes,
    categorias: context.categorias,
    produtos: context.produtos,
    pacotes: context.pacotes,
    metricas: context.metricas,
    adicionarOrcamento: context.adicionarOrcamento,
    atualizarOrcamento: context.atualizarOrcamento,
    excluirOrcamento: context.excluirOrcamento,
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
