/**
 * Capabilities de ESCRITA — módulo Leads (Bloco B1).
 *
 * Toda escrita passa por RLS (`user_id`) e mantém o histórico do lead:
 * mudanças de status escrevem em `historico_status` e `interacoes`.
 * Conversão e exclusão exigem aprovação humana (ver `ai/permissions.ts`).
 */
import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";
import { LEAD_FULL_COLS } from "./leads";

type Json = Record<string, unknown>;

const nowIso = () => new Date().toISOString();

const LeadRefSchema = z.object({
  id: z.string(),
  nome: z.string(),
  status: z.string().nullable(),
  cliente_id: z.string().nullable(),
  arquivado: z.boolean().nullable(),
  updated_at: z.string(),
});

const REF_COLS = "id, nome, status, cliente_id, arquivado, updated_at";

async function loadLead(id: string) {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_FULL_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Json | null;
}

function appendInteracao(
  current: unknown,
  entry: {
    leadId: string;
    tipo: "conversa" | "manual" | "followup" | "mudanca_status" | "orcamento";
    descricao: string;
    automatica?: boolean;
    statusAnterior?: string | null;
    statusNovo?: string | null;
  },
) {
  const list = Array.isArray(current) ? [...(current as unknown[])] : [];
  list.push({
    id: crypto.randomUUID(),
    leadId: entry.leadId,
    tipo: entry.tipo,
    descricao: entry.descricao.slice(0, 500),
    timestamp: nowIso(),
    automatica: entry.automatica ?? false,
    ...(entry.statusAnterior ? { statusAnterior: entry.statusAnterior } : {}),
    ...(entry.statusNovo ? { statusNovo: entry.statusNovo } : {}),
  });
  return list.slice(-200);
}

/* ================================ CREATE ================================ */

export const createLeadCap = defineCommand({
  id: "leads.create",
  title: "Criar lead",
  description:
    "Cria um lead no topo do funil. Nome obrigatório; status default é o primeiro estágio configurado.",
  input: z
    .object({
      nome: z.string(),
      email: z.string().nullable().optional(),
      telefone: z.string().nullable().optional(),
      whatsapp: z.string().nullable().optional(),
      origem: z.string().nullable().optional(),
      status: z.string().optional(),
      observacoes: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    })
    .strict(),
  output: LeadRefSchema,
  permissions: ["leads:write"],
  sideEffects: ["db:leads"],
  handler: async (input, ctx) => {
    const nome = input.nome.trim();
    if (!nome) return err(domainError("VALIDATION", "Nome é obrigatório."));
    if (nome.length > 120) return err(domainError("VALIDATION", "Nome muito longo."));
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));

    let status = input.status;
    if (!status) {
      const { data: first } = await supabase
        .from("lead_statuses")
        .select("key")
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      status = first?.key ?? "novo";
    }

    const payload = {
      user_id: ctx.user.id,
      nome,
      email: input.email ?? null,
      telefone: input.telefone ?? null,
      whatsapp: input.whatsapp ?? null,
      origem: input.origem ?? "manual",
      status,
      observacoes: input.observacoes ?? null,
      tags: input.tags ?? [],
      status_timestamp: nowIso(),
      interacoes: [
        {
          id: crypto.randomUUID(),
          leadId: "",
          tipo: "criacao",
          descricao: "Lead criado",
          timestamp: nowIso(),
          automatica: true,
        },
      ],
    };

    const { data, error } = await supabase
      .from("leads")
      .insert(payload as never)
      .select(REF_COLS)
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(data as never);
  },
});

/* ================================ UPDATE ================================ */

export const updateLeadCap = defineCommand({
  id: "leads.update",
  title: "Atualizar lead",
  description:
    "Atualiza dados cadastrais do lead (nome, contato, origem, observações, tags). Não muda status — use leads.moveStatus.",
  input: z
    .object({
      id: z.string(),
      nome: z.string().optional(),
      email: z.string().nullable().optional(),
      telefone: z.string().nullable().optional(),
      whatsapp: z.string().nullable().optional(),
      origem: z.string().nullable().optional(),
      observacoes: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    })
    .strict(),
  output: LeadRefSchema,
  permissions: ["leads:write"],
  sideEffects: ["db:leads"],
  handler: async (input) => {
    const { id, ...rest } = input;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (Object.keys(patch).length === 0) {
      return err(domainError("VALIDATION", "Informe pelo menos um campo para atualizar."));
    }
    if (typeof patch.nome === "string") {
      const nome = patch.nome.trim();
      if (!nome) return err(domainError("VALIDATION", "Nome não pode ficar vazio."));
      patch.nome = nome;
    }
    const { data, error } = await supabase
      .from("leads")
      .update(patch as never)
      .eq("id", id)
      .select(REF_COLS)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Lead não encontrado."));
    return ok(data as never);
  },
});

/* ============================== INTERAÇÕES ============================== */

export const addLeadInteracaoCap = defineCommand({
  id: "leads.addInteracao",
  title: "Registrar interação no lead",
  description:
    "Anexa uma interação (conversa, follow-up, nota manual) ao histórico do lead e zera o contador de dias sem contato.",
  input: z
    .object({
      id: z.string(),
      descricao: z.string(),
      tipo: z.enum(["conversa", "manual", "followup", "orcamento"]).default("manual"),
    })
    .strict(),
  output: LeadRefSchema,
  permissions: ["leads:write"],
  sideEffects: ["db:leads"],
  handler: async ({ id, descricao, tipo }) => {
    const texto = descricao.trim();
    if (!texto) return err(domainError("VALIDATION", "Descrição vazia."));
    let lead: Json | null;
    try {
      lead = await loadLead(id);
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
    if (!lead) return err(domainError("NOT_FOUND", "Lead não encontrado."));

    const interacoes = appendInteracao(lead.interacoes, {
      leadId: id,
      tipo,
      descricao: texto,
    });

    const { data, error } = await supabase
      .from("leads")
      .update({
        interacoes,
        ultima_interacao: nowIso(),
        dias_sem_interacao: 0,
        needs_follow_up: false,
      } as never)
      .eq("id", id)
      .select(REF_COLS)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    return ok(data as never);
  },
});

/* ============================= MOVER STATUS ============================= */

export const moveLeadStatusCap = defineCommand({
  id: "leads.moveStatus",
  title: "Mover lead de estágio",
  description:
    "Move o lead para outro estágio do funil, registrando histórico e interação automática. Para perda use leads.markLost.",
  input: z
    .object({
      id: z.string(),
      status: z.string(),
      nota: z.string().optional(),
    })
    .strict(),
  output: LeadRefSchema,
  permissions: ["leads:write"],
  sideEffects: ["db:leads"],
  handler: async ({ id, status, nota }) => {
    const { data: statusDef, error: sErr } = await supabase
      .from("lead_statuses")
      .select("key, name, is_lost")
      .eq("key", status)
      .maybeSingle();
    if (sErr) return err(domainError("DB", sErr.message));
    if (!statusDef) {
      return err(
        domainError("VALIDATION", `Estágio "${status}" não existe. Use leads.listStatuses.`),
      );
    }
    if (statusDef.is_lost) {
      return err(
        domainError("VALIDATION", "Estágio de perda: use leads.markLost com o motivo."),
      );
    }

    let lead: Json | null;
    try {
      lead = await loadLead(id);
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
    if (!lead) return err(domainError("NOT_FOUND", "Lead não encontrado."));

    const anterior = (lead.status as string | null) ?? null;
    if (anterior === status) return err(domainError("VALIDATION", "Lead já está nesse estágio."));

    const historico = Array.isArray(lead.historico_status)
      ? [...(lead.historico_status as unknown[])]
      : [];
    historico.push({ status, timestamp: nowIso(), statusAnterior: anterior });

    const interacoes = appendInteracao(lead.interacoes, {
      leadId: id,
      tipo: "mudanca_status",
      descricao: nota?.trim() || `Movido para ${statusDef.name}`,
      automatica: !nota,
      statusAnterior: anterior,
      statusNovo: status,
    });

    const { data, error } = await supabase
      .from("leads")
      .update({
        status,
        status_timestamp: nowIso(),
        historico_status: historico.slice(-100),
        interacoes,
        ultima_interacao: nowIso(),
        dias_sem_interacao: 0,
        needs_follow_up: false,
      } as never)
      .eq("id", id)
      .select(REF_COLS)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    return ok(data as never);
  },
});

/* ================================ PERDA ================================= */

export const markLeadLostCap = defineCommand({
  id: "leads.markLost",
  title: "Marcar lead como perdido",
  description:
    "Marca o lead como perdido com motivo obrigatório, preservando o histórico. Reversível via leads.moveStatus.",
  input: z
    .object({
      id: z.string(),
      motivo: z.string(),
      status: z.string().optional(),
    })
    .strict(),
  output: LeadRefSchema,
  permissions: ["leads:write"],
  sideEffects: ["db:leads"],
  handler: async ({ id, motivo, status }) => {
    const razao = motivo.trim();
    if (!razao) return err(domainError("VALIDATION", "Motivo da perda é obrigatório."));

    let statusKey = status;
    if (!statusKey) {
      const { data: lost } = await supabase
        .from("lead_statuses")
        .select("key")
        .eq("is_lost", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      statusKey = lost?.key;
    }
    if (!statusKey) {
      return err(domainError("VALIDATION", "Nenhum estágio de perda configurado no funil."));
    }

    let lead: Json | null;
    try {
      lead = await loadLead(id);
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
    if (!lead) return err(domainError("NOT_FOUND", "Lead não encontrado."));

    const interacoes = appendInteracao(lead.interacoes, {
      leadId: id,
      tipo: "mudanca_status",
      descricao: `Lead perdido: ${razao}`,
      automatica: true,
      statusAnterior: (lead.status as string | null) ?? null,
      statusNovo: statusKey,
    });

    const { data, error } = await supabase
      .from("leads")
      .update({
        status: statusKey,
        motivo_perda: razao.slice(0, 300),
        perdido_em: nowIso(),
        status_timestamp: nowIso(),
        interacoes,
        needs_follow_up: false,
      } as never)
      .eq("id", id)
      .select(REF_COLS)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    return ok(data as never);
  },
});

/* =============================== ARQUIVAR =============================== */

export const archiveLeadCap = defineCommand({
  id: "leads.archive",
  title: "Arquivar ou desarquivar lead",
  description:
    "Oculta o lead do funil sem apagar dados (arquivar) ou o traz de volta (desarquivar).",
  input: z.object({ id: z.string(), arquivado: z.boolean().default(true) }).strict(),
  output: LeadRefSchema,
  permissions: ["leads:write"],
  sideEffects: ["db:leads"],
  handler: async ({ id, arquivado }) => {
    const { data, error } = await supabase
      .from("leads")
      .update({ arquivado } as never)
      .eq("id", id)
      .select(REF_COLS)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Lead não encontrado."));
    return ok(data as never);
  },
});

/* =============================== CONVERSÃO =============================== */

export const convertLeadToClienteCap = defineCommand({
  id: "leads.convertToCliente",
  title: "Converter lead em cliente",
  description:
    "Cria (ou vincula) um cliente a partir do lead e marca o lead como convertido. Exige aprovação humana.",
  input: z
    .object({
      id: z.string(),
      clienteId: z.string().optional(),
      status: z.string().optional(),
    })
    .strict(),
  output: z.object({
    lead: LeadRefSchema,
    clienteId: z.string(),
    clienteCriado: z.boolean(),
  }),
  permissions: ["leads:write", "clientes:write"],
  sideEffects: ["db:leads", "db:clientes"],
  handler: async ({ id, clienteId, status }, ctx) => {
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));

    let lead: Json | null;
    try {
      lead = await loadLead(id);
    } catch (e) {
      return err(domainError("DB", (e as Error).message));
    }
    if (!lead) return err(domainError("NOT_FOUND", "Lead não encontrado."));
    if (lead.cliente_id) {
      return err(domainError("VALIDATION", "Lead já está vinculado a um cliente."));
    }

    let finalClienteId = clienteId ?? null;
    let clienteCriado = false;

    if (!finalClienteId) {
      const { data: novo, error: cErr } = await supabase
        .from("clientes")
        .insert({
          user_id: ctx.user.id,
          nome: lead.nome as string,
          email: (lead.email as string | null) ?? null,
          telefone: (lead.telefone as string | null) ?? null,
          whatsapp: (lead.whatsapp as string | null) ?? null,
          origem: (lead.origem as string | null) ?? "lead",
        } as never)
        .select("id")
        .single();
      if (cErr) return err(domainError("DB", cErr.message));
      finalClienteId = novo.id;
      clienteCriado = true;
    }

    let statusKey = status;
    if (!statusKey) {
      const { data: conv } = await supabase
        .from("lead_statuses")
        .select("key")
        .eq("is_converted", true)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      statusKey = conv?.key ?? (lead.status as string | null) ?? undefined;
    }

    const interacoes = appendInteracao(lead.interacoes, {
      leadId: id,
      tipo: "mudanca_status",
      descricao: clienteCriado
        ? "Lead convertido em cliente (novo cadastro)"
        : "Lead vinculado a cliente existente",
      automatica: true,
      statusAnterior: (lead.status as string | null) ?? null,
      statusNovo: statusKey ?? null,
    });

    const { data, error } = await supabase
      .from("leads")
      .update({
        cliente_id: finalClienteId,
        ...(statusKey ? { status: statusKey, status_timestamp: nowIso() } : {}),
        interacoes,
        ultima_interacao: nowIso(),
        dias_sem_interacao: 0,
        needs_follow_up: false,
      } as never)
      .eq("id", id)
      .select(REF_COLS)
      .maybeSingle();
    if (error) return err(domainError("DB", error.message));

    return ok({
      lead: data as never,
      clienteId: finalClienteId as string,
      clienteCriado,
    });
  },
});
