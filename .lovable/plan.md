

# Correção: Descrição de estornos no extrato mostra IDs técnicos

## Problema

Estornos aparecem no extrato com descrições como `Estorno [REF:ab209502-da04-4eba-a47e-949a73b49097]` — o sufixo `[REF:...]` é referência interna sem valor para o usuário.

## Causa

1. `PaymentSupabaseService.refundPayment()` salva `descricao = "Estorno [REF:paymentId]"` no banco
2. `sessionDeletionUtils.ts` salva `descricao = "Estorno por exclusão de sessão [REF:id]"`
3. A view `extrato_unificado` usa `COALESCE(ct.descricao, 'Estorno')` que exibe o texto cru
4. O hook `useSessionPayments` já limpa o REF com regex no histórico de pagamentos, mas o extrato não faz isso

## Solução

### 1. View SQL — Limpar `[REF:...]` na descrição do estorno

Alterar o bloco de estornos na view `extrato_unificado` para remover o sufixo técnico:

```sql
COALESCE(
  regexp_replace(ct.descricao, '\s*\[REF:[^\]]+\]', '', 'g'),
  'Estorno'
) AS descricao
```

E usar o mesmo valor limpo para `observacoes`.

### 2. Também melhorar descrição no serviço (futuro)

Alterar `PaymentSupabaseService.refundPayment()` para salvar uma descrição mais amigável:

```ts
const descricao = `Estorno${motivo ? `: ${motivo}` : ''}`;
```

O `[REF:paymentId]` pode ser salvo em um campo separado ou simplesmente removido — o vínculo já é rastreável pelo `session_id` e `cliente_id`.

Mesma limpeza em `sessionDeletionUtils.ts`:
```ts
descricao: `Estorno por exclusão de sessão`
```

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | `regexp_replace` na descrição de estornos na view |
| `src/services/PaymentSupabaseService.ts` | Remover `[REF:]` da descrição salva |
| `src/utils/sessionDeletionUtils.ts` | Remover `[REF:]` da descrição salva |

