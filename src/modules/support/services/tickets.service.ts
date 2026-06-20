import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SupportTicket,
  TicketCategory,
  TicketStatus,
  TicketPriority,
  SuggestionStatus,
  TechnicalSnapshot,
} from "../types";

const TICKET_COLS = "*";

export async function createTicket(
  sb: SupabaseClient,
  args: {
    userId: string;
    assunto: string;
    categoria: TicketCategory;
    technicalSnapshot: TechnicalSnapshot;
  }
): Promise<SupportTicket> {
  const { data, error } = await sb
    .from("support_tickets")
    .insert({
      user_id: args.userId,
      assunto: args.assunto.trim(),
      categoria: args.categoria,
      technical_snapshot: args.technicalSnapshot as any,
    })
    .select(TICKET_COLS)
    .single();
  if (error) throw error;
  return data as SupportTicket;
}

export async function listMyTickets(
  sb: SupabaseClient,
  userId: string
): Promise<SupportTicket[]> {
  const { data, error } = await sb
    .from("support_tickets")
    .select(TICKET_COLS)
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as SupportTicket[];
}

export async function getTicket(sb: SupabaseClient, id: string): Promise<SupportTicket> {
  const { data, error } = await sb.from("support_tickets").select(TICKET_COLS).eq("id", id).single();
  if (error) throw error;
  return data as SupportTicket;
}

export interface AdminTicketFilters {
  status?: TicketStatus[];
  categoria?: TicketCategory[];
  priority?: TicketPriority[];
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function adminListTickets(
  sb: SupabaseClient,
  filters: AdminTicketFilters = {}
): Promise<{ rows: SupportTicket[]; total: number }> {
  let q = sb
    .from("support_tickets")
    .select(TICKET_COLS, { count: "exact" })
    .order("last_message_at", { ascending: false });

  if (filters.status?.length) q = q.in("status", filters.status as any);
  if (filters.categoria?.length) q = q.in("categoria", filters.categoria as any);
  if (filters.priority?.length) q = q.in("priority", filters.priority as any);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.search?.trim()) {
    const s = filters.search.trim().replace(/[%]/g, "");
    q = q.or(`assunto.ilike.%${s}%`);
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  q = q.range(offset, offset + limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []) as SupportTicket[], total: count ?? 0 };
}

export async function adminUpdateTicket(
  sb: SupabaseClient,
  id: string,
  patch: Partial<{
    status: TicketStatus;
    priority: TicketPriority;
    suggestion_status: SuggestionStatus | null;
    assigned_to: string | null;
  }>
): Promise<SupportTicket> {
  const { data, error } = await sb
    .from("support_tickets")
    .update(patch as any)
    .eq("id", id)
    .select(TICKET_COLS)
    .single();
  if (error) throw error;
  return data as SupportTicket;
}

export async function adminDeleteTicket(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("support_tickets").delete().eq("id", id);
  if (error) throw error;
}
