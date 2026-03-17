

# Asaas Fee Management — Reorganizado ✅

## Mudanças Implementadas

### 1. DB: `valor_liquido` na tabela `cobrancas`
- Coluna `valor_liquido NUMERIC` adicionada
- Trigger `ensure_transaction_on_cobranca_paid` usa `COALESCE(valor_liquido, valor)` para transações financeiras

### 2. DB: `dados_extras` JSONB na tabela `cobrancas`
- Coluna para armazenar overrides per-charge (repassarTaxasProcessamento, anteciparParcelas, repassarTaxaAntecipacao)

### 3. Settings Reorganizados (`AsaasCard.tsx`)
```text
Absorver taxas de processamento  [ON/OFF]
Irei antecipar parcelas          [ON/OFF]
  └── Repassar taxa de antecipação [ON/OFF]  (só aparece se antecipar=ON)
```

### 4. Per-Charge Overrides (`ChargeModal.tsx`)
- Toggles por cobrança: Repassar taxas, Antecipar, Repassar antecipação
- Pre-preenchidos das configurações globais
- **Overrides salvos em `cobrancas.dados_extras`** para checkout ler

### 5. Edge Functions Atualizadas
- `gestao-asaas-create-payment`: valor_liquido = null para cartão (vem via webhook)
- `checkout-process-payment`: lê overrides de `cobranca.dados_extras`, valor_liquido = null para cartão
- `checkout-get-data`: retorna overrides per-charge sobre settings globais
- `asaas-webhook`: **agora processa PAYMENT_CONFIRMED/RECEIVED para cobranças não-subscription**, atualiza status=pago + valor_liquido=netValue

### 6. Antecipação via API Asaas
- Nova edge function `gestao-asaas-anticipation` com ações `simulate` e `request`
- UI no `ChargeHistory.tsx`: botão de antecipação em cobranças pagas (link/cartão Asaas)
- Dialog com simulação mostrando valor, taxa e líquido, com botão para confirmar

### 7. Frontend Fee Calc Atualizado
- `AsaasCheckoutSection.tsx` e `PublicCheckout.tsx` usam nova lógica
- `ChargeHistory.tsx` mostra valor líquido quando diferente do bruto

## Fluxo de valor_liquido

```text
1. Fotógrafo cria cobrança (absorverTaxa=true)
   → cobrancas.valor = 100, dados_extras = {overrides...}
   → valor_liquido = NULL (desconhecido até Asaas confirmar)

2. Cliente paga via checkout
   → checkout-process-payment cria pagamento Asaas por R$100
   → Asaas retorna paymentId, status=PENDING
   → cobrancas.status = 'pendente'

3. Asaas confirma pagamento → webhook dispara
   → PAYMENT_CONFIRMED com payment.netValue = 94.56
   → Webhook atualiza: status='pago', valor_liquido=94.56
   → DB trigger cria transação com R$94.56 (líquido)

4. Fotógrafo vê R$94.56 no histórico financeiro ✓
```
