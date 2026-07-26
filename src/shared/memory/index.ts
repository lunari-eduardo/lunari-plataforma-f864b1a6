/**
 * Memory Engine v1 (ADR-003)
 *
 * Camada enxuta de fatos duráveis e preferências de longo prazo por usuário.
 * NÃO é histórico de conversa, cache, rascunho ou log de sessão — se o dado
 * perde valor em 24h, ele pertence a Observation/cache. Se muda a cada
 * conversa, pertence a Context.
 *
 * Regras invioláveis:
 *  - `key` começando com `conversation|message|turn|history|chat.` é rejeitada
 *    (aplicado tanto no port quanto em CHECK no banco).
 *  - `value` limitado a ~4KB (CHECK no banco).
 *  - RLS: owner-scope estrito por `user_id`.
 */

import { supabase } from "@/integrations/supabase/client";

export type MemoryScope = "user" | "project" | "assistant";
export type MemorySource = "assistant" | "manual" | "inferred";

export interface MemoryEntry {
  id: string;
  user_id: string;
  scope: MemoryScope;
  key: string;
  value: unknown;
  source: MemorySource;
  confidence: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemorySetInput {
  userId: string;
  scope: MemoryScope;
  key: string;
  value: unknown;
  source?: MemorySource;
  confidence?: number;
  expiresAt?: string | null;
}

export interface MemoryStore {
  get(userId: string, scope: MemoryScope, key: string): Promise<MemoryEntry | null>;
  list(userId: string, scope?: MemoryScope): Promise<MemoryEntry[]>;
  set(input: MemorySetInput): Promise<MemoryEntry>;
  forget(userId: string, scope: MemoryScope, key: string): Promise<boolean>;
}

const RESERVED_KEY_PREFIX = /^(conversation|message|turn|history|chat)\./i;

export function isReservedMemoryKey(key: string): boolean {
  return RESERVED_KEY_PREFIX.test(key);
}

function ensureValidKey(key: string): void {
  if (!key || key.length > 128) {
    throw new Error("memory key inválida (1-128 chars).");
  }
  if (isReservedMemoryKey(key)) {
    throw new Error(
      `memory key "${key}" é reservada — Memory não armazena histórico de conversas.`,
    );
  }
}

function ensureValueSize(value: unknown): void {
  const size = JSON.stringify(value ?? null).length;
  if (size > 4096) {
    throw new Error(`memory value excede 4KB (${size} bytes) — enxute ou use Knowledge.`);
  }
}

export const memoryStore: MemoryStore = {
  async get(userId, scope, key) {
    const { data, error } = await supabase
      .from("memory_entries")
      .select("*")
      .eq("user_id", userId)
      .eq("scope", scope)
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return (data as MemoryEntry | null) ?? null;
  },

  async list(userId, scope) {
    let q = supabase
      .from("memory_entries")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (scope) q = q.eq("scope", scope);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as MemoryEntry[];
  },

  async set(input) {
    ensureValidKey(input.key);
    ensureValueSize(input.value);
    const row = {
      user_id: input.userId,
      scope: input.scope,
      key: input.key,
      value: input.value as never,
      source: input.source ?? "manual",
      confidence: input.confidence ?? 1.0,
      expires_at: input.expiresAt ?? null,
    };
    const { data, error } = await supabase
      .from("memory_entries")
      .upsert(row, { onConflict: "user_id,scope,key" })
      .select("*")
      .single();
    if (error) throw error;
    return data as MemoryEntry;
  },

  async forget(userId, scope, key) {
    const { error, count } = await supabase
      .from("memory_entries")
      .delete({ count: "exact" })
      .eq("user_id", userId)
      .eq("scope", scope)
      .eq("key", key);
    if (error) throw error;
    return (count ?? 0) > 0;
  },
};
