import {
  capabilityToAITool,
  listCapabilities,
  type AICapabilityTool,
  type ConfirmationChallenge,
} from "@/shared/capability";
import type { AuthUser } from "@/shared/ports";
import {
  canUserRun,
  needsHumanApproval,
  listPrecificacaoCapabilityIds,
  REQUIRES_APPROVAL,
} from "./permissions";

export interface PrecificacaoAITool extends AICapabilityTool {
  needsApproval: boolean;
  permissions: string[];
}

/**
 * Toda escrita de preço é do tipo "publish": muda a regra praticada daqui
 * pra frente. Nenhuma é destrutiva (não apaga histórico), mas todas exigem
 * confirmação explícita do fotógrafo.
 */
function confirmationFor(capabilityId: string): ConfirmationChallenge | undefined {
  if (!REQUIRES_APPROVAL.has(capabilityId)) return undefined;

  if (capabilityId === "precificacao.setModelo") {
    return {
      kind: "publish",
      prompt:
        "Isto muda como fotos extras passam a ser cobradas em novas sessões. Confirme para aplicar.",
    };
  }
  if (capabilityId === "precificacao.setMetas") {
    return {
      kind: "publish",
      prompt: "Isto redefine suas metas de faturamento e lucro. Confirme para aplicar.",
    };
  }
  if (capabilityId === "precificacao.updateMargemEHoras") {
    return {
      kind: "publish",
      prompt:
        "Isto recalcula o custo por hora usado em todas as simulações futuras. Confirme para aplicar.",
    };
  }
  return {
    kind: "publish",
    prompt:
      "Isto altera o preço praticado em novas sessões (sessões existentes não mudam). Confirme para aplicar.",
  };
}

export function listPrecificacaoAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): PrecificacaoAITool[] {
  const caps = listCapabilities({ module: "precificacao", kind: opts?.kind });
  const filtered =
    opts?.user === undefined ? caps : caps.filter((c) => canUserRun(opts.user!, c.id));
  return filtered.map((c) => {
    const base = capabilityToAITool(c);
    const confirmation = confirmationFor(c.id);
    return {
      ...base,
      ...(confirmation ? { confirmation } : {}),
      needsApproval: needsHumanApproval(c.id),
      permissions: c.permissions,
    };
  });
}

export { REQUIRES_APPROVAL, listPrecificacaoCapabilityIds };
