/**
 * Wrapper fino sobre o singleton `taskStatusesStore`.
 *
 * Mantém a API histórica (`statuses`, `addStatus`, `updateStatus`,
 * `removeStatus`, `moveStatus`, `getDoneKey`, `getDefaultOpenKey`,
 * `refetch`, `loading`) para os consumidores existentes, mas todos
 * leem/escrevem do mesmo store — fim do problema de instâncias
 * divergentes e múltiplas inscrições realtime.
 */

import { useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  taskStatusesStore,
  useTaskStatusesStore,
  type TaskStatusDef,
} from "@/modules/tasks/presentation/store/taskStatusesStore";

export type { TaskStatusDef };

export function useSupabaseTaskStatuses() {
  const { user } = useAuth();
  const { statuses, loading } = useTaskStatusesStore();

  useEffect(() => {
    if (user?.id) {
      taskStatusesStore.init(user.id);
    }
  }, [user?.id]);

  const getDoneKey = useCallback((): string => {
    const done = statuses.find((s) => s.isDone);
    return done?.key || "done";
  }, [statuses]);

  const getDefaultOpenKey = useCallback((): string => {
    const open = statuses.find((s) => !s.isDone);
    return open?.key || "todo";
  }, [statuses]);

  return {
    statuses,
    loading,
    addStatus: taskStatusesStore.addStatus,
    updateStatus: taskStatusesStore.updateStatus,
    removeStatus: taskStatusesStore.removeStatus,
    moveStatus: taskStatusesStore.moveStatus,
    refetch: taskStatusesStore.refetch,
    getDoneKey,
    getDefaultOpenKey,
  };
}
