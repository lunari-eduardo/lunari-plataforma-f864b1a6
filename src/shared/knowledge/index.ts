/**
 * Knowledge Engine v1 (ADR-015, Art. 15 da Constituição)
 *
 * "Knowledge" = corpo textual RECUPERÁVEL por similaridade semântica.
 * Diferente de:
 *   - Context: fatos declarados (curtos, tipados, alta confiança).
 *   - Memory: fatos inferidos.
 *   - view-state: preferências transientes de UI.
 *
 * v1 é intencionalmente pequena:
 *   - embed(...) e search(...) invocam edge functions que usam o Lovable AI
 *     Gateway para vetorizar via `openai/text-embedding-3-small` (1536-dim).
 *   - Armazenamento em `public.knowledge_documents` com pgvector + HNSW.
 *   - Owner-scoped por RLS (auth.uid()) e pela SECURITY DEFINER `knowledge_match`.
 *
 * NÃO expõe embeddings brutos ao cliente. Todo cálculo vive nas edge functions.
 */

import { supabase } from "@/integrations/supabase/client";

export type KnowledgeSource =
  | "contract_template"
  | "form_template"
  | "note"
  | "help"
  | (string & {});

export interface KnowledgeMatch {
  id: string;
  source: string;
  external_id: string | null;
  title: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface KnowledgeEmbedInput {
  source: KnowledgeSource;
  externalId?: string | null;
  title?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeSearchInput {
  query: string;
  source?: KnowledgeSource | null;
  limit?: number;
}

export async function embedDocument(
  input: KnowledgeEmbedInput,
): Promise<{ id: string; source: string; external_id: string | null }> {
  const { data, error } = await supabase.functions.invoke("knowledge-embed", {
    body: {
      source: input.source,
      external_id: input.externalId ?? null,
      title: input.title ?? null,
      content: input.content,
      metadata: input.metadata ?? {},
    },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error((data as { error?: string })?.error ?? "knowledge_embed_failed");
  return data.document;
}

export async function searchKnowledge(input: KnowledgeSearchInput): Promise<KnowledgeMatch[]> {
  const { data, error } = await supabase.functions.invoke("knowledge-search", {
    body: {
      query: input.query,
      source: input.source ?? null,
      limit: input.limit ?? 8,
    },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error((data as { error?: string })?.error ?? "knowledge_search_failed");
  return (data.results ?? []) as KnowledgeMatch[];
}
