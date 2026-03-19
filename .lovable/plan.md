

# Plano: Registrar Taxas de Gateway no Mercado Pago + Preparar Gallery

## Situação Atual

| Provedor | Registra `valor_liquido`? | Registra `taxa_gateway`? |
|----------|--------------------------|--------------------------|
| Asaas | Sim (via `netValue` na API) | Sim (calculado no webhook) |
| InfinitePay | Não | Não |
| Mercado Pago | Não | Não |

O trigger `ensure_transaction_on_cobranca_paid` já sabe ler `valor_liquido` da `cobrancas` e calcular taxas automaticamente. O problema é que **nenhum webhook fora o Asaas** grava esses campos na `cobrancas`.

## O que a API do Mercado Pago fornece

No GET `/v1/payments/{id}`, a resposta inclui:

```json
{
  "transaction_amount": 100.00,
  "transaction_details": {
    "net_received_amount": 95.01
  },
  "fee_details": [
    { "type": "mercadopago_fee", "amount": 4.99 }
  ]
}
```

- `transaction_details.net_received_amount` → valor líquido
- `fee_details` → array com detalhes das taxas (inclui PIX e cartão)

## Mudanças

### 1. Webhook Mercado Pago — Gravar taxas na cobrança

No `mercadopago-webhook/index.ts`, quando o pagamento é `approved`, extrair dados de taxas da resposta da API e gravá-los na `cobrancas`:

```typescript
// Após consultar payment na API do MP
const netReceived = payment.transaction_details?.net_received_amount ?? null;
const feeAmount = payment.fee_details?.reduce(
  (sum, f) => sum + (f.amount || 0), 0
) ?? 0;

// No UPDATE da cobrança
.update({
  status: newStatus,
  mp_payment_id: String(paymentId),
  data_pagamento: ...,
  valor_liquido: netReceived,       // ← NOVO
  updated_at: ...,
})
```

O trigger `ensure_transaction_on_cobranca_paid` já calcula `taxa_gateway = valor - valor_liquido` automaticamente ao criar a transação. Não precisa de mais nada.

### 2. Webhook Mercado Pago — Eliminar criação manual de transação

O webhook atual (linhas 224-297) cria transações manualmente, duplicando o trabalho do trigger. Isso é o **mesmo bug** que corrigimos no InfinitePay. Devemos:

- **Remover** todo o bloco de criação manual de transação (linhas 224-297)
- Delegar ao trigger `ensure_transaction_on_cobranca_paid` (que já lida com dedup, taxas, e `recompute_session_paid`)
- Manter apenas um log informativo

### 3. InfinitePay — Gravar taxas quando disponíveis

O InfinitePay não envia dados de taxa no webhook atual. Mas o `paid_amount` (em centavos) representa o valor bruto. Se no futuro a API passar a fornecer valor líquido, o webhook já estará preparado. Por ora, `valor_liquido` ficará NULL para InfinitePay (PIX não tem taxa nesse gateway).

### 4. Gallery — Funciona automaticamente

A Edge Function `gallery-create-payment` cria cobranças na tabela `cobrancas` com `provedor = 'mercadopago'` ou `'infinitepay'`. Os webhooks compartilhados (`mercadopago-webhook`, `infinitepay-webhook`) processam essas cobranças igualmente. Ao gravar `valor_liquido` na cobrança, o trigger cria a transação com taxas — independente de quem originou a cobrança (Gestão ou Gallery).

Não é necessário nenhuma Edge Function separada para o Gallery.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/mercadopago-webhook/index.ts` | Extrair `net_received_amount` e `fee_details`, gravar `valor_liquido` na cobrança, remover criação manual de transação |

## Fluxo Corrigido

```text
Cliente paga R$100 via Cartão no MP (taxa 4,99%):

1. MP envia webhook → mercadopago-webhook
2. Webhook consulta GET /v1/payments/{id}
   → transaction_amount: 100
   → net_received_amount: 95.01
3. Webhook atualiza cobrança:
   status='pago', valor_liquido=95.01
4. Trigger ensure_transaction_on_cobranca_paid:
   → Cria transação: valor=100, taxa_gateway=4.99
5. Trigger recompute_session_paid:
   → valor_pago += 100
6. Extrato mostra:
   + R$100,00  Entrada  Pagamento Mercado Pago
   - R$  4,99  Saída    Taxa Gateway MP
```

Para PIX (sem taxa ou taxa menor):
```text
→ net_received_amount: 100 (ou 99.01)
→ taxa_gateway = 100 - 100 = 0 (ou 0.99)
```

