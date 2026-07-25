/**
 * Capabilities operacionais — Etapas de trabalho.
 *
 * P6.A tranche 2. Etapas com `is_system_status = true` são protegidas
 * (não podem ser renomeadas nem removidas). Move usa `ordem`.
 */
import { z } from "zod";
import { defineCommand, defineQuery } from "@/shared/capability";
import { supabase } from "@/integrations/supabase/client";
import { domainError, err, ok } from "@/shared/result";

const EtapaSchema = z.object({
  id: z.string(),
  nome: z.string(),
  cor: z.string(),
  ordem: z.number(),
  is_system_status: z.boolean().nullable(),
  is_hidden_in_workflow: z.boolean(),
});

export const listEtapasCap = defineQuery({
  id: "configuracoes.listEtapas",
  title: "Listar etapas",
  description: "Lista etapas ordenadas.",
  input: z.object({}).strict(),
  output: z.object({ items: z.array(EtapaSchema) }),
  permissions: [],
  handler: async () => {
    const { data, error } = await supabase
      .from("etapas_trabalho")
      .select("id, nome, cor, ordem, is_system_status, is_hidden_in_workflow")
      .order("ordem");
    if (error) return err(domainError("DB", error.message));
    return ok({ items: data ?? [] });
  },
});

export const createEtapaCap = defineCommand({
  id: "configuracoes.createEtapa",
  title: "Criar etapa",
  description: "Cria nova etapa customizada no final da lista.",
  input: z.object({
    nome: z.string(),
    cor: z.string(),
  }).strict(),
  output: EtapaSchema,
  permissions: [],
  sideEffects: ["db:etapas_trabalho"],
  handler: async ({ nome, cor }, ctx) => {
    const trimmed = nome.trim();
    if (!trimmed) return err(domainError("VALIDATION", "Nome da etapa é obrigatório."));
    if (!ctx.user?.id) return err(domainError("UNAUTHORIZED", "Sessão expirada."));
    const { data: last } = await supabase
      .from("etapas_trabalho")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrdem = (last?.ordem ?? 0) + 1;
    const { data, error } = await supabase
      .from("etapas_trabalho")
      .insert({ nome: trimmed, cor, ordem: nextOrdem, user_id: ctx.user.id })
      .select("id, nome, cor, ordem, is_system_status, is_hidden_in_workflow")
      .single();
    if (error) return err(domainError("DB", error.message));
    return ok(data);
  },
});

export const updateEtapaCap = defineCommand({
  id: "configuracoes.updateEtapa",
  title: "Editar etapa",
  description: "Renomeia / muda cor. Etapas de sistema não podem ser renomeadas.",
  input: z.object({
    id: z.string(),
    nome: z.string().optional(),
    cor: z.string().optional(),
    is_hidden_in_workflow: z.boolean().optional(),
  }).strict(),
  output: EtapaSchema,
  permissions: [],
  sideEffects: ["db:etapas_trabalho"],
  handler: async ({ id, ...patch }) => {
    const { data: cur } = await supabase
      .from("etapas_trabalho")
      .select("is_system_status")
      .eq("id", id)
      .maybeSingle();
    if (cur?.is_system_status && patch.nome !== undefined) {
      return err(domainError("FORBIDDEN", "Etapa de sistema não pode ser renomeada."));
    }
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
    if (typeof clean.nome === "string") clean.nome = (clean.nome as string).trim();
    if (Object.keys(clean).length === 0) {
      return err(domainError("VALIDATION", "Informe pelo menos um campo."));
    }
    const { data, error } = await supabase
      .from("etapas_trabalho")
      .update(clean)
      .eq("id", id)
      .select("id, nome, cor, ordem, is_system_status, is_hidden_in_workflow")
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Etapa não encontrada."));
    return ok(data);
  },
});

export const moveEtapaCap = defineCommand({
  id: "configuracoes.moveEtapa",
  title: "Reordenar etapa",
  description: "Muda a posição da etapa (ordem absoluta).",
  input: z.object({ id: z.string(), ordem: z.number().int().nonnegative() }).strict(),
  output: EtapaSchema,
  permissions: [],
  sideEffects: ["db:etapas_trabalho"],
  handler: async ({ id, ordem }) => {
    const { data, error } = await supabase
      .from("etapas_trabalho")
      .update({ ordem })
      .eq("id", id)
      .select("id, nome, cor, ordem, is_system_status, is_hidden_in_workflow")
      .single();
    if (error) return err(domainError("DB", error.message));
    if (!data) return err(domainError("NOT_FOUND", "Etapa não encontrada."));
    return ok(data);
  },
});

export const deleteEtapaCap = defineCommand({
  id: "configuracoes.deleteEtapa",
  title: "Excluir etapa",
  description: "Remove definitivamente. Bloqueado para etapas de sistema.",
  input: z.object({ id: z.string() }).strict(),
  output: z.object({ deleted: z.boolean() }),
  permissions: [],
  needsApproval: true,
  sideEffects: ["db:etapas_trabalho"],
  handler: async ({ id }) => {
    const { data: cur } = await supabase
      .from("etapas_trabalho")
      .select("is_system_status")
      .eq("id", id)
      .maybeSingle();
    if (cur?.is_system_status) {
      return err(domainError("FORBIDDEN", "Etapa de sistema não pode ser excluída."));
    }
    const { error } = await supabase.from("etapas_trabalho").delete().eq("id", id);
    if (error) return err(domainError("DB", error.message));
    return ok({ deleted: true });
  },
});
