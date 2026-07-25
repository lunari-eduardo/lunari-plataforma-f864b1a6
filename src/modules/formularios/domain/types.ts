/**
 * Tipos de domínio — Módulo Formulários.
 *
 * Mantido enxuto até que capabilities sejam introduzidas. Reflete os campos
 * mínimos que o snapshot de IA consome. Contratos Zod virão junto às
 * capabilities de escrita.
 */

export type FormularioStatus = "rascunho" | "publicado" | "arquivado";
export type FormularioTipo =
  | "briefing"
  | "posvenda"
  | "captura"
  | "custom";

export interface FormularioResumo {
  id: string;
  titulo: string;
  tipo?: FormularioTipo | null;
  status?: FormularioStatus | null;
  respostasCount?: number;
  atualizadoEm?: string | null; // ISO
  publico?: boolean;
}

export interface RespostaResumo {
  id: string;
  formularioId: string;
  clienteId?: string | null;
  submetidoEm: string; // ISO
  fechado?: boolean;
}

export interface FormulariosFiltros {
  search: string;
  tipo: FormularioTipo | "all";
  status: FormularioStatus | "all";
}
