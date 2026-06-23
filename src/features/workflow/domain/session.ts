/**
 * Domain canonical — WorkflowSession
 * Zero React, zero Supabase. Single source of truth for session shape.
 *
 * Mantém compatibilidade 1:1 com a interface que hoje vive em
 * `src/hooks/useWorkflowRealtime.ts` para permitir re-export como shim.
 */

export interface WorkflowSessionClienteEmbed {
  nome: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
}

export interface WorkflowSession {
  id: string;
  user_id: string;
  cliente_id: string;
  session_id: string;
  appointment_id?: string;
  orcamento_id?: string;
  data_sessao: string; // YYYY-MM-DD
  hora_sessao: string; // HH:MM
  categoria: string;
  pacote?: string;
  descricao?: string;
  status: string;
  valor_total: number;
  valor_base_pacote?: number;
  valor_pago: number;
  produtos_incluidos: unknown;
  qtd_fotos_extra?: number;
  valor_foto_extra?: number;
  valor_total_foto_extra?: number;
  regras_congeladas?: unknown;
  desconto?: number;
  valor_adicional?: number;
  observacoes?: string | null;
  detalhes?: string | null;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
  /** Computado pelo Postgres — string vinda do banco. */
  status_financeiro?: string;
  /** Embed do JOIN clientes. */
  clientes?: WorkflowSessionClienteEmbed;
  /** Pagamentos anexados via batch query. */
  pagamentos?: unknown[];
  /** Integração galeria — campos opcionais usados pela UI. */
  galeria_id?: string;
  galerias?: {
    valor_total_vendido?: number;
    total_fotos_extras_vendidas?: number;
  };
}

/** Helpers de identificação (somente leitura, sem efeitos). */
export const getSessionPrimaryKey = (s: Pick<WorkflowSession, "id">): string => s.id;
export const getSessionTextId = (s: Pick<WorkflowSession, "session_id">): string => s.session_id;

/** Extrai (year, month) 1-indexed da string YYYY-MM-DD, sem timezone. */
export function getSessionYearMonth(dateString: string | null | undefined): { year: number; month: number } | null {
  if (!dateString || typeof dateString !== "string") return null;
  const [yearStr, monthStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return null;
  return { year, month };
}

/** Chave canônica para bucketização por mês. */
export const monthBucketKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;

/** Invariantes mínimos — não lança, retorna lista de erros. */
export function validateSessionInvariants(s: Partial<WorkflowSession>): string[] {
  const errors: string[] = [];
  if (!s.id) errors.push("session.id ausente");
  if (!s.user_id) errors.push("session.user_id ausente");
  if (s.data_sessao && !/^\d{4}-\d{2}-\d{2}$/.test(s.data_sessao)) {
    errors.push("session.data_sessao deve ser YYYY-MM-DD");
  }
  if (typeof s.valor_total === "number" && s.valor_total < 0) {
    errors.push("session.valor_total negativo");
  }
  if (typeof s.valor_pago === "number" && s.valor_pago < 0) {
    errors.push("session.valor_pago negativo");
  }
  return errors;
}
