/**
 * Registry agregado das superfícies de IA (`ai/`) de cada módulo.
 * Este arquivo é o ÚNICO ponto de importação para o chat/runtime do
 * Assistente Lu. Importar os módulos aqui garante que suas capabilities
 * sejam registradas antes de listadas.
 */
import "@/features/workflow"; // registra capabilities de workflow
import "@/modules/workflow"; // side-effects: registra queries/commands do módulo workflow

import "@/modules/tasks"; // registra capabilities de tasks
import "@/modules/agenda"; // registra capabilities de agenda
import "@/modules/clientes"; // superfície AI de clientes (sem caps ainda)
import "@/modules/formularios"; // superfície AI de formulários (sem caps ainda)
import "@/modules/contratos"; // superfície AI + capabilities de contratos
import "@/modules/configuracoes"; // superfície AI de configurações (sem caps ainda)
import "./billing";
import "./gallery";
import "./finance";
import "@/modules/knowledge"; // Onda 6 — Knowledge Engine v1
import "@/modules/observation"; // Onda 7 — Observation Engine v1
import "@/modules/memory"; // Onda 8 — Memory Engine v1
import "@/modules/intelligence"; // Onda 9 — Intelligence Engine v1
import "@/modules/decision"; // Onda 10 — Decision Engine v1
import "@/modules/learning"; // Onda 11 — Learning Engine v1
import "@/modules/automation"; // Onda 12 — Automation Engine v1


import { listWorkflowAITools } from "@/features/workflow/ai";
import { listTasksAITools } from "@/modules/tasks/ai";
import { listAgendaAITools } from "@/modules/agenda/ai";
import { listClientesAITools } from "@/modules/clientes/ai";
import { listFormulariosAITools } from "@/modules/formularios/ai";
import { listContratosAITools } from "@/modules/contratos/ai";
import { listConfiguracoesAITools } from "@/modules/configuracoes/ai";
import { listBillingAITools } from "./billing/ai";
import { listGalleryAITools } from "./gallery/ai";
import { listFinanceAITools } from "./finance/ai";
import { listKnowledgeAITools } from "@/modules/knowledge/ai";
import { listObservationAITools } from "@/modules/observation/ai";
import { listMemoryAITools } from "@/modules/memory/ai";
import { listIntelligenceAITools } from "@/modules/intelligence/ai";
import { listDecisionAITools } from "@/modules/decision/ai";
import { listLearningAITools } from "@/modules/learning/ai";
import type { AuthUser } from "@/shared/ports";
import type { AICapabilityTool } from "@/shared/capability";

export interface LunariAITool extends AICapabilityTool {
  module:
    | "workflow"
    | "tasks"
    | "agenda"
    | "clientes"
    | "formularios"
    | "contratos"
    | "configuracoes"
    | "billing"
    | "gallery"
    | "finance"
    | "knowledge"
    | "observation"
    | "memory"
    | "intelligence"
    | "decision"
    | "learning";
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
  const a = listAgendaAITools(opts).map((x) => ({ ...x, module: "agenda" as const }));
  const c = listClientesAITools(opts).map((x) => ({ ...x, module: "clientes" as const }));
  const fo = listFormulariosAITools(opts).map((x) => ({ ...x, module: "formularios" as const }));
  const cn = listContratosAITools(opts).map((x) => ({ ...x, module: "contratos" as const }));
  const co = listConfiguracoesAITools(opts).map((x) => ({ ...x, module: "configuracoes" as const }));
  const b = listBillingAITools(opts).map((x) => ({ ...x, module: "billing" as const }));
  const g = listGalleryAITools(opts).map((x) => ({ ...x, module: "gallery" as const }));
  const f = listFinanceAITools(opts).map((x) => ({ ...x, module: "finance" as const }));
  const k = listKnowledgeAITools(opts).map((x) => ({ ...x, module: "knowledge" as const }));
  const o = listObservationAITools(opts).map((x) => ({ ...x, module: "observation" as const }));
  const m = listMemoryAITools(opts).map((x) => ({ ...x, module: "memory" as const }));
  const i = listIntelligenceAITools(opts).map((x) => ({ ...x, module: "intelligence" as const }));
  const d = listDecisionAITools(opts).map((x) => ({ ...x, module: "decision" as const }));
  const l = listLearningAITools(opts).map((x) => ({ ...x, module: "learning" as const }));
  return [...w, ...t, ...a, ...c, ...fo, ...cn, ...co, ...b, ...g, ...f, ...k, ...o, ...m, ...i, ...d, ...l];
}

export function lunariAIToolMap(opts?: Parameters<typeof listLunariAITools>[0]) {
  const map = new Map<string, LunariAITool>();
  for (const t of listLunariAITools(opts)) map.set(t.id, t);
  return map;
}
