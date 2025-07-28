import { useAppContext } from '@/contexts/AppContext';

export const useClientes = () => {
  const context = useAppContext();
  
  return {
    clientes: context.clientes,
    workflowItems: context.workflowItems,
    adicionarCliente: context.adicionarCliente,
    atualizarCliente: context.atualizarCliente,
    removerCliente: context.removerCliente
  };
};