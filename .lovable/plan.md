

# Plano: Restaurar Contrato Compartilhado das Edge Functions

## Problema

As Edge Functions compartilhadas (`infinitepay-create-link`, `mercadopago-create-link`) foram corrompidas com verificação de JWT (`supabase.auth.getUser(token)`). Isso quebra o fluxo do Gallery, que chama essas funções internamente usando `SUPABASE_SERVICE_ROLE_KEY` — que não é um JWT de usuário e falha na validação.

## Contrato Imutável (a ser restaurado)

```
1. NÃO adicionar verificação de JWT (auth.getUser)
2. userId DEVE ser aceito no body da request
3. verify_jwt DEVE ser false no config.toml (já está)
4. Autenticação do fotógrafo é via userId no body
```

## Mudanças

### 1. `supabase/functions/infinitepay-create-link/index.ts`

- Adicionar comentário do contrato no topo
- Remover linhas 27-43 (JWT validation)
- Aceitar `userId` no body (junto com `clienteId`, `sessionId`, `valor`, `descricao`)
- Se `userId` não vier no body, erro

### 2. `supabase/functions/mercadopago-create-link/index.ts`

- Adicionar comentário do contrato no topo
- Remover linhas 52-65 (JWT validation)
- Aceitar `userId` no body
- Passar `userId` do body para `getUserMpIntegration()` em vez de `user.id`

### 3. `supabase/functions/gestao-infinitepay-create-link/index.ts`

- Este é exclusivo do Gestão — **manter** JWT validation (está correto aqui)
- Adicionar comentário indicando que é Gestão-only

### 4. Verificar chamadas do Gestão

Garantir que o Gestão chame `gestao-infinitepay-create-link` (com JWT) e não `infinitepay-create-link` (compartilhada). Verificar `useCobranca` ou hook equivalente.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/infinitepay-create-link/index.ts` | Remover JWT, aceitar userId no body, adicionar contrato |
| `supabase/functions/mercadopago-create-link/index.ts` | Remover JWT, aceitar userId no body, adicionar contrato |

## Nota

O `config.toml` já tem `verify_jwt = false` para ambas as funções. Nenhuma mudança necessária ali.

