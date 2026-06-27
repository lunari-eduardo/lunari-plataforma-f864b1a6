/**
 * Implementação Supabase da `StatusesRepo`.
 * Mapeia a coluna `is_done` do banco para `isTerminal` no domínio
 * (mantemos o nome "terminal" no domínio para não casar com a string mágica "done").
 */

import { supabase } from "@/integrations/supabase/client";
import type { TaskStatusDef } from "../../domain/types";
import type { StatusesRepo } from "../../ports/statusesRepo";

type StatusRow = {
  key: string;
  name: string;
  color: string | null;
  sort_order: number | null;
  is_done: boolean | null;
};

export const supabaseStatusesRepo: StatusesRepo = {
  async list(userId: string): Promise<TaskStatusDef[]> {
    const { data, error } = await supabase
      .from("task_statuses")
      .select("key,name,color,sort_order,is_done")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => {
      const row = r as StatusRow;
      return {
        key: row.key,
        name: row.name,
        color: row.color ?? undefined,
        order: row.sort_order ?? undefined,
        isTerminal: row.is_done ?? false,
      };
    });
  },
};
