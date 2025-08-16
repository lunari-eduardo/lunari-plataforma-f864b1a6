import { useMemo } from 'react';
import { Cliente } from '@/types/cliente';
import { getSimplifiedClientMetrics, autoFixIfNeeded, SimplifiedMetrics } from '@/utils/crmDataFix';

export interface ClientMetrics {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  origem?: string;
  sessoes: number;
  totalFaturado: number;
  totalPago: number;
  aReceber: number;
  ultimaSessao: Date | null;
}

export function useClientMetrics(clientes: Cliente[]): ClientMetrics[] {
  return useMemo(() => {
    // Executar correção automática se necessário
    autoFixIfNeeded();
    
    // Obter métricas simplificadas e precisas
    const simplifiedMetrics = getSimplifiedClientMetrics(clientes);
    
    // Converter para formato ClientMetrics incluindo origem dos dados originais
    return simplifiedMetrics.map(metric => {
      // Buscar cliente original para pegar a origem
      const clienteOriginal = clientes.find(c => c.id === metric.id);
      
      return {
        id: metric.id,
        nome: metric.nome,
        email: metric.email,
        telefone: metric.telefone,
        origem: clienteOriginal?.origem || '',
        sessoes: metric.totalSessoes,
        totalFaturado: metric.totalFaturado,
        totalPago: metric.totalPago,
        aReceber: metric.aReceber,
        ultimaSessao: metric.ultimaSessao
      };
    });
  }, [clientes]);
}