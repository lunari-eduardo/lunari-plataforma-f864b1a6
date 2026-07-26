/**
 * Context Engine v1 (ADR-003, Art. 15 da Constituição)
 *
 * "Context" = fatos DECLARADOS pelo fotógrafo (fonte: humano, alta confiança).
 * Nunca contém:
 *  - fatos inferidos (isso é Memory — nasce depois),
 *  - documentos ou textos (isso é Knowledge — nasce depois),
 *  - preferências transientes de UI (isso é view-state).
 *
 * v1 é intencionalmente pequena: só expõe a leitura tipada. Escrita continua
 * onde já está (páginas de Configurações / Meu Perfil / Admin). Quando um
 * setter precisar viver aqui, criamos capability própria em v1.x.
 *
 * Provider-based: cada família de fatos declarados registra um provider.
 * Snapshot combinado é cacheado por usuário e invalidado em `context.invalidate`.
 */

export type ContextConfidence = "high" | "medium" | "low";

export interface ContextFact<T = unknown> {
  key: string;
  value: T;
  /** Origem humana declarada. Em v1 todos são "human". */
  source: "human";
  confidence: ContextConfidence;
  /** Última atualização conhecida (ISO). Opcional. */
  updatedAt?: string;
}

export interface ContextSnapshot {
  userId: string;
  facts: Record<string, ContextFact>;
  /** Momento em que o snapshot foi montado. */
  loadedAt: string;
}

export interface ContextProvider {
  /** Namespace único (ex.: "profile", "rollout"). Vira prefixo da chave. */
  id: string;
  /** Retorna fatos para o usuário. Deve ser rápido e tolerante a falha. */
  load(userId: string): Promise<ContextFact[]>;
}

const providers = new Map<string, ContextProvider>();

export function registerContextProvider(provider: ContextProvider): void {
  providers.set(provider.id, provider);
}

/** Somente para testes/debug. */
export function _resetContextProviders(): void {
  providers.clear();
  cache.clear();
}

const cache = new Map<string, { snapshot: ContextSnapshot; expiresAt: number }>();
const TTL_MS = 60_000;

export async function loadContext(userId: string): Promise<ContextSnapshot> {
  if (!userId) {
    return { userId: "", facts: {}, loadedAt: new Date().toISOString() };
  }
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;

  const facts: Record<string, ContextFact> = {};
  const results = await Promise.allSettled(
    Array.from(providers.values()).map((p) => p.load(userId)),
  );
  for (const r of results) {
    if (r.status !== "fulfilled") {
       
      console.warn("[context] provider failed", r.reason);
      continue;
    }
    for (const f of r.value) facts[f.key] = f;
  }

  const snapshot: ContextSnapshot = {
    userId,
    facts,
    loadedAt: new Date().toISOString(),
  };
  cache.set(userId, { snapshot, expiresAt: Date.now() + TTL_MS });
  return snapshot;
}

export function invalidateContext(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

export function getContextFact<T = unknown>(
  snapshot: ContextSnapshot,
  key: string,
): ContextFact<T> | undefined {
  return snapshot.facts[key] as ContextFact<T> | undefined;
}

/**
 * Serializa em bloco pronto para prompt do Lu.
 * Formato: "- key: value (confidence)"
 */
export function formatContextForPrompt(snapshot: ContextSnapshot): string {
  const entries = Object.values(snapshot.facts);
  if (entries.length === 0) return "(sem contexto declarado)";
  return entries
    .map((f) => {
      const v =
        typeof f.value === "string" || typeof f.value === "number"
          ? String(f.value)
          : JSON.stringify(f.value);
      return `- ${f.key}: ${v} [${f.confidence}]`;
    })
    .join("\n");
}
