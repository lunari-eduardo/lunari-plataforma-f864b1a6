/**
 * Tipos de domínio — Módulo Contratos.
 */

export type ContratoStatus =
  | "rascunho"
  | "enviado"
  | "assinado"
  | "cancelado";

export interface ContratoTemplateResumo {
  id: string;
  nome: string;
  categoria: string | null;
  ativo: boolean;
  isPadrao: boolean;
  atualizadoEm: string;
}

export interface ContratoResumo {
  id: string;
  titulo: string;
  status: ContratoStatus | string;
  clienteId: string;
  sessionId: string | null;
  templateId: string | null;
  enviadoEm: string | null;
  assinadoEm: string | null;
  atualizadoEm: string;
}

export interface ContratosFiltros {
  search: string;
  status: ContratoStatus | "all";
  clienteId: string | null;
}

/** Variáveis oficiais reconhecidas pelo motor de templates da Lunari. */
export const CONTRATO_VARIAVEIS_SUPORTADAS = [
  "cliente_nome",
  "cliente_email",
  "cliente_telefone",
  "cliente_documento",
  "session_data",
  "session_local",
  "session_valor",
  "fotografo_nome",
  "fotografo_email",
  "estudio_nome",
] as const;
export type ContratoVariavel = (typeof CONTRATO_VARIAVEIS_SUPORTADAS)[number];
