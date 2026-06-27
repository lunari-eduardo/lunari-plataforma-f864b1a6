/**
 * Bridge — monta o canal realtime único e hidrata o `tasksStore` na primeira carga.
 *
 * Onda 2: bridge inerte para consumidores atuais (`useSupabaseTasks` continua
 * com sua própria query/realtime). A partir da Onda 3 os hooks novos lerão
 * exclusivamente do `tasksStore` alimentado por esta bridge.
 */

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseTasksRepo } from "../supabase/tasksRepo";
import { tasksRealtime } from "./tasksRealtimeChannel";
import { tasksStore } from "../../presentation/store/tasksStore";

export function TasksRealtimeBridge() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      try {
        const list = await supabaseTasksRepo.list({ userId: user.id });
        if (!cancelled) tasksStore.hydrate(list);
      } catch (err) {
        console.error("[TasksRealtimeBridge] hidratação falhou", err);
      }
    })();

    const cleanup = tasksRealtime.subscribe(user.id);
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [user?.id]);

  return null;
}
