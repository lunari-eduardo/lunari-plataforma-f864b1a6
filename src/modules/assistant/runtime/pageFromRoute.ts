import type { LunariPage } from "@/shared/ai";

/**
 * Onda E.3 — Deriva a página Lunari corrente a partir do pathname.
 * Usado para montar o system prompt/snapshot contextual da Lu.
 */
export function pageFromRoute(pathname: string): LunariPage {
  const p = pathname.toLowerCase();
  if (p.startsWith("/app/workflow") || p === "/app" || p === "/app/") return "workflow";
  if (p.startsWith("/app/tarefas") || p.startsWith("/app/tasks")) return "tasks";
  if (p.startsWith("/app/agenda")) return "agenda";
  if (p.startsWith("/app/financ")) return "finance";
  if (p.startsWith("/app/plano") || p.startsWith("/app/billing") || p.startsWith("/app/assinatura")) return "billing";
  if (p.startsWith("/app/galeria") || p.startsWith("/app/gallery")) return "gallery";
  if (p.startsWith("/app/cliente") || p.startsWith("/app/crm") || p.startsWith("/app/leads")) return "clientes";
  if (p.startsWith("/app/formulario") || p.startsWith("/app/briefing")) return "formularios";
  if (p.startsWith("/app/contrato")) return "contratos";
  if (p.startsWith("/app/config")) return "configuracoes";
  return "workflow";
}
