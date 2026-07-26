import { z } from "zod";
import { defineQuery, defineCommand } from "@/shared/capability";
import { ok, err, domainError } from "@/shared/result";
import { embedDocument, searchKnowledge } from "@/shared/knowledge";

/**
 * Onda 6 — Capabilities do Knowledge Engine v1.
 *
 * `knowledge.search` (query, cheap, sem aprovação):
 *   Busca semântica sobre `knowledge_documents` do usuário autenticado.
 *
 * `knowledge.embed` (command, sem aprovação):
 *   Insere ou atualiza um documento indexado (por `source`+`external_id`).
 *   Não é destrutivo: idempotente por (user, source, external_id).
 */

export const knowledgeSearchCapability = defineQuery({
  id: "knowledge.search",
  title: "Buscar em conhecimento",
  description:
    "Busca por similaridade semântica em documentos do fotógrafo (templates de contrato, formulários, anotações, etc.).",
  input: z.object({
    query: z.string().min(1).max(4000),
    source: z.string().max(64).optional().nullable(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  output: z.object({
    results: z.array(
      z.object({
        id: z.string(),
        source: z.string(),
        external_id: z.string().nullable(),
        title: z.string().nullable(),
        content: z.string(),
        metadata: z.record(z.unknown()),
        similarity: z.number(),
      }),
    ),
  }),
  permissions: ["knowledge:read"],
  costHint: "cheap",
  async handler(input) {
    try {
      const results = await searchKnowledge({
        query: input.query,
        source: input.source ?? null,
        limit: input.limit,
      });
      return ok({ results });
    } catch (e) {
      return err(
        domainError("KNOWLEDGE_SEARCH_FAILED", "Não foi possível buscar no conhecimento.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});

export const knowledgeEmbedCapability = defineCommand({
  id: "knowledge.embed",
  title: "Indexar documento em conhecimento",
  description:
    "Insere ou atualiza um documento no índice semântico (idempotente por source+external_id).",
  input: z.object({
    source: z.string().min(1).max(64),
    externalId: z.string().max(128).optional().nullable(),
    title: z.string().max(500).optional().nullable(),
    content: z.string().min(1).max(20000),
    metadata: z.record(z.unknown()).optional(),
  }),
  output: z.object({
    id: z.string(),
    source: z.string(),
    external_id: z.string().nullable(),
  }),
  permissions: ["knowledge:write"],
  costHint: "cheap",
  async handler(input) {
    try {
      const doc = await embedDocument({
        source: input.source,
        externalId: input.externalId ?? null,
        title: input.title ?? null,
        content: input.content,
        metadata: input.metadata,
      });
      return ok({
        id: doc.id,
        source: doc.source,
        external_id: doc.external_id ?? null,
      });
    } catch (e) {
      return err(
        domainError("KNOWLEDGE_EMBED_FAILED", "Não foi possível indexar o documento.", {
          retriable: true,
          cause: e,
        }),
      );
    }
  },
});
