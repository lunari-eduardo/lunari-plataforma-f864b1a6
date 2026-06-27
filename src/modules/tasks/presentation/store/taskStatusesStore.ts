/**
 * Store singleton de Task Statuses.
 *
 * Centraliza fetch + realtime + mutações para que todos os consumidores
 * (Tarefas, ManageTaskStatusesModal, TaskCard, HighPriorityDueSoonCard,
 * useTodayOverview…) leiam da MESMA fonte de verdade. Antes, cada hook
 * abria seu próprio canal `task_statuses_changes`, o que era desduplicado
 * pelo cliente Supabase e fazia o realtime falhar em alguns mounts.
 *
 * API: `useTaskStatuses()` retorna `{ statuses, loading, init, ... }` via
 * `useSyncExternalStore`. As mutações fazem update otimista local + persist.
 */

import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TaskStatusDef {
  id: string;
  key: string;
  name: string;
  order: number;
  isDone?: boolean;
  color?: string;
}

const DEFAULT_STATUSES: Omit<TaskStatusDef, "id">[] = [
  { key: "todo", name: "A Fazer", order: 0, isDone: false, color: "#6b7280" },
  { key: "in_progress", name: "Em Andamento", order: 1, isDone: false, color: "#3b82f6" },
  { key: "waiting", name: "Aguardando", order: 2, isDone: false, color: "#f59e0b" },
  { key: "done", name: "Concluída", order: 3, isDone: true, color: "#22c55e" },
];

type Listener = () => void;

interface State {
  statuses: TaskStatusDef[];
  loading: boolean;
  currentUserId: string | null;
}

const state: State = { statuses: [], loading: true, currentUserId: null };
const listeners = new Set<Listener>();
let snapshot = { statuses: state.statuses, loading: state.loading };
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let pendingFetch: Promise<void> | null = null;

function setStatuses(next: TaskStatusDef[]) {
  state.statuses = next;
  snapshot = { statuses: state.statuses, loading: state.loading };
  listeners.forEach((l) => l());
}

function setLoading(v: boolean) {
  state.loading = v;
  snapshot = { statuses: state.statuses, loading: state.loading };
  listeners.forEach((l) => l());
}

function rowToStatus(s: Record<string, unknown>): TaskStatusDef {
  return {
    id: s.id as string,
    key: s.key as string,
    name: s.name as string,
    order: s.sort_order as number,
    isDone: (s.is_done as boolean) || false,
    color: (s.color as string) || "#6b7280",
  };
}

async function fetchStatuses(userId: string) {
  try {
    const { data, error } = await supabase
      .from("task_statuses")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    if (data && data.length > 0) {
      setStatuses(data.map((s) => rowToStatus(s as unknown as Record<string, unknown>)));
    } else {
      await seedDefaults(userId);
    }
  } catch (e) {
    console.error("Error fetching task statuses:", e);
  } finally {
    setLoading(false);
  }
}

async function seedDefaults(userId: string) {
  try {
    const toInsert = DEFAULT_STATUSES.map((s) => ({
      user_id: userId,
      key: s.key,
      name: s.name,
      sort_order: s.order,
      is_done: s.isDone || false,
      color: s.color || "#6b7280",
    }));
    const { data, error } = await supabase
      .from("task_statuses")
      .insert(toInsert)
      .select();
    if (error) throw error;
    if (data) setStatuses(data.map((s) => rowToStatus(s as unknown as Record<string, unknown>)));
  } catch (e) {
    console.error("Error seeding default statuses:", e);
  }
}

function subscribeRealtime(userId: string) {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  realtimeChannel = supabase
    .channel(`task_statuses_${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_statuses", filter: `user_id=eq.${userId}` },
      () => {
        fetchStatuses(userId);
      },
    )
    .subscribe();
}

export const taskStatusesStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return snapshot;
  },
  async init(userId: string) {
    if (state.currentUserId === userId) return pendingFetch ?? undefined;
    state.currentUserId = userId;
    subscribeRealtime(userId);
    setLoading(true);
    pendingFetch = fetchStatuses(userId).finally(() => {
      pendingFetch = null;
    });
    return pendingFetch;
  },
  reset() {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    state.currentUserId = null;
    state.statuses = [];
    state.loading = true;
    snapshot = { statuses: [], loading: true };
    listeners.forEach((l) => l());
  },
  async addStatus(name: string): Promise<TaskStatusDef | null> {
    const userId = state.currentUserId;
    if (!userId) return null;
    const maxOrder =
      state.statuses.length > 0 ? Math.max(...state.statuses.map((s) => s.order)) : -1;
    const newKey = `status_${Date.now()}`;
    try {
      const { data, error } = await supabase
        .from("task_statuses")
        .insert({
          user_id: userId,
          key: newKey,
          name,
          sort_order: maxOrder + 1,
          is_done: false,
          color: "#6b7280",
        })
        .select()
        .single();
      if (error) throw error;
      const newStatus = rowToStatus(data as unknown as Record<string, unknown>);
      setStatuses([...state.statuses, newStatus]);
      return newStatus;
    } catch (e) {
      console.error("Error adding status:", e);
      return null;
    }
  },
  async updateStatus(id: string, patch: Partial<TaskStatusDef>) {
    const userId = state.currentUserId;
    if (!userId) return;
    // Update otimista
    const before = state.statuses;
    setStatuses(state.statuses.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      const updateData: Record<string, unknown> = {};
      if (patch.name !== undefined) updateData.name = patch.name;
      if (patch.color !== undefined) updateData.color = patch.color;
      if (patch.isDone !== undefined) updateData.is_done = patch.isDone;
      if (patch.order !== undefined) updateData.sort_order = patch.order;
      const { error } = await supabase
        .from("task_statuses")
        .update(updateData)
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
    } catch (e) {
      console.error("Error updating status:", e);
      setStatuses(before); // rollback
    }
  },
  async removeStatus(id: string): Promise<boolean> {
    const userId = state.currentUserId;
    if (!userId) return false;
    const status = state.statuses.find((s) => s.id === id);
    if (status?.isDone) {
      const doneCount = state.statuses.filter((s) => s.isDone).length;
      if (doneCount <= 1) return false;
    }
    try {
      const { error } = await supabase
        .from("task_statuses")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) throw error;
      setStatuses(state.statuses.filter((s) => s.id !== id));
      return true;
    } catch (e) {
      console.error("Error removing status:", e);
      return false;
    }
  },
  async moveStatus(id: string, direction: "up" | "down") {
    const userId = state.currentUserId;
    if (!userId) return;
    const idx = state.statuses.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= state.statuses.length) return;
    const before = state.statuses;
    const next = [...state.statuses];
    const currentOrder = next[idx].order;
    const swapOrder = next[swapIdx].order;
    next[idx] = { ...next[idx], order: swapOrder };
    next[swapIdx] = { ...next[swapIdx], order: currentOrder };
    next.sort((a, b) => a.order - b.order);
    setStatuses(next);
    try {
      await Promise.all([
        supabase.from("task_statuses").update({ sort_order: swapOrder }).eq("id", id),
        supabase
          .from("task_statuses")
          .update({ sort_order: currentOrder })
          .eq("id", before[swapIdx].id),
      ]);
    } catch (e) {
      console.error("Error moving status:", e);
      setStatuses(before);
    }
  },
  async refetch() {
    const userId = state.currentUserId;
    if (!userId) return;
    await fetchStatuses(userId);
  },
};

export function useTaskStatusesStore() {
  return useSyncExternalStore(taskStatusesStore.subscribe, taskStatusesStore.getSnapshot);
}
