import type { SupportAttachment, AttachmentKind, PendingAttachment } from "../types";
import type { SupportHost } from "../SupportHostProvider";
import { kindForMime } from "../config";

export async function listAttachmentsForTicket(
  host: SupportHost,
  ticketId: string
): Promise<SupportAttachment[]> {
  const { data, error } = await host.supabase
    .from("support_attachments")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SupportAttachment[];
}

export async function uploadAndRegisterAttachment(
  host: SupportHost,
  args: {
    ticketId: string;
    messageId: string | null;
    file: File;
  }
): Promise<SupportAttachment> {
  const kind = kindForMime(args.file.type) as AttachmentKind | null;
  if (!kind) throw new Error(`Tipo de arquivo não permitido: ${args.file.type || "desconhecido"}`);
  if (!host.currentUser) throw new Error("Usuário não autenticado");

  const uploaded = await host.storage.uploadFile(args.file, {
    context: "support-ticket",
    entityId: args.ticketId,
  });

  const { data, error } = await host.supabase
    .from("support_attachments")
    .insert({
      ticket_id: args.ticketId,
      message_id: args.messageId,
      kind,
      r2_key: uploaded.r2Key,
      file_name: args.file.name,
      mime_type: args.file.type,
      size_bytes: args.file.size,
      uploaded_by: host.currentUser.id,
    })
    .select("*")
    .single();
  if (error) {
    // Tenta limpar do R2 se falhou no DB
    host.storage.deleteFile(uploaded.r2Key).catch(() => {});
    throw error;
  }
  return data as SupportAttachment;
}

export async function deleteAttachment(
  host: SupportHost,
  attachment: SupportAttachment
): Promise<void> {
  const { error } = await host.supabase
    .from("support_attachments")
    .delete()
    .eq("id", attachment.id);
  if (error) throw error;
  await host.storage.deleteFile(attachment.r2_key).catch(() => {});
}

export function buildPendingAttachment(file: File): PendingAttachment | null {
  const kind = kindForMime(file.type) as AttachmentKind | null;
  if (!kind) return null;
  return {
    id: crypto.randomUUID(),
    file,
    kind,
    previewUrl: URL.createObjectURL(file),
  };
}
