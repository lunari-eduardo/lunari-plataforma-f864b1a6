/**
 * Audiência de capabilities — Rodada A1 do roteiro MCP.
 *
 * Define QUEM pode enxergar cada capability:
 *  - "app" → a Lu dentro do Lunari Studio (sempre).
 *  - "mcp" → clientes MCP externos (ChatGPT, Claude, Cursor…).
 *
 * Regra de negócio (ADR-008 + decisão do roteiro A):
 *  - MCP é para o USUÁRIO FINAL. Nada de superfície admin/plataforma.
 *  - Gallery entra apenas como LEITURA de dados já existentes no Gestão.
 *
 * Nada aqui altera runtime: em A1 o campo é apenas declarado e exposto no
 * registry. Quem consome (`buildMCPToolsForUser`, catálogo, executor) passa a
 * ler em A2/A3.
 */

export type CapabilityAudience = "app" | "mcp";

/**
 * Módulos que NUNCA vão para o MCP: são os anéis internos da arquitetura
 * (Kernel/Policy/Context/…). Expor `memory.forget` ou `automation.tick` a um
 * cliente externo deixaria o agente reescrever o próprio estado.
 */
export const MCP_BLOCKED_MODULES: ReadonlySet<string> = new Set([
  "context",
  "memory",
  "knowledge",
  "observation",
  "intelligence",
  "decision",
  "learning",
  "automation",
]);

/**
 * Capabilities individuais bloqueadas por serem decisão de plataforma
 * (não do fotógrafo operando por chat) ou escrita fora do escopo do MCP.
 */
export const MCP_BLOCKED_CAPABILITIES: ReadonlySet<string> = new Set([
  // Crédito de fotos = decisão comercial da plataforma.
  "finance.credit.grant",
  "finance.credit.revoke",
  "finance.credit.apply",
  // Gallery só entra como leitura; reabrir seleção é escrita no Gallery.
  "gallery.reopenSelection",
]);

/** Módulo derivado do id (`finance.transaction.create` → `finance`). */
export function moduleOf(capabilityId: string): string {
  return capabilityId.split(".")[0] ?? capabilityId;
}

/** Audiência default de uma capability, quando não declarada explicitamente. */
export function defaultAudienceFor(capabilityId: string): CapabilityAudience[] {
  if (MCP_BLOCKED_MODULES.has(moduleOf(capabilityId))) return ["app"];
  if (MCP_BLOCKED_CAPABILITIES.has(capabilityId)) return ["app"];
  return ["app", "mcp"];
}

/** Conveniência para filtros. */
export function isExposedToMCP(audience: readonly CapabilityAudience[]): boolean {
  return audience.includes("mcp");
}
