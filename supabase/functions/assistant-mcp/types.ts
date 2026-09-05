// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
export { markupDaMargem, round2 } from "./pricing.ts";

export interface McpContent { type: "text"; text: string }

export interface McpToolResult {
  content: McpContent[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _pendingApproval?: { approvalId: string; expiresAt: string };
}

export type Handler = (
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, any>,
) => Promise<McpToolResult>;

export interface BridgedTool {
  handler: Handler;
  scope: "read" | "write";
  requiresApproval: boolean;
  summarize?: (args: Record<string, any>) => string;
}

export type WriteCfg = {
  handler: Handler;
  requiresApproval: boolean;
  summarize: (a: Record<string, any>) => string;
};

export interface NeedsInputOption {
  label: string;
  value: string;
  hint?: string;
}

export const ok = (structured: unknown, summary: string): McpToolResult => ({
  content: [{ type: "text", text: summary }],
  structuredContent:
    structured && typeof structured === "object"
      ? (structured as Record<string, unknown>)
      : { value: structured },
});

export const fail = (message: string): McpToolResult => ({
  isError: true,
  content: [{ type: "text", text: message }],
});

export function needsInput(input: {
  missing: string[];
  question: string;
  options?: NeedsInputOption[];
  allowCreate?: boolean;
  createHint?: string;
}): McpToolResult {
  const lines = [input.question];
  if (input.options?.length) {
    lines.push(
      ...input.options.map((o) => `- ${o.label}${o.hint ? ` (${o.hint})` : ""} → ${o.value}`),
    );
  }
  if (input.allowCreate && input.createHint) lines.push(input.createHint);
  lines.push(
    `[needs_input] Pergunte ao usuário antes de prosseguir. Campos faltando: ${input.missing.join(", ")}. Não escolha nem crie nada por conta própria.`,
  );
  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent: {
      status: "needs_input",
      missing: input.missing,
      question: input.question,
      options: input.options ?? [],
      allowCreate: !!input.allowCreate,
    },
  };
}

export function clampLimit(n: unknown, def = 20, max = 200): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return def;
  return Math.min(Math.floor(v), max);
}

export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const money = (v: unknown) => `R$ ${(Number(v) || 0).toFixed(2)}`;

export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function toMinutes(hhmm: string): number {
  const [h, m] = String(hhmm).split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60), m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function somaProdutos(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.reduce((s: number, p: any) => s + (Number(p?.custo) || 0) * (Number(p?.quantidade) || 1), 0);
}

export function somaCustos(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.reduce((s: number, c: any) => s + (Number(c?.valorUnitario ?? c?.valor) || 0) * (Number(c?.quantidade) || 1), 0);
}

export function arredondar(valor: number, passo: number): number {
  if (!passo || passo <= 0) return round2(valor);
  return round2(Math.ceil(valor / passo) * passo);
}

export function resolverMarkup(args: Record<string, any>, margemPadrao: number): { markup: number; origem: string } {
  if (Number(args.markup) > 0) return { markup: Number(args.markup), origem: `markup informado ${Number(args.markup)}x` };
  if (Number(args.margemDesejada) > 0) {
    const m = markupDaMargem(Number(args.margemDesejada));
    if (m) return { markup: m, origem: `derivado da margem ${Number(args.margemDesejada)}%` };
  }
  const padrao = margemPadrao > 0 ? markupDaMargem(margemPadrao) : null;
  if (padrao) return { markup: padrao, origem: `margem configurada ${margemPadrao}%` };
  return { markup: 2, origem: "markup padrão 2x (nenhuma margem configurada)" };
}

export const GRUPOS_RECEITA = ["Receita Operacional", "Receita Não Operacional"];

export const SESSAO_COLS =
  "id,session_id,cliente_id,appointment_id,galeria_id,data_sessao,hora_sessao,categoria,pacote," +
  "descricao,observacoes,detalhes,status,status_financeiro,valor_total,valor_pago,valor_base_pacote," +
  "valor_adicional,desconto,qtd_fotos_extra,valor_foto_extra,valor_total_foto_extra,produtos_incluidos," +
  "clientes(id,nome,telefone,email)";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const APPT_COLS = "id,title,date,time,type,status,description,cliente_id,duration_minutes,session_id,paid_amount";

export const WORKFLOW_EDITABLE = [
  "descricao",
  "observacoes",
  "detalhes",
  "categoria",
  "pacote",
  "data_sessao",
  "hora_sessao",
  "desconto",
  "valor_adicional",
  "valor_base_pacote",
  "valor_foto_extra",
] as const;

export const WORKFLOW_NUMERIC = new Set<string>([
  "desconto",
  "valor_adicional",
  "valor_base_pacote",
  "valor_foto_extra",
]);
