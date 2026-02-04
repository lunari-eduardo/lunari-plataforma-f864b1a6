
# Plano: Re-deploy da Edge Function mercadopago-create-link

## Confirmação de Isolamento

A arquitetura de pagamentos JÁ está completamente isolada entre os projetos:

| Projeto | Edge Function | Autenticação | Uso |
|---------|--------------|--------------|-----|
| **Gestão** | `mercadopago-create-link` | JWT do usuário | Apenas Gestão |
| **Gestão** | `gestao-infinitepay-create-link` | JWT do usuário | Apenas Gestão |
| **Gallery** | `gallery-create-payment` | Service Role | Apenas Gallery |

O Gallery **nunca chama** `mercadopago-create-link`. Ele tem sua própria função que:
1. Recebe `galleryId` ou `sessionId`
2. Busca o fotógrafo no banco
3. Busca o provedor ativo do fotógrafo
4. Chama diretamente as APIs do Mercado Pago ou InfinitePay

Isso significa que qualquer mudança em `mercadopago-create-link` **não afeta o Gallery**.

---

## Diagnóstico do Erro

Os logs mostram que a versão deployada da `mercadopago-create-link` está desatualizada. A versão no repositório já está correta e usa autenticação via JWT:

```typescript
// Código atual no repositório (CORRETO)
const token = authHeader.replace('Bearer ', '');
const { data: { user } } = await supabase.auth.getUser(token);
// user.id é usado automaticamente
```

Mas a versão deployada ainda espera `photographer_id` ou `userId` no body (versão antiga).

---

## Solução

Fazer o **re-deploy** da Edge Function `mercadopago-create-link` para sincronizar o código atual do repositório com o ambiente de produção.

### Ação Necessária

Executar o deploy da função `mercadopago-create-link` para atualizar a versão no Supabase.

### Verificação Pós-Deploy

Após o deploy, ao gerar um link Mercado Pago:

**Logs esperados (versão nova):**
```
[mercadopago-create-link] User authenticated: db0ca3d8-xxxx
[mercadopago-create-link] Raw body: {"clienteId":"xxx",...}
```

**Logs da versão antiga (problema atual):**
```
Nenhum ID de fotógrafo fornecido (photographer_id ou userId)
```

---

## Impacto

| Componente | Status | Impacto |
|------------|--------|---------|
| Gestão - ChargeModal | ✅ OK | Código correto, aguardando deploy |
| Gestão - useCobranca | ✅ OK | Envia dados corretos |
| Edge Function (repo) | ✅ OK | Código atualizado |
| Edge Function (deploy) | ❌ Desatualizada | Precisa re-deploy |
| Gallery | ✅ Não afetado | Usa função separada |

---

## Resumo

Não é necessário modificar nenhum arquivo de código. A correção consiste apenas em **fazer o deploy da Edge Function `mercadopago-create-link`** para aplicar a versão atual do repositório no Supabase.
