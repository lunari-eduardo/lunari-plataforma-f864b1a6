import type { LunariPage } from "@/shared/ai";

/**
 * Onda E.3 — Deriva a página Lunari corrente a partir do pathname.
 * Usado para montar o system prompt/snapshot contextual da Lu.
 */
export function pageFromRoute(pathname: string): LunariPage {
  const p = pathname.toLowerCase().replace(/^\/app/, "");
  if (p.startsWith("/workflow")) return "workflow";
  if (p.startsWith("/tarefas") || p.startsWith("/tasks")) return "tasks";
  if (p.startsWith("/agenda")) return "agenda";
  if (p.startsWith("/financ")) return "finance";
  if (p.startsWith("/precificacao") || p.startsWith("/pricing")) return "precificacao";
  if (p.startsWith("/plano") || p.startsWith("/billing") || p.startsWith("/assinatura")) return "billing";
  if (p.startsWith("/galeria") || p.startsWith("/gallery")) return "gallery";
  if (p.startsWith("/cliente") || p.startsWith("/crm")) return "clientes";
  if (p.startsWith("/leads") || p.startsWith("/comercial")) return "leads";
  if (p.startsWith("/formulario") || p.startsWith("/briefing")) return "formularios";
  if (p.startsWith("/contrato")) return "contratos";
  if (p.startsWith("/config") || p.startsWith("/integracoes") || p.startsWith("/minha-conta")) return "configuracoes";
  return "workflow";
}
