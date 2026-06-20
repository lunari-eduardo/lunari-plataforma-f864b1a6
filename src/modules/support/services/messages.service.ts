import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupportMessage, MessageAuthorRole } from "../types";

export async function listMessages(
  sb: SupabaseClient,
  ticketId: string
): Promise<SupportMessage[]> {
  const { data, error } = await sb
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupportMessage[];
}

export async function postMessage(
  sb: SupabaseClient,
  args: {
    ticketId: string;
    authorId: string;
    authorRole: MessageAuthorRole;
    body: string;
  }
): Promise<SupportMessage> {
  const { data, error } = await sb
    .from("support_messages")
    .insert({
      ticket_id: args.ticketId,
      author_id: args.authorId,
      author_role: args.authorRole,
      body: args.body.trim(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SupportMessage;
}
