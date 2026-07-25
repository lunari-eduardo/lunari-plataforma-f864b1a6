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
  listFormulariosCapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface FormulariosAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

function confirmationFor(capabilityId: string): ConfirmationChallenge | undefined {
  if (!REQUIRES_APPROVAL.has(capabilityId)) return undefined;
  if (capabilityId === "formularios.deleteForm" || capabilityId === "formularios.deleteResponse") {
    return {
      kind: "destructive",
      prompt:
        "Exclusão definitiva. Digite o nome exato do formulário ou diga \"confirmar exclusão\".",
    };
  }
  if (capabilityId === "formularios.publishForm") {
    return {
      kind: "publish",
      prompt: "Publicar disponibiliza a URL pública para o cliente. Confirme.",
    };
  }
  if (capabilityId === "formularios.unpublishForm") {
    return {
      kind: "publish",
      prompt: "Despublicar bloqueia novas respostas do cliente. Confirme.",
    };
  }
  if (
    capabilityId === "formularios.generateFormWithAI" ||
    capabilityId === "formularios.generateAIBriefing"
  ) {
    return {
      kind: "ai_generation",
      prompt: "Gerar conteúdo com IA. Você poderá revisar antes de aplicar.",
    };
  }
  return { kind: "destructive", prompt: "Confirme a ação para prosseguir." };
}

export async function buildFormDeleteChallenge(
  capabilityId: string,
  input: { id?: string },
): Promise<ConfirmationChallenge | undefined> {
  const base = confirmationFor(capabilityId);
  if (!base || base.kind !== "destructive" || !input?.id) return base;
  const { data } = await supabase
    .from("formularios")
    .select("titulo")
    .eq("id", input.id)
    .maybeSingle();
  const expected = data?.titulo?.trim();
  if (!expected) return base;
  return { ...base, challenge: { type: "type_name", expected } };
}

export function listFormulariosAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): FormulariosAITool[] {
  const caps = listCapabilities({ module: "formularios", kind: opts?.kind });
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => ({
    ...capabilityToAITool(c),
    needsApproval: needsHumanApproval(c.id),
    permissions: c.permissions,
    confirmation: confirmationFor(c.id),
  }));
}

export { REQUIRES_APPROVAL, listFormulariosCapabilityIds };
