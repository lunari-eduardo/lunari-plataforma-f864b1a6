import {
  capabilityToAITool,
  listCapabilities,
  type AICapabilityTool,
  type ConfirmationChallenge,
} from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import { supabase } from "@/integrations/supabase/client";
import {
  canUserRun,
  needsHumanApproval,
  listConfiguracoesCapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface ConfiguracoesAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

/** Metadata declarativa de confirmação por capability. */
function confirmationFor(
  capabilityId: string,
  input?: unknown,
): ConfirmationChallenge | undefined {
  if (!REQUIRES_APPROVAL.has(capabilityId)) return undefined;

  if (
    capabilityId === "configuracoes.deleteCategoria" ||
    capabilityId === "configuracoes.deletePacote" ||
    capabilityId === "configuracoes.deleteProduto" ||
    capabilityId === "configuracoes.deleteEtapa" ||
    capabilityId === "configuracoes.deleteContratoTemplate"
  ) {
    return {
      kind: "destructive",
      prompt:
        "Exclusão definitiva. Confirme digitando o nome exato do item ou dizendo \"confirmar exclusão\".",
    };
  }

  if (
    capabilityId === "configuracoes.setPricingModel" ||
    capabilityId === "configuracoes.updateGlobalPricingTable" ||
    capabilityId === "configuracoes.setCategoriaPricingTable"
  ) {
    return {
      kind: "publish",
      prompt: "Isto altera a regra de preço para novas sessões. Confirme para aplicar.",
    };
  }

  return { kind: "destructive", prompt: "Confirme a ação para prosseguir." };
}

/**
 * Enriquecimento assíncrono do challenge type_name para deletes: consulta o
 * nome real do recurso para exigir digitação exata. UI chama antes do gate.
 */
export async function buildDeleteChallenge(
  capabilityId: string,
  input: { id?: string },
): Promise<ConfirmationChallenge | undefined> {
  const base = confirmationFor(capabilityId);
  if (!base || base.kind !== "destructive" || !input?.id) return base;

  const table =
    capabilityId === "configuracoes.deleteCategoria"
      ? "categorias"
      : capabilityId === "configuracoes.deletePacote"
        ? "pacotes"
        : capabilityId === "configuracoes.deleteProduto"
          ? "produtos"
          : capabilityId === "configuracoes.deleteEtapa"
            ? "etapas_trabalho"
            : capabilityId === "configuracoes.deleteContratoTemplate"
              ? "contrato_templates"
              : null;
  if (!table) return base;

  const { data } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          maybeSingle: () => Promise<{ data: { nome?: string } | null }>;
        };
      };
    };
  })
    .from(table)
    .select("nome")
    .eq("id", input.id)
    .maybeSingle();

  const expected = data?.nome?.trim();
  if (!expected) return base;
  return { ...base, challenge: { type: "type_name", expected } };
}

export function listConfiguracoesAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): ConfiguracoesAITool[] {
  const caps = listCapabilities({ module: "configuracoes", kind: opts?.kind });
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
    confirmation: confirmationFor(c.id),
  }));
}

export { REQUIRES_APPROVAL, listConfiguracoesCapabilityIds };
