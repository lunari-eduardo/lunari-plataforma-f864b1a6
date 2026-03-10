

# Fix: Eliminação de Duplicação de Pagamentos

## Causa Raiz Identificada

Existem **3 pontos independentes** que criam transações em `clientes_transacoes` para o mesmo pagamento:

1. **Edge Function `checkout-process-payment`** (linha 303): Insere transação manualmente quando cartão é confirmado
2. **Database trigger `ensure_transaction_on_cobranca_paid`**: Dispara quando `cobrancas.status` muda para `'pago'` — cria outra transação automaticamente
3. **Edge Function `check-payment-status`** (polling PIX): Também cria transação ao detectar pagamento confirmado

O mesmo problema existe em `gestao-asaas-create-payment` (linha 392).

### Sequência que causou a duplicação

```text
checkout-process-payment:
  1. UPDATE cobrancas SET status='pago'  →  trigger dispara  →  cria transação #1
  2. INSERT INTO clientes_transacoes     →  cria transação #2 (Edge Function)
  
check-payment-status (polling PIX):
  3. Detecta status 'pago'              →  cria transação #3
```

A verificação de dedup do trigger compara `created_at >= NEW.created_at - INTERVAL '1 hour'` (usando `created_at` da cobrança, não `NOW()`), falhando em detectar transações criadas na mesma operação.

## Solução: Fonte Única de Criação de Transações

**Princípio**: O trigger `ensure_transaction_on_cobranca_paid` é a ÚNICA fonte autorizada a criar transações quando uma cobrança é paga. Nenhuma Edge Function deve criar transações manualmente.

### Correções

| Arquivo | Ação |
|---------|------|
| `supabase/functions/checkout-process-payment/index.ts` | Remover INSERT em `clientes_transacoes` (linhas 295-313) |
| `supabase/functions/gestao-asaas-create-payment/index.ts` | Remover INSERT em `clientes_transacoes` (linhas 383-403) |
| `supabase/functions/check-payment-status/index.ts` | Remover INSERT em `clientes_transacoes` (polling) |
| Migration SQL | Melhorar dedup do trigger usando `NOW()` em vez de `NEW.created_at` |

### Melhoria do Trigger (Migration)

Alterar a verificação de dedup para usar `NOW()` e uma janela mais ampla:

```sql
SELECT id INTO v_existing_tx
FROM public.clientes_transacoes
WHERE session_id = v_session_text
  AND tipo = 'pagamento'
  AND valor = NEW.valor
  AND created_at >= NOW() - INTERVAL '24 hours'
LIMIT 1;
```

Isso garante que mesmo se o trigger disparar múltiplas vezes (updates sequenciais na cobrança), não cria duplicatas.

### Resultado

```text
Pagamento confirmado:
  Edge Function → UPDATE cobrancas SET status='pago'
    → Trigger (única fonte) → Verifica dedup → Cria 1 transação
    → Recalcula valor_pago via trigger_recompute_session_paid
```

