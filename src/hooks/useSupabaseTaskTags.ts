/**
 * Facade fina sobre `tagsStore` (singleton) + capabilities `tasks.tags.*`.
 * Mantém API histórica para os consumidores existentes.
 *
 * IMPORTANTE: as capabilities declaram `permissions: ["tasks:write"]`, então
 * precisam do `user` injetado. Usamos `useRunCapability()` para garantir isso
 * (chamar `cmd.execute(input)` direto resulta em UNAUTHENTICATED).
 */

import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRunCapability } from "@/shared/capability/react";
import { isOk } from "@/shared/result";
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
  const run = useRunCapability();

  useEffect(() => {
    if (user?.id) tagsStore.init(user.id);
  }, [user?.id]);

  const addTag = useCallback(
    async (name: string): Promise<TaskTagDef | null> => {
      const clean = name.trim();
      if (!clean) return null;
      const exists = tagsStore
        .getSnapshot()
        .tags.some((t) => t.name.trim().toLowerCase() === clean.toLowerCase());
      if (exists) {
        toast.error("Já existe uma etiqueta com esse nome");
        return null;
      }
      const res = await run(createTagCmd, { name: clean });
      if (!isOk(res)) {
        toast.error("Não foi possível criar a etiqueta", {
          description: res.error.message,
        });
        return null;
      }
      return { id: res.value.id, name: res.value.name, color: res.value.color };
    },
    [run],
  );

  const updateTag = useCallback(
    async (id: string, patch: Partial<TaskTagDef>) => {
      // Ignora updates de nome vazio (acontece durante digitação se chamado por keystroke)
      if (patch.name !== undefined && !patch.name.trim()) return;
      const res = await run(updateTagCmd, { id, ...patch });
      if (!isOk(res) && res.error.code !== "VALIDATION") {
        toast.error("Não foi possível atualizar a etiqueta", {
          description: res.error.message,
        });
      }
    },
    [run],
  );

  const removeTag = useCallback(
    async (id: string) => {
      const res = await run(deleteTagCmd, { id });
      if (!isOk(res)) {
        toast.error("Não foi possível excluir a etiqueta", {
          description: res.error.message,
        });
      }
    },
    [run],
  );

  const moveTag = useCallback(
    async (id: string, direction: "up" | "down") => {
      const list = tagsStore.getSnapshot().tags;
      const idx = list.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= list.length) return;
      const next = [...list];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      const items = next.map((t, i) => ({ id: t.id, order: i }));
      // patch otimista
      tagsStore.applyOptimistic(next.map((t, i) => ({ ...t, order: i })));
      const res = await run(reorderTagsCmd, { items });
      if (!isOk(res)) {
        toast.error("Não foi possível reordenar", {
          description: res.error.message,
        });
        await tagsStore.refetch();
      }
    },
    [run],
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
