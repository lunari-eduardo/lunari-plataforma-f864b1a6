import type {
  TicketStatus,
  TicketCategory,
  TicketPriority,
  SuggestionStatus,
  FAQCategory,
} from "../types";

export const STATUS_LABEL: Record<TicketStatus, string> = {
  novo: "Novo",
  recebido: "Recebido",
  em_analise: "Em análise",
  aguardando_cliente: "Aguardando cliente",
  resolvido: "Resolvido",
  resolvido_whatsapp: "Resolvido (WhatsApp)",
  fechado: "Fechado",
};

export const STATUS_TONE: Record<TicketStatus, string> = {
  novo: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  recebido: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  em_analise: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  aguardando_cliente: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  resolvido: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  resolvido_whatsapp: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  fechado: "bg-muted text-muted-foreground border-border",
};

export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  problema_tecnico: "Problema técnico",
  duvida: "Dúvida",
  sugestao: "Sugestão",
  financeiro: "Financeiro",
  conta: "Conta",
  galerias: "Galerias",
  outro: "Outro",
};

export const PRIORITY_LABEL: Record<TicketPriority, string> = {
  baixa: "Baixa",
  normal: "Normal",
  alta: "Alta",
  urgente: "Urgente",
};

export const PRIORITY_TONE: Record<TicketPriority, string> = {
  baixa: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  normal: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  alta: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  urgente: "bg-red-500/15 text-red-400 border-red-500/30",
};

export const SUGGESTION_STATUS_LABEL: Record<SuggestionStatus, string> = {
  recebida: "Recebida",
  em_analise: "Em análise",
  planejada: "Planejada",
  em_desenvolvimento: "Em desenvolvimento",
  implementada: "Implementada",
  recusada: "Recusada",
};

export const FAQ_CATEGORY_LABEL: Record<FAQCategory, string> = {
  conta: "Conta",
  galerias: "Galerias",
  lunari_studio: "Lunari Studio",
  lunari_gallery: "Lunari Gallery",
  financeiro: "Financeiro",
  assinatura: "Assinatura",
  configuracoes: "Configurações",
  outros: "Outros",
};

export function formatTicketNumber(n: number | string): string {
  const num = typeof n === "string" ? Number(n) : n;
  return `#${String(num).padStart(4, "0")}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
