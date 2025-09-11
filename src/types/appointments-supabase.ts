// Types for Supabase appointments system
export interface AppointmentSupabase {
  id: string;
  user_id: string;
  cliente_id?: string;
  session_id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  status: string;
  description?: string;
  package_id?: string;
  paid_amount?: number;
  orcamento_id?: string;
  origem?: 'agenda' | 'orcamento';
  created_at?: string;
  updated_at?: string;
}

export interface ClientesSessaoSupabase {
  id: string;
  user_id: string;
  cliente_id: string;
  session_id: string;
  appointment_id?: string;
  orcamento_id?: string;
  data_sessao: string;
  hora_sessao: string;
  categoria: string;
  pacote?: string;
  descricao?: string;
  status: string;
  valor_total: number;
  valor_pago: number;
  produtos_incluidos: any;
  created_at?: string;
  updated_at?: string;
}

export interface ClientesTransacaoSupabase {
  id: string;
  user_id: string;
  cliente_id: string;
  session_id?: string;
  tipo: 'pagamento' | 'desconto' | 'ajuste';
  valor: number;
  descricao?: string;
  data_transacao: string;
  created_at?: string;
}

// Utils for SessionID generation
export function generateUniversalSessionId(prefix: string = 'session'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${prefix}-${timestamp}-${random}`;
}

export function generateSessionIdFromSource(sourceId: string, sourceType: 'orcamento' | 'agenda' | 'direct'): string {
  return `${sourceType}-${sourceId}-${Date.now()}`;
}