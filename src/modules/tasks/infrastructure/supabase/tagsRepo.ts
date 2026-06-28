/**
 * Implementação Supabase da `TagsRepo`.
 * Único ponto autorizado a tocar `supabase.from('task_tags')`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { TagsRepo, TaskTagDef } from "../../ports/tagsRepo";

type Row = Record<string, unknown>;

function rowToTag(r: Row): TaskTagDef {
  return {
    id: r.id as string,
    name: r.name as string,
    color: (r.color as string | null) ?? undefined,
    order: (r.sort_order as number) ?? 0,
  };
}

export const supabaseTagsRepo: TagsRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from("task_tags")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => rowToTag(r as Row));
  },

  async create({ name, color, order }, userId) {
    const { data, error } = await supabase
      .from("task_tags")
      .insert({ user_id: userId, name, color, sort_order: order })
      .select()
      .single();
    if (error) throw error;
    return rowToTag(data as Row);
  },

  async update(id, patch, userId) {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.color !== undefined) payload.color = patch.color;
    if (patch.order !== undefined) payload.sort_order = patch.order;
    if (Object.keys(payload).length === 0) return;
    const { error } = await supabase
      .from("task_tags")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async remove(id, userId) {
    const { error } = await supabase
      .from("task_tags")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async reorder(items, userId) {
    await Promise.all(
      items.map((it) =>
        supabase
          .from("task_tags")
          .update({ sort_order: it.order })
          .eq("id", it.id)
          .eq("user_id", userId),
      ),
    );
  },
};
