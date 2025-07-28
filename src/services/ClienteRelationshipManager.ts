/**
 * Cliente Relationship Manager
 * 
 * Serviço centralizado para gerenciar dados de clientes e suas relações
 * Prepara a base para migração futura ao Supabase
 */

import { storage, STORAGE_KEYS } from '@/utils/localStorage';
import { WorkflowItem } from '@/contexts/AppContext';
import { Appointment } from '@/hooks/useAgenda';
import { Orcamento, Cliente } from '@/types/orcamentos';
import { 
  ClienteRegistry, 
  ClienteRegistryMap, 
  ClienteBase, 
  ClienteMetricas, 
  ClienteHistorico,
  ClienteMigrationData 
} from '@/types/cliente';

const CLIENTE_REGISTRY_KEY = 'lunari_cliente_registry';
const CACHE_VERSION = 1;

export class ClienteRelationshipManager {
  private static registry: ClienteRegistryMap = {};
  private static initialized = false;

  /**
   * Inicializa o sistema carregando dados existentes
   */
  static initialize(): void {
    if (this.initialized) return;
    
    console.log('🚀 ClienteRelationshipManager: Inicializando sistema...');
    
    try {
      this.loadRegistryFromStorage();
      this.migrateExistingData();
      this.initialized = true;
      
      console.log('✅ ClienteRelationshipManager: Sistema inicializado com sucesso');
    } catch (error) {
      console.error('❌ ClienteRelationshipManager: Erro na inicialização:', error);
      throw error;
    }
  }

  /**
   * Carrega o registry do localStorage
   */
  private static loadRegistryFromStorage(): void {
    this.registry = storage.load(CLIENTE_REGISTRY_KEY, {});
  }

  /**
   * Salva o registry no localStorage
   */
  private static saveRegistryToStorage(): void {
    storage.save(CLIENTE_REGISTRY_KEY, this.registry);
  }

  /**
   * Migra dados existentes para a nova estrutura
   */
  private static migrateExistingData(): void {
    const clientes: Cliente[] = storage.load(STORAGE_KEYS.CLIENTS, []);
    const workflowItems: WorkflowItem[] = storage.load(STORAGE_KEYS.WORKFLOW_ITEMS, []);
    const appointments: Appointment[] = storage.load(STORAGE_KEYS.APPOINTMENTS, []);
    const orcamentos: Orcamento[] = storage.load(STORAGE_KEYS.BUDGETS, []);

    console.log('🔄 Migrando dados existentes para Cliente Registry...');
    console.log(`Clientes: ${clientes.length}, Workflow: ${workflowItems.length}, Agenda: ${appointments.length}, Orçamentos: ${orcamentos.length}`);
    
    // Debug detalhado dos dados
    console.log('📊 Clientes encontrados:', clientes.map(c => ({ id: c.id, nome: c.nome })));
    console.log('📊 WorkflowItems encontrados:', workflowItems.map(w => ({ 
      id: w.id, 
      nome: w.nome, 
      clienteId: w.clienteId, 
      email: w.email, 
      whatsapp: w.whatsapp 
    })));

    clientes.forEach(cliente => {
      if (!this.registry[cliente.id]) {
        const clienteBase = this.convertToClienteBase(cliente);
        const relatedWorkflow = this.findRelatedWorkflowItems(clienteBase, workflowItems);
        const relatedAppointments = this.findRelatedAppointments(clienteBase, appointments);
        const relatedOrcamentos = this.findRelatedOrcamentos(clienteBase, orcamentos);
        
        console.log(`🔗 Cliente ${cliente.nome}:`, {
          workflow: relatedWorkflow.length,
          appointments: relatedAppointments.length,
          orcamentos: relatedOrcamentos.length,
          workflowDetails: relatedWorkflow.map(w => ({ id: w.id, nome: w.nome, total: w.total }))
        });

        const migrationData: ClienteMigrationData = {
          cliente: clienteBase,
          workflowItems: relatedWorkflow,
          appointments: relatedAppointments,
          orcamentos: relatedOrcamentos
        };

        this.registry[cliente.id] = this.createRegistryEntry(migrationData);
      }
    });

    this.saveRegistryToStorage();
    console.log(`✅ Migração concluída. ${Object.keys(this.registry).length} clientes no registry`);
  }

  /**
   * Converte Cliente para ClienteBase
   */
  private static convertToClienteBase(cliente: Cliente): ClienteBase {
    return {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };
  }

  /**
   * Encontra WorkflowItems relacionados a um cliente
   */
  private static findRelatedWorkflowItems(cliente: ClienteBase, workflowItems: WorkflowItem[]): WorkflowItem[] {
    const relacionados = workflowItems.filter(item => {
      // Priorizar clienteId se existir
      if (item.clienteId) {
        const match = item.clienteId === cliente.id;
        if (match) console.log(`✅ Match por clienteId: ${item.nome} -> ${cliente.nome}`);
        return match;
      }
      
      // Fallback: busca por nome, email ou telefone (normalizado)
      const normalizeName = (name: string) => name?.toLowerCase().trim().replace(/\s+/g, ' ') || '';
      const normalizeEmail = (email: string) => email?.toLowerCase().trim() || '';
      const normalizePhone = (phone: string) => phone?.replace(/\D/g, '') || '';
      
      const nomeMatch = normalizeName(item.nome) === normalizeName(cliente.nome);
      const emailMatch = item.email && cliente.email && normalizeEmail(item.email) === normalizeEmail(cliente.email);
      const telefoneMatch = item.whatsapp && normalizePhone(item.whatsapp) === normalizePhone(cliente.telefone);
      
      if (nomeMatch || emailMatch || telefoneMatch) {
        console.log(`✅ Match por dados: ${item.nome} -> ${cliente.nome} (nome: ${nomeMatch}, email: ${emailMatch}, tel: ${telefoneMatch})`);
      }
      
      return nomeMatch || emailMatch || telefoneMatch;
    });
    
    console.log(`🔍 Busca para ${cliente.nome}: encontrados ${relacionados.length} workflow items`);
    return relacionados;
  }

  /**
   * Encontra Appointments relacionados a um cliente
   */
  private static findRelatedAppointments(cliente: ClienteBase, appointments: Appointment[]): Appointment[] {
    return appointments.filter(appointment => {
      const nomeMatch = appointment.client?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
      const telefoneMatch = appointment.whatsapp === cliente.telefone;
      
      return nomeMatch || telefoneMatch;
    });
  }

  /**
   * Encontra Orçamentos relacionados a um cliente
   */
  private static findRelatedOrcamentos(cliente: ClienteBase, orcamentos: Orcamento[]): Orcamento[] {
    return orcamentos.filter(orcamento => {
      if (orcamento.cliente?.id === cliente.id) return true;
      
      const nomeMatch = orcamento.cliente?.nome?.toLowerCase().trim() === cliente.nome.toLowerCase().trim();
      const emailMatch = orcamento.cliente?.email?.toLowerCase().trim() === cliente.email.toLowerCase().trim();
      const telefoneMatch = orcamento.cliente?.telefone === cliente.telefone;
      
      return nomeMatch || emailMatch || telefoneMatch;
    });
  }

  /**
   * Cria uma entrada no registry
   */
  private static createRegistryEntry(data: ClienteMigrationData): ClienteRegistry {
    const metricas = this.calculateMetricas(data.workflowItems, data.appointments);
    
    return {
      cliente: data.cliente,
      metricas,
      historico: {
        workflowItems: data.workflowItems,
        appointments: data.appointments,
        orcamentos: data.orcamentos
      },
      relacionamentos: {
        workflowItemIds: data.workflowItems.map(item => item.id),
        appointmentIds: data.appointments.map(app => app.id),
        orcamentoIds: data.orcamentos.map(orc => orc.id)
      },
      cache: {
        calculadoEm: new Date().toISOString(),
        versao: CACHE_VERSION
      }
    };
  }

  /**
   * Calcula métricas de um cliente
   */
  private static calculateMetricas(workflowItems: WorkflowItem[], appointments: Appointment[]): ClienteMetricas {
    const totalSessoes = workflowItems.length;
    const totalGasto = workflowItems.reduce((total, item) => total + (item.total || 0), 0);
    const totalPago = workflowItems.reduce((total, item) => total + (item.valorPago || 0), 0);
    const aReceber = workflowItems.reduce((total, item) => total + (item.restante || 0), 0);

    // Encontrar última sessão
    let ultimaData: Date | null = null;
    workflowItems.forEach(item => {
      const dataItem = item.dataOriginal || new Date(item.data);
      if (!ultimaData || dataItem > ultimaData) {
        ultimaData = dataItem;
      }
    });

    appointments.forEach(appointment => {
      const dataApp = appointment.date instanceof Date ? appointment.date : new Date(appointment.date);
      if (!ultimaData || dataApp > ultimaData) {
        ultimaData = dataApp;
      }
    });

    // Encontrar primeiro contato
    let primeiraData: Date | null = null;
    workflowItems.forEach(item => {
      const dataItem = item.dataOriginal || new Date(item.data);
      if (!primeiraData || dataItem < primeiraData) {
        primeiraData = dataItem;
      }
    });

    // Determinar status financeiro
    let statusFinanceiro: 'em_dia' | 'pendente' | 'inadimplente' = 'em_dia';
    if (aReceber > 0) {
      statusFinanceiro = 'pendente';
      // TODO: Implementar lógica de inadimplência baseada em prazo
    }

    return {
      totalSessoes,
      totalGasto,
      totalPago,
      aReceber,
      ultimaSessao: ultimaData ? ultimaData.toLocaleDateString('pt-BR') : null,
      primeiroContato: primeiraData ? primeiraData.toLocaleDateString('pt-BR') : null,
      statusFinanceiro
    };
  }

  /**
   * Obtém dados de um cliente pelo ID
   */
  static getClienteRegistry(clienteId: string): ClienteRegistry | null {
    this.initialize();
    return this.registry[clienteId] || null;
  }

  /**
   * Obtém todos os clientes do registry
   */
  static getAllClientesRegistry(): ClienteRegistryMap {
    this.initialize();
    return { ...this.registry };
  }

  /**
   * Atualiza ou cria um cliente no registry
   */
  static updateClienteRegistry(clienteId: string, cliente: ClienteBase): void {
    this.initialize();
    
    // Se não existe, criar novo
    if (!this.registry[clienteId]) {
      const migrationData: ClienteMigrationData = {
        cliente,
        workflowItems: [],
        appointments: [],
        orcamentos: []
      };
      this.registry[clienteId] = this.createRegistryEntry(migrationData);
    } else {
      // Atualizar dados do cliente
      this.registry[clienteId].cliente = {
        ...cliente,
        atualizadoEm: new Date().toISOString()
      };
    }
    
    this.saveRegistryToStorage();
  }

  /**
   * Adiciona um WorkflowItem ao registry de um cliente
   */
  static addWorkflowItemToCliente(clienteId: string, workflowItem: WorkflowItem): void {
    this.initialize();
    
    const registry = this.registry[clienteId];
    if (!registry) {
      console.warn(`Cliente ${clienteId} não encontrado no registry`);
      return;
    }

    // Adicionar ao histórico se não existir
    const exists = registry.historico.workflowItems.some(item => item.id === workflowItem.id);
    if (!exists) {
      registry.historico.workflowItems.push(workflowItem);
      registry.relacionamentos.workflowItemIds.push(workflowItem.id);
      
      // Recalcular métricas
      registry.metricas = this.calculateMetricas(
        registry.historico.workflowItems, 
        registry.historico.appointments
      );
      
      // Atualizar cache
      registry.cache = {
        calculadoEm: new Date().toISOString(),
        versao: CACHE_VERSION
      };
      
      this.saveRegistryToStorage();
    }
  }

  /**
   * Remove um cliente do registry
   */
  static removeClienteRegistry(clienteId: string): void {
    this.initialize();
    delete this.registry[clienteId];
    this.saveRegistryToStorage();
  }

  /**
   * Força recálculo de métricas para todos os clientes
   */
  static recalculateAllMetrics(): void {
    this.initialize();
    
    Object.keys(this.registry).forEach(clienteId => {
      const registry = this.registry[clienteId];
      registry.metricas = this.calculateMetricas(
        registry.historico.workflowItems,
        registry.historico.appointments
      );
      registry.cache = {
        calculadoEm: new Date().toISOString(),
        versao: CACHE_VERSION
      };
    });
    
    this.saveRegistryToStorage();
    console.log('✅ Métricas recalculadas para todos os clientes');
  }

  /**
   * Obtém estatísticas do registry
   */
  static getRegistryStats(): {
    totalClientes: number;
    totalSessoes: number;
    totalFaturamento: number;
    ultimaAtualizacao: string;
  } {
    this.initialize();
    
    const clientes = Object.values(this.registry);
    const totalClientes = clientes.length;
    const totalSessoes = clientes.reduce((total, registry) => total + registry.metricas.totalSessoes, 0);
    const totalFaturamento = clientes.reduce((total, registry) => total + registry.metricas.totalGasto, 0);
    
    let ultimaAtualizacao = '';
    clientes.forEach(registry => {
      if (registry.cache.calculadoEm > ultimaAtualizacao) {
        ultimaAtualizacao = registry.cache.calculadoEm;
      }
    });

    return {
      totalClientes,
      totalSessoes,
      totalFaturamento,
      ultimaAtualizacao
    };
  }
}