/**
 * Tipos para o Sistema de Cliente Registry
 * Estrutura centralizada para dados de clientes compatível com Supabase
 */

import { WorkflowItem } from '@/contexts/AppContext';
import { Appointment } from '@/hooks/useAgenda';
import { Orcamento } from '@/types/orcamentos';

export interface ClienteBase {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ClienteMetricas {
  totalSessoes: number;
  totalFaturado: number; // Renomeado de totalGasto
  totalPago: number;
  aReceber: number;
  ultimaSessao: string | null;
  primeiroContato: string | null;
  statusFinanceiro: 'em_dia' | 'pendente' | 'inadimplente';
}

export interface ClienteHistorico {
  workflowItems: WorkflowItem[];
  appointments: Appointment[];
  orcamentos: Orcamento[];
}

export interface ClienteRegistry {
  cliente: ClienteBase;
  metricas: ClienteMetricas;
  historico: ClienteHistorico;
  relacionamentos: {
    workflowItemIds: string[];
    appointmentIds: string[];
    orcamentoIds: string[];
  };
  cache: {
    calculadoEm: string;
    versao: number;
  };
}

export interface ClienteRegistryMap {
  [clienteId: string]: ClienteRegistry;
}

// Tipos para migração e compatibilidade
export interface ClienteMigrationData {
  cliente: ClienteBase;
  workflowItems: WorkflowItem[];
  appointments: Appointment[];
  orcamentos: Orcamento[];
}

// Schema para Supabase (estrutura futura)
export interface ClienteSupabaseSchema {
  // Tabela: clients
  clients: {
    id: string;
    nome: string;
    email: string;
    telefone: string;
    created_at: string;
    updated_at: string;
  };
  
  // Tabela: client_workflow_items (relacionamento)
  client_workflow_items: {
    id: string;
    client_id: string;
    workflow_item_id: string;
    created_at: string;
  };
  
  // Tabela: client_metrics (cache calculado)
  client_metrics: {
    client_id: string;
    total_sessoes: number;
    total_gasto: number;
    total_pago: number;
    a_receber: number;
    ultima_sessao: string | null;
    primeiro_contato: string | null;
    status_financeiro: string;
    calculated_at: string;
    version: number;
  };
}