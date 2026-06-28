/**
 * Facade fina sobre `peopleStore` (singleton) + capabilities `tasks.people.*`.
 */

import { useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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

  useEffect(() => {
    if (user?.id) peopleStore.init(user.id);
  }, [user?.id]);

  const addPerson = useCallback(async (name: string): Promise<TaskPerson | null> => {
    const res = await createPersonCmd.execute({ name });
    if (!res.ok) return null;
    return { id: res.value.id, name: res.value.name, color: res.value.color };
  }, []);

  const updatePerson = useCallback(async (id: string, patch: Partial<TaskPerson>) => {
    await updatePersonCmd.execute({ id, ...patch });
  }, []);

  const removePerson = useCallback(async (id: string) => {
    await deletePersonCmd.execute({ id });
  }, []);

  const movePerson = useCallback(
    async (id: string, direction: "up" | "down") => {
      const list = peopleStore.getSnapshot().people;
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) return;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= list.length) return;
      const next = [...list];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      peopleStore.applyOptimistic(next.map((p, i) => ({ ...p, order: i })));
      await runCapability("tasks.people.reorder", {
        items: next.map((p, i) => ({ id: p.id, order: i })),
      });
    },
    [],
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
