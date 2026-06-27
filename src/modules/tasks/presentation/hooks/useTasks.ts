/**
 * useTasks — hook reativo que lê do `tasksStore` via useSyncExternalStore.
 * É a fonte canônica para a UI a partir da Onda 4c.
 *
 * O store é alimentado pelo canal realtime único (`TasksRealtimeBridge` em App.tsx).
 * Mutações vão por capabilities; updates otimistas via `tasksStore.applyOptimisticPatch`.
 */

import { useSyncExternalStore } from "react";
import { tasksStore } from "../store/tasksStore";
import type { Task } from "../../domain/types";

export function useTasks(): Task[] {
  useSyncExternalStore(tasksStore.subscribe, tasksStore.getSnapshot, tasksStore.getSnapshot);
  // getAll retorna nova array por chamada — ok porque o snapshot versionado
  // garante que React só recalcule quando o store realmente mudou.
  return tasksStore.getAll();
}
