/**
 * Registry agregado das superfícies de IA (`ai/`) de cada módulo.
 * Este arquivo é o ÚNICO ponto de importação para o chat/runtime do
 * Assistente Lu. Importar os módulos aqui garante que suas capabilities
 * sejam registradas antes de listadas.
 */
import "@/features/workflow"; // registra capabilities de workflow
import "@/modules/tasks"; // registra capabilities de tasks
import "./billing";
import "./gallery";
import "./finance";

import { listWorkflowAITools } from "@/features/workflow/ai";
import { listTasksAITools } from "@/modules/tasks/ai";
import { listBillingAITools } from "./billing/ai";
import { listGalleryAITools } from "./gallery/ai";
import { listFinanceAITools } from "./finance/ai";
import type { AuthUser } from "@/shared/ports";
import type { AICapabilityTool } from "@/shared/capability";

export interface LunariAITool extends AICapabilityTool {
  module: "workflow" | "tasks" | "billing" | "gallery" | "finance";
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
  const t = listTasksAITools(opts).map((x) => ({ ...x, module: "tasks" as const }));
  const b = listBillingAITools(opts).map((x) => ({ ...x, module: "billing" as const }));
  const g = listGalleryAITools(opts).map((x) => ({ ...x, module: "gallery" as const }));
  const f = listFinanceAITools(opts).map((x) => ({ ...x, module: "finance" as const }));
  return [...w, ...t, ...b, ...g, ...f];
}

export function lunariAIToolMap(opts?: Parameters<typeof listLunariAITools>[0]) {
  const map = new Map<string, LunariAITool>();
  for (const t of listLunariAITools(opts)) map.set(t.id, t);
  return map;
}
