

# Plano de Correção: Separação de Cobranças entre Gestão e Gallery

## Diagnóstico do Problema

### Causa Raiz Identificada

O projeto **Gallery** sobrescreveu a Edge Function `infinitepay-create-link` com uma versão diferente que:

**Versão Gallery (incorreta para Gestão):**
```typescript
// Esperava userId no body da requisição
if (!clienteId || !valor || !userId) {
  throw new Error("clienteId, valor e userId são obrigatórios");
}
```

**Versão Gestão (correta):**
```typescript
// Extrai userId automaticamente do JWT
const userId = user.id; // Linha 43
```

Quando o Gallery fez deploy, **sobrescreveu** a função do Gestão causando erro 400 ao tentar gerar links de pagamento no Workflow.

### Solução Imediata ✅ APLICADA

Re-deployei a Edge Function `infinitepay-create-link` com a versão correta do Gestão. O teste agora retorna "Não autorizado" (esperado sem JWT) em vez de "userId obrigatório".

---

## Arquitetura Atual (Conflituosa)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  GESTÃO e GALLERY usam as MESMAS Edge Functions no MESMO Supabase           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  infinitepay-create-link    ← Gestão usa (c/ JWT)                           │
│                             ← Gallery também quer usar (sem JWT)            │
│                                                                             │
│  infinitepay-webhook        ← Usado por ambos (mesmo webhook URL)           │
│                                                                             │
│  gallery-create-payment     ← Wrapper criado para Gallery (correto)         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
         PROBLEMA: Gallery modificou infinitepay-create-link
         para funcionar sem JWT, quebrando o Gestão
```

---

## Solução Proposta: Separação de Responsabilidades

### Princípio: "Cada projeto tem seu ponto de entrada"

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GESTÃO (Fotógrafo logado)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ChargeModal → useCobranca → infinitepay-create-link                        │
│                                                                             │
│  • Usa JWT do fotógrafo (Authorization header)                              │
│  • Extrai userId automaticamente do token                                   │
│  • Payload: { clienteId, sessionId, valor, descricao }                      │
│  • NÃO PODE ser alterado pelo Gallery                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           GALLERY (Cliente final)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SelectionConfirmation → gallery-create-payment                             │
│                                                                             │
│  • SEM JWT (cliente não é usuário autenticado)                              │
│  • Busca userId via galleryId ou sessionId                                  │
│  • Usa Service Role internamente                                            │
│  • Payload: { galleryId, sessionId, clienteId, valor, descricao }           │
│  • Esta função JÁ EXISTE e deve ser usada pelo Gallery                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Ações Necessárias

### 1. Proteger as Edge Functions do Gestão (JÁ FEITO ✅)

A versão correta de `infinitepay-create-link` foi redeployada com:
- Autenticação via JWT obrigatória
- Extração de userId do token
- Sem necessidade de userId no body

### 2. Orientação para o Projeto Gallery

O Gallery **NÃO DEVE** modificar:
- `infinitepay-create-link` - exclusivo do Gestão
- `mercadopago-create-link` - exclusivo do Gestão
- `mercadopago-create-pix` - exclusivo do Gestão

O Gallery **DEVE** usar:
- `gallery-create-payment` - wrapper que já existe e funciona sem JWT

### 3. Adicionar Coluna `origem` para Rastreabilidade (Opcional)

Para melhor auditoria, podemos adicionar identificação da origem:

```sql
ALTER TABLE cobrancas ADD COLUMN origem TEXT DEFAULT 'gestao';
-- Valores: 'gestao' | 'gallery'
```

E atualizar as funções:
- `infinitepay-create-link` → insere com `origem: 'gestao'`
- `gallery-create-payment` → insere com `origem: 'gallery'`

### 4. Prefixar order_nsu por Projeto (Opcional)

Para facilitar debugging:
- Gestão: usa UUID da cobrança como `order_nsu` (atual)
- Gallery: usa formato `gallery-{timestamp}-{random}` (já implementado)

---

## Documentação de Responsabilidades

### Edge Functions do GESTÃO (não modificar pelo Gallery)

| Função | Propósito | Autenticação |
|--------|-----------|--------------|
| `infinitepay-create-link` | Criar link de pagamento (fotógrafo) | JWT obrigatório |
| `mercadopago-create-link` | Criar link Mercado Pago (fotógrafo) | JWT obrigatório |
| `mercadopago-create-pix` | Criar Pix Mercado Pago (fotógrafo) | JWT obrigatório |

### Edge Functions COMPARTILHADAS

| Função | Propósito | Autenticação |
|--------|-----------|--------------|
| `gallery-create-payment` | Wrapper para Gallery criar cobranças | Service Role (interno) |
| `infinitepay-webhook` | Receber confirmação de pagamento | Nenhuma (webhook público) |
| `mercadopago-webhook` | Receber confirmação de pagamento | Nenhuma (webhook público) |
| `gallery-update-session-photos` | Atualizar fotos extras da sessão | Service Role (interno) |

### Tabelas Compartilhadas

| Tabela | Escrita | Leitura |
|--------|---------|---------|
| `cobrancas` | Gestão + Gallery | Gestão + Gallery |
| `clientes_sessoes` | Gestão + Gallery (via edge functions) | Gestão + Gallery |
| `clientes_transacoes` | Gestão + Webhooks | Gestão |
| `usuarios_integracoes` | Gestão | Gestão + Gallery (via edge functions) |

---

## Resumo do Que Foi Corrigido

| Ação | Status |
|------|--------|
| Identificar que Gallery sobrescreveu a Edge Function | ✅ Feito |
| Re-deployar `infinitepay-create-link` com versão do Gestão | ✅ Feito |
| Verificar que o erro mudou de "userId obrigatório" para "Não autorizado" | ✅ Confirmado |
| Documentar separação de responsabilidades | ✅ Este plano |

---

## Próximos Passos (Ações no Gallery)

1. **Comunicar ao projeto Gallery** que ele deve usar APENAS `gallery-create-payment`
2. O Gallery **NÃO deve** fazer deploy de funções que existem no Gestão
3. Se o Gallery precisar de funcionalidade adicional, criar funções novas com prefixo `gallery-*`

---

## Teste para Confirmar Correção

Faça o seguinte no Gestão:
1. Acesse o Workflow
2. Selecione um cliente (ex: Eduardo Diehl)
3. Clique em "Cobrar" → Selecione "Link"
4. Clique em "Gerar Link"
5. Deve gerar o link normalmente sem erro 400

Se continuar com erro, pode ser cache do navegador - tente hard refresh (Ctrl+Shift+R).

