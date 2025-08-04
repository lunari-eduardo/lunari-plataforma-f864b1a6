import { useMemo } from 'react';
import { Cliente } from '@/types/orcamentos';
import { getSimplifiedClientMetrics, autoFixIfNeeded, SimplifiedMetrics } from '@/utils/crmDataFix';

export interface ClientMetrics {
  id: string;
  nome: string;
  email: string;
  telefone: string;
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
    
    // Converter para formato ClientMetrics
    return simplifiedMetrics.map(metric => ({
      id: metric.id,
      nome: metric.nome,
      email: metric.email,
      telefone: metric.telefone,
      sessoes: metric.totalSessoes,
      totalFaturado: metric.totalFaturado,
      totalPago: metric.totalPago,
      aReceber: metric.aReceber,
      ultimaSessao: metric.ultimaSessao
    }));
  }, [clientes]);
}