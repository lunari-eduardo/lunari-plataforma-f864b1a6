

# Diagnóstico: Pagamento de R$115 Reaparecendo como Pendente

## Causa Raiz Identificada

O problema está na **cadeia de callbacks `onPaymentUpdate`** no Workflow. Quando o pagamento rápido de R$130 é adicionado:

1. **`addPayment` no AppContext** (linha 810) insere a transação de R$130 no Supabase via `PaymentSupabaseService.saveSinglePaymentTracked`
2. O trigger `recompute_session_paid` recalcula `valor_pago` = 130 + 115 = **R$ 245,00** ✅
3. O evento `payment-created` é disparado
4. **`WorkflowCacheContext`** (linha 531) recebe o evento, aguarda 350ms, e faz re-fetch da sessão do Supabase com `valor_pago = 245` ✅

**Até aqui tudo correto.** O problema acontece quando o usuário **abre o modal de pagamentos** (ou o CRM):

5. O `SessionPaymentsManager` monta e chama `useSessionPayments(sessionData.id, initialPayments)`
6. `useSessionPayments` faz fetch das transações do Supabase (encontra 2: R$130 manual + R$115 InfinitePay)
7. O `useEffect` na **linha 111-114** do `SessionPaymentsManager` dispara `onPaymentUpdate(sessionId, totalPago, legacyPayments)` toda vez que `payments` muda
8. No Workflow, o callback `onPaymentUpdate` chama `onFieldUpdate(sessionId, 'valorPago', ...)` — mas o campo `'valorPago'` é **ignorado** pelo `updateSession` (linha 531 do useWorkflowRealtime: `case 'valorPago': break`)

**O campo `valorPago` nunca chega ao banco.** Isso significa que o valor exibido na UI depende inteiramente do cache local, e qualquer re-render pode resetar para o valor antigo.

Além disso, o **`onFieldUpdate` com `'pagamentos'`** também é ignorado pelo banco (linha 533). Ou seja, toda a sincronização via `onPaymentUpdate` → `onFieldUpdate` é efetivamente um **no-op** que só afeta estado local temporário.

### O verdadeiro bug

O `valor_pago` no banco **está correto** (R$ 245). O problema é que a UI do Workflow card lê de `session.valorPago` (formato string `"R$ 130,00"`) que vem do **cache local/localStorage** e não é atualizado corretamente após o re-fetch. O campo `pendente` no card é calculado como `total - valorPago`, e se `valorPago` estiver desatualizado, mostra R$ 115 pendente.

A inconsistência visual é causada por **dois sistemas de dados concorrendo**: o Supabase (correto) e o localStorage/cache (desatualizado).

## Sobre os itens marcados pelo usuário nas imagens

- **"Corrigir Valores do Histórico"**: botão de migração de dados antigos — pode ser removido ou escondido (já não é necessário rotineiramente)
- **"Nenhuma sessão precisou ser corrigida"**: toast do botão acima — confirma que os dados do banco estão corretos
- **Ícone vermelho com X**: esses itens de UI obsoletos devem ser limpos

## Correções Propostas

### 1. Eliminar `onPaymentUpdate` → `onFieldUpdate` como mecanismo de sync (raiz do bug)

O `valor_pago` já é mantido pelo trigger do banco. O frontend **não deve tentar setá-lo manualmente**. A UI do Workflow deve ler `valor_pago` diretamente do Supabase (já faz via WorkflowCacheContext).

**Arquivo**: `src/components/workflow/WorkflowCardCollapsed.tsx` e `WorkflowCardExpanded.tsx`
- Remover o callback `onPaymentUpdate` que tenta setar `valorPago` via `onFieldUpdate`
- Substituir por: apenas disparar um evento `payment-created` para forçar re-fetch do cache

### 2. Forçar re-fetch após fechar modal de pagamentos

**Arquivo**: `src/components/workflow/WorkflowCardCollapsed.tsx` e `WorkflowCardExpanded.tsx`
- No `onClose` do `WorkflowPaymentsModal`, disparar `window.dispatchEvent(new CustomEvent('payment-created', { detail: { sessionId } }))` para forçar o `WorkflowCacheContext` a buscar dados frescos do banco

### 3. Corrigir cálculo de `pendente` no card

**Arquivo**: `src/components/workflow/WorkflowCardCollapsed.tsx`
- O cálculo de `pendente` deve usar `valor_pago` do banco (campo numérico) em vez de parsear a string `session.valorPago`

### 4. Limpar UI obsoleta no CRM

**Arquivo**: `src/components/crm/WorkflowHistoryTable.tsx`
- Remover ou esconder o botão "Corrigir Valores do Histórico" (já fez seu trabalho, não é necessário no dia a dia)

### 5. Remover escrita de `valorPago` no localStorage do AppContext

**Arquivo**: `src/contexts/AppContext.tsx` (linhas 862-912)
- O bloco que atualiza `localStorage` com `valorPago` é redundante e causa dessincronização. Remover essa lógica — o Supabase é a fonte da verdade.

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/workflow/WorkflowCardCollapsed.tsx` | Simplificar `onPaymentUpdate`, forçar re-fetch no close |
| `src/components/workflow/WorkflowCardExpanded.tsx` | Mesma correção |
| `src/contexts/AppContext.tsx` | Remover bloco localStorage de `addPayment` |
| `src/components/crm/WorkflowHistoryTable.tsx` | Esconder botão "Corrigir Valores" |
| `src/components/payments/SessionPaymentsManager.tsx` | Revisar useEffect de sync para não causar loops |

## Sobre Escalabilidade

A arquitetura atual (trigger SQL como fonte da verdade para `valor_pago`) é **correta e escalável**. O problema não é o banco — é o frontend tentando manter um estado paralelo via localStorage/callbacks que conflita com o dado real. A correção acima elimina essa duplicidade.

