

# Revisão Completa: Sistema de Pagamentos Asaas — Debug e Validação

## Diagnóstico Atual (dados reais do banco)

Após auditoria completa, o estado atual do banco está **parcialmente correto**:

### O que JÁ funciona ✅
- **Parcelas (`cobranca_parcelas`)**: `valor_bruto` correto (nominal/parcelas), `taxa_gateway = 0` quando repasse ativo
- **Trigger `ensure_transaction_on_cobranca_paid`**: já respeita flags de repasse e zera taxas corretamente
- **`clientes_transacoes`** recentes: `valor=50, valor_liquido=50, taxa_gateway=0` para repasse ✅
- **Edge Functions**: `checkout-process-payment`, `check-payment-status`, `asaas-webhook` usam `cobranca.valor / total_parcelas` como base

### O que está QUEBRADO ❌

**1. `cobranca.valor_liquido` armazena o netValue do gateway, não a perspectiva do fotógrafo**

O trigger `reconcile_cobranca_from_parcelas` faz `SUM(parcelas.valor_liquido)`. Para repasse:
- Parcelas: `valor_liquido = 25.61` (netValue do Asaas, > valor_bruto pois cliente pagou a mais)
- Cobrança: `valor_liquido = 51.22` (soma) para um `valor = 50`

Resultado: `ChargeHistory` exibe "Líquido: R$ 51,22" — enganoso e incorreto do ponto de vista do fotógrafo.

**2. `useSessionPayments` calcula `taxaTotal` inline como `valor - valorLiquido`**

Linha 361: `const taxaTotal = valorLiq != null ? Math.round((valorBruto - valorLiq) * 100) / 100 : undefined;`

Para repasse: `50 - 51.22 = -1.22` → mostra valor negativo ou confuso.

**3. `SessionPaymentsManager` mostra "Líquido" quando `valorLiquido !== valor`**

Linha 358: quando `valorLiquido > valor` (repasse), aparece "Líquido: R$51,22" — o fotógrafo não deveria ver isso.

**4. `ChargeHistory` exibe "Líquido" sem filtrar por flags de repasse**

Linha 127: `cobranca.valorLiquido != null && cobranca.valorLiquido !== cobranca.valor` — sempre mostra para Asaas com parcelas.

**5. `totalRecebido` usa `valorLiquido` do gateway, não do fotógrafo**

`useSessionPayments` linha 487-488: `p.valorLiquido` vem do gateway netValue. Para repasse, isso é > valor, inflando "Recebido".

## Regra Financeira Definitiva

```text
FOTÓGRAFO vê:
  valor_cobrado = cobranca.valor (sempre o valor nominal)
  
  se repassarTaxasProcessamento = true:
    taxa_gateway_fotografo = 0
  senão:
    taxa_gateway_fotografo = SUM(parcelas.taxa_gateway)

  se repassarTaxaAntecipacao = true:
    taxa_antecipacao_fotografo = 0
  senão:
    taxa_antecipacao_fotografo = SUM(parcelas.taxa_antecipacao)

  valor_liquido_fotografo = valor_cobrado - taxa_gateway_fotografo - taxa_antecipacao_fotografo
  
  Se tudo repassado: Cobrado=50, Recebido=50, Taxas=0
  Se tudo absorvido: Cobrado=50, Recebido=48.28, Taxas=1.72
```

## Plano de Correção

### 1. Trigger `reconcile_cobranca_from_parcelas` — Calcular `valor_liquido` na perspectiva do fotógrafo

Atualmente soma raw gateway netValue. Deve:
- Ler `dados_extras` da cobrança (flags de repasse)
- Se `repassarTaxasProcessamento = true`: `valor_liquido = cobranca.valor` (ignora gateway netValue)
- Se `repassarTaxasProcessamento = false`: `valor_liquido = SUM(parcelas.valor_liquido)` (mantém lógica atual)
- Tratar antecipação da mesma forma

Isso faz `cobranca.valor_liquido` representar sempre a perspectiva do fotógrafo, não do gateway.

### 2. `useSessionPayments` — Ajustar cálculos de líquido e taxas para repasse

Ao construir entries de pagamentos a partir de `cobranca_parcelas`:
- Buscar `dados_extras` da cobrança pai (já disponível via join)
- Se `repassarTaxasProcessamento = true`:
  - `valorLiquido` = `valor_bruto` (fotógrafo recebe integral)
  - `taxaTotal` = 0
- Se false: manter cálculo atual

Para cobranças sem parcelas (avulsas):
- Mesma regra usando `cobranca.dados_extras`

### 3. `SessionPaymentsManager` — Ocultar "Líquido" quando fotógrafo não tem desconto

Linha 358: só mostrar "Líquido" quando `valorLiquido < valor` (fotógrafo absorveu taxa). Nunca quando `valorLiquido >= valor`.

### 4. `ChargeHistory` — Ocultar "Líquido" quando repasse ativo

- Mapear `dados_extras` no fetch de cobranças (`useCobranca.ts`)
- Adicionar campo `dadosExtras` ao tipo `Cobranca`
- No ChargeHistory: ocultar linha "Líquido" quando `repassarTaxasProcessamento = true` OU quando `valorLiquido >= valor`

### 5. `useSessionPayments` totais — Usar perspectiva do fotógrafo

- `totalRecebido`: somar `valorLiquido` já ajustado (após item 2)
- `totalTaxas`: somar taxas efetivas (0 quando repassado)

### 6. Webhooks/Edge Functions — Validar que não duplicam parcelas

Auditado: OK ✅ — `asaas-webhook` usa `upsert` com `onConflict: 'asaas_payment_id'`. Não cria duplicatas.

### 7. Backfill — Recalcular `cobranca.valor_liquido` para cobranças com repasse

Atualizar `cobranca.valor_liquido` para cobranças Asaas pagas onde repasse estava ativo, definindo `valor_liquido = valor`.

### 8. Snapshot de configuração — Garantir que dados_extras contenha flags

Auditado: OK ✅ — `ChargeModal.handleAsaasGenerateLink()` já grava `repassarTaxasProcessamento`, `anteciparParcelas`, `repassarTaxaAntecipacao` em `dados_extras` no momento da criação.

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Reescrever `reconcile_cobranca_from_parcelas` para respeitar flags de repasse; backfill `cobranca.valor_liquido` |
| `src/hooks/useSessionPayments.ts` | Buscar `dados_extras` das cobranças; ajustar `valorLiquido` e `taxaTotal` por parcela para repasse |
| `src/components/payments/SessionPaymentsManager.tsx` | Ocultar "Líquido" quando `valorLiquido >= valor` |
| `src/types/cobranca.ts` | Adicionar `dadosExtras?: Record<string, any>` |
| `src/hooks/useCobranca.ts` | Mapear `dados_extras` → `dadosExtras` |
| `src/components/cobranca/ChargeHistory.tsx` | Ocultar "Líquido" quando repasse ativo ou `valorLiquido >= valor` |

## O que NÃO será alterado (já está correto)

- `checkout-process-payment`: ordem de gravação (cobrança pai antes de parcelas) ✅
- `check-payment-status`: usa `cobranca.valor / total_parcelas` como `valor_bruto` ✅
- `asaas-webhook`: `upsertParcela` com `cobranca.valor` nominal ✅
- `ensure_transaction_on_cobranca_paid`: respeita flags de repasse ✅
- `gestao-asaas-create-payment`: snapshot de overrides ✅

## Resultado Esperado

Para cobranças com repasse ao cliente:
- **Cobrado**: R$ 50,00
- **Recebido**: R$ 50,00
- **Taxas**: R$ 0,00
- **Líquido**: NÃO exibido (pois = cobrado)

Para cobranças sem repasse:
- **Cobrado**: R$ 50,00
- **Recebido**: R$ 48,28
- **Taxas**: R$ 1,72
- **Líquido**: R$ 48,28

