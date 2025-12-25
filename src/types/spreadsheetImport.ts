/**
 * Tipos para importação de planilha do Workflow
 */

export interface SpreadsheetSession {
  // Dados do cliente
  cliente_nome: string;
  cliente_email?: string;
  cliente_whatsapp?: string;
  
  // Dados da sessão
  data_sessao: string; // YYYY-MM-DD
  hora_sessao: string; // HH:MM
  categoria: string;
  pacote?: string;
  status?: string;
  descricao?: string;
  observacoes?: string;
  detalhes?: string;
  
  // Valores financeiros
  valor_base_pacote?: number;
  valor_foto_extra?: number;
  qtd_fotos_extra?: number;
  valor_total_foto_extra?: number;
  valor_adicional?: number;
  desconto?: number;
  valor_total?: number;
  valor_pago?: number;
}

export interface SpreadsheetPayment {
  session_ref: string; // Referência à sessão (linha ou identificador)
  data_transacao: string; // YYYY-MM-DD
  valor: number;
  descricao?: string;
}

export interface ParsedSpreadsheet {
  sessions: SpreadsheetSession[];
  payments: SpreadsheetPayment[];
  errors: ParseError[];
  warnings: string[];
}

export interface ParseError {
  row: number;
  column?: string;
  message: string;
  value?: any;
}

export interface ImportResult {
  success: boolean;
  imported: {
    clients: number;
    sessions: number;
    payments: number;
  };
  errors: ImportError[];
  skipped: number;
}

export interface ImportError {
  row: number;
  message: string;
  data?: any;
}

export interface ImportProgress {
  current: number;
  total: number;
  phase: 'parsing' | 'validating' | 'importing_clients' | 'importing_sessions' | 'importing_payments' | 'done';
  message: string;
}

// Mapeamento de colunas esperadas
export const EXPECTED_COLUMNS = {
  sessions: [
    { key: 'cliente_nome', label: 'Nome do Cliente', required: true },
    { key: 'cliente_email', label: 'Email do Cliente', required: false },
    { key: 'cliente_whatsapp', label: 'WhatsApp', required: false },
    { key: 'data_sessao', label: 'Data da Sessão', required: true },
    { key: 'hora_sessao', label: 'Hora', required: true },
    { key: 'categoria', label: 'Categoria', required: true },
    { key: 'pacote', label: 'Pacote', required: false },
    { key: 'status', label: 'Status', required: false },
    { key: 'valor_base_pacote', label: 'Valor Base Pacote', required: false },
    { key: 'valor_foto_extra', label: 'Valor Foto Extra', required: false },
    { key: 'qtd_fotos_extra', label: 'Qtd Fotos Extra', required: false },
    { key: 'valor_total_foto_extra', label: 'Valor Total Foto Extra', required: false },
    { key: 'valor_adicional', label: 'Valor Adicional', required: false },
    { key: 'desconto', label: 'Desconto', required: false },
    { key: 'valor_total', label: 'Valor Total', required: false },
    { key: 'valor_pago', label: 'Valor Pago', required: false },
    { key: 'descricao', label: 'Descrição', required: false },
    { key: 'observacoes', label: 'Observações', required: false },
    { key: 'detalhes', label: 'Detalhes', required: false },
  ],
  payments: [
    { key: 'session_ref', label: 'Referência Sessão', required: true },
    { key: 'data_transacao', label: 'Data Pagamento', required: true },
    { key: 'valor', label: 'Valor', required: true },
    { key: 'descricao', label: 'Descrição', required: false },
  ]
} as const;

// Status válidos
export const VALID_STATUSES = [
  'agendado',
  'confirmado', 
  'realizado',
  'editando',
  'entregue',
  'cancelado'
];
