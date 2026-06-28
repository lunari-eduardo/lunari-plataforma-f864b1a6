/**
 * Store singleton de Task Tags.
 * Mesma arquitetura do `taskStatusesStore`: fetch + realtime único +
 * mutações otimistas. Consumidores se inscrevem via `useTaskTagsStore`.
 */

import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseTagsRepo } from "../../infrastructure/supabase/tagsRepo";
import type { TaskTagDef } from "../../ports/tagsRepo";

type Listener = () => void;

interface State {
  tags: TaskTagDef[];
  loading: boolean;
  currentUserId: string | null;
}

const state: State = { tags: [], loading: true, currentUserId: null };
const listeners = new Set<Listener>();
let snapshot = { tags: state.tags, loading: state.loading };
let channel: ReturnType<typeof supabase.channel> | null = null;
let pendingFetch: Promise<void> | null = null;

function emit() {
  snapshot = { tags: state.tags, loading: state.loading };
  listeners.forEach((l) => l());
}

async function fetchTags(userId: string) {
  try {
    state.tags = await supabaseTagsRepo.list(userId);
  } catch (e) {
    console.error("Error fetching task tags:", e);
  } finally {
    state.loading = false;
    emit();
  }
}

function subscribeRealtime(userId: string) {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  channel = supabase
    .channel(`task_tags_${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_tags", filter: `user_id=eq.${userId}` },
      () => {
        fetchTags(userId);
      },
    )
    .subscribe();
}

export const tagsStore = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot() {
    return snapshot;
  },
  async init(userId: string) {
    if (state.currentUserId === userId) return pendingFetch ?? undefined;
    state.currentUserId = userId;
    subscribeRealtime(userId);
    state.loading = true;
    emit();
    pendingFetch = fetchTags(userId).finally(() => {
      pendingFetch = null;
    });
    return pendingFetch;
  },
  reset() {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
    state.currentUserId = null;
    state.tags = [];
    state.loading = true;
    emit();
  },
  applyOptimistic(next: TaskTagDef[]) {
    state.tags = next;
    emit();
  },
  async refetch() {
    if (state.currentUserId) await fetchTags(state.currentUserId);
  },
};

export function useTaskTagsStore() {
  return useSyncExternalStore(tagsStore.subscribe, tagsStore.getSnapshot);
}
