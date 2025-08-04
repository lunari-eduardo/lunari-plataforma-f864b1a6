import { useMemo, useState, useEffect } from 'react';
import { Cliente } from '@/types/orcamentos';
import { WorkflowItem } from '@/contexts/AppContext';
import { storage, STORAGE_KEYS } from '@/utils/localStorage';

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

export function useClientMetrics(clientes: Cliente[]) {
  const [workflowSessions, setWorkflowSessions] = useState<any[]>([]);

  // ESPELHAMENTO DIRETO: Leitura direta de workflow_sessions
  useEffect(() => {
    const loadWorkflowSessions = () => {
      try {
        const saved = localStorage.getItem('workflow_sessions');
        const sessions = saved ? JSON.parse(saved) : [];
        setWorkflowSessions(sessions);
        
        console.log('🔗 ESPELHAMENTO DIRETO - Sessions carregadas:', sessions.length);
      } catch (error) {
        console.error('❌ Erro ao carregar workflow_sessions:', error);
        setWorkflowSessions([]);
      }
    };

    loadWorkflowSessions();
    
    // Escutar mudanças no localStorage para sincronização em tempo real
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'workflow_sessions') {
        loadWorkflowSessions();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Polling otimizado para detectar mudanças
    const intervalId = setInterval(loadWorkflowSessions, 2000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, []);

  // Função para converter valores monetários
  const parseMonetaryValue = (value: string | number): number => {
    if (typeof value === 'number') return value;
    if (!value || typeof value !== 'string') return 0;
    
    const cleanValue = value
      .replace(/R\$\s*/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim();
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  const clientMetrics = useMemo(() => {
    const debugMode = process.env.NODE_ENV === 'development';

    // CÁLCULO DIRETO DOS VALORES usando workflow_sessions
    const metrics: ClientMetrics[] = clientes.map(cliente => {
      // FILTRO: associar por clienteId OU nome
      const sessoesCliente = workflowSessions.filter(session => {
        const matchByClienteId = session.clienteId === cliente.id;
        const matchByName = !session.clienteId && session.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
        return matchByClienteId || matchByName;
      });

      // CÁLCULOS usando valores diretos de workflow_sessions
      const sessoes = sessoesCliente.length;
      const totalFaturado = sessoesCliente.reduce((acc, session) => {
        const valor = parseMonetaryValue(session.total || session.valor || 0);
        return acc + valor;
      }, 0);
      const totalPago = sessoesCliente.reduce((acc, session) => {
        const valor = parseMonetaryValue(session.valorPago || 0);
        return acc + valor;
      }, 0);
      const aReceber = totalFaturado - totalPago;

      // LOG para debug
      if (debugMode && totalFaturado > 0) {
        console.log(`💰 ${cliente.nome}: Total R$ ${totalFaturado.toFixed(2)} | Pago R$ ${totalPago.toFixed(2)} | A Receber R$ ${aReceber.toFixed(2)}`);
      }

      // Encontrar última sessão
      let ultimaSessao: Date | null = null;
      if (sessoesCliente.length > 0) {
        const datasOrdenadas = sessoesCliente
          .map(session => new Date(session.data))
          .filter(data => !isNaN(data.getTime()))
          .sort((a, b) => b.getTime() - a.getTime());
        
        if (datasOrdenadas.length > 0) {
          ultimaSessao = datasOrdenadas[0];
        }
      }

      return {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        sessoes,
        totalFaturado,
        totalPago,
        aReceber,
        ultimaSessao
      };
    });

    // LOG resumo final
    if (debugMode && workflowSessions.length > 0) {
      const totalGeral = metrics.reduce((acc, m) => acc + m.totalFaturado, 0);
      console.log('✅ ESPELHAMENTO DIRETO - CRM Metrics:', {
        clientesComSessoes: metrics.filter(m => m.sessoes > 0).length,
        totalFaturamento: totalGeral.toFixed(2)
      });
    }

    return metrics;
  }, [clientes, workflowSessions]);

  return clientMetrics;
}