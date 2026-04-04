

# Sistema de Estorno + Correção de Cascatas Perigosas

## Problemas Críticos Encontrados

### 1. CASCADE perigoso: Excluir galeria apaga cobranças
`cobrancas.galeria_id → galerias.id ON DELETE CASCADE` — ao excluir uma galeria, **todas as cobranças vinculadas são apagadas**, incluindo parcelas (outro CASCADE). Isso destrói todo o histórico financeiro silenciosamente.

### 2. Excluir sessão + galeria vinculada
Hoje, `clientes_sessoes.galeria_id → galerias.id ON DELETE SET NULL` — se a galeria é excluída, o vínculo é removido. Porém se a sessão for excluída pelo Workflow, o código em `sessionDeletionUtils.ts` pode excluir transações (`clientes_transacoes`) sem registro de estorno. A galeria permanece intacta (não há cascade de sessão → galeria).

### 3. Pagamentos são deletados sem rastro
`PaymentSupabaseService.deletePaymentFromSupabase()` faz `DELETE` direto na tabela `clientes_transacoes`. O trigger `recompute_session_paid` recalcula o saldo — mas o registro financeiro desaparece completamente. Não há auditoria.

### 4. `recompute_session_paid` ignora estornos
A função soma apenas `tipo = 'pagamento'`. Precisará considerar `tipo = 'estorno'` como valor negativo.

---

## Plano de Implementação

### Fase 1: Migration SQL — Corrigir cascatas e suportar estorno

**A) Trocar CASCADE por SET NULL em `cobrancas.galeria_id`**
```sql
ALTER TABLE cobrancas DROP CONSTRAINT cobrancas_galeria_id_fkey;
ALTER TABLE cobrancas ADD CONSTRAINT cobrancas_galeria_id_fkey 
  FOREIGN KEY (galeria_id) REFERENCES galerias(id) ON DELETE SET NULL;
```
Isso garante que excluir uma galeria **preserva** as cobranças (ficam órfãs mas auditáveis).

**B) Atualizar `recompute_session_paid` para considerar estornos**
```sql
UPDATE clientes_sessoes SET valor_pago = (
  SELECT COALESCE(SUM(
    CASE WHEN tipo = 'estorno' THEN -valor ELSE valor END
  ), 0)
  FROM clientes_transacoes
  WHERE session_id = p_session_id AND tipo IN ('pagamento', 'estorno')
)
```

### Fase 2: Lógica de estorno no código

**A) `PaymentSupabaseService.ts` — Nova função `refundPayment`**
Em vez de deletar a transação original, criar uma nova transação com:
- `tipo: 'estorno'`
- `valor`: valor estornado (positivo na tabela, tratado como negativo pelo trigger)
- `descricao`: referência ao pagamento original
- `data_transacao`: data atual
- Manter a transação original intacta

**B) `useSessionPayments.ts` — Substituir `deletePayment` por `refundPayment`**
- Pagamentos **pendentes/agendados**: podem ser excluídos normalmente (ainda não foram pagos)
- Pagamentos **pagos**: criar estorno em vez de excluir
- Pagamentos de **gateway** (InfinitePay, Asaas, MP): não editáveis, estorno apenas registra internamente

**C) `SessionPaymentsManager.tsx` — Trocar botão de excluir por estornar**
- Para pagamentos pagos: ícone de estorno (RotateCcw) em vez de lixeira
- Modal de confirmação: "Estornar pagamento de R$ X?" com campo opcional de motivo
- Pagamento estornado aparece na lista com badge "Estornado" e valor em vermelho

**D) `sessionDeletionUtils.ts` — FlexibleDeleteModal**
- Trocar opção "Excluir pagamentos" por "Estornar pagamentos"
- Ao excluir sessão com estorno: criar transação de estorno para cada pagamento pago, depois excluir sessão
- Opção "Preservar pagamentos" continua orphanando (session_id = null)

### Fase 3: Exibição de estornos

**A) `SessionPaymentExtended` — Novo tipo**
Adicionar `'estorno'` ao tipo de pagamento e `'estornado'` ao status.

**B) Cálculos atualizados em `useSessionPayments.ts`**
- `totalPago`: soma pagamentos pagos — soma estornos
- `totalEstornado`: soma de estornos (novo campo)

**C) Extrato unificado (`extrato_unificado` view)**
Verificar se a view já trata `tipo = 'estorno'`. Se não, atualizar para exibi-lo corretamente.

---

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Trocar CASCADE por SET NULL em `cobrancas.galeria_id`; atualizar `recompute_session_paid` |
| `src/services/PaymentSupabaseService.ts` | Nova função `refundPayment`; manter `deletePayment` apenas para pendentes |
| `src/hooks/useSessionPayments.ts` | Lógica de estorno vs exclusão; novo cálculo `totalEstornado` |
| `src/components/payments/SessionPaymentsManager.tsx` | Botão estorno para pagos; badge "Estornado"; exibição de estornos na lista |
| `src/types/sessionPayments.ts` | Adicionar `'estorno'` ao tipo |
| `src/utils/sessionDeletionUtils.ts` | Opção de estornar em vez de excluir |
| `src/components/workflow/FlexibleDeleteModal.tsx` | Trocar label "Excluir pagamentos" → "Estornar pagamentos" |

## Ações necessárias no projeto Gallery

1. **Verificar se Gallery exclui galerias diretamente** — após a migration, excluir galeria não apagará cobranças (SET NULL), então o Gallery deve tratar cobranças órfãs ou impedir exclusão de galerias com cobranças pagas
2. **Webhooks de gateway** — nenhuma mudança necessária (continuam criando transações normalmente)
3. **UI de exclusão de galeria no Gallery** — adicionar aviso se galeria possui cobranças pagas, oferecendo opção de estorno antes da exclusão

