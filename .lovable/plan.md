
# Reestruturação Financeira Asaas — Parcelas Individuais ✅

## Arquitetura

### Tabelas

```text
cobrancas (existente, atualizada)
├── valor (bruto total da venda)
├── valor_liquido (soma dos net de parcelas pagas — trigger calcula)
├── status: pendente | parcialmente_pago | pago | cancelado | expirado
├── asaas_installment_id (ID do grupo de parcelas)
├── total_parcelas (int, default 1)
└── parcelas_pagas (int, trigger calcula)

cobranca_parcelas (NOVA)
├── cobranca_id → cobrancas.id
├── numero_parcela (1, 2, 3...)
├── asaas_payment_id (UNIQUE — proteção contra webhook duplicado)
├── valor_bruto (value do webhook)
├── taxa_gateway (value - netValue)
├── taxa_antecipacao (diferença de net em antecipação)
├── valor_liquido (netValue do webhook)
├── status: pendente | confirmado | recebido | antecipado | estornado | cancelado
├── data_vencimento, data_pagamento, data_credito
├── data_credito_real (preenchido no RECEIVED/ANTICIPATED)
├── antecipado (boolean)

asaas_webhook_events (NOVA)
├── event_type + payment_id (UNIQUE — idempotência)
├── payload JSONB
└── processed boolean
```

### Triggers

1. **`reconcile_cobranca_from_parcelas`**: Quando parcela muda status, recalcula na cobrança pai:
   - parcelas_pagas = count(status IN confirmado/recebido/antecipado)
   - valor_liquido = sum(valor_liquido) das parcelas pagas
   - status = pago se todas pagas, parcialmente_pago se > 0

2. **`ensure_transaction_on_cobranca_paid`**: Usa `NEW.valor` (bruto) para transação financeira — representa o que o cliente pagou. Resiliente a sessões deletadas (pula session_id se FK inválido).

### Webhook (`asaas-webhook`)

Eventos tratados para cobranças não-subscription:
- **PAYMENT_CONFIRMED** → upsert parcela com status `confirmado`
- **PAYMENT_RECEIVED** → upsert parcela com status `recebido`
- **PAYMENT_ANTICIPATED** → upsert parcela com `antecipado=true`, calcula `taxa_antecipacao`
- **PAYMENT_REFUNDED / CHARGEBACK** → marca parcela como `estornado`
- **PAYMENT_DELETED** → marca parcela como `cancelado`

Idempotência: `asaas_webhook_events` com dedup por (event_type, payment_id).

### Edge Functions de Criação

`gestao-asaas-create-payment` e `checkout-process-payment`:
- **NUNCA** setam `status: 'pago'` diretamente — sempre `pendente`
- Salvam `total_parcelas` e `asaas_installment_id` na cobrança
- `valor_liquido = null` — webhook preenche via parcelas
- Retornam `creditCardStatus` para feedback visual ao usuário (sem alterar estado financeiro)

### Frontend

- `StatusCobranca` inclui `parcialmente_pago`
- `ChargeHistory` mostra progresso: "Parcial (2/3)" ou "Pago (3/3)"
- `Cobranca` type inclui `totalParcelas`, `parcelasPagas`, `asaasInstallmentId`
- Modal de pagamentos exibe valor líquido e taxas quando disponível

## Correções Aplicadas (2026-03-18)

### Bug 1: Checkout curto-circuitava parcelas
**Problema**: checkout setava `status='pago'` diretamente para cartão de crédito.
**Solução**: Sempre `status='pendente'`. Webhook + triggers determinam status final.

### Bug 2: webhook_logs insert falhava silenciosamente
**Problema**: Código usava coluna `event_type` que não existe na tabela `webhook_logs`.
**Solução**: Removido `event_type` do insert, usando apenas `provedor`, `payload`, `headers`.

### Bug 3: CHECK constraint bloqueava parcialmente_pago
**Problema**: `cobrancas_status_check` não incluía `parcialmente_pago`.
**Solução**: Constraint atualizado para incluir `parcialmente_pago`.

### Bug 4: Trigger falhava com sessões deletadas
**Problema**: `ensure_transaction_on_cobranca_paid` tentava inserir transação com `session_id` de sessão deletada, violando FK.
**Solução**: Trigger agora verifica se sessão existe; se não, cria transação sem `session_id`.

## Fluxo

```text
1. Cobrança R$150 em 3x → total_parcelas=3, status=pendente

2. Checkout retorna creditCardStatus=CONFIRMED (feedback visual)
   mas cobrança permanece status=pendente no banco

3. PAYMENT_CONFIRMED (parcela 1) → webhook cria parcela
   trigger → parcelas_pagas=1, status=parcialmente_pago

4. PAYMENT_CONFIRMED (parcela 2)
   trigger → parcelas_pagas=2

5. PAYMENT_CONFIRMED (parcela 3)
   trigger → parcelas_pagas=3, status=pago
   ensure_transaction → transação R$150 (bruto)
```
