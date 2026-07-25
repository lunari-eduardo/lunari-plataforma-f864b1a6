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
  listContratosCapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface ContratosAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

function confirmationFor(capabilityId: string): ConfirmationChallenge | undefined {
  if (!REQUIRES_APPROVAL.has(capabilityId)) return undefined;
  if (capabilityId === "contratos.deleteTemplate") {
    return {
      kind: "destructive",
      prompt:
        "Exclusão de template. Digite o nome exato para confirmar ou diga \"confirmar exclusão\".",
    };
  }
  if (capabilityId === "contratos.deleteContrato") {
    return {
      kind: "destructive",
      prompt:
        "Exclusão de contrato. Digite o título exato para confirmar ou diga \"confirmar exclusão\".",
    };
  }
  if (capabilityId === "contratos.markSentContrato") {
    return {
      kind: "publish",
      prompt:
        "Marcar como enviado sinaliza ao sistema que o cliente já recebeu o contrato. Confirme.",
    };
  }
  if (
    capabilityId === "contratos.generateTemplateWithAI" ||
    capabilityId === "contratos.generateContratoWithAI"
  ) {
    return {
      kind: "ai_generation",
      prompt: "Gerar conteúdo com IA. Você poderá revisar antes de aplicar.",
    };
  }
  return { kind: "destructive", prompt: "Confirme a ação para prosseguir." };
}

export async function buildTemplateDeleteChallenge(
  input: { id?: string },
): Promise<ConfirmationChallenge | undefined> {
  const base = confirmationFor("contratos.deleteTemplate");
  if (!base || base.kind !== "destructive" || !input?.id) return base;
  const { data } = await supabase
    .from("contrato_templates")
    .select("nome")
    .eq("id", input.id)
    .maybeSingle();
  const expected = data?.nome?.trim();
  if (!expected) return base;
  return { ...base, challenge: { type: "type_name", expected } };
}

export async function buildContratoDeleteChallenge(
  input: { id?: string },
): Promise<ConfirmationChallenge | undefined> {
  const base = confirmationFor("contratos.deleteContrato");
  if (!base || base.kind !== "destructive" || !input?.id) return base;
  const { data } = await supabase
    .from("contratos")
    .select("titulo")
    .eq("id", input.id)
    .maybeSingle();
  const expected = data?.titulo?.trim();
  if (!expected) return base;
  return { ...base, challenge: { type: "type_name", expected } };
}

export function listContratosAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): ContratosAITool[] {
  const caps = listCapabilities({ module: "contratos", kind: opts?.kind });
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
    confirmation: confirmationFor(c.id),
  }));
}

export { REQUIRES_APPROVAL, listContratosCapabilityIds };
