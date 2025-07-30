import { storage, STORAGE_KEYS } from '@/utils/localStorage';
// Client management is now centralized in AppContext
import { useAgenda } from '@/hooks/useAgenda';
import { useWorkflow } from '@/hooks/useWorkflow';
import { parseDateFromStorage } from '@/utils/dateUtils';

// Centralized data layer for all application data
// This prepares the structure for future Supabase integration

export interface CommonEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClienteData extends CommonEntity {
  nome: string;
  telefone: string;
  email: string;
  endereco: string;
  categorias: string[];
  totalSessoes: number;
  totalPago: number;
  valorPendente: number;
  ultimaSessao: string;
  proximaSessao: string | null;
}

export interface AgendamentoData extends CommonEntity {
  clienteId: string;
  data: Date;
  hora: string;
  status: 'confirmado' | 'a confirmar';
  categoria: string;
  descricao: string;
  valorPago: number;
  pacoteId?: string;
}

export interface OrcamentoData extends CommonEntity {
  clienteId: string;
  data: string;
  hora: string;
  categoria: string;
  detalhes: string;
  pacotes: Array<{ id: string; nome: string; preco: number; quantidade: number; }>;
  valorTotal: number;
  desconto?: number;
  status: 'rascunho' | 'enviado' | 'fechado' | 'cancelado' | 'pendente' | 'follow-up';
  origemCliente: string;
}

export class DataLayer {
  // Generic data operations
  static save<T>(key: string, data: T[]): void {
    storage.save(key, data);
  }

  static load<T>(key: string, defaultValue: T[]): T[] {
    return storage.load(key, defaultValue);
  }

  // Client operations
  static saveCliente(cliente: Omit<ClienteData, 'id' | 'createdAt' | 'updatedAt'>): ClienteData {
    const newCliente: ClienteData = {
      ...cliente,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const clientes = this.load<ClienteData>(STORAGE_KEYS.CLIENTS, []);
    clientes.push(newCliente);
    this.save(STORAGE_KEYS.CLIENTS, clientes);

    return newCliente;
  }

  static updateCliente(id: string, updates: Partial<ClienteData>): void {
    const clientes = this.load<ClienteData>(STORAGE_KEYS.CLIENTS, []);
    const index = clientes.findIndex(c => c.id === id);
    
    if (index !== -1) {
      clientes[index] = {
        ...clientes[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.save(STORAGE_KEYS.CLIENTS, clientes);
    }
  }

  static getClienteById(id: string): ClienteData | null {
    const clientes = this.load<ClienteData>(STORAGE_KEYS.CLIENTS, []);
    return clientes.find(c => c.id === id) || null;
  }

  static getClienteByName(nome: string): ClienteData | null {
    const clientes = this.load<ClienteData>(STORAGE_KEYS.CLIENTS, []);
    return clientes.find(c => c.nome.toLowerCase() === nome.toLowerCase()) || null;
  }

  // Agendamento operations
  static saveAgendamento(agendamento: Omit<AgendamentoData, 'id' | 'createdAt' | 'updatedAt'>): AgendamentoData {
    const newAgendamento: AgendamentoData = {
      ...agendamento,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const agendamentos = this.load<AgendamentoData>(STORAGE_KEYS.APPOINTMENTS, []);
    agendamentos.push(newAgendamento);
    this.save(STORAGE_KEYS.APPOINTMENTS, agendamentos);

    return newAgendamento;
  }

  // Sync new clients from appointments to CRM
  static syncNewClientToCRM(clientName: string, clientPhone: string, clientEmail: string): string {
    // Check if client already exists
    const existingClient = this.getClienteByName(clientName);
    if (existingClient) {
      return existingClient.id;
    }

    // Create new client
    const newClient = this.saveCliente({
      nome: clientName,
      telefone: clientPhone,
      email: clientEmail,
      endereco: '',
      categorias: [],
      totalSessoes: 0,
      totalPago: 0,
      valorPendente: 0,
      ultimaSessao: '',
      proximaSessao: null,
    });

    return newClient.id;
  }

  // Get all clients for dropdowns/search
  static getAllClientes(): ClienteData[] {
    return this.load<ClienteData>(STORAGE_KEYS.CLIENTS, []);
  }

  // Workflow integration
  static createWorkflowFromOrcamento(orcamento: OrcamentoData): void {
    // This will be called when an orcamento status changes to 'fechado'
    // It should create both an appointment and a workflow entry
    
    const cliente = this.getClienteById(orcamento.clienteId);
    if (!cliente) return;

    // Create appointment
    const agendamento: Omit<AgendamentoData, 'id' | 'createdAt' | 'updatedAt'> = {
      clienteId: orcamento.clienteId,
      data: parseDateFromStorage(orcamento.data),
      hora: orcamento.hora,
      status: 'confirmado',
      categoria: orcamento.categoria,
      descricao: orcamento.detalhes,
      valorPago: 0,
    };

    this.saveAgendamento(agendamento);
  }

  // Data validation for Supabase preparation
  static validateData<T extends CommonEntity>(data: T): boolean {
    return !!(data.id && data.createdAt && data.updatedAt);
  }

  // Prepare data for Supabase migration
  static prepareForSupabase() {
    const allData = {
      clientes: this.load<ClienteData>(STORAGE_KEYS.CLIENTS, []),
      agendamentos: this.load<AgendamentoData>(STORAGE_KEYS.APPOINTMENTS, []),
      orcamentos: this.load<OrcamentoData>(STORAGE_KEYS.BUDGETS, []),
    };

    // Validate all data
    const validation = {
      validClientes: allData.clientes.filter(this.validateData),
      validAgendamentos: allData.agendamentos.filter(this.validateData),
      validOrcamentos: allData.orcamentos.filter(this.validateData),
    };

    console.log('Data ready for Supabase migration:', validation);
    return validation;
  }
}