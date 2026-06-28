/**
 * Facade fina sobre `peopleStore` (singleton) + capabilities `tasks.people.*`.
 *
 * As capabilities exigem `permissions: ["tasks:write"]`, então `user` precisa
 * ser injetado via `useRunCapability()`; chamar `cmd.execute(input)` direto
 * resultaria em UNAUTHENTICATED.
 */

import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useRunCapability } from "@/shared/capability/react";
import { isOk } from "@/shared/result";
import {
  createPerson as createPersonCmd,
  updatePerson as updatePersonCmd,
  deletePerson as deletePersonCmd,
  reorderPeople as reorderPeopleCmd,
} from "@/modules/tasks/application/commands/people";
import {
  peopleStore,
  useTaskPeopleStore,
} from "@/modules/tasks/presentation/store/peopleStore";
import type { TaskPersonDef } from "@/modules/tasks/ports/peopleRepo";

export interface TaskPerson {
  id: string;
  name: string;
  color?: string;
}

function toUi(p: TaskPersonDef): TaskPerson {
  return { id: p.id, name: p.name, color: p.color };
}

export function useSupabaseTaskPeople() {
  const { user } = useAuth();
  const { people, loading } = useTaskPeopleStore();
  const run = useRunCapability();

  useEffect(() => {
    if (user?.id) peopleStore.init(user.id);
  }, [user?.id]);

  const addPerson = useCallback(
    async (name: string): Promise<TaskPerson | null> => {
      const clean = name.trim();
      if (!clean) return null;
      const exists = peopleStore
        .getSnapshot()
        .people.some((p) => p.name.trim().toLowerCase() === clean.toLowerCase());
      if (exists) {
        toast.error("Já existe um responsável com esse nome");
        return null;
      }
      const res = await run(createPersonCmd, { name: clean });
      if (!isOk(res)) {
        toast.error("Não foi possível adicionar o responsável", {
          description: res.error.message,
        });
        return null;
      }
      return { id: res.value.id, name: res.value.name, color: res.value.color };
    },
    [run],
  );

  const updatePerson = useCallback(
    async (id: string, patch: Partial<TaskPerson>) => {
      if (patch.name !== undefined && !patch.name.trim()) return;
      const res = await run(updatePersonCmd, { id, ...patch });
      if (!isOk(res) && res.error.code !== "VALIDATION") {
        toast.error("Não foi possível atualizar o responsável", {
          description: res.error.message,
        });
      }
    },
    [run],
  );

  const removePerson = useCallback(
    async (id: string) => {
      const res = await run(deletePersonCmd, { id });
      if (!isOk(res)) {
        toast.error("Não foi possível excluir o responsável", {
          description: res.error.message,
        });
      }
    },
    [run],
  );

  const movePerson = useCallback(
    async (id: string, direction: "up" | "down") => {
      const list = peopleStore.getSnapshot().people;
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) return;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= list.length) return;
      const next = [...list];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      const items = next.map((p, i) => ({ id: p.id, order: i }));
      peopleStore.applyOptimistic(next.map((p, i) => ({ ...p, order: i })));
      const res = await run(reorderPeopleCmd, { items });
      if (!isOk(res)) {
        toast.error("Não foi possível reordenar", {
          description: res.error.message,
        });
        await peopleStore.refetch();
      }
    },
    [run],
  );

  return {
    people: people.map(toUi),
    loading,
    addPerson,
    updatePerson,
    removePerson,
    movePerson,
    refetch: peopleStore.refetch,
  };
}
