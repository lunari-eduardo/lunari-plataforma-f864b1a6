# MODULE: memory

## O que é?
Memory Engine v1 (ADR-003). Armazena **fatos duráveis** e **preferências de
longo prazo** por usuário — nada mais.

## O que Memory NÃO é
- Histórico de conversas com o Lu → **Observation** (append-only).
- Cache de resultados de tools → **cache/estado local**.
- Rascunhos, notas de sessão, contexto do turno atual → **Context**.
- Documentos textuais grandes → **Knowledge** (pgvector).
- Transcrições, mensagens, turnos de diálogo → **Observation**.

Teste prático:
- Perde valor em 24h? Não é Memory.
- Muda a cada conversa? Não é Memory — é Context.
- Foi declarado explicitamente pelo usuário agora? Context.
- Foi observado/inferido de forma estável ao longo do tempo? Memory.

Chaves com prefixo `conversation.`, `message.`, `turn.`, `history.`, `chat.`
são rejeitadas em runtime **e** no banco.

## Escopo (v1)
- `memory.recall` — lê por `(scope,key)` ou lista por `scope`.
- `memory.remember` — upsert; aprovação humana quando `source=assistant` e
  `scope != assistant`.
- `memory.forget` — remoção; aprovação humana sempre.

Fora de escopo v1: UI no Hub, extração automática por LLM, sumarização,
worker de TTL (`expires_at` existe, execução fica para depois).

## Escopos
- `user` — preferências pessoais do fotógrafo (ex.: `finance.preferred_gateway`).
- `project` — fatos sobre o negócio (ex.: `agenda.default_slot_duration`).
- `assistant` — memória do próprio Lu (ex.: `assistant.tone_preference`).

## Como responde aos 6 critérios do Guia do Produto
1. **Utilidade imediata**: Lu passa a lembrar preferências entre sessões.
2. **Simplicidade**: 1 tabela, 3 capabilities, zero UI obrigatória.
3. **Velocidade**: upsert único indexado por `(user_id, scope, key)`.
4. **Isolamento**: RLS owner-scope + CHECK que rejeita chaves de conversa.
5. **Reversibilidade**: `memory.forget` sempre exige aprovação.
6. **Evolução**: contrato do `MemoryStore` estável — trocar backend = trocar impl.

## Infra
- Tabela: `public.memory_entries` (jsonb ≤ 4KB, único por scope+key).
- Port: `src/shared/memory/MemoryStore`.
- Kernel hook de Observation registra `capability.executed` automaticamente.

## Segurança
- RLS estrita: apenas o próprio `auth.uid()`.
- CHECK no banco rejeita keys reservadas para conversas.
- CHECK no banco limita `value` a 4KB.
- Sem GRANT para `anon`.
