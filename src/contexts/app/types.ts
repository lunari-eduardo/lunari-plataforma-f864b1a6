import type { Cliente, OrigemCliente } from "@/types/cliente";
import type { Template } from "@/types/template";
import type { Appointment } from "@/modules/agenda/presentation";
import type { AvailabilitySlot, AvailabilityType } from "@/types/availability";
import type { CreateTransactionInput } from "@/hooks/useFinancialTransactionsSupabase";

export interface ProdutoWorkflow {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  tipo: "incluso" | "manual";
  produzido?: boolean;
  entregue?: boolean;
}

export interface RegrasPrecoFotoExtraCongeladas {
  modelo: "fixo" | "global" | "categoria";
  valorFixo?: number;
  tabelaGlobal?: {
    id: string;
    nome: string;
    faixas: Array<{
      min: number;
      max: number | null;
      valor: number;
    }>;
  };
  tabelaCategoria?: {
    id: string;
    nome: string;
    faixas: Array<{
      min: number;
      max: number | null;
      valor: number;
    }>;
  };
  categoriaId?: string;
  timestampCongelamento?: string;
  // Flags para sessões históricas manuais
  isManualHistorical?: boolean;
  source?: "manual_historical" | "appointment" | "budget";
  pacote?: {
    nome: string | null;
    valorBase: number;
    valorFotoExtra: number;
  };
  createdAt?: string;
}

export interface WorkflowItem {
  id: string;
  sessionId?: string;
  data: string;
  hora: string;
  nome: string;
  whatsapp: string;
  email: string;
  descricao: string;
  status: string;
  categoria: string;
  pacote: string;
  valorPacote: number;
  desconto: number;
  valorFotoExtra: number;
  qtdFotoExtra: number;
  valorTotalFotoExtra: number;
  produto: string;
  qtdProduto: number;
  valorTotalProduto: number;
  produtosList?: ProdutoWorkflow[];
  valorAdicional: number;
  detalhes: string;
  total: number;
  valorPago: number;
  restante: number;
  pagamentos: Array<{ id: string; valor: number; data: string }>;
  fonte: "agenda" | "orcamento";
  dataOriginal: Date;
  valorFinalAjustado?: boolean;
  valorOriginalOrcamento?: number;
  percentualAjusteOrcamento?: number;
  regrasDePrecoFotoExtraCongeladas?: RegrasPrecoFotoExtraCongeladas;
  clienteId?: string;
}

export interface WorkflowFilters {
  mes: string;
  busca: string;
}

export interface AppContextType {
  // CRM - Dados mantidos para compatibilidade
  templates: Template[];
  origens: OrigemCliente[];
  clientes: Cliente[];
  categorias: string[];
  categoriasFull: Array<{ id: string; nome: string }>;
  produtos: any[];
  pacotes: any[];

  // Agenda
  appointments: Appointment[];
  // Disponibilidades da Agenda
  availability: AvailabilitySlot[];
  availabilityTypes: AvailabilityType[];

  // Workflow
  workflowItems: WorkflowItem[];
  workflowItemsAll: WorkflowItem[];
  workflowSummary: { receita: number; aReceber: number; previsto: number };
  workflowFilters: WorkflowFilters;
  visibleColumns: Record<string, boolean>;

  // Cartões de Crédito (NOVO)
  cartoes: Array<{
    id: string;
    nome: string;
    diaVencimento: number;
    diaFechamento: number;
    ativo: boolean;
  }>;

  // CRM Actions
  adicionarTemplate: (template: Omit<Template, "id">) => Template;
  atualizarTemplate: (id: string, template: Partial<Template>) => void;
  excluirTemplate: (id: string) => void;
  definirTemplatePadrao: (id: string) => void;
  adicionarOrigem: (origem: Omit<OrigemCliente, "id">) => OrigemCliente;
  atualizarOrigem: (id: string, origem: Partial<OrigemCliente>) => void;
  excluirOrigem: (id: string) => void;
  adicionarCliente: (cliente: Omit<Cliente, "id">) => Cliente;
  atualizarCliente: (id: string, dadosAtualizados: Partial<Cliente>) => void;
  removerCliente: (id: string) => void;
  adicionarCategoria: (categoria: string) => void;
  removerCategoria: (categoria: string) => void;

  // Agenda Actions
  addAppointment: (appointment: Omit<Appointment, "id">) => Appointment;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => void;
  deleteAppointment: (id: string, preservePayments?: boolean) => void;
  // Disponibilidades Actions
  addAvailabilitySlots: (slots: AvailabilitySlot[]) => void;
  clearAvailabilityForDate: (date: string) => void;
  deleteAvailabilitySlot: (id: string) => void;
  // Tipos de Disponibilidade Actions
  addAvailabilityType: (input: { name: string; color: string }) => AvailabilityType;
  updateAvailabilityType: (id: string, updates: Partial<AvailabilityType>) => void;
  deleteAvailabilityType: (id: string) => void;

  // Workflow Actions
  updateWorkflowItem: (id: string, updates: Partial<WorkflowItem>) => void;
  addPayment: (id: string, valor: number) => void;
  toggleColumnVisibility: (column: string) => void;
  updateWorkflowFilters: (newFilters: Partial<WorkflowFilters>) => void;
  navigateMonth: (direction: number) => void;

  // Integration utility functions
  isFromBudget: (appointment: Appointment) => boolean;
  getBudgetId: (appointment: Appointment) => string | undefined;
  canEditFully: (appointment: Appointment) => boolean;

  // Cartões de Crédito Actions (NOVO)
  adicionarCartao: (cartao: { nome: string; diaVencimento: number; diaFechamento: number }) => void;
  atualizarCartao: (
    id: string,
    dadosAtualizados: Partial<{
      nome: string;
      diaVencimento: number;
      diaFechamento: number;
      ativo: boolean;
    }>,
  ) => void;
  removerCartao: (id: string) => void;

  // Motor Financeiro Centralizado (NOVO)
  createTransactionEngine: (input: CreateTransactionInput) => void;

  // Cliente pré-selecionado para agendamento
  selectedClientForScheduling: string | null;
  setSelectedClientForScheduling: (clientId: string | null) => void;
  clearSelectedClientForScheduling: () => void;
}
