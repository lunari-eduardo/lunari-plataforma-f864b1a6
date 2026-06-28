/**
 * Store singleton de Task People. Mesmo molde de `tagsStore` /
 * `taskStatusesStore`.
 */

import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabasePeopleRepo } from "../../infrastructure/supabase/peopleRepo";
import type { TaskPersonDef } from "../../ports/peopleRepo";

type Listener = () => void;

interface State {
  people: TaskPersonDef[];
  loading: boolean;
  currentUserId: string | null;
}

const state: State = { people: [], loading: true, currentUserId: null };
const listeners = new Set<Listener>();
let snapshot = { people: state.people, loading: state.loading };
let channel: ReturnType<typeof supabase.channel> | null = null;
let pendingFetch: Promise<void> | null = null;

function emit() {
  snapshot = { people: state.people, loading: state.loading };
  listeners.forEach((l) => l());
}

async function fetchPeople(userId: string) {
  try {
    state.people = await supabasePeopleRepo.list(userId);
  } catch (e) {
    console.error("Error fetching task people:", e);
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
    .channel(`task_people_${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "task_people", filter: `user_id=eq.${userId}` },
      () => {
        fetchPeople(userId);
      },
    )
    .subscribe();
}

export const peopleStore = {
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
    pendingFetch = fetchPeople(userId).finally(() => {
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
    state.people = [];
    state.loading = true;
    emit();
  },
  applyOptimistic(next: TaskPersonDef[]) {
    state.people = next;
    emit();
  },
  async refetch() {
    if (state.currentUserId) await fetchPeople(state.currentUserId);
  },
};

export function useTaskPeopleStore() {
  return useSyncExternalStore(peopleStore.subscribe, peopleStore.getSnapshot);
}
