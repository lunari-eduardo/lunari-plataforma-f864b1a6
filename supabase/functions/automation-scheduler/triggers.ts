/**
 * triggers.ts — Onda 4 (D2): detectores por tempo do Automation Engine.
 *
 * Cada detector é SOMENTE LEITURA e escopado a um único usuário. Ele nunca
 * escreve no domínio: devolve candidatos (`entityId` + `windowKey` + payload)
 * que o scheduler enfileira e o executor materializa como capability.
 *
 * `windowKey` é a chave de idempotência temporal — junto com
 * (user_id, rule_id, entity_id) forma o índice único que impede o mesmo
 * gatilho de disparar duas vezes na mesma janela.
 */
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type TriggerKind =
  | "lead.stalled"
  | "session.no_gallery"
  | "charge.pending_stale";

export const TRIGGER_KINDS: TriggerKind[] = [
  "lead.stalled",
  "session.no_gallery",
  "charge.pending_stale",
];

export interface TriggerCandidate {
  entityId: string;
  windowKey: string;
  payload: {
    title: string;
    description: string;
    relatedClienteId?: string | null;
    relatedSessionId?: string | null;
  };
}

export interface TriggerConfig {
  /** Dias de inatividade/atraso antes de disparar. */
  days?: number;
  /** Teto de candidatos por ciclo — protege contra avalanche na 1ª ativação. */
  maxPerCycle?: number;
}

const DEFAULTS: Record<TriggerKind, Required<TriggerConfig>> = {
  "lead.stalled": { days: 7, maxPerCycle: 10 },
  "session.no_gallery": { days: 7, maxPerCycle: 10 },
  "charge.pending_stale": { days: 5, maxPerCycle: 10 },
};

export function resolveConfig(kind: TriggerKind, raw: unknown): Required<TriggerConfig> {
  const base = DEFAULTS[kind];
  const cfg = (raw ?? {}) as TriggerConfig;
  const days = Number.isFinite(cfg.days) ? Math.min(365, Math.max(1, Number(cfg.days))) : base.days;
  const maxPerCycle = Number.isFinite(cfg.maxPerCycle)
    ? Math.min(50, Math.max(1, Number(cfg.maxPerCycle)))
    : base.maxPerCycle;
  return { days, maxPerCycle };
}

/** Janela diária — o mesmo gatilho só reincide no dia seguinte. */
function dayWindow(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function dateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

const LEAD_CLOSED = ["convertido", "perdido", "ganho", "fechado", "descartado"];

async function detectLeadStalled(
  supabase: SupabaseClient,
  userId: string,
  cfg: Required<TriggerConfig>,
): Promise<TriggerCandidate[]> {
  const cutoff = daysAgoISO(cfg.days);
  const { data, error } = await supabase
    .from("leads")
    .select("id, nome, status, ultima_interacao, created_at, cliente_id")
    .eq("user_id", userId)
    .or("arquivado.is.null,arquivado.eq.false")
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;

  const out: TriggerCandidate[] = [];
  for (const l of (data ?? []) as any[]) {
    const status = String(l.status ?? "").toLowerCase();
    if (LEAD_CLOSED.some((s) => status.includes(s))) continue;
    const last = l.ultima_interacao ?? l.created_at;
    if (!last || last > cutoff) continue;
    out.push({
      entityId: String(l.id),
      windowKey: dayWindow(),
      payload: {
        title: `Follow-up: ${l.nome ?? "lead"} parado há ${cfg.days}+ dias`,
        description:
          `Este lead está sem interação registrada desde ${String(last).slice(0, 10)}. ` +
          `Tarefa criada automaticamente pelo Automation Engine.`,
        relatedClienteId: l.cliente_id ?? null,
      },
    });
    if (out.length >= cfg.maxPerCycle) break;
  }
  return out;
}

async function detectSessionNoGallery(
  supabase: SupabaseClient,
  userId: string,
  cfg: Required<TriggerConfig>,
): Promise<TriggerCandidate[]> {
  const cutoff = dateDaysAgo(cfg.days);
  const floor = dateDaysAgo(cfg.days + 120); // não caça histórico antigo
  const { data, error } = await supabase
    .from("clientes_sessoes")
    .select("id, session_id, cliente_id, data_sessao, galeria_id, status")
    .eq("user_id", userId)
    .is("galeria_id", null)
    .lte("data_sessao", cutoff)
    .gte("data_sessao", floor)
    .order("data_sessao", { ascending: false })
    .limit(cfg.maxPerCycle);
  if (error) throw error;

  return ((data ?? []) as any[]).map((s) => ({
    entityId: String(s.id),
    windowKey: dayWindow(),
    payload: {
      title: `Montar galeria da sessão de ${String(s.data_sessao ?? "").slice(0, 10)}`,
      description:
        `Sessão realizada há ${cfg.days}+ dias e ainda sem galeria vinculada. ` +
        `Tarefa criada automaticamente pelo Automation Engine.`,
      relatedClienteId: s.cliente_id ?? null,
      relatedSessionId: s.session_id ?? null,
    },
  }));
}

const CHARGE_OPEN = ["pendente", "pending", "aguardando", "aguardando_pagamento", "criada"];

async function detectChargePendingStale(
  supabase: SupabaseClient,
  userId: string,
  cfg: Required<TriggerConfig>,
): Promise<TriggerCandidate[]> {
  const cutoff = daysAgoISO(cfg.days);
  const floor = daysAgoISO(cfg.days + 90);
  const { data, error } = await supabase
    .from("cobrancas")
    .select("id, cliente_id, session_id, valor, descricao, status, created_at")
    .eq("user_id", userId)
    .in("status", CHARGE_OPEN)
    .lte("created_at", cutoff)
    .gte("created_at", floor)
    .order("created_at", { ascending: true })
    .limit(cfg.maxPerCycle);
  if (error) throw error;

  return ((data ?? []) as any[]).map((c) => ({
    entityId: String(c.id),
    windowKey: dayWindow(),
    payload: {
      title: `Cobrança em aberto há ${cfg.days}+ dias — ${c.descricao ?? "sem descrição"}`,
      description:
        `Cobrança de R$ ${Number(c.valor ?? 0).toFixed(2)} criada em ` +
        `${String(c.created_at ?? "").slice(0, 10)} continua pendente. ` +
        `Tarefa criada automaticamente pelo Automation Engine.`,
      relatedClienteId: c.cliente_id ?? null,
      relatedSessionId: c.session_id ?? null,
    },
  }));
}

export async function detect(
  kind: TriggerKind,
  supabase: SupabaseClient,
  userId: string,
  rawConfig: unknown,
): Promise<TriggerCandidate[]> {
  const cfg = resolveConfig(kind, rawConfig);
  switch (kind) {
    case "lead.stalled":
      return detectLeadStalled(supabase, userId, cfg);
    case "session.no_gallery":
      return detectSessionNoGallery(supabase, userId, cfg);
    case "charge.pending_stale":
      return detectChargePendingStale(supabase, userId, cfg);
    default:
      return [];
  }
}
