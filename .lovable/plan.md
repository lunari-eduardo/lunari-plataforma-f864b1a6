

# Diagnóstico: Conflito entre Gestão e Gallery no Sistema de Cobranças

## Problema Identificado

Após análise detalhada dos logs e código, identifiquei que:

### 1. Edge Function Desatualizada no Supabase

A versão deployada da `infinitepay-create-link` está **desatualizada** em relação ao código do repositório:

| Aspecto | Código no Repositório | Versão Deployada |
|---------|----------------------|------------------|
| Autenticação | Extrai `userId` do JWT (linha 43) | Exige `userId` no body |
| Extração de URL | `ipData.checkout_url \|\| ipData.url \|\| ipData.link` (linha 170) | Só procura `checkout_url` |
| order_nsu | UUID da cobrança (`cobranca.id`) | Formato `gallery-timestamp-random` |

**Evidência nos logs:**
```
ERROR: No checkout_url in InfinitePay response: { url: "https://checkout.infinitepay.io/..." }
```
→ A API retorna `url`, mas a versão deployada só procura `checkout_url`

**Evidência no curl:**
```
{"error":"clienteId, valor e userId são obrigatórios"}
```
→ A versão deployada espera `userId` no body, código atual não

### 2. Separação de Responsabilidades

O sistema foi projetado com duas Edge Functions distintas:

| Função | Uso | Autenticação |
|--------|-----|--------------|
| `infinitepay-create-link` | Gestão (Workflow/CRM) | JWT do fotógrafo |
| `gallery-create-payment` | Gallery | Service Role (sem auth) |

**O Gallery deve usar `gallery-create-payment`, NÃO `infinitepay-create-link`**

---

## Correções Necessárias

### FASE 1: Redeploy da Edge Function do Gestão

A `infinitepay-create-link` precisa ser redeployada para usar o código atual do repositório, que já tem as correções:

**Linha 170 (já correta no repo):**
```typescript
const checkoutUrl = ipData.checkout_url || ipData.url || ipData.link;
```

### FASE 2: Verificar gallery-create-payment

A função `gallery-create-payment` já está correta no repositório (linha 206):
```typescript
checkoutUrl = ipData.checkout_url || ipData.url || ipData.link;
```

Mas nunca foi chamada (logs vazios), então precisa ser deployada também.

---

## Plano do Gallery - Análise de Impacto

### O plano do Gallery NÃO afeta o Gestão porque:

1. **Funções separadas**: Gallery usa `gallery-create-payment`, Gestão usa `infinitepay-create-link`
2. **Banco compartilhado**: Ambos salvam em `cobrancas`, mas isso é intencional para sincronização
3. **Webhooks unificados**: `infinitepay-webhook` processa pagamentos de ambas as fontes

### Correções que o Gallery precisa fazer:

1. **Corrigir `saleSettings.paymentMethod`** (não afeta Gestão)
2. **Usar `gallery-create-payment`** em vez de tentar chamar `infinitepay-create-link` diretamente

---

## Diagrama de Arquitetura Correta

```
┌─────────────────────────────────────────────────────────────────┐
│                        GESTÃO                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ChargeModal → useCobranca → infinitepay-create-link            │
│                               (requer JWT do fotógrafo)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Salva em 'cobrancas'
                              │ com session_id (texto)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BANCO DE DADOS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  • cobrancas (registro de todas as cobranças)                   │
│  • clientes_transacoes (pagamentos confirmados)                 │
│  • clientes_sessoes (valores totais via trigger)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Salva em 'cobrancas'
                              │ com session_id (texto)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        GALLERY                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ClientGallery → gallery-create-payment                         │
│                  (Service Role, sem auth do cliente)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INFINITEPAY API                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Retorna: { url: "https://checkout.infinitepay.io/..." }        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Webhook quando pago
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 infinitepay-webhook                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Atualiza cobrancas.status = 'pago'                          │
│  2. Cria clientes_transacoes                                    │
│  3. Trigger recompute_session_paid atualiza valor_pago          │
│                                                                 │
│  ✓ Funciona igual para Gestão e Gallery                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ações a Executar

### No Gestão (este projeto):

1. **Redeploy `infinitepay-create-link`** - corrigir versão desatualizada
2. **Deploy `gallery-create-payment`** - garantir que está disponível

### Instruções para o Gallery:

O Gallery deve:

1. **Usar `gallery-create-payment`** para criar cobranças:
```typescript
const { data } = await supabase.functions.invoke('gallery-create-payment', {
  body: {
    galleryId: "uuid-da-galeria",    // Ou sessionId (texto)
    clienteId: "uuid-do-cliente",
    valor: 168.00,
    descricao: "8 fotos extras - Galeria"
  }
});

if (data.success && data.checkoutUrl) {
  window.location.href = data.checkoutUrl;
}
```

2. **Corrigir mapeamento de `paymentMethod`** no `saleSettings` (problema interno do Gallery)

3. **NÃO tentar chamar `infinitepay-create-link` diretamente** - essa função requer JWT do fotógrafo

---

## Resumo de Onde Salvar Pagamentos

| Origem | Tabela | session_id | Sincronização |
|--------|--------|------------|---------------|
| Gestão (Workflow/CRM) | `cobrancas` | `"workflow-xxx"` (texto) | Automática via webhook |
| Gallery (vinculada) | `cobrancas` | `"workflow-xxx"` (texto) | Automática via webhook |
| Gallery (avulsa) | `cobrancas` | `null` | Sem vínculo com sessão |

O webhook `infinitepay-webhook` processa todos igualmente:
- Atualiza `cobrancas.status`
- Cria `clientes_transacoes` com `session_id`
- Trigger recalcula `clientes_sessoes.valor_pago`

