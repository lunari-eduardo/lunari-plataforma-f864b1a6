# Rollout da assistente Lunari (A6)

Estágio global em `app_settings.assistant_rollout_stage` — JSON string, com
`CHECK` no banco: só `"admin"`, `"beta"` ou `"geral"`.

Fonte única de decisão: RPC `public.assistant_access_allowed(_uid)`
(SECURITY DEFINER, **fail-closed** — erro/estágio desconhecido = negado).

## Matriz de comportamento

| Estágio | Launcher da Lunari | Edge functions `assistant-*` | Criar PAT | Tool via MCP | App OAuth |
|---|---|---|---|---|---|
| `admin` | só admin | só admin | só admin | só admin | só admin |
| `beta`  | admin + `assistant_beta_access` | idem | idem | idem | idem |
| `geral` | todos autenticados | todos | todos | todos | todos |

## Onde o gate é aplicado

| Superfície | Mecanismo |
|---|---|
| UI (launcher) | `useAssistantAccess()` |
| Rotas `/app/assistente/*` | `RequireAssistantAccess` |
| Execução in-app | `runCapabilityAsAssistant` → status `blocked_by_rollout` auditado |
| Edge functions `assistant-*` | `_shared/assistant-guard.ts` (403 `assistant_locked`) |
| MCP (PAT e OAuth) | checagem inline em `assistant-mcp` |
| Dispatcher genérico | `capability-dispatch.ts` quando recebe `userId` |
| **Emissão de credenciais** | `assistant_mcp_token_create` (exception `assistant_locked`) e `assistant_mcp_grant_resolve` (retorna `{}`) |

Nenhuma credencial MCP nasce fora do estágio permitido — não existe token órfão.

## Transições sem regressão

- **Avançar** (`admin → beta → geral`) só amplia: nada é revogado.
- **Retroceder** bloqueia imediatamente (tokens continuam existindo, mas param
  de validar). Revogar credenciais é uma ação separada e explícita.
- Toda troca passa por `assistant_rollout_set(_stage)` — admin-only, valida o
  literal e grava a transição em `assistant_invocations`
  (`capability_id = assistant.rollout.change`, `output_status = "beta->geral"`).

## Fila de acesso ao beta

`assistant_access_requests` (um pendente por usuário):

- usuário cria/vê os próprios pedidos pela tela bloqueada;
- admin vê todos e decide em `assistant_access_request_decide(_id, _approve)`;
- aprovar insere em `assistant_beta_access` na mesma transação.

## Guarda de regressão

`scripts/check-assistant-gate.ts` (CI `ai-surface`, `bun run assistant:gate`)
falha se uma edge function `assistant-*` perder o guard, se o runner in-app
deixar de checar o gate, ou se uma rota do assistente ficar sem
`RequireAssistantAccess`.
