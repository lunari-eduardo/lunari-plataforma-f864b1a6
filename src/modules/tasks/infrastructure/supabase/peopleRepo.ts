/**
 * Implementação Supabase da `PeopleRepo`.
 * Único ponto autorizado a tocar `supabase.from('task_people')`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PeopleRepo, TaskPersonDef } from "../../ports/peopleRepo";

type Row = Record<string, unknown>;

function rowToPerson(r: Row): TaskPersonDef {
  return {
    id: r.id as string,
    name: r.name as string,
    color: (r.color as string | null) ?? undefined,
    order: (r.sort_order as number) ?? 0,
  };
}

export const supabasePeopleRepo: PeopleRepo = {
  async list(userId) {
    const { data, error } = await supabase
      .from("task_people")
      .select("*")
      .eq("user_id", userId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => rowToPerson(r as Row));
  },

  async create({ name, color, order }, userId) {
    const { data, error } = await supabase
      .from("task_people")
      .insert({ user_id: userId, name, color, sort_order: order })
      .select()
      .single();
    if (error) throw error;
    return rowToPerson(data as Row);
  },

  async update(id, patch, userId) {
    const payload: Record<string, unknown> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.color !== undefined) payload.color = patch.color;
    if (patch.order !== undefined) payload.sort_order = patch.order;
    if (Object.keys(payload).length === 0) return;
    const { error } = await supabase
      .from("task_people")
      .update(payload)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async remove(id, userId) {
    const { error } = await supabase
      .from("task_people")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
  },

  async reorder(items, userId) {
    await Promise.all(
      items.map((it) =>
        supabase
          .from("task_people")
          .update({ sort_order: it.order })
          .eq("id", it.id)
          .eq("user_id", userId),
      ),
    );
  },
};
