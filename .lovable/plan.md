

# Correção: Origem "Supabase" no modal + Estornos no extrato + Data/hora do estorno

## Problemas identificados

### 1. Modal "Editar Pagamento" mostra "Origem: Supabase"
O card de origem exibe o valor cru do campo `origem` (ex: "supabase"). Isso é um detalhe técnico interno sem valor para o usuário.

### 2. Estornos não aparecem no extrato financeiro
A view `extrato_unificado` filtra `WHERE ct.tipo = 'pagamento'` (linha 179 da migration mais recente). Estornos (`tipo = 'estorno'`) são **completamente excluídos** do extrato.

### 3. Data e hora do estorno não aparecem no histórico de pagamentos
O `SessionPaymentsManager` só renderiza data quando `statusPagamento === 'pago'` (linha 329). Estornos têm `statusPagamento: 'estornado'`, então a coluna de data fica vazia.

## Plano

### 1. `EditPaymentModal.tsx` — Remover card de origem/tipo

Remover completamente o card que exibe "Origem" e "Tipo" (linhas 101-121). Essa informação é técnica e irrelevante para o usuário. O título "Editar Pagamento" já é suficiente.

### 2. Migration SQL — Adicionar estornos ao `extrato_unificado`

Recriar a view adicionando um novo bloco `UNION ALL` para estornos:

```sql
UNION ALL
SELECT 
  ct.id::text AS id,
  ct.data_transacao AS data,
  'saida'::text AS tipo,
  COALESCE(ct.descricao, 'Estorno') AS descricao,
  'workflow'::text AS origem,
  c.nome AS cliente,
  cs.pacote AS projeto,
  cs.categoria AS categoria_session,
  'Estorno'::text AS categoria,
  NULL::integer, NULL::integer,
  ct.valor,
  'Pago'::text AS status,
  NULL::text AS cartao,
  ct.descricao AS observacoes,
  ct.user_id,
  ct.session_id,
  ct.created_at,
  'estorno'::text AS meio_pagamento
FROM clientes_transacoes ct
LEFT JOIN clientes c ON ct.cliente_id = c.id
LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
WHERE ct.tipo = 'estorno'
```

Estornos aparecerão como **saída** no extrato, com categoria "Estorno" e meio de pagamento "estorno".

### 3. `SessionPaymentsManager.tsx` — Mostrar data/hora em estornos

Expandir a condição de renderização de data (linha 329) para incluir estornos:

```tsx
{(payment.statusPagamento === 'pago' || payment.tipo === 'estorno') && (payment.createdAt || payment.data) && (
```

E usar ícone diferente para estorno (RotateCcw vermelho em vez de CheckCircle2 verde).

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/EditPaymentModal.tsx` | Remover card de Origem/Tipo |
| Migration SQL | Adicionar estornos ao `extrato_unificado` |
| `src/components/payments/SessionPaymentsManager.tsx` | Mostrar data/hora para estornos |

