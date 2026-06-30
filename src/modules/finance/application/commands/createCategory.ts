import { z } from "zod";
import { defineCommand } from "@/shared/capability";
import { domainError, err, isOk, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";
import { GROUPS, type GroupCode } from "../../domain/group";
import { NATURES } from "../../domain/nature";
import { itemsStore } from "../../presentation/store/itemsStore";
import { rowToItem } from "../../infrastructure/supabase/mappers";
import { resolveUserId } from "../_auth";
import type { Grupo } from "../../domain/types";

const Input = z.object({
  nome: z.string().min(2).max(60),
  groupCode: z.string(),
  source: z.enum(["user", "automation", "ai"]).default("user"),
}).strict();

const Output = z.object({
  id: z.string(),
  nome: z.string(),
  groupCode: z.string(),
  natureCode: z.string(),
  grupo: z.string(),
});

/**
 * Mapeia natureza → enum legado `grupo_principal` para manter compatibilidade
 * com hooks/UIs que ainda dependem do campo `grupo`.
 */
function legacyGrupoFromGroup(groupCode: GroupCode): Grupo {
  const nature = GROUPS[groupCode].natureCode;
  switch (nature) {
    case "receita_operacional": return "Receita Operacional";
    case "receita_financeira": return "Receita Não Operacional";
    case "investimento_ativos": return "Investimento";
    case "despesa_operacional":
    case "impostos":
    case "pro_labore":
    case "distribuicao_lucros":
    case "financiamento":
      return "Despesa Variável";
    default:
      return "Despesa Variável";
  }
}

export const createCategory = defineCommand({
  id: "finance.category.create",
  title: "Criar categoria vinculada a um grupo",
  description:
    "Cria nova categoria (subcategoria) vinculada a um grupo fixo do catálogo. Idempotente por (user, lower(nome), grupo_principal).",
  input: Input,
  output: Output,
  permissions: ["finance:write"],
  sideEffects: ["db:fin_items_master", "event:finance.item.created"],
  audit: "on-success",
  async handler({ nome, groupCode, source }, ctx) {
    const auth = await resolveUserId(ctx);
    if (!isOk(auth)) return auth;

    const group = GROUPS[groupCode as GroupCode];
    if (!group) {
      return err(domainError("VALIDATION", `Grupo desconhecido: ${groupCode}`));
    }
    const nature = NATURES[group.natureCode];
    const grupoLegado = legacyGrupoFromGroup(groupCode as GroupCode);
    const nomeTrim = nome.trim();

    try {
      // Procura existente (case-insensitive) no mesmo grupo legado
      const { data: existentes, error: findErr } = await supabase
        .from("fin_items_master")
        .select("*")
        .eq("user_id", auth.value)
        .eq("grupo_principal", grupoLegado)
        .ilike("nome", nomeTrim);
      if (findErr) throw findErr;

      const existente = (existentes || []).find(
        (i: any) => (i.nome || "").trim().toLowerCase() === nomeTrim.toLowerCase(),
      );

      let row: any;
      if (existente) {
        // Reativa e/ou atualiza group_code do item existente.
        const patch: any = { ativo: true, nome: nomeTrim, group_code: groupCode };
        const { data: updated, error: upErr } = await supabase
          .from("fin_items_master")
          .update(patch)
          .eq("id", existente.id)
          .select()
          .single();
        if (upErr) throw upErr;
        row = updated;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("fin_items_master")
          .insert({
            user_id: auth.value,
            nome: nomeTrim,
            grupo_principal: grupoLegado,
            group_code: groupCode,
            ativo: true,
            is_default: false,
            is_system: false,
          } as any)
          .select()
          .single();
        if (insErr) throw insErr;
        row = inserted;
      }

      const item = rowToItem(row);
      if (ctx.runtime === "client") {
        try { itemsStore.upsert(item); } catch { /* noop */ }
      }

      await ctx.emit("finance.item.created", {
        id: item.id,
        nome: item.nome,
        grupo: item.grupo,
        photographerId: auth.value,
        actor: source,
      });

      return ok({
        id: item.id,
        nome: item.nome,
        groupCode,
        natureCode: nature.code,
        grupo: item.grupo,
      });
    } catch (e: any) {
      ctx.log.error("falha ao criar categoria", { e });
      return err(domainError("EXTERNAL", "Não foi possível criar a categoria.", { cause: e, retriable: true }));
    }
  },
});
