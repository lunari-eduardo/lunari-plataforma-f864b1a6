

# Reestruturação Financeira Asaas — Parcelas, Taxas e Webhooks

## Resumo

Criar tabela `cobranca_parcelas` para rastrear cada parcela individualmente, separar taxas de gateway e antecipacao, adicionar tabela `asaas_webhook_events` para idempotencia, e ajustar o trigger de transacao financeira para usar valor bruto.

---

## Etapa 1: Migration SQL

### Nova tabela `cobranca_parcelas`

```sql
CREATE TABLE public.cobranca_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobranca_id UUID NOT NULL REFERENCES cobrancas(id) ON DELETE CASCADE,
  numero_parcela INTEGER NOT NULL,
  asaas_payment_id TEXT NOT NULL,
  valor_bruto NUMERIC NOT NULL,
  taxa_gateway NUMERIC DEFAULT 0,
  taxa_antecipacao NUMERIC DEFAULT 0,
  valor_liquido NUMERIC,
  status TEXT NOT NULL DEFAULT 'pendente',  -- pendente, confirmado, recebido, antecipado, estornado, cancelado
  billing_type TEXT,
  data_vencimento DATE,
  data_pagamento TIMESTAMPTZ,
  data_credito DATE,
  antecipado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (asaas_payment_id)  -- protecao contra webhook duplicado
);

ALTER TABLE public.cobranca_parcelas ENABLE ROW LEVEL SECURITY;
```

RLS: leitura via join com cobrancas.user_id = auth.uid().

### Nova tabela `asaas_webhook_events`

```sql
CREATE TABLE public.asaas_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payment_id TEXT,
  installment_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_webhook_event_dedup ON asaas_webhook_events(event_type, payment_id);
```

### Novas colunas em `cobrancas`

```sql
ALTER TABLE cobrancas ADD COLUMN IF NOT EXISTS asaas_installment_id TEXT;
ALTER TABLE cobrancas ADD COLUMN IF NOT EXISTS total_parcelas INTEGER DEFAULT 1;
ALTER TABLE cobrancas ADD COLUMN IF NOT EXISTS parcelas_pagas INTEGER DEFAULT 0;
```

Adicionar `parcialmente_pago` como status valido (se houver check constraint, atualizar).

### Trigger de reconciliacao em `cobranca_parcelas`

Quando uma parcela muda de status, recalcular na cobranca pai:
- `parcelas_pagas` = count de parcelas com status in (confirmado, recebido, antecipado)
- `valor_liquido` = sum(valor_liquido) das parcelas pagas
- `status` = pago se todas pagas, parcialmente_pago se > 0, pendente se 0

### Ajuste no trigger `ensure_transaction_on_cobranca_paid`

Mudar para usar `NEW.valor` (bruto) em vez de `COALESCE(NEW.valor_liquido, NEW.valor)`. A transacao financeira representa o que o cliente pagou, nao o liquido do fotografo. O liquido fica visivel no historico de cobrancas.

---

## Etapa 2: Webhook (`asaas-webhook/index.ts`)

Reescrever o bloco de pagamentos nao-subscription:

### Fluxo de idempotencia

1. Salvar evento em `asaas_webhook_events` com `ON CONFLICT DO NOTHING`
2. Verificar se ja foi processado (`processed = true`) — se sim, retornar
3. Processar evento
4. Marcar como `processed = true`

### Eventos tratados

**PAYMENT_CONFIRMED**: Buscar cobranca por `asaas_installment_id = payment.installment` ou `mp_payment_id = payment.id`. Fazer upsert em `cobranca_parcelas` com status `confirmado`, valor_bruto = payment.value, taxa_gateway = value - netValue, valor_liquido = netValue.

**PAYMENT_RECEIVED**: Atualizar parcela para status `recebido`. Este evento indica saldo disponivel — e o momento correto para considerar receita real.

**PAYMENT_ANTICIPATED**: Atualizar parcela com `antecipado = true`, nova `taxa_antecipacao`, novo `valor_liquido`, nova `data_credito`.

**PAYMENT_REFUNDED / PAYMENT_CHARGEBACK_REQUESTED**: Marcar parcela como `estornado`.

**PAYMENT_DELETED**: Marcar parcela como `cancelado`.

O trigger em `cobranca_parcelas` cuida de atualizar a cobranca pai automaticamente.

### Decisao sobre receita

A cobranca sera marcada como `pago` pelo trigger quando todas as parcelas atingirem status pago (confirmado/recebido/antecipado). O trigger `ensure_transaction_on_cobranca_paid` dispara a transacao financeira automaticamente.

---

## Etapa 3: Edge Functions de criacao

### `checkout-process-payment` e `gestao-asaas-create-payment`

Quando Asaas retorna resposta com `installmentCount > 1`:
- Salvar `asaas_installment_id` na cobranca (usar `paymentData.installment` ou o campo correto da resposta)
- Salvar `total_parcelas`
- `mp_payment_id` armazena o ID do primeiro pagamento
- `valor_liquido = null` (webhook preenche)
- Status inicial = `pendente`

---

## Etapa 4: Frontend

### `src/types/cobranca.ts`

Adicionar:
```typescript
export type StatusCobranca = 'pendente' | 'parcialmente_pago' | 'pago' | 'cancelado' | 'expirado';

// Novo
totalParcelas?: number;
parcelasPagas?: number;
asaasInstallmentId?: string;
```

### `ChargeHistory.tsx`

- Badge para `parcialmente_pago` (amarela): "Parcial (2/3)"
- Exibir valores separados: bruto, taxas, liquido
- Manter botao de antecipacao para parcelas elegíveis

### `statusBadges`

Adicionar:
```typescript
parcialmente_pago: { variant: 'secondary', label: 'Parcial' }
```

---

## Etapa 5: Atualizar `plan.md`

Refletir a nova arquitetura com parcelas individuais.

---

## Arquivos Modificados

| Arquivo | Mudanca |
|---------|---------|
| Migration SQL | Criar `cobranca_parcelas`, `asaas_webhook_events`, alterar `cobrancas`, triggers |
| `supabase/functions/asaas-webhook/index.ts` | Reescrever bloco nao-subscription com parcelas individuais + idempotencia |
| `supabase/functions/checkout-process-payment/index.ts` | Salvar `asaas_installment_id`, `total_parcelas` |
| `supabase/functions/gestao-asaas-create-payment/index.ts` | Idem |
| `src/types/cobranca.ts` | Adicionar campos de parcelamento e status `parcialmente_pago` |
| `src/components/cobranca/ChargeHistory.tsx` | Exibir parcelas, status parcial, valores separados |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |
| `.lovable/plan.md` | Documentar nova arquitetura |

## Fluxo Final

```text
1. Fotografo cria cobranca R$150 em 3x
   cobrancas: valor=150, total_parcelas=3, status=pendente

2. PAYMENT_CONFIRMED (parcela 1)
   cobranca_parcelas: asaas_payment_id=pay_1, valor_bruto=50, taxa_gateway=1.40, valor_liquido=48.60, status=confirmado
   trigger → parcelas_pagas=1, status=parcialmente_pago

3. PAYMENT_CONFIRMED (parcela 2)
   trigger → parcelas_pagas=2, status=parcialmente_pago

4. PAYMENT_CONFIRMED (parcela 3)
   trigger → parcelas_pagas=3, status=pago
   ensure_transaction_on_cobranca_paid → transacao R$150 (bruto)

5. Fotografo ve:
   Cobranca: R$150 - Pago (3/3)
   Bruto: R$150 | Taxas: R$4.20 | Liquido: R$145.80
```

