

# Correção: Estornos + Modal Agenda + Restaurar exclusão manual

## Causa raiz do estorno falhando (400 Bad Request)

A tabela `clientes_transacoes` possui um CHECK constraint na coluna `tipo`:
```sql
tipo text NOT NULL CHECK (tipo IN ('pagamento', 'desconto', 'ajuste'))
```
O valor `'estorno'` **não está na lista permitida**. Toda tentativa de INSERT com `tipo = 'estorno'` resulta em erro 400. A migration anterior atualizou os triggers (`recompute_session_paid`) para tratar estornos, mas **esqueceu de atualizar o CHECK constraint**.

## Problemas identificados

1. **CHECK constraint bloqueia estorno** — precisa incluir `'estorno'` na lista
2. **Modal da agenda (`AppointmentDeleteConfirmModal`)** — ainda mostra "Excluir tudo permanentemente" com texto sobre excluir pagamentos, sem opção de estorno
3. **RPC `delete_appointment_cascade`** — faz `DELETE FROM clientes_transacoes` direto, sem criar estornos
4. **Botão de exclusão removido para pagamentos pagos manuais** — o usuário quer manter a opção de excluir pagamentos manuais pagos (ex: lançamento acidental), além do estorno

## Plano de implementação

### 1. Migration SQL — Atualizar CHECK constraint

```sql
ALTER TABLE public.clientes_transacoes 
  DROP CONSTRAINT clientes_transacoes_tipo_check;
ALTER TABLE public.clientes_transacoes 
  ADD CONSTRAINT clientes_transacoes_tipo_check 
  CHECK (tipo IN ('pagamento', 'desconto', 'ajuste', 'estorno'));
```

### 2. `AppointmentDeleteConfirmModal.tsx` — Adicionar opção de estorno

Quando `hasPayments === true`, oferecer **3 opções** (RadioGroup):
- **Preservar histórico** (atual) — cancela agendamento, sessão vira histórico, pagamentos mantidos
- **Estornar pagamentos** (nova) — cria registros de estorno para cada pagamento pago, depois exclui sessão
- **Excluir tudo permanentemente** (atual) — deleta tudo incluindo pagamentos

Ajustar a prop `onConfirm` para aceitar `'preserve' | 'refund' | 'remove'` em vez de `boolean`.

### 3. `SupabaseAgendaAdapter.ts` + `AgendaContext` — Propagar opção de estorno

- `deleteAppointment(id, action: 'preserve' | 'refund' | 'remove')` em vez de `boolean`
- Quando `action === 'refund'`: usar `deleteSessionWithOptions` com `paymentAction: 'refund'` antes de excluir o appointment
- Quando `action === 'remove'`: manter RPC cascade atual
- Quando `action === 'preserve'`: manter fluxo legado atual

### 4. `SessionPaymentsManager.tsx` — Restaurar botão de excluir para manuais pagos

Para pagamentos **pagos + editáveis** (manuais), exibir **ambos** botões:
- Editar (lápis)
- Excluir (lixeira) — exclusão direta do registro
- Estornar (RotateCcw) — cria registro de estorno

Isso dá controle total ao usuário: se foi lançado por engano, exclui; se foi pago de verdade mas precisa devolver, estorna.

### 5. `Agenda.tsx` — Atualizar handler de exclusão

Ajustar `handleDeleteAppointment` para receber o tipo de ação e exibir toast adequado para cada caso.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Adicionar `'estorno'` ao CHECK constraint de `clientes_transacoes.tipo` |
| `AppointmentDeleteConfirmModal.tsx` | 3 opções (preservar/estornar/excluir); nova prop `onConfirm(action)` |
| `AppointmentDetails.tsx` | Propagar novo tipo de ação |
| `SupabaseAgendaAdapter.ts` | Aceitar `'preserve' | 'refund' | 'remove'`; chamar estorno quando necessário |
| `AgendaContext.tsx` | Ajustar tipo do parâmetro |
| `Agenda.tsx` | Ajustar handler e toasts |
| `SessionPaymentsManager.tsx` | Restaurar botão de excluir para pagamentos manuais pagos |

## O que NÃO muda

- `PaymentSupabaseService.refundPayment()` — lógica já está correta, só falhava pelo CHECK
- `sessionDeletionUtils.ts` — fluxo de estorno em massa já funciona
- `FlexibleDeleteModal.tsx` (workflow) — já atualizado corretamente
- Triggers `recompute_session_paid` — já tratam estornos como negativos

