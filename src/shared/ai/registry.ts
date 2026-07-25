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
import { snapshotForAgenda, type AgendaPageSnapshot } from "@/modules/agenda/ai";
import { snapshotForGallery, type GalleryPageSnapshot } from "@/modules/gallery/ai";
import { snapshotForClientes, type ClientesPageSnapshot } from "@/modules/clientes/ai";
import { snapshotForFormularios, type FormulariosPageSnapshot } from "@/modules/formularios/ai";
import {
  snapshotForConfiguracoes,
  type ConfiguracoesPageSnapshot,
} from "@/modules/configuracoes/ai";

export type LunariPage =
  | "workflow"
  | "tasks"
  | "agenda"
  | "finance"
  | "billing"
  | "gallery"
  | "clientes"
  | "formularios"
  | "configuracoes";

export interface AllPageSnapshots {
  workflow: WorkflowPageSnapshot;
  tasks: TasksPageSnapshot;
  agenda: AgendaPageSnapshot;
  finance: FinancePageSnapshot;
  billing: null;
  gallery: GalleryPageSnapshot;
  clientes: ClientesPageSnapshot;
  formularios: FormulariosPageSnapshot;
  configuracoes: ConfiguracoesPageSnapshot;
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
    agenda: snapshotForAgenda(user),
    finance: snapshotForFinance(user),
    billing: null,
    gallery: snapshotForGallery(user),
    clientes: snapshotForClientes(user),
    formularios: snapshotForFormularios(user),
    configuracoes: snapshotForConfiguracoes(user),
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
    case "agenda":
      return snapshotForAgenda(user) as AllPageSnapshots[P];
    case "finance":
      return snapshotForFinance(user) as AllPageSnapshots[P];
    case "gallery":
      return snapshotForGallery(user) as AllPageSnapshots[P];
    case "clientes":
      return snapshotForClientes(user) as AllPageSnapshots[P];
    case "formularios":
      return snapshotForFormularios(user) as AllPageSnapshots[P];
    case "billing":
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
