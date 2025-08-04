import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';
import { STORAGE_KEYS } from '@/utils/localStorage';

export interface ClientMetrics {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  total: number;
  pago: number;
  restante: number;
  sessoes: number;
}

/**
 * CRM COM CÁLCULO DIRETO DO WORKFLOW
 * Fonte única: lunari_workflow_items do localStorage
 * Cálculo simples: filtro por clienteId + reduce
 */
export function useClientMetrics(clientes: Cliente[]) {
  const clientMetrics = useMemo(() => {
    // 1. CARREGAR WORKFLOW DO LOCALSTORAGE (fonte única)
    const workflow = JSON.parse(localStorage.getItem(STORAGE_KEYS.WORKFLOW_ITEMS) || '[]');
    
    console.log('📊 CRM CALCULATION - Workflow items loaded:', workflow.length);
    
    return clientes.map(cliente => {
      // 2. FILTRAR POR CLIENTE
      const sessoesCliente = workflow.filter((item: any) => item.clienteId === cliente.id);
      
      // 3. CALCULAR SOMATÓRIOS (como planilha)
      const total = sessoesCliente.reduce((acc: number, item: any) => acc + (item.total || 0), 0);
      const pago = sessoesCliente.reduce((acc: number, item: any) => acc + (item.valorPago || 0), 0);
      const restante = total - pago;
      const sessoes = sessoesCliente.length;
      
      console.log(`💰 Cliente ${cliente.nome}:`, {
        sessoes,
        total,
        pago,
        restante,
        workflowItems: sessoesCliente.map((item: any) => ({
          id: item.id,
          data: item.data,
          total: item.total,
          pago: item.valorPago
        }))
      });
      
      return {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        total,
        pago,
        restante,
        sessoes
      };
    });
  }, [clientes]);

  return clientMetrics;
}