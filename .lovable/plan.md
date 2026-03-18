

# Diagnóstico Completo: Taxas Não Registradas na Cobrança de R$50

## Evidências do Banco de Dados

### Dados encontrados:
- **Cobrança R$50** (8ba54358): `status=pago`, `valor_liquido=null`, `parcelas_pagas=0`
- **Tabela `cobranca_parcelas`**: VAZIA — nenhuma parcela foi criada
- **Transação financeira**: Registrou R$50,00 (bruto) — sem informação de taxas
- **Webhook events**: Os eventos existem com `processed=false`, mas são da cobrança R$100 anterior. Para a cobrança R$50, os logs mostram "Cobrança already paid, skipping"

### Dados do Asaas (do webhook payload):
```
Parcela 1: value=25, netValue=24.14 → taxa=0.86
Parcela 2: value=25, netValue=24.14 → taxa=0.86
Total: bruto=50, líquido=48.28, taxa_total=1.72
```

O Asaas sandbox **fornece** as taxas corretamente. O problema é que o sistema não as registra.

## Causa Raiz

O problema está no `checkout-process-payment/index.ts`, **linha 301**:

```typescript
status: isConfirmed ? 'pago' : 'pendente',
```

Para cartão de crédito, o Asaas retorna `status: CONFIRMED` imediatamente. O checkout marca a cobrança como `pago` diretamente, o que:

1. Dispara o trigger `ensure_transaction_on_cobranca_paid` → cria transação de R$50 (bruto)
2. Quando o webhook chega depois, encontra a cobrança já `pago` e pula ("already paid, skipping")
3. Nenhuma parcela é criada em `cobranca_parcelas`
4. `valor_liquido` fica `null` — taxas nunca são registradas

**Resumo: O checkout curto-circuita todo o sistema de parcelas.**

## Correções

### 1. `checkout-process-payment/index.ts` — Nunca setar `pago` diretamente

```typescript
// ANTES (linha 301):
status: isConfirmed ? 'pago' : 'pendente',

// DEPOIS:
status: 'pendente', // Webhook + parcelas determinam o status final
```

Remover também a linha 309 (`data_pagamento`). O fluxo correto é:
- Checkout cria cobrança com `status=pendente`
- Webhook recebe PAYMENT_CONFIRMED → cria parcela
- Trigger `reconcile_cobranca_from_parcelas` → atualiza status para `pago`
- Trigger `ensure_transaction_on_cobranca_paid` → cria transação com valor bruto

### 2. `asaas-webhook/index.ts` — Redeployar

Os logs mostram que a versão deployada ainda tem código antigo ("Looking for gallery cobrança"). O código-fonte já está correto, mas precisa ser reimplantado.

Também corrigir: quando `findCobranca` encontra uma cobrança com `status=pago`, **não deve pular** — deve criar a parcela mesmo assim (para registrar taxas). Remover qualquer short-circuit de "already paid".

### 3. `gestao-asaas-create-payment` — Mesmo fix

Verificar se também seta `status: 'pago'` diretamente e aplicar a mesma correção.

### 4. Corrigir dados existentes

Para as cobranças já marcadas como `pago` sem parcelas:
- Usar os payloads salvos em `asaas_webhook_events` e `webhook_logs` para criar as parcelas retroativamente
- Recalcular `valor_liquido` nas cobranças afetadas

## Impacto Financeiro

| | Sistema atual | Correto |
|---|---|---|
| Cobrança R$50 | Recebido: R$50,00 | Recebido: R$48,28 |
| Taxa gateway | Não informada | R$1,72 |
| Risco fiscal | **SIM** — receita inflada | Não |

O fotógrafo está vendo que recebeu R$50, mas na realidade recebeu R$48,28. Isso causa:
- Extrato financeiro incorreto
- Diferença de R$1,72 sem explicação
- Risco fiscal ao declarar receita maior que a real

## Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/checkout-process-payment/index.ts` | Nunca setar status='pago'; sempre 'pendente' |
| `supabase/functions/gestao-asaas-create-payment/index.ts` | Mesmo fix |
| `supabase/functions/asaas-webhook/index.ts` | Remover skip de "already paid"; redeployar |
| SQL (dados) | Criar parcelas retroativas para cobranças existentes |

