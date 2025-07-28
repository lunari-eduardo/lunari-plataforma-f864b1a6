/**
 * Sistema de Cliente Registry - Fonte Única de Verdade
 * Gerencia todos os dados do cliente de forma centralizada e reativa
 */

import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { WorkflowItem } from '@/contexts/AppContext';
import { Appointment } from '@/hooks/useAgenda';
import { Cliente, Orcamento } from '@/types/orcamentos';

export interface ClienteMetricas {
  totalSessoes: number;
  totalFaturado: number;
  totalPago: number;
  aReceber: number;
  ultimaSessao: string | null;
  primeiroContato: string | null;
}

export interface ClienteRegistryData {
  cliente: Cliente;
  metricas: ClienteMetricas;
  workflowItems: WorkflowItem[];
  appointments: Appointment[];
  orcamentos: Orcamento[];
  lastUpdated: string;
}

export type ClienteRegistryMap = Record<string, ClienteRegistryData>;

class ClienteRegistryService {
  private registry: ClienteRegistryMap = {};
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Carrega dados do localStorage
   */
  private loadFromStorage(): void {
    this.registry = storage.load('cliente_registry', {});
  }

  /**
   * Salva dados no localStorage
   */
  private saveToStorage(): void {
    storage.save('cliente_registry', this.registry);
    this.notifyListeners();
  }

  /**
   * Adiciona listener para mudanças
   */
  addListener(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifica listeners sobre mudanças
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  /**
   * Sincroniza todos os dados do sistema
   */
  syncAll(): void {
    const clientes: Cliente[] = storage.load(STORAGE_KEYS.CLIENTS, []);
    const workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    const appointments: Appointment[] = storage.load(STORAGE_KEYS.APPOINTMENTS, []);
    const orcamentos: Orcamento[] = storage.load(STORAGE_KEYS.BUDGETS, []);

    console.log('🔄 ClienteRegistry: Sincronizando dados completos', {
      clientes: clientes.length,
      workflowItems: workflowItems.length,
      appointments: appointments.length,
      orcamentos: orcamentos.length
    });

    // Resetar registry
    this.registry = {};

    // Processar cada cliente
    clientes.forEach(cliente => {
      this.syncCliente(cliente, workflowItems, appointments, orcamentos);
    });

    this.saveToStorage();
    console.log('✅ ClienteRegistry: Sincronização completa finalizada');
  }

  /**
   * Sincroniza dados de um cliente específico
   */
  private syncCliente(
    cliente: Cliente, 
    allWorkflowItems: WorkflowItem[], 
    allAppointments: Appointment[], 
    allOrcamentos: Orcamento[]
  ): void {
    // Encontrar dados relacionados ao cliente
    const clienteWorkflowItems = this.findRelatedWorkflowItems(cliente, allWorkflowItems);
    const clienteAppointments = this.findRelatedAppointments(cliente, allAppointments);
    const clienteOrcamentos = this.findRelatedOrcamentos(cliente, allOrcamentos);

    // Calcular métricas
    const metricas = this.calculateMetricas(clienteWorkflowItems);

    // Atualizar registry
    this.registry[cliente.id] = {
      cliente,
      metricas,
      workflowItems: clienteWorkflowItems,
      appointments: clienteAppointments,
      orcamentos: clienteOrcamentos,
      lastUpdated: new Date().toISOString()
    };

    console.log(`📊 Cliente "${cliente.nome}" sincronizado:`, {
      workflowItems: clienteWorkflowItems.length,
      totalFaturado: metricas.totalFaturado,
      totalPago: metricas.totalPago
    });
  }

  /**
   * Encontra WorkflowItems relacionados ao cliente
   */
  private findRelatedWorkflowItems(cliente: Cliente, workflowItems: WorkflowItem[]): WorkflowItem[] {
    return workflowItems.filter(item => {
      // Prioridade 1: clienteId direto
      if (item.clienteId === cliente.id) {
        return true;
      }
      
      // Prioridade 2: nome exato
      if (item.nome && cliente.nome) {
        const nomeItem = item.nome.toLowerCase().trim();
        const nomeCliente = cliente.nome.toLowerCase().trim();
        if (nomeItem === nomeCliente) {
          return true;
        }
      }
      
      // Prioridade 3: telefone (apenas números)
      if (item.whatsapp && cliente.telefone) {
        const telefoneItem = item.whatsapp.replace(/\D/g, '');
        const telefoneCliente = cliente.telefone.replace(/\D/g, '');
        if (telefoneItem === telefoneCliente && telefoneItem.length >= 10) {
          return true;
        }
      }
      
      return false;
    });
  }

  /**
   * Encontra Appointments relacionados ao cliente
   */
  private findRelatedAppointments(cliente: Cliente, appointments: Appointment[]): Appointment[] {
    return appointments.filter(appointment => {
      const nomeMatch = appointment.client?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
      const telefoneMatch = appointment.whatsapp === cliente.telefone;
      return nomeMatch || telefoneMatch;
    });
  }

  /**
   * Encontra Orçamentos relacionados ao cliente
   */
  private findRelatedOrcamentos(cliente: Cliente, orcamentos: Orcamento[]): Orcamento[] {
    return orcamentos.filter(orcamento => {
      if (orcamento.cliente?.id === cliente.id) return true;
      
      const nomeMatch = orcamento.cliente?.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
      const emailMatch = orcamento.cliente?.email?.toLowerCase().trim() === cliente.email?.toLowerCase().trim();
      const telefoneMatch = orcamento.cliente?.telefone === cliente.telefone;
      
      return nomeMatch || emailMatch || telefoneMatch;
    });
  }

  /**
   * Calcula métricas do cliente - CORRIGINDO BUG DA DATA
   */
  private calculateMetricas(workflowItems: WorkflowItem[]): ClienteMetricas {
    const totalSessoes = workflowItems.length;
    const totalFaturado = workflowItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalPago = workflowItems.reduce((sum, item) => sum + (item.valorPago || 0), 0);
    const aReceber = workflowItems.reduce((sum, item) => sum + (item.restante || 0), 0);

    // CORREÇÃO DO BUG: Última sessão com data correta
    let ultimaSessao: string | null = null;
    let primeiroContato: string | null = null;

    if (workflowItems.length > 0) {
      const datas = workflowItems
        .map(item => {
          // Usar dataOriginal se disponível, senão usar data
          const dataSource = item.dataOriginal || item.data;
          
          // Se for string, converter para Date
          if (typeof dataSource === 'string') {
            return new Date(dataSource);
          }
          
          // Se for Date, usar diretamente
          if (dataSource instanceof Date) {
            return dataSource;
          }
          
          return null;
        })
        .filter((date): date is Date => date !== null && !isNaN(date.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());

      if (datas.length > 0) {
        // CORREÇÃO: Usar toLocaleDateString brasileiro sem ajuste de timezone
        ultimaSessao = datas[datas.length - 1].toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        });
        primeiroContato = datas[0].toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        });
      }
    }

    return {
      totalSessoes,
      totalFaturado,
      totalPago,
      aReceber,
      ultimaSessao,
      primeiroContato
    };
  }

  /**
   * Obtém dados de um cliente
   */
  getClienteData(clienteId: string): ClienteRegistryData | null {
    return this.registry[clienteId] || null;
  }

  /**
   * Obtém todos os clientes do registry
   */
  getAllClientes(): ClienteRegistryData[] {
    return Object.values(this.registry);
  }

  /**
   * Força sincronização quando há mudanças nos dados
   */
  onDataChange(): void {
    this.syncAll();
  }

  /**
   * Obtém estatísticas gerais
   */
  getStats() {
    const clientes = this.getAllClientes();
    return {
      totalClientes: clientes.length,
      totalFaturamento: clientes.reduce((sum, c) => sum + c.metricas.totalFaturado, 0),
      totalPago: clientes.reduce((sum, c) => sum + c.metricas.totalPago, 0),
      totalAReceber: clientes.reduce((sum, c) => sum + c.metricas.aReceber, 0)
    };
  }
}

// Instância singleton
export const clienteRegistry = new ClienteRegistryService();