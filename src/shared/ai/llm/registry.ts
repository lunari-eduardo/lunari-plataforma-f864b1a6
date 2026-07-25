/**
 * Registry de providers LLM.
 *
 * Fase B — o runtime resolve o provider via `getLLMProvider(id)`. Adapters
 * concretos (Gemini/OpenAI/MCP-bridge) se auto-registram via
 * `registerLLMProvider`. Nenhum provider é embutido aqui — a decisão do
 * fornecedor default é feita pelo runtime da Lu, não por este módulo.
 */

import type { LLMProvider } from "./types";

const providers = new Map<string, LLMProvider>();
let defaultProviderId: string | null = null;

export function registerLLMProvider(provider: LLMProvider, opts?: { makeDefault?: boolean }) {
  providers.set(provider.id, provider);
  if (opts?.makeDefault || !defaultProviderId) {
    defaultProviderId = provider.id;
  }
}

export function getLLMProvider(id?: string): LLMProvider {
  const key = id ?? defaultProviderId;
  if (!key) throw new Error("LLM: nenhum provider registrado.");
  const p = providers.get(key);
  if (!p) throw new Error(`LLM: provider "${key}" não registrado.`);
  return p;
}

export function listLLMProviders(): LLMProvider[] {
  return Array.from(providers.values());
}

export function setDefaultLLMProvider(id: string) {
  if (!providers.has(id)) throw new Error(`LLM: provider "${id}" não registrado.`);
  defaultProviderId = id;
}

export function getDefaultLLMProviderId(): string | null {
  return defaultProviderId;
}

/** Somente testes — limpa o registry. */
export function __resetLLMProvidersForTests() {
  providers.clear();
  defaultProviderId = null;
}
