// Tipos canônicos do domínio de Suporte (independentes do schema gerado).

export type TicketStatus =
  | "novo"
  | "recebido"
  | "em_analise"
  | "aguardando_cliente"
  | "resolvido"
  | "resolvido_whatsapp"
  | "fechado";

export type TicketPriority = "baixa" | "normal" | "alta" | "urgente";

export type TicketCategory =
  | "problema_tecnico"
  | "duvida"
  | "sugestao"
  | "financeiro"
  | "conta"
  | "galerias"
  | "outro";

export type SuggestionStatus =
  | "recebida"
  | "em_analise"
  | "planejada"
  | "em_desenvolvimento"
  | "implementada"
  | "recusada";

export type FAQCategory =
  | "conta"
  | "galerias"
  | "lunari_studio"
  | "lunari_gallery"
  | "financeiro"
  | "assinatura"
  | "configuracoes"
  | "outros";

export type MessageAuthorRole = "user" | "admin" | "system";

export type AttachmentKind = "image" | "video";

export interface TechnicalSnapshot {
  plan?: string | null;
  app_version?: string | null;
  origin_path?: string | null;
  user_agent?: string | null;
  os?: string | null;
  browser?: string | null;
  locale?: string | null;
  viewport?: string | null;
  timezone?: string | null;
}

export interface SupportTicket {
  id: string;
  numero: number;
  user_id: string;
  assunto: string;
  categoria: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  suggestion_status: SuggestionStatus | null;
  assigned_to: string | null;
  technical_snapshot: TechnicalSnapshot;
  last_message_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_id: string;
  author_role: MessageAuthorRole;
  body: string;
  created_at: string;
}

export interface SupportAttachment {
  id: string;
  ticket_id: string;
  message_id: string | null;
  kind: AttachmentKind;
  r2_key: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string;
  created_at: string;
}

export interface SupportInternalNote {
  id: string;
  ticket_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface FAQMediaItem {
  kind: AttachmentKind;
  r2_key: string;
  mime?: string;
  alt?: string;
}

export interface FAQArticle {
  id: string;
  slug: string;
  category: FAQCategory;
  pergunta: string;
  resposta: string;
  keywords: string[];
  media: FAQMediaItem[];
  ordem: number;
  published: boolean;
  active: boolean;
  views_count: number;
  helpful_count: number;
  not_helpful_count: number;
  source_ticket_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingAttachment {
  id: string; // uuid local
  file: File;
  kind: AttachmentKind;
  previewUrl: string;
}
