/**
 * Helpers para blindar dados do Workflow contra valores ausentes/corrompidos.
 * 
 * Usado antes de qualquer .toFixed() ou render — evita TypeError em produção
 * quando o cache local ou um realtime parcial traz campos undefined/null.
 */

import type { WorkflowSession } from '@/hooks/useWorkflowRealtime';

export const toSafeNumber = (value: any, fallback = 0): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const formatBRL = (value: any, fallback = 0): string => {
  return `R$ ${toSafeNumber(value, fallback).toFixed(2).replace('.', ',')}`;
};

export const safeArray = <T = any>(value: any): T[] => {
  return Array.isArray(value) ? value : [];
};

/**
 * Normaliza uma sessão vinda do Supabase, IndexedDB, realtime ou cache legado.
 * Garante que todos os campos numéricos e estruturais tenham defaults seguros.
 */
export function normalizeWorkflowSession(session: any): WorkflowSession {
  if (!session || typeof session !== 'object') {
    return session;
  }

  return {
    ...session,
    valor_total: toSafeNumber(session.valor_total),
    valor_pago: toSafeNumber(session.valor_pago),
    valor_base_pacote: toSafeNumber(session.valor_base_pacote),
    valor_foto_extra: toSafeNumber(session.valor_foto_extra),
    valor_total_foto_extra: toSafeNumber(session.valor_total_foto_extra),
    valor_adicional: toSafeNumber(session.valor_adicional),
    desconto: toSafeNumber(session.desconto),
    qtd_fotos_extra: toSafeNumber(session.qtd_fotos_extra),
    produtos_incluidos: safeArray(session.produtos_incluidos),
    regras_congeladas: session.regras_congeladas ?? null,
    descricao: session.descricao ?? '',
    observacoes: session.observacoes ?? '',
    detalhes: session.detalhes ?? '',
    status: session.status ?? 'agendado',
    clientes: session.clientes ?? null,
  } as WorkflowSession;
}

export function normalizeWorkflowSessions(sessions: any[]): WorkflowSession[] {
  return safeArray(sessions).map(normalizeWorkflowSession);
}
