

# Correção: Lógica de `valor_bruto` e taxas em parcelas com repasse de taxas

## Problema Central

Quando o fotógrafo configura **repassar taxas ao cliente**, o sistema infla o `valorFinal` (R$50 → R$53.02) para cobrir as taxas do Asaas. Porém, ao registrar as parcelas em `cobranca_parcelas`, o sistema usa o **valor inflado** como `valor_bruto`:

**Dados reais do banco (cobrança 933c304f):**
- `cobranca.valor = 50` (valor original do fotógrafo)
- `repassarTaxasProcessamento = true`, `anteciparParcelas = true`, `repassarTaxaAntecipacao = true`
- Parcela 1: `valor_bruto = 26.51` ❌ (deveria ser 25), `valor_liquido = 25.61`, `taxa_gateway = 0.90` ❌ (deveria ser 0)
- Parcela 2: idem

**Consequências visíveis na UI:**
- COBRADO mostra R$163.02 (inclui R$53.02 inflado) em vez de R$160 (soma dos valores reais)
- Taxas de R$1.80 aparecem como dedução do fotógrafo, mas **o cliente já pagou essas taxas**
- O "Pendente" fica errado porque é calculado como `Total - Cobrado(inflado)`

**Comparação com o caso correto (cobrança 1250d450, sem repasse):**
- `cobranca.valor = 50`, `repassarTaxas = false`
- Parcela 1: `valor_bruto = 25` ✅, `valor_liquido = 24.14` ✅, `taxa_gateway = 0.86` ✅

## Causa Raiz (3 pontos)

1. **`checkout-process-payment`** linha 318: `valor_bruto: valorFinal` — usa o valor inflado em vez de `cobranca.valor / totalParcelas`
2. **`check-payment-status`** linha 198/274: `valorBruto = payment.value` — usa o `value` do Asaas (inflado) em vez do valor original da cobrança
3. **`checkout-process-payment`** só cria 1 parcela para pagamentos parcelados (a 2ª parcela é criada depois pelo polling do `check-payment-status`)

## Regra Correta

```text
valor_bruto = cobranca.valor / total_parcelas  (SEMPRE o valor original do fotógrafo)
valor_liquido = netValue do Asaas              (o que realmente cai na conta)
taxa_gateway = max(0, valor_bruto - valor_liquido)

Quando repassarTaxas=true:
  - Asaas cobra R$53.02 do cliente
  - netValue ≈ R$51.22 (Asaas desconta sua fee de R$53.02)
  - valor_bruto = R$25 (original por parcela)
  - valor_liquido = R$25.61 (> bruto, pois cliente pagou a mais)
  - taxa_gateway = 0 (fotógrafo não paga nada)

Quando repassarTaxas=false:
  - Asaas cobra R$50 do cliente
  - netValue ≈ R$48.28
  - valor_bruto = R$25
  - valor_liquido = R$24.14
  - taxa_gateway = R$0.86
```

## Plano de Correção

### 1. `checkout-process-payment` — Corrigir criação de parcelas

- Usar `valor / totalParcelas` como `valor_bruto` em vez de `valorFinal`
- Para pagamentos parcelados CONFIRMED: buscar TODOS os payments do installment (`GET /payments?installment=X`) e criar uma parcela para cada um, em vez de criar apenas 1
- `taxa_gateway = Math.max(0, valorBrutoParcela - netValueParcela)`

### 2. `check-payment-status` — Corrigir `valorBruto` no upsert

- Em `handleAsaasInstallmentCheck` (linha 198): usar `cobranca.valor / cobranca.total_parcelas` em vez de `payment.value`
- Em `handleAsaasSinglePaymentCheck` (linha 274): usar `cobranca.valor` em vez de `payment.value`
- Mesma lógica de `taxa_gateway = Math.max(0, ...)`

### 3. Correção retroativa dos dados existentes

- Atualizar as 2 parcelas da cobrança `933c304f` para `valor_bruto = 25`, `taxa_gateway = 0`
- Atualizar `cobranca.valor_liquido` para refletir os valores corretos (trigger `reconcile_cobranca_from_parcelas` fará isso automaticamente)

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/checkout-process-payment/index.ts` | Usar `valor/totalParcelas` como valor_bruto; buscar todos installments para criar parcelas |
| `supabase/functions/check-payment-status/index.ts` | Usar `cobranca.valor/total_parcelas` como valor_bruto nos upserts |
| Correção de dados (SQL direto) | Fix parcelas da cobrança 933c304f |

## Impacto

- COBRADO no modal reflete o valor original (R$50), não o inflado (R$53.02)
- Taxas = R$0 quando cliente paga as taxas (repassar ativo)
- Pendente calculado corretamente
- Parcelas criadas corretamente para todas as installments de uma vez

