/**
 * Registry agregado das superfícies de IA (`ai/`) de cada módulo.
 * Este arquivo é o ÚNICO ponto de importação para o chat/runtime do
 * Assistente Lu. Importar de módulos individuais aqui garante que suas
 * capabilities sejam registradas antes de listadas.
 */
import "./workflow";
import "./billing";
import "./gallery";
import "./finance";
import "./tasks";
import "./agenda";

import { listWorkflowAITools } from "@/features/workflow/ai";
import { listBillingAITools } from "./billing/ai";
import { listGalleryAITools } from "./gallery/ai";
import { listFinanceAITools } from "./finance/ai";
import type { AuthUser } from "@/shared/ports";
import type { AICapabilityTool } from "@/shared/capability";

export interface LunariAITool extends AICapabilityTool {
  module: "workflow" | "billing" | "gallery" | "finance";
  needsApproval: boolean;
  permissions: string[];
}

/**
 * Lista consolidada de tools disponíveis ao Assistente. Filtra por usuário
 * autenticado e opcionalmente por tipo.
 */
export function listLunariAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): LunariAITool[] {
  const w = listWorkflowAITools(opts).map((t) => ({ ...t, module: "workflow" as const }));
  const b = listBillingAITools(opts).map((t) => ({ ...t, module: "billing" as const }));
  const g = listGalleryAITools(opts).map((t) => ({ ...t, module: "gallery" as const }));
  const f = listFinanceAITools(opts).map((t) => ({ ...t, module: "finance" as const }));
  return [...w, ...b, ...g, ...f];
}

export function lunariAIToolMap(opts?: Parameters<typeof listLunariAITools>[0]) {
  const map = new Map<string, LunariAITool>();
  for (const t of listLunariAITools(opts)) map.set(t.id, t);
  return map;
}
