/**
 * Facade fina sobre `tagsStore` (singleton) + capabilities `tasks.tags.*`.
 * Mantém API histórica para os consumidores existentes.
 */

import { useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createTag as createTagCmd,
  updateTag as updateTagCmd,
  deleteTag as deleteTagCmd,
  reorderTags as reorderTagsCmd,
} from "@/modules/tasks/application/commands/tags";
import {
  tagsStore,
  useTaskTagsStore,
} from "@/modules/tasks/presentation/store/tagsStore";
import type { TaskTagDef as RepoTag } from "@/modules/tasks/ports/tagsRepo";

export interface TaskTagDef {
  id: string;
  name: string;
  color?: string;
}

function toUi(t: RepoTag): TaskTagDef {
  return { id: t.id, name: t.name, color: t.color };
}

export function useSupabaseTaskTags() {
  const { user } = useAuth();
  const { tags, loading } = useTaskTagsStore();

  useEffect(() => {
    if (user?.id) tagsStore.init(user.id);
  }, [user?.id]);

  const addTag = useCallback(async (name: string): Promise<TaskTagDef | null> => {
    const res = await runCapability("tasks.tags.create", { name });
    if (!res.ok) return null;
    return { id: res.value.id, name: res.value.name, color: res.value.color };
  }, []);

  const updateTag = useCallback(async (id: string, patch: Partial<TaskTagDef>) => {
    await runCapability("tasks.tags.update", { id, ...patch });
  }, []);

  const removeTag = useCallback(async (id: string) => {
    await runCapability("tasks.tags.delete", { id });
  }, []);

  const moveTag = useCallback(
    async (id: string, direction: "up" | "down") => {
      const list = tagsStore.getSnapshot().tags;
      const idx = list.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= list.length) return;
      const next = [...list];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      // otimista
      tagsStore.applyOptimistic(next.map((t, i) => ({ ...t, order: i })));
      await runCapability("tasks.tags.reorder", {
        items: next.map((t, i) => ({ id: t.id, order: i })),
      });
    },
    [],
  );

  return {
    tags: tags.map(toUi),
    loading,
    addTag,
    updateTag,
    removeTag,
    moveTag,
    refetch: tagsStore.refetch,
  };
}
