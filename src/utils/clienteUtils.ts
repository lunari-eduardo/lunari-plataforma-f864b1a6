import { Cliente } from '@/types/orcamentos';
import { WorkflowItem } from '@/contexts/AppContext';
import { Appointment } from '@/hooks/useAgenda';

export interface ClienteMetricas {
  sessoes: number;
  totalGasto: number;
  totalPago: number;
  aReceber: number;
  ultimaSessao: string | null;
}

/**
 * Calcula todas as métricas de um cliente baseado nos dados do workflow
 */
export function calcularMetricasCliente(
  clienteId: string,
  workflowItems: WorkflowItem[],
  appointments: Appointment[]
): ClienteMetricas {
  // Filtrar items do workflow por clienteId primeiro, depois por compatibilidade
  const itemsDoCliente = workflowItems.filter(item => {
    // Priorizar clienteId se existir
    if (item.clienteId) {
      return item.clienteId === clienteId;
    }
    
    // Fallback para compatibilidade - verificar por nome, email ou whatsapp
    const cliente = item.nome?.toLowerCase().trim() || '';
    const email = item.email?.toLowerCase().trim() || '';
    
    return cliente.includes(clienteId.toLowerCase()) || 
           email.includes(clienteId.toLowerCase()) ||
           item.whatsapp === clienteId;
  });

  // Calcular métricas financeiras
  const totalGasto = itemsDoCliente.reduce((total, item) => total + (item.total || 0), 0);
  const totalPago = itemsDoCliente.reduce((total, item) => total + (item.valorPago || 0), 0);
  const aReceber = itemsDoCliente.reduce((total, item) => total + (item.restante || 0), 0);
  
  // Obter última sessão
  const ultimaSessao = getUltimaSessaoCliente(clienteId, workflowItems, appointments);

  return {
    sessoes: itemsDoCliente.length,
    totalGasto,
    totalPago,
    aReceber,
    ultimaSessao: formatarDataUltimaSessao(ultimaSessao)
  };
}

/**
 * Encontra a data da última sessão de um cliente
 */
export function getUltimaSessaoCliente(
  clienteId: string,
  workflowItems: WorkflowItem[],
  appointments: Appointment[]
): Date | null {
  let ultimaData: Date | null = null;

  // Verificar no workflow
  workflowItems.forEach(item => {
    // Priorizar clienteId se existir
    let pertenceAoCliente = false;
    
    if (item.clienteId) {
      pertenceAoCliente = item.clienteId === clienteId;
    } else {
      // Fallback para compatibilidade
      const cliente = item.nome?.toLowerCase().trim() || '';
      const email = item.email?.toLowerCase().trim() || '';
      
      pertenceAoCliente = cliente.includes(clienteId.toLowerCase()) || 
                         email.includes(clienteId.toLowerCase()) ||
                         item.whatsapp === clienteId;
    }
    
    if (pertenceAoCliente) {
      const dataItem = item.dataOriginal || new Date(item.data);
      if (!ultimaData || dataItem > ultimaData) {
        ultimaData = dataItem;
      }
    }
  });

  // Verificar nos agendamentos
  appointments.forEach(appointment => {
    if (appointment.client?.toLowerCase().includes(clienteId.toLowerCase()) ||
        appointment.whatsapp === clienteId) {
      
      const dataAppointment = appointment.date instanceof Date ? appointment.date : new Date(appointment.date);
      if (!ultimaData || dataAppointment > ultimaData) {
        ultimaData = dataAppointment;
      }
    }
  });

  return ultimaData;
}

/**
 * Formata a data da última sessão para exibição
 */
export function formatarDataUltimaSessao(data: Date | null): string | null {
  if (!data) return null;
  
  return data.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Hook para calcular métricas de todos os clientes
 */
export function useClienteMetrics(
  clientes: Cliente[],
  workflowItems: WorkflowItem[],
  appointments: Appointment[]
): Map<string, ClienteMetricas> {
  const metricas = new Map<string, ClienteMetricas>();

  clientes.forEach(cliente => {
    // Tentar múltiplos identificadores para encontrar dados do cliente
    const identificadores = [
      cliente.id,
      cliente.nome,
      cliente.email,
      cliente.telefone
    ].filter(Boolean);

    let melhorMetrica: ClienteMetricas = {
      sessoes: 0,
      totalGasto: 0,
      totalPago: 0,
      aReceber: 0,
      ultimaSessao: null
    };

    // Testar cada identificador e usar o que retornar mais dados
    identificadores.forEach(identificador => {
      const metrica = calcularMetricasCliente(identificador, workflowItems, appointments);
      if (metrica.sessoes > melhorMetrica.sessoes) {
        melhorMetrica = metrica;
      }
    });

    metricas.set(cliente.id, melhorMetrica);
  });

  return metricas;
}