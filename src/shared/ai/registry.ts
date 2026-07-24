/**
 * Registry central da superfície de IA (F2.3).
 *
 * Único ponto de entrada para o runtime do Assistente Lu:
 *  - `listAllLunariAITools({ user })` — tools de todos os módulos.
 *  - `buildAllPageSnapshots({ user })` — snapshots por página.
 *  - `getPageSnapshot(page, { user })` — snapshot de uma página específica.
 *
 * Importa `@/modules/ai-registry` como side-effect para garantir que
 * todas as capabilities estejam registradas antes de qualquer listagem.
 */

import "@/modules/ai-registry";

import type { AuthUser } from "@/shared/ports";
import {
  listLunariAITools,
  lunariAIToolMap,
  type LunariAITool,
} from "@/modules/ai-registry";

import { snapshotForActiveMonth, type WorkflowPageSnapshot } from "@/features/workflow/ai";
import { snapshotForTasks, type TasksPageSnapshot } from "@/modules/tasks/ai";
import { snapshotForFinance, type FinancePageSnapshot } from "@/modules/finance/ai";

export type LunariPage =
  | "workflow"
  | "tasks"
  | "finance"
  | "billing"
  | "gallery";

export interface AllPageSnapshots {
  workflow: WorkflowPageSnapshot;
  tasks: TasksPageSnapshot;
  finance: FinancePageSnapshot;
  billing: null;
  gallery: null;
}

export function listAllLunariAITools(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}): LunariAITool[] {
  return listLunariAITools(opts);
}

export function getAllLunariAIToolsMap(opts?: {
  user?: AuthUser | null;
  kind?: "command" | "query";
}) {
  return lunariAIToolMap(opts);
}

export function buildAllPageSnapshots(user: AuthUser | null): AllPageSnapshots {
  return {
    workflow: snapshotForActiveMonth(user),
    tasks: snapshotForTasks(user),
    finance: snapshotForFinance(user),
    billing: null,
    gallery: null,
  };
}

export function getPageSnapshot<P extends LunariPage>(
  page: P,
  user: AuthUser | null,
): AllPageSnapshots[P] {
  switch (page) {
    case "workflow":
      return snapshotForActiveMonth(user) as AllPageSnapshots[P];
    case "tasks":
      return snapshotForTasks(user) as AllPageSnapshots[P];
    case "finance":
      return snapshotForFinance(user) as AllPageSnapshots[P];
    case "billing":
    case "gallery":
      return null as AllPageSnapshots[P];
    default:
      throw new Error(`unknown page: ${page}`);
  }
}

export { runCapabilityAsAssistant } from "./runCapabilityAsAssistant";
export type {
  AssistantRunOptions,
  AssistantRunResult,
  AssistantOutputStatus,
} from "./runCapabilityAsAssistant";
export type { LunariAITool };
