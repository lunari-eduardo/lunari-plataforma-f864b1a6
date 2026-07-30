/**
 * Capabilities de LEITURA — módulo Leads (Bloco B1).
 *
 * Projeção enxuta sobre `leads`, `lead_statuses`, `lead_follow_up_config`
 * e (para orçamentos) `appointments` com `type = 'budget'`.
 * RLS por `user_id` — nenhuma query filtra manualmente por usuário.
 */
import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";

export const LEAD_SUMMARY_COLS =
  "id, nome, email, telefone, whatsapp, status, origem, tags, cliente_id, arquivado, needs_follow_up, dias_sem_interacao, ultima_interacao, created_at, updated_at";

export const LEAD_FULL_COLS = `${LEAD_SUMMARY_COLS}, observacoes, interacoes, historico_status, motivo_perda, perdido_em, data_contato, data_nascimento, endereco, needs_scheduling, scheduled_appointment_id, status_timestamp`;

const LeadSummarySchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string().nullable(),
  telefone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  status: z.string().nullable(),
  origem: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  cliente_id: z.string().nullable(),
  arquivado: z.boolean().nullable(),
  needs_follow_up: z.boolean().nullable(),
  dias_sem_interacao: z.number().nullable(),
  ultima_interacao: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const LeadFullSchema = LeadSummarySchema.extend({
  observacoes: z.string().nullable(),
  interacoes: z.unknown().nullable(),
  historico_status: z.unknown().nullable(),
  motivo_perda: z.string().nullable(),
  perdido_em: z.string().nullable(),
  data_contato: z.string().nullable(),
  data_nascimento: z.string().nullable(),
  endereco: z.string().nullable(),
  needs_scheduling: z.boolean().nullable(),
  scheduled_appointment_id: z.string().nullable(),
  status_timestamp: z.string().nullable(),
});

/* ============================== LISTAGEM ============================== */

export const listLeadsCap = defineQuery({
  id: "leads.list",
  title: "Listar leads",
  description:
    "Lista leads do funil com filtros por status, origem, tag, período de criação e busca por nome/email/telefone. Arquivados ocultos por padrão.",
  input: z
    .object({
      status: z.string().optional(),
      origem: z.string().optional(),
      tag: z.string().optional(),
      search: z.string().optional(),
      arquivados: z.enum(["ocultar", "incluir", "somente"]).default("ocultar"),
      desde: z.string().optional(),
      ate: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
      offset: z.number().int().nonnegative().default(0),
    })
    .strict(),
  output: z.object({ items: z.array(LeadSummarySchema), count: z.number() }),
  permissions: ["leads:read"],
  handler: async (input) => {
    let q = supabase
      .from("leads")
      .select(LEAD_SUMMARY_COLS, { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);

    if (input.status) q = q.eq("status", input.status);
    if (input.origem) q = q.eq("origem", input.origem);
    if (input.tag) q = q.contains("tags", [input.tag]);
    if (input.desde) q = q.gte("created_at", input.desde);
    if (input.ate) q = q.lte("created_at", input.ate);
    if (input.arquivados === "ocultar") q = q.or("arquivado.is.null,arquivado.eq.false");
    if (input.arquivados === "somente") q = q.eq("arquivado", true);
    if (input.search && input.search.trim().length >= 2) {
      const like = `%${input.search.trim()}%`;
      q = q.or(`nome.ilike.${like},email.ilike.${like},telefone.ilike.${like}`);
    }

    const { data, error, count } = await q;
    if (error) return err(domainError("DB", error.message));
    return ok({ items: (data ?? []) as never, count: count ?? 0 });
  },
});

export const getLeadCap = defineQuery({
  id: "leads.get",
  title: "Obter lead",
  description:
    "Retorna o lead completo, incluindo interações, histórico de status e motivo de perda.",
  input: z.object({ id: z.string() }).strict(),
  output: LeadFullSchema.nullable(),
  permissions: ["leads:read"],
  handler: async ({ id }) => {
    const { data, error } = await supabase
      .from("leads")
      .select(LEAD_FULL_COLS)
      .eq("id", id)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    return ok((data ?? null) as never);
  },
});

export const listLeadStatusesCap = defineQuery({
  id: "leads.listStatuses",
  title: "Listar estágios do funil",
  description:
    "Colunas do kanban de leads na ordem configurada, indicando quais representam conversão e perda.",
  input: z.object({}).strict(),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        key: z.string(),
        name: z.string(),
        color: z.string().nullable(),
        sort_order: z.number(),
        is_converted: z.boolean().nullable(),
        is_lost: z.boolean().nullable(),
      }),
    ),
  }),
  permissions: ["leads:read"],
  handler: async () => {
    const { data, error } = await supabase
      .from("lead_statuses")
      .select("id, key, name, color, sort_order, is_converted, is_lost")
      .order("sort_order", { ascending: true });
    if (error) return err(domainError("DB", error.message));
    return ok({ items: (data ?? []) as never });
  },
});

/* =============================== MÉTRICAS =============================== */

export const leadsMetricsCap = defineQuery({
  id: "leads.metrics",
  title: "Métricas do funil de leads",
  description:
    "Totais por estágio, por origem, conversões, perdas com motivo e taxa de conversão no período informado (default: mês corrente).",
  input: z
    .object({
      desde: z.string().optional(),
      ate: z.string().optional(),
    })
    .strict(),
  output: z.object({
    periodo: z.object({ desde: z.string(), ate: z.string() }),
    total: z.number(),
    porStatus: z.record(z.number()),
    porOrigem: z.record(z.number()),
    convertidos: z.number(),
    perdidos: z.number(),
    motivosPerda: z.record(z.number()),
    taxaConversao: z.number(),
  }),
  permissions: ["leads:read"],
  handler: async ({ desde, ate }) => {
    const now = new Date();
    const start =
      desde ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end =
      ate ?? new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [{ data: statuses, error: sErr }, { data: rows, error: lErr }] = await Promise.all([
      supabase.from("lead_statuses").select("key, is_converted, is_lost"),
      supabase
        .from("leads")
        .select("status, origem, motivo_perda, cliente_id")
        .gte("created_at", start)
        .lte("created_at", `${end}T23:59:59.999Z`)
        .limit(5000),
    ]);
    if (sErr) return err(domainError("DB", sErr.message));
    if (lErr) return err(domainError("DB", lErr.message));

    const convertedKeys = new Set(
      (statuses ?? []).filter((s) => s.is_converted).map((s) => s.key),
    );
    const lostKeys = new Set((statuses ?? []).filter((s) => s.is_lost).map((s) => s.key));

    const porStatus: Record<string, number> = {};
    const porOrigem: Record<string, number> = {};
    const motivosPerda: Record<string, number> = {};
    let convertidos = 0;
    let perdidos = 0;

    for (const r of rows ?? []) {
      const status = r.status ?? "sem_status";
      porStatus[status] = (porStatus[status] ?? 0) + 1;
      const origem = r.origem ?? "sem_origem";
      porOrigem[origem] = (porOrigem[origem] ?? 0) + 1;
      if (convertedKeys.has(status) || r.cliente_id) convertidos += 1;
      if (lostKeys.has(status)) {
        perdidos += 1;
        const motivo = r.motivo_perda ?? "nao_informado";
        motivosPerda[motivo] = (motivosPerda[motivo] ?? 0) + 1;
      }
    }

    const total = (rows ?? []).length;
    return ok({
      periodo: { desde: start, ate: end },
      total,
      porStatus,
      porOrigem,
      convertidos,
      perdidos,
      motivosPerda,
      taxaConversao: total > 0 ? Number(((convertidos / total) * 100).toFixed(1)) : 0,
    });
  },
});

/* ============================== FOLLOW-UP ============================== */

export const listFollowUpsDueCap = defineQuery({
  id: "leads.listFollowUpsDue",
  title: "Listar follow-ups pendentes",
  description:
    "Leads marcados para follow-up ou parados há mais dias que o configurado em lead_follow_up_config.",
  input: z
    .object({ limit: z.number().int().positive().max(100).default(30) })
    .strict(),
  output: z.object({
    config: z
      .object({
        ativo: z.boolean().nullable(),
        dias_para_follow_up: z.number().nullable(),
        status_monitorado: z.string().nullable(),
      })
      .nullable(),
    items: z.array(LeadSummarySchema),
  }),
  permissions: ["leads:read"],
  handler: async ({ limit }) => {
    const { data: cfg, error: cErr } = await supabase
      .from("lead_follow_up_config")
      .select("ativo, dias_para_follow_up, status_monitorado")
      .maybeSingle();
    if (cErr) return err(domainError("DB", cErr.message));

    const dias = cfg?.dias_para_follow_up ?? 7;
    let q = supabase
      .from("leads")
      .select(LEAD_SUMMARY_COLS)
      .or("arquivado.is.null,arquivado.eq.false")
      .or(`needs_follow_up.eq.true,dias_sem_interacao.gte.${dias}`)
      .order("dias_sem_interacao", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (cfg?.status_monitorado) q = q.eq("status", cfg.status_monitorado);

    const { data, error } = await q;
    if (error) return err(domainError("DB", error.message));
    return ok({ config: cfg ?? null, items: (data ?? []) as never });
  },
});

/* ============================== ORÇAMENTOS ============================== */

export const listOrcamentosAgendadosCap = defineQuery({
  id: "leads.listOrcamentosAgendados",
  title: "Listar orçamentos agendados",
  description:
    "Projeção de orçamentos sobre a agenda (compromissos do tipo 'budget'), por período e/ou cliente. O Lunari não possui tabela própria de orçamentos.",
  input: z
    .object({
      desde: z.string().optional(),
      ate: z.string().optional(),
      clienteId: z.string().optional(),
      limit: z.number().int().positive().max(200).default(50),
    })
    .strict(),
  output: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        date: z.string(),
        time: z.string(),
        status: z.string().nullable(),
        cliente_id: z.string().nullable(),
        session_id: z.string(),
        paid_amount: z.number().nullable(),
      }),
    ),
  }),
  permissions: ["leads:read"],
  handler: async ({ desde, ate, clienteId, limit }) => {
    let q = supabase
      .from("appointments")
      .select(
        "id, title, description, date, time, status, cliente_id, session_id, paid_amount",
      )
      .eq("type", "budget")
      .order("date", { ascending: false })
      .limit(limit);
    if (desde) q = q.gte("date", desde);
    if (ate) q = q.lte("date", ate);
    if (clienteId) q = q.eq("cliente_id", clienteId);
    const { data, error } = await q;
    if (error) return err(domainError("DB", error.message));
    return ok({ items: (data ?? []) as never });
  },
});
