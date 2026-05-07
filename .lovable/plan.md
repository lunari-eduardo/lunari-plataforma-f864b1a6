# Correção da divergência de pagamentos entre Workflow/CRM e modal de Pagamentos

## Diagnóstico (causa raiz comprovada)

Sessão analisada: `c30f6d83-...` (Cliente Novo 09/06).

| Cobrança | Valor | Status | Transação correspondente? |
|----------|-------|--------|---------------------------|
| `edc1fb60` (03/05) | R$ 5,00 | pago | ✅ Sim |
| `45f82362` (07/05 03:28) | R$ 5,00 | pago | ❌ **Não criou** |
| `a0fedbb9` (07/05 03:47) | R$ 9,00 | pago | ✅ Sim |

- `clientes_sessoes.valor_pago = 14` (apenas 5 + 9). Faltam R$ 5,00.
- Modal de Pagamentos lê das cobranças → mostra **R$ 19** corretamente.
- Workflow/CRM leem `clientes_sessoes.valor_pago` → mostram **R$ 14** (errado).

### Por que a transação não foi criada

A função `ensure_transaction_on_cobranca_paid` faz duas verificações de duplicidade antes de inserir uma transação:

1. **Primária (correta):** `cobranca_id = NEW.id` — não encontra (é cobrança nova).
2. **Secundária (defeituosa):** match por `session_id + valor + provedor_label` na descrição.

```sql
-- Trecho problemático
SELECT id INTO v_existing_tx
FROM clientes_transacoes
WHERE session_id = v_session_text
  AND tipo = 'pagamento'
  AND valor = v_valor_transacao
  AND descricao ILIKE '%' || v_provedor_label || '%'
LIMIT 1;
```

Quando o fotógrafo vende **fotos extras com preço unitário fixo** (caso muito comum) e o cliente faz mais de uma compra de mesma quantidade no mesmo provedor (ex.: duas vezes "1 foto extra - R$ 5,00 via Asaas"), essa busca casa com a transação da cobrança antiga. O fluxo entra no ramo `ELSE` e apenas faz `UPDATE ... cobranca_id = COALESCE(cobranca_id, NEW.id)` — como a transação existente já tem `cobranca_id` preenchido, **o COALESCE preserva o ID antigo e nenhuma nova transação é criada**.

Resultado: `recompute_session_paid` (trigger AFTER em `clientes_transacoes`) soma apenas as transações existentes, deixando `valor_pago` defasado. Reproduz exatamente o sintoma de "Pago R$ 14" no Workflow/CRM enquanto o modal mostra "Recebido R$ 19".

Esse problema só passou a aparecer agora porque a antiga restrição de unicidade por cobrança foi flexibilizada nas últimas iterações (permitir excluir galeria mantendo pagamentos), tornando a heurística secundária ativa em mais cenários.

## Plano de correção

### 1. Corrigir o trigger `ensure_transaction_on_cobranca_paid`

- **Remover a verificação secundária por (session+valor+provedor)**. Ela é insegura — colide em qualquer caso de cobranças repetidas de mesmo valor.
- Manter apenas:
  - Match por `cobranca_id = NEW.id` (primário).
  - Match por UUID da cobrança na descrição (`%cobranca <uuid>%`) — cobre webhooks legados antes da coluna `cobranca_id`.
- Comportamento esperado: cada cobrança paga gera **exatamente uma** transação; reentrância do webhook continua idempotente via `cobranca_id`.

### 2. Backfill das sessões/transações afetadas

Script de migração único (executado uma vez):

```text
- Para cada cobranca em status pago/pago_manual SEM transação ligada por cobranca_id
  e SEM match por UUID na descrição:
    INSERT clientes_transacoes (...) usando a mesma lógica do trigger
    (valor, valor_liquido, taxas, data_pagamento, descricao com [auto-backfill]).
- Após o INSERT, o trigger recompute_paid_amount já recalcula
  clientes_sessoes.valor_pago automaticamente.
- SELECT de auditoria final: sessões cuja soma de transações != valor_pago.
```

### 3. Salvaguardas adicionais (defesa em profundidade)

- **Índice único parcial** em `clientes_transacoes (cobranca_id) WHERE cobranca_id IS NOT NULL` para garantir 1 transação por cobrança no nível do banco.
- Função utilitária `reconcile_session_payments(session_id)` que recria transações faltantes — útil para suporte e como fallback de qualquer divergência futura.
- Log/aviso na função do trigger quando uma transação for criada via backfill, facilitando auditoria.

### 4. Verificação

- Reabrir Cliente Novo 09/06: Workflow/CRM devem mostrar Pago = R$ 19,00, Pendente = R$ 195,00.
- Rodar SELECT consolidado em todas as sessões para garantir 0 divergências entre `valor_pago` e soma de transações.

## Arquivos / objetos afetados

- DB: função `public.ensure_transaction_on_cobranca_paid` (substituir).
- DB: nova migração com backfill + índice único parcial + função `reconcile_session_payments`.
- Frontend: **nenhuma alteração** — `SessionPaymentsManager` e Workflow já lêem das fontes corretas; o problema é puramente de dados/trigger.

## Riscos e mitigação

- Backfill insere transações históricas: limitamos por `cobranca_id IS NULL` em transações existentes para nunca duplicar; transação de teste em ambiente antes de aplicar índice único.
- Índice único pode falhar se já houver duplicatas por cobranca_id: a migração faz dedup prévio (manter a transação mais antiga, deletar duplicatas) antes de criar o índice.
