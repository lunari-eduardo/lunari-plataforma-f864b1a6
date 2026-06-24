import { z } from "zod";
import { defineQuery } from "@/shared/capability";
import { domainError, err, ok } from "@/shared/result";
import { supabase } from "@/integrations/supabase/client";

/**
 * Capability `workflow.statusOptions`
 *
 * Lista as etapas (status) configuradas pelo fotógrafo em `etapas_trabalho`.
 * IA deve consultar esta query antes de avançar um card (`workflow.advanceCard`)
 * para garantir que o destino existe nas etapas personalizadas do usuário.
 */

const Input = z.object({});

const Output = z.object({
  options: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      color: z.string().nullable(),
      ordem: z.number().nullable(),
    }),
  ),
});

export const listStatusOptions = defineQuery({
  id: "workflow.statusOptions",
  title: "Listar etapas do funil",
  description:
    "Retorna as etapas (status) configuradas pelo fotógrafo, ordenadas.",
  input: Input,
  output: Output,
  permissions: ["workflow:read"],
  async handler(_input, ctx) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? ctx.user?.id;
    if (!userId) {
      return err(domainError("UNAUTHENTICATED", "Sessão expirada."));
    }

    const { data, error } = await supabase
      .from("etapas_trabalho")
      .select("nome, cor, ordem")
      .eq("user_id", userId)
      .order("ordem", { ascending: true });

    if (error) {
      ctx.log.error("falha ao listar etapas", { error });
      return err(
        domainError("EXTERNAL", "Não foi possível listar as etapas.", {
          retriable: true,
          cause: error,
        }),
      );
    }

    const options = (data ?? []).map((row: any) => ({
      value: row.nome,
      label: row.nome,
      color: row.cor ?? null,
      ordem: row.ordem ?? null,
    }));

    return ok({ options });
  },
});
