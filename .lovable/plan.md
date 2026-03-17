

# Asaas Fee Management — Reorganizado ✅

## Mudanças Implementadas

### 1. DB: `valor_liquido` na tabela `cobrancas`
- Coluna `valor_liquido NUMERIC` adicionada
- Trigger `ensure_transaction_on_cobranca_paid` usa `COALESCE(valor_liquido, valor)` para transações financeiras

### 2. Settings Reorganizados (`AsaasCard.tsx`)
```text
Absorver taxas de processamento  [ON/OFF]
Irei antecipar parcelas          [ON/OFF]
  └── Repassar taxa de antecipação [ON/OFF]  (só aparece se antecipar=ON)
```
- Novos campos: `ireiAntecipar`, `repassarTaxaAntecipacao`
- Backward compat: lê `incluirTaxaAntecipacao` como fallback

### 3. Per-Charge Overrides (`ChargeModal.tsx`)
- Toggles por cobrança: Repassar taxas, Antecipar, Repassar antecipação
- Pre-preenchidos das configurações globais

### 4. Edge Functions Atualizadas
- `gestao-asaas-create-payment`: aceita overrides, salva `valor_liquido`
- `checkout-process-payment`: salva `valor_liquido` do Asaas `netValue`
- `checkout-get-data`: retorna `ireiAntecipar` e `repassarTaxaAntecipacao`

### 5. Frontend Fee Calc Atualizado
- `AsaasCheckoutSection.tsx` e `PublicCheckout.tsx` usam nova lógica
