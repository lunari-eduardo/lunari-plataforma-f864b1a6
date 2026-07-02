/**
 * Helpers para blindar dados do Workflow contra valores ausentes/corrompidos.
 * 
 * Usado antes de qualquer .toFixed() ou render — evita TypeError em produção
 * quando o cache local ou um realtime parcial traz campos undefined/null.
 */

import type { WorkflowSession } from '@/features/workflow';

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
    status: session.status ?? null,
    clientes: session.clientes ?? null,
  } as WorkflowSession;
}

export function normalizeWorkflowSessions(sessions: any[]): WorkflowSession[] {
  return safeArray(sessions).map(normalizeWorkflowSession);
}

/**
 * Normalização PARCIAL: só toca em campos efetivamente presentes no payload.
 * Use para mesclar fetches incompletos (ex.: payment-created listener) sem
 * sobrescrever campos populados no cache com defaults (0, null, '', []).
 */
export function normalizeWorkflowSessionPartial(session: any): Partial<WorkflowSession> {
  if (!session || typeof session !== 'object') return session;

  const out: any = { ...session };

  const numericFields = [
    'valor_total',
    'valor_pago',
    'valor_base_pacote',
    'valor_foto_extra',
    'valor_total_foto_extra',
    'valor_adicional',
    'desconto',
    'qtd_fotos_extra',
  ];
  for (const f of numericFields) {
    if (session[f] !== undefined && session[f] !== null) {
      out[f] = toSafeNumber(session[f]);
    }
  }

  if (Array.isArray(session.produtos_incluidos)) {
    out.produtos_incluidos = safeArray(session.produtos_incluidos);
  }

  // Campos string/object: só normaliza se vieram explicitamente no payload
  // (não força defaults — preserva o valor existente no cache).

  return out as Partial<WorkflowSession>;
}
