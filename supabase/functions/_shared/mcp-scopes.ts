/**
 * supabase/functions/_shared/mcp-scopes.ts — A4 (gêmeo Deno de src/shared/capability/scopes.ts)
 *
 * O Edge Runtime não importa `src/`, então a matriz de escopos vive duplicada
 * aqui. `scripts/check-mcp-scopes.ts` compara os dois no CI e falha em drift.
 *
 *   read        kind = "query"
 *   write       kind = "command" && needsApproval = false
 *   destructive kind = "command" && needsApproval = true
 *
 * Hierarquia: destructive ⊃ write ⊃ read.
 */

export const SCOPE_TIERS = ["read", "write", "destructive"] as const;
export type ScopeTier = (typeof SCOPE_TIERS)[number];

const IMPLIED: Record<ScopeTier, ScopeTier[]> = {
  read: ["read"],
  write: ["read", "write"],
  destructive: ["read", "write", "destructive"],
};

export function tierOf(input: { kind?: "command" | "query"; needsApproval?: boolean }): ScopeTier {
  if (input.kind === "query") return "read";
  return input.needsApproval ? "destructive" : "write";
}

export function expandTiers(granted: readonly string[]): ScopeTier[] {
  const out = new Set<ScopeTier>();
  for (const g of granted) {
    const tier = SCOPE_TIERS.find((t) => t === g);
    if (tier) for (const implied of IMPLIED[tier]) out.add(implied);
  }
  return SCOPE_TIERS.filter((t) => out.has(t));
}

export function tierSatisfiedBy(required: ScopeTier, granted: readonly string[]): boolean {
  return expandTiers(granted).includes(required);
}

/** `admin` nunca é aceito — token de usuário final não carrega escopo admin. */
export function normalizeScopes(raw: readonly unknown[] | null | undefined): ScopeTier[] {
  const list = Array.isArray(raw) ? raw.map((s) => String(s)) : [];
  const valid = list.filter((s) => (SCOPE_TIERS as readonly string[]).includes(s)) as ScopeTier[];
  return valid.length > 0 ? Array.from(new Set(valid)) : ["read"];
}

export const TIER_LABEL: Record<ScopeTier, string> = {
  read: "leitura",
  write: "escrita",
  destructive: "ações destrutivas",
};
