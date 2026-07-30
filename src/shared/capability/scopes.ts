/**
 * src/shared/capability/scopes.ts — A4
 *
 * Fonte única da matriz de escopos do MCP. Tier é DERIVADO da capability,
 * nunca anotado à mão:
 *
 *   read        kind = "query"
 *   write       kind = "command" && needsApproval = false
 *   destructive kind = "command" && needsApproval = true
 *
 * Hierarquia: destructive ⊃ write ⊃ read. Conceder destrutivo concede escrita;
 * nunca o contrário.
 *
 * IMPORTANTE: escopo ≠ aprovação. Escopo diz "este cliente pode PEDIR";
 * o fluxo de approvals continua exigindo confirmação humana para o tier
 * destrutivo mesmo com escopo concedido.
 *
 * Há um gêmeo Deno em `supabase/functions/_shared/mcp-scopes.ts` (o Edge não
 * importa `src/`). Os dois são checados um contra o outro no CI.
 */

export const SCOPE_TIERS = ["read", "write", "destructive"] as const;
export type ScopeTier = (typeof SCOPE_TIERS)[number];

/** Escopos herdados por cada tier concedido. */
const IMPLIED: Record<ScopeTier, ScopeTier[]> = {
  read: ["read"],
  write: ["read", "write"],
  destructive: ["read", "write", "destructive"],
};

/** Tier exigido por uma capability/tool. */
export function tierOf(input: { kind: "command" | "query"; needsApproval?: boolean }): ScopeTier {
  if (input.kind === "query") return "read";
  return input.needsApproval ? "destructive" : "write";
}

/** Expande escopos concedidos aplicando a hierarquia. */
export function expandTiers(granted: readonly string[]): ScopeTier[] {
  const out = new Set<ScopeTier>();
  for (const g of granted) {
    const tier = SCOPE_TIERS.find((t) => t === g);
    if (tier) for (const implied of IMPLIED[tier]) out.add(implied);
  }
  return SCOPE_TIERS.filter((t) => out.has(t));
}

/** Decisão única: o conjunto concedido satisfaz o tier exigido? */
export function tierSatisfiedBy(required: ScopeTier, granted: readonly string[]): boolean {
  return expandTiers(granted).includes(required);
}

/**
 * Normaliza escopos vindos de token/grant. `admin` NUNCA é aceito: token de
 * usuário final não carrega escopo administrativo (A4, entrega 3).
 */
export function normalizeScopes(raw: readonly unknown[] | null | undefined): ScopeTier[] {
  const list = Array.isArray(raw) ? raw.map((s) => String(s)) : [];
  const valid = list.filter((s): s is ScopeTier => (SCOPE_TIERS as readonly string[]).includes(s));
  return valid.length > 0 ? Array.from(new Set(valid)) : ["read"];
}

/** Rótulo curto em pt-BR para UI e mensagens de erro. */
export const TIER_LABEL: Record<ScopeTier, string> = {
  read: "leitura",
  write: "escrita",
  destructive: "ações destrutivas",
};
