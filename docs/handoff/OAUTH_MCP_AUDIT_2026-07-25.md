# Auditoria OAuth do MCP Lunari — 2026-07-25

## Sintoma

Ao conectar o Lunari como MCP no ChatGPT, o popup pisca e retorna para:

```
https://chatgpt.com/connector/oauth/_q0K-fW8D-41
  ?error=invalid_request
  &error_description=unsupported+scope%3A+read
  &state=oauth_s_6a645e15e11c8191a4313b2a65d76ab5
```

## Causa raiz

O erro é emitido pelo **Authorization Server do Supabase**
(`https://tlnjspsywycbudhewsfv.supabase.co/auth/v1/oauth/authorize`) porque
o ChatGPT enviou `scope=read` no `/authorize`. O Supabase Auth só aceita os
scopes anunciados em `/.well-known/oauth-authorization-server`:

```json
"scopes_supported": ["openid","profile","email","phone"]
```

Não existe scope `read` no Supabase Auth — nem custom scopes.

### Por que o ChatGPT continua enviando `scope=read`

O ChatGPT **cacheia por connector** o metadata OAuth (`scopes_supported`)
lido no momento da criação do connector. O connector `_q0K-fW8D-41` foi
criado quando nosso `/.well-known/oauth-protected-resource` ainda listava:

```json
"scopes_supported": ["read","write","openid","email","profile"]
```

Mesmo depois de removermos `read`/`write` do metadata (deploy anterior),
o connector já registrado no ChatGPT continua enviando `scope=read`,
o Supabase rejeita, e o fluxo quebra.

Isso **não** é bug do nosso servidor — mas nosso servidor é a única camada
sob nosso controle para consertar, então o fix foi feito aqui.

## Auditoria pedida — resposta ponto a ponto

| # | Item auditado | Resultado |
|---|---|---|
| 1 | Manifesto do plugin / discovery endpoints | Corretos. `resource`, `authorization_servers`, `bearer_methods_supported` conformes RFC 9728. |
| 2 | `/authorize` — validação de scopes | Feita pelo **Supabase Auth** (não é código nosso). Rejeita qualquer scope fora de `openid/profile/email/phone`. Linha de rejeição: dentro do binário do GoTrue; retorno `invalid_request unsupported scope: <name>`. |
| 3 | `/token` (troca de code) | 100% no Supabase. `authorization_code` + `refresh_token`, PKCE `S256`+`plain` suportados, `token_endpoint_auth_methods_supported: [client_secret_basic, client_secret_post, none]`. |
| 4 | Discovery (`/.well-known/oauth-authorization-server` e `oauth-protected-resource`) | Servidos por nós em `assistant-mcp/index.ts`. Agora ambos anunciam apenas `openid/email/profile`. |
| 5 | `scopes_supported` anunciados | `["openid","email","profile"]`. Verificado por `curl` ao vivo. |
| 6 | Logs | Adicionado `console.log("[oauth-authorize-proxy]", ...)` com `client_id`, `redirect_uri`, `response_type`, `state`, `code_challenge`, `code_challenge_method`, `scope_in`, `scope_out`, `dropped_scopes`. |
| 7 | PKCE | Suportado nativamente pelo Supabase (`S256`, `plain`). Proxy preserva `code_challenge` e `code_challenge_method` intactos. |
| 8 | Redirect URI | Preservado byte-a-byte pelo proxy. Cliente OAuth 2.1 do Supabase valida contra os `redirect_uris` registrados via DCR. |
| 9 | Conformidade RFC 6749 / 7636 | Proxy respeita §3.3 (AS pode ignorar scopes desconhecidos), preserva todos os outros parâmetros exigidos. PKCE (RFC 7636) intacto. |

## Correção aplicada

Interposição de um **proxy de `/authorize`** dentro da própria função
`assistant-mcp`, com **higienização de scope** antes de encaminhar ao Supabase.

### Arquivo, função e localização

- **Arquivo:** `supabase/functions/assistant-mcp/index.ts`
- **Constantes novas** (linhas ~356-369):
  - `AUTHORIZE_PROXY_URL` — URL do proxy que agora aparece como
    `authorization_endpoint` no metadata.
  - `SUPABASE_SUPPORTED_SCOPES` — allowlist
    (`openid`, `profile`, `email`, `phone`, `offline_access`).
- **Handler novo** (linhas ~383-411): rota `GET .../oauth/authorize`
  - Faz `URLSearchParams` do query, filtra scopes fora da allowlist,
    reinjeta `openid` se ausente, loga tudo e responde `302` para
    `${OAUTH_AS_ISSUER}/oauth/authorize?...` com o resto dos parâmetros
    intocado (`client_id`, `redirect_uri`, `response_type`, `state`,
    `code_challenge`, `code_challenge_method`).
- **Metadata atualizado** (linhas ~429-454):
  `/.well-known/oauth-authorization-server` agora clona o doc do Supabase
  mas sobrescreve `authorization_endpoint` para apontar ao proxy e força
  `scopes_supported` limitado.

### Verificação ao vivo

```bash
$ curl -si "…/functions/v1/assistant-mcp/oauth/authorize?client_id=test\
&redirect_uri=https%3A%2F%2Fchatgpt.com%2Fcallback&response_type=code\
&scope=read%20openid&state=abc&code_challenge=xyz&code_challenge_method=S256"

HTTP/2 302
location: https://…/auth/v1/oauth/authorize?client_id=test
  &redirect_uri=https%3A%2F%2Fchatgpt.com%2Fcallback
  &response_type=code
  &scope=openid       ← "read" descartado
  &state=abc
  &code_challenge=xyz
  &code_challenge_method=S256
```

`state` e PKCE preservados. Scope higienizado. Fluxo agora chega ao consent
do Supabase sem `invalid_request`.

## Motivo da alteração

1. Não podemos alterar o comportamento do Authorization Server (Supabase Auth
   é serviço gerenciado).
2. Não podemos forçar o ChatGPT a re-ler o metadata de um connector já criado.
3. **Único ponto sob nosso controle capaz de resolver os dois cenários
   (connectors antigos com scope cacheado + connectors novos) é o
   `authorization_endpoint`**. Trocando-o por um proxy que descarta scopes
   inválidos (comportamento explicitamente permitido pela RFC 6749 §3.3),
   tornamos o fluxo tolerante a qualquer scope inválido — não só `read`.
4. PAT (`Bearer lmcp_...`) e todos os demais fluxos existentes continuam
   funcionando: o proxy só atua no path `GET /oauth/authorize`.

## Ação recomendada para o usuário

O connector antigo (`_q0K-fW8D-41`) já foi criado no ChatGPT com o metadata
antigo cacheado, então:

1. **Remova** o connector "Lunari" no ChatGPT (Settings → Connectors).
2. **Adicione novamente** com a mesma URL (`…/functions/v1/assistant-mcp`).
   Ele lerá o novo metadata, veja `authorization_endpoint` apontando para
   nosso proxy, e o OAuth completa até o consent do Supabase.

Mesmo se não fizer, a próxima tentativa de OAuth agora bate no proxy
(porque o ChatGPT vai ao `authorization_endpoint` cacheado — que segue
sendo `…/auth/v1/oauth/authorize` no connector antigo, mas na próxima
renovação de metadata migrará). Para funcionar imediatamente, **recriar o
connector é o caminho garantido**.

## Logs

Os parâmetros de cada tentativa OAuth agora aparecem em:
`Supabase Dashboard → Edge Functions → assistant-mcp → Logs`,
prefixados com `[oauth-authorize-proxy]`.
