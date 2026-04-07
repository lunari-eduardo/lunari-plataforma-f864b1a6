

# Correção: Persistir flags de repasse em `dados_extras` da cobrança

## Problema

O trigger `reconcile_cobranca_from_parcelas` lê as flags `repassarTaxasProcessamento`, `anteciparParcelas` e `repassarTaxaAntecipacao` de `cobrancas.dados_extras` (linhas 38-39) para decidir se o fotógrafo absorve ou repassa taxas. Porém, a Edge Function `gestao-asaas-create-payment` calcula essas flags (linhas 219-221) mas **nunca as salva** no campo `dados_extras` da cobrança inserida (linhas 368-382).

Resultado: o trigger sempre vê `false` para ambas as flags, e registra despesa de gateway mesmo quando o cliente deveria pagar as taxas. Exatamente o bug reportado pela Gallery.

## Correção

### Arquivo: `supabase/functions/gestao-asaas-create-payment/index.ts`

Após a linha 381 (`asaas_installment_id`), adicionar `dados_extras` ao objeto `cobrancaData`:

```typescript
const cobrancaData: Record<string, unknown> = {
  // ... campos existentes ...
  asaas_installment_id: asaasInstallmentId,
  dados_extras: {
    repassarTaxasProcessamento: repassarTaxas,
    anteciparParcelas: antecipar,
    repassarTaxaAntecipacao: repassarAntecipacao,
  },
};
```

Isso garante que:
1. O trigger `reconcile_cobranca_from_parcelas` lê os flags corretos e calcula `valor_liquido` na perspectiva do fotógrafo
2. As funções `checkout-get-data` e `checkout-process-payment` (que já leem `cobranca.dados_extras`) recebem os overrides corretos
3. O extrato mostra `taxa_gateway = 0` quando o cliente paga as taxas

## Impacto

- Apenas 1 arquivo modificado
- Sem migration necessária (a coluna `dados_extras` já existe como JSONB)
- Cobranças futuras terão os flags corretos; cobranças antigas sem o campo continuam com o comportamento atual (fallback para global settings)

