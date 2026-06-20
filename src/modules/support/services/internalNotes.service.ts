import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupportInternalNote } from "../types";

export async function listNotes(
  sb: SupabaseClient,
  ticketId: string
): Promise<SupportInternalNote[]> {
  const { data, error } = await sb
    .from("support_internal_notes")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupportInternalNote[];
}

export async function addNote(
  sb: SupabaseClient,
  args: { ticketId: string; authorId: string; body: string }
): Promise<SupportInternalNote> {
  const { data, error } = await sb
    .from("support_internal_notes")
    .insert({
      ticket_id: args.ticketId,
      author_id: args.authorId,
      body: args.body.trim(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SupportInternalNote;
}

export async function deleteNote(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("support_internal_notes").delete().eq("id", id);
  if (error) throw error;
}
