# MODULE: knowledge

## O que é?
Superfície do Knowledge Engine v1 (ADR-015). Provê recuperação semântica
sobre um corpus textual do fotógrafo (templates de contrato, templates de
formulário, notas, artigos de ajuda).

## Escopo (v1)
- `knowledge.search` — busca vetorial owner-scoped.
- `knowledge.embed` — indexa/atualiza documento (idempotente por `source`+`external_id`).

Fora de escopo v1: chunking automático, reindex em massa, UI de gestão,
Memory (fatos inferidos), fatos declarados (isso é Context).

## Como responde aos 6 critérios do Guia do Produto
1. **Utilidade imediata**: Lu passa a citar templates/notas reais do usuário.
2. **Simplicidade**: 2 capabilities, 2 edge functions, sem UI obrigatória.
3. **Velocidade**: 1 chamada de embedding + HNSW = ~150-400ms típico.
4. **Isolamento**: RLS + SECURITY DEFINER `knowledge_match` filtram por `auth.uid()`.
5. **Reversibilidade**: `knowledge.embed` é idempotente; deleção manual via SQL.
6. **Evolução**: Chunking, dedupe, e Memory Engine nascem em Ondas futuras
   sem quebrar a superfície.

## Infra
- Tabela: `public.knowledge_documents` (pgvector `vector(1536)`, HNSW cosine).
- RPC: `public.knowledge_match(user_id, query, source?, limit?)`.
- Edge functions: `knowledge-embed`, `knowledge-search`.
- Modelo: `openai/text-embedding-3-small` via Lovable AI Gateway.

## Segurança
- `LOVABLE_API_KEY` fica apenas nas edge functions.
- Cliente nunca vê vetores; só recebe `{id, title, content, similarity, ...}`.
- Auditoria via `assistant_invocations` quando executado pelo Lu.
