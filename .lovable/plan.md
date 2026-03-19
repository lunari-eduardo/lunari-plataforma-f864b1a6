

# Investigação: Bug de valor_pago = 230 (deveria ser 245 ou 115)

## Causa Raiz Encontrada: Dupla Criação de Transação no InfinitePay Webhook

O webhook do InfinitePay cria transações **DUAS VEZES** para cada pagamento:

1. **Linha 270-280**: Webhook atualiza `cobrancas.status = 'pago'` → dispara trigger `ensure_transaction_on_cobranca_paid` → cria transação com descrição `Pagamento InfinitePay - cobranca <UUID> ... [auto-reconciled]`

2. **Linha 339-349**: Webhook cria **OUTRA** transação com descrição `Pagamento InfinitePay (Pix) - 5 fotos extras...` (formato diferente, SEM o ID da cobrança)

O trigger de dedup verifica `descricao ILIKE '%cobranca <id>%'`, mas a transação criada pelo webhook (passo 2) usa um formato diferente. Resultado: duas transações de R$115 → `recompute_session_paid` soma 115+115 = **230**.

Posteriormente, uma das transações duplicadas foi removida (provavelmente por limpeza manual ou migration), mas sem disparar o trigger de recompute, deixando `valor_pago = 230` congelado.

### Evidências

```text
Sessão: workflow-1772463411892-lznoi6eru8k
  valor_total:  245 (130 base + 115 extras)
  valor_pago:   230 (deveria ser 115 — única transação existente)
  Transações:   1 × R$115 [auto-reconciled]
  SUM real:     115
  
Cobrança: 0cbec877 (InfinitePay, status=pago, valor=115, PIX)
  valor_liquido: NULL (PIX não tem taxa)
```

### Pagamento base (R$130) NUNCA foi registrado

O fotógrafo não registrou o pagamento do pacote base para esta sessão via `clientes_transacoes`. Isso é um problema separado — o saldo correto deveria ser: R$115 pago, R$130 pendente.

## Plano de Correção

### 1. Corrigir dados desta sessão (imediato)

Migration para forçar recalcule de `valor_pago` baseado nas transações reais:

```sql
SELECT public.recompute_session_paid('workflow-1772463411892-lznoi6eru8k');
```

Isso vai setar valor_pago = 115 (a única transação existente).

### 2. Eliminar dupla criação no InfinitePay Webhook (bug sistêmico)

No `infinitepay-webhook/index.ts`, o bloco de criação de transação (linhas 328-383) é **redundante** com o trigger `ensure_transaction_on_cobranca_paid`. Devemos:

- **Remover** a criação manual de transação no webhook (linhas 339-349)
- O trigger `ensure_transaction_on_cobranca_paid` já garante a criação da transação quando a cobrança muda para 'pago'
- Manter apenas o log informativo

### 3. Varredura de outras sessões afetadas

Buscar TODAS as sessões onde `valor_pago ≠ SUM(transações)` e corrigir:

```sql
WITH expected AS (
  SELECT session_id, COALESCE(SUM(valor), 0) AS soma
  FROM clientes_transacoes
  WHERE tipo = 'pagamento' AND session_id IS NOT NULL
  GROUP BY session_id
)
SELECT cs.session_id, cs.valor_pago AS atual, e.soma AS esperado
FROM clientes_sessoes cs
JOIN expected e ON cs.session_id = e.session_id
WHERE cs.valor_pago != e.soma;
```

Executar `recompute_session_paid` para cada sessão divergente.

### 4. Integração Gallery → Gestão para taxas

Sobre a questão de taxas vindas do Gallery: como o Gallery usa InfinitePay via `gallery-create-payment`, e o webhook já grava a cobrança com `provedor = 'infinitepay'`, o trigger `ensure_transaction_on_cobranca_paid` já registra `taxa_gateway` e `taxa_antecipacao` corretamente quando `valor_liquido` está presente na cobrança. Para PIX (como este caso), não há taxa — `valor_liquido = NULL` — e isso está correto.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Recalcular valor_pago de sessões divergentes |
| `supabase/functions/infinitepay-webhook/index.ts` | Remover criação duplicada de transação (linhas 328-383), manter apenas o trigger |

