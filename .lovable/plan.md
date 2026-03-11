

# Fix: Origem "Link MP" para Asaas + Dedup Agressiva Bloqueando Pagamentos

## Problemas Identificados

### 1. Trigger de dedup muito agressiva
A dedup no trigger `ensure_transaction_on_cobranca_paid` compara apenas `session_id + tipo + valor + 24h`. Quando já existe um pagamento manual de R$100, a cobrança Asaas de R$100 é ignorada pelo trigger porque encontra a transação manual com mesmo valor. Prova no banco: a cobrança `f16d3155` (Asaas, R$100, status=pago) **não gerou transação** porque o pagamento rápido manual de R$100 (criado 1 min antes) satisfez a dedup.

### 2. Origem exibida como "Link MP" em vez de "Link Asaas"
Em `useSessionPayments.ts` (linha 236), a detecção de origem só reconhece `mercadopago` e `infinitepay`. Transações Asaas (com descrição "Pagamento Asaas - cobranca...") caem no fallback `supabase` → exibido como "Manual". Quando vem da tabela `cobrancas` como pagamento pago, o `paymentId` usa prefixo `mp-` (linha 253) porque não há branch para Asaas → classificado como `mercadopago` → exibido "Link MP".

### 3. valor_pago não atualizado
Consequência direta do problema 1: como o trigger não criou a transação, o `recompute_session_paid` nunca recalculou. O valor ficou R$100 (só o manual) em vez de R$200 (manual + Asaas).

## Solução

### Migration SQL — Melhorar dedup do trigger
Adicionar `cobranca_id` na verificação de dedup. Em vez de comparar apenas por valor, verificar se já existe transação com referência à mesma cobrança (via `descricao ILIKE '%cobranca <id>%'`). Assim, pagamentos manuais e de gateway coexistem sem conflito.

```sql
-- Substituir a verificação atual:
SELECT id INTO v_existing_tx
FROM public.clientes_transacoes
WHERE session_id = v_session_text
  AND tipo = 'pagamento'
  AND valor = NEW.valor
  AND created_at >= NOW() - INTERVAL '24 hours'
LIMIT 1;

-- Por verificação que inclui referência à cobrança:
SELECT id INTO v_existing_tx
FROM public.clientes_transacoes
WHERE session_id = v_session_text
  AND tipo = 'pagamento'
  AND descricao ILIKE '%cobranca ' || NEW.id::text || '%'
LIMIT 1;
```

Isso é mais preciso: verifica se já existe transação **para esta cobrança específica**, não qualquer transação com o mesmo valor.

### `src/hooks/useSessionPayments.ts`
- Adicionar detecção de Asaas na lógica de origem (linhas 217-236): checar `t.descricao` por `'asaas'`
- Na seção de cobranças pagas (linhas 249-253): adicionar branch para `provedor === 'asaas'` com prefixo `asaas-` no paymentId em vez de `mp-`

### `src/components/payments/SessionPaymentsManager.tsx`
- Em `getOriginLabel`: adicionar detecção de Asaas (origem `'asaas'` ou observações com "asaas")
- Em `getOriginIcon`: adicionar ícone para Asaas (usar `Link2` ou `CreditCard`)

### Fix de dados — Reprocessar cobrança perdida
Executar query para reprocessar a cobrança `f16d3155` que ficou sem transação:
```sql
-- Forçar recriação resetando e re-marcando como pago
UPDATE cobrancas SET status = 'pendente' WHERE id = 'f16d3155-0573-42fe-8b9e-7e5727b530af';
UPDATE cobrancas SET status = 'pago', data_pagamento = '2026-03-11T05:29:17.537Z' WHERE id = 'f16d3155-0573-42fe-8b9e-7e5727b530af';
```

## Arquivos alterados
- Migration SQL (trigger `ensure_transaction_on_cobranca_paid`)
- `src/hooks/useSessionPayments.ts` (detecção de origem Asaas)
- `src/components/payments/SessionPaymentsManager.tsx` (labels e ícones Asaas)

