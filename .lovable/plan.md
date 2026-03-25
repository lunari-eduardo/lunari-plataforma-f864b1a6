

# Fix: Duplicate InfinitePay Transactions (Feb Sessions)

## Root Cause

The migration run on 2026-03-24 (to fix orphaned cobrancas) inserted `[auto-reconciled]` transactions for ALL paid cobrancas missing a matching transaction. However, it detected matches by searching `descricao ILIKE '%cobranca <UUID>%'`. Two sessions already had `[retroativo]` transactions (from an earlier manual fix) with a different description format (`Pagamento InfinitePay (Link) - ...`), so the duplicate check missed them.

**Affected sessions (exactly 2):**

| Session | Duplicate TX ID | Valor | Should delete |
|---------|----------------|-------|---------------|
| Maju-Vicente (`workflow-1770819329231-lt1vtcjy9n`) | `052cd661-bad8-45e1-962c-9d1c50503fe4` | R$25 | Yes |
| Lisiane-Otávio (`workflow-1771610846081-03ol8fqdrkbm`) | `138eecdb-fdee-4263-9fcd-844bc83f5ef5` | R$115 | Yes |

After deletion, `recompute_session_paid` trigger will recalculate `valor_pago` automatically.

## Fix Plan

### 1. Data repair: Delete 2 duplicate transactions

Delete the two `[auto-reconciled]` duplicate transactions by ID. The trigger on `clientes_transacoes` will automatically recompute `valor_pago` for both sessions.

```sql
DELETE FROM clientes_transacoes 
WHERE id IN (
  '052cd661-bad8-45e1-962c-9d1c50503fe4',
  '138eecdb-fdee-4263-9fcd-844bc83f5ef5'
);
```

**Result:**
- Maju-Vicente: valor_pago drops from R$180 → R$155 (= valor_total, credit R$0)
- Lisiane-Otávio: valor_pago drops from R$360 → R$245 (= valor_total, credit R$0)

### 2. Prevention: Improve duplicate detection in trigger

The current trigger only checks `descricao ILIKE '%cobranca <UUID>%'`. This misses `[retroativo]` transactions. Add a secondary check: also look for an existing transaction with the **same session_id, same valor, same provider** to catch duplicates regardless of description format.

Update `ensure_transaction_on_cobranca_paid` function to add a broader duplicate check:

```sql
-- After existing check by cobranca ID in descricao, add:
IF v_existing_tx IS NULL AND v_session_text IS NOT NULL THEN
  SELECT id INTO v_existing_tx
  FROM public.clientes_transacoes
  WHERE session_id = v_session_text
    AND tipo = 'pagamento'
    AND valor = v_valor_transacao
    AND descricao ILIKE '%' || v_provedor_label || '%'
  LIMIT 1;
END IF;
```

This ensures that even if a transaction was manually created with a different description format, the trigger won't create a duplicate for the same session + amount + provider.

## Files

| Action | Target |
|--------|--------|
| Data fix (insert tool) | Delete 2 duplicate transactions |
| Migration | Update `ensure_transaction_on_cobranca_paid` with broader duplicate check |

