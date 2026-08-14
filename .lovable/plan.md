# Auditoria do Assistente Lunari — diagnóstico e plano de correção

Nenhuma alteração foi feita. Abaixo o fluxo real do código, a causa raiz confirmada por log e o plano.

## A. Fluxo atual (real)

```text
AssistantChat.tsx (useChat @ai-sdk/react v2)
  └─ buildRequestBody(): listAllLunariAITools({user}) → 217 tools
       name = capabilityId com "." → "__"
       parameters = inputSchema (JSON Schema, gerado por zod-to-json-schema em shared/capability/ai-adapter.ts)
       + system prompt (buildAssistantSystemPrompt) + page
  └─ DefaultChatTransport → POST {VITE_SUPABASE_URL}/functions/v1/assistant-chat
       header Authorization: Bearer <access_token do Supabase>
supabase/functions/assistant-chat/index.ts
  ├─ CORS ok / valida JWT com supabase.auth.getClaims  → OK (log "Auth OK")
  ├─ assistant-guard → RPC assistant_access_allowed    → OK (log "acesso permitido")
  ├─ lê app_settings: provider='gemini', model='gemini-3.7-flash'
  ├─ lê assistant_provider_keys.api_key (53 chars, prefixo AQ.Ab8… = chave AI Studio nova)
  ├─ monta tools[name] = { description, inputSchema: { jsonSchema: <schema> } }  ← BUG
  ├─ createGoogleGenerativeAI({apiKey})(modelId)
  └─ streamText(...).toUIMessageStreamResponse()  → devolve HTTP 200 e o stream
Frontend: primeiro chunk do stream é um erro mascarado → renderiza "An error occurred."
```

Tool calling do lado do cliente (`onToolCall` → `executeAssistantToolCall` → `runCapabilityAsAssistant` → `assistant_invocations`) nunca chega a rodar: o fluxo morre antes da 1ª chamada ao Gemini.

## B. Ponto exato da falha

Arquivo: `supabase/functions/assistant-chat/index.ts`, linhas 183-192.

```ts
tools[decl.name] = {
  description: buildToolDescription(decl),
  inputSchema: { jsonSchema: decl.parameters ?? {...} },   // objeto cru
};
```

Erro original (log da Edge Function, repetido em todas as tentativas de hoje):

```
TypeError: Cannot read properties of undefined (reading 'typeName')
  at parseDef (@ai-sdk/provider-utils/3.0.32/.../index.mjs:2607)
  at zodToJsonSchema (...)
  at prepareToolsAndToolChoice (ai/5.0.236/.../index.mjs:1221)
  at streamStep
```

Causa: no AI SDK 5, `inputSchema` aceita um schema Zod **ou** um `Schema` criado por `jsonSchema(...)` (helper de `ai`/`@ai-sdk/provider-utils`), que carrega um símbolo interno. Um objeto literal `{ jsonSchema: … }` não é reconhecido, cai no caminho Zod e `parseDef` lê `._def.typeName` de `undefined`. Isso acontece **antes** de qualquer request ao Google — por isso não há resposta do Gemini, nem 4xx, nem log de rede.

Por que o usuário vê só "An error occurred.": `toUIMessageStreamResponse()` já respondeu 200; o erro ocorre dentro do stream e o AI SDK mascara mensagens de erro por padrão (`onError` não definido). O `catch` do `try` na linha 280 nunca dispara, porque a exceção é assíncrona dentro do stream. `AssistantChat.tsx` apenas renderiza `error.message`.

O erro anterior ("versão de especificação v1 / v2") era um problema distinto e já resolvido: `@ai-sdk/google@^2` (spec v2) é a versão correta com `ai@^5`. O arquivo `supabase/functions/assistant-chat/test-spec.ts` ainda importa `@ai-sdk/google@^3` — resíduo de teste, não é executado.

## C. Problemas encontrados

**CRÍTICO**
1. `inputSchema` cru (linhas 188-190) → quebra 100% das requisições com tools.
2. Erros do stream são mascarados: sem `onError` em `toUIMessageStreamResponse`, o motivo real nunca chega à UI nem ao log estruturado.

**ALTO**
3. 217 tools enviadas em todo turno. O Gemini limita function declarations (~128) e o payload/custo por turno é enorme. Mesmo corrigido o item 1, isso provavelmente gerará 400 do Google.
4. Modelo `gemini-3.7-flash` gravado em `app_settings` — id não confirmado na API Generative Language; risco de 404 model not found assim que o schema for corrigido. `DEFAULT_MODEL` no código (`gemini-3.5-flash-lite`) diverge do valor do banco.
5. Chave do provider guardada em `assistant_provider_keys` (tabela) em vez de secret da Edge Function.

**MÉDIO**
6. `assistant_invocations` só é gravado no cliente (`runCapabilityAsAssistant`) e no gate; não há registro do turno de chat em si (prompt/modelo/tokens).
7. Truncamento de histórico muta `part.result` de mensagens `tool` (campo correto no AI SDK 5 é `output`) — pode invalidar o par tool-call/tool-result.
8. Sliding window fixo de 10 mensagens pode cortar entre um `tool-call` e seu `tool-result`.
9. Rollout está em `admin` — funciona para você, bloqueia os demais (informativo, não alterar).

**BAIXO**
10. `test-spec.ts` legado dentro da pasta da função.
11. `leads-ai-assistant` é stub sem IA; `assistant-mcp`, `assistant-transcribe`, `assemble-context`, `knowledge-*` são superfícies separadas e não interferem no chat.

## D. O que está correto

- Auth por JWT (`getClaims`), CORS, gate de rollout, leitura de configuração — todos confirmados nos logs.
- Arquitetura de tools no cliente (execução com RLS do usuário) e Human-in-the-loop via `runCapabilityAsAssistant`/`assistant_approvals`.
- `ai@^5` + `@ai-sdk/google@^2` + `@ai-sdk/react@^2`: combinação de versões coerente.
- Geração de JSON Schema a partir de Zod em `ai-adapter.ts`.
- Arquitetura já compatível com áudio futuro (transcrição em `assistant-transcribe`, mesma camada de tools e histórico).

## E/F. Correções propostas (ordem)

1. **Envolver o schema com o helper `jsonSchema()`** — `assistant-chat/index.ts`, bloco de adaptação de tools. Importar `jsonSchema` de `npm:ai@^5` e usar `inputSchema: jsonSchema(decl.parameters)`. Impacto: destrava o fluxo. Risco: baixo. Teste: enviar "oi" e ver stream de texto.
2. **Expor o erro real** — adicionar `onError` em `toUIMessageStreamResponse` retornando a mensagem, e `console.error` estruturado. Risco: baixo (mensagens de erro visíveis só para o usuário autenticado).
3. **Reduzir o catálogo de tools por turno** — no `buildRequestBody` do frontend, filtrar por página/contexto ou aplicar tool-deferral (uma tool de busca + uma de invocação). Meta: ≤ 60 declarações. Risco: médio (afeta alcance da Lu); teste por página.
4. **Validar o id do modelo** — checar `gemini-3.7-flash` contra o endpoint `models.list` do Google com a chave do cofre; alinhar `app_settings.assistant_ai_model` e `DEFAULT_MODEL`.
5. **Corrigir o truncamento de histórico** — usar `output` em vez de `result` e cortar sempre em fronteira de turno completo.
6. **Registrar o turno de chat em `assistant_invocations`** (início + finish, com modelo e uso de tokens).
7. **Limpeza**: remover `test-spec.ts`; decidir sobre `leads-ai-assistant`.

Teste de aceite para 1-2: uma pergunta não destrutiva ("Quais sessões têm pagamento pendente?") deve chegar ao Gemini e, no mínimo, retornar erro específico do provider em vez de "An error occurred.".

## G. Não alterar

Auth/JWT, gate de rollout, CORS, execução client-side das capabilities, Human-in-the-loop, `ai-adapter.ts`, versões atuais de `ai`/`@ai-sdk/*` (não fazer downgrade), provider Gemini.
