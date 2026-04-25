# 🩺 Diagnóstico — Por que a exclusão pelo Workflow não removeu pagamentos nem agendamento

Após investigar o fluxo completo (UI → handler → DB) e consultar o estado atual do banco, identifiquei **três falhas distintas** que se somam:

### 1. A opção "Excluir tudo permanentemente" não exclui pagamentos
Em `src/pages/Workflow.tsx` (linhas 800-820), o branch `else` (`action === 'remove'`) faz **exatamente o mesmo** que o `'preserve'`:
```ts
// remove: hard delete — decouple transactions first
await supabase.from('clientes_transacoes')
  .update({ session_id: null })   // ❌ apenas DESVINCULA
  .eq('session_id', sessaoData.session_id);
await supabase.from('clientes_sessoes').delete().eq('id', sessionId);
```
Some-se a isso a FK `clientes_transacoes.session_id → clientes_sessoes(session_id) ON DELETE SET NULL`: mesmo se a sessão fosse deletada sem o `update` prévio, as transações sobreviveriam como órfãs. **Resultado:** o pagamento de R$ 112,00 do Eduardo Valmor (visível no extrato como `session_id = NULL`) é exatamente esse cenário.

### 2. A exclusão pelo Workflow ignora o `appointment` da Agenda
A função `handleDeleteSession` só toca em `clientes_sessoes` e `clientes_transacoes`. **Nunca apaga `appointments`**. Confirmei no banco: o appointment `1c1bb97f-…` (Eduardo Valmor, 18/06 15:00) ainda existe vinculado à sessão `68f97f40-…` — exatamente o card azul que aparece na sua imagem da Agenda.

### 3. Existem dois fluxos paralelos (e divergentes) de exclusão
- **Agenda** usa a RPC atômica `delete_appointment_cascade` (que apaga transações + sessão + appointment de forma transacional) — está correta.
- **Workflow** usa código manual em `Workflow.tsx` (errado) e ainda existe o hook morto `useWorkflowRealtime.deleteSession → deleteSessionWithOptions` (que só conhece `preserve|refund`, nem suporta `remove`). Há também o `FlexibleDeleteModal` (2 opções) e o `WorkflowDeleteConfirmModal` (3 opções) coexistindo.

### Estado atual do banco (impacto)
- 50 transações órfãs (`session_id IS NULL`) somando R$ 3.097 só do user de testes — algumas marcadas com sufixo `[orphan]` em descrições antigas.
- Appointment + sessão do Eduardo Valmor (15:00) ainda intactos.
- Cobranças do Eduardo (Asaas/InfinitePay) também já estão com `session_id = NULL` — perda de rastreabilidade.

---

# 🎯 Plano de correção

## Princípios
1. **Uma única fonte da verdade**: criar RPC `delete_workflow_session_cascade` espelhando o padrão da Agenda.
2. **Atomicidade**: tudo (transações, cobranças desvinculadas, sessão, appointment) numa transação SQL.
3. **Sem perda silenciosa**: cobranças com pagamentos já confirmados (`status='pago'` com gateway externo) **não são apagadas** — apenas perdem o vínculo, e a sessão recebe registro em `audit_log`.
4. **Compatibilidade Gallery**: galerias vinculadas obedecem à FK `ON DELETE SET NULL` que já existe — não removemos galerias, apenas desvinculamos.

---

## FASE 1 — Backend: RPC atômica unificada
**Arquivo:** nova migration SQL.

Criar `public.delete_workflow_session_cascade(p_session_pk uuid, p_action text)` com `SECURITY DEFINER` e `auth.uid()`:

| Ação | Comportamento |
|---|---|
| `preserve` | `UPDATE clientes_sessoes SET status='historico'` (soft delete, mantém tudo) |
| `refund` | INSERT estornos espelhando pagamentos `tipo='pagamento'` → DELETE da sessão (FK desvincula transações automaticamente) → DELETE do appointment vinculado |
| `remove` | DELETE de `clientes_transacoes WHERE session_id=...` → DELETE de `clientes_sessoes` → DELETE de `appointments WHERE id = appointment_id` da sessão. Cobranças do gateway: se houver pagamento confirmado externo, **não apagar** a `cobranca` (apenas zerar `session_id`); senão, apagar. |

Retorno: `jsonb` com contadores (`deleted_transactions`, `deleted_cobrancas`, `deleted_appointment`, `deleted_session`) para feedback ao usuário e logs.

Validações dentro da função:
- `auth.uid()` precisa bater com `user_id` da sessão (defesa em profundidade além das RLS).
- `RAISE EXCEPTION` se sessão não existe (evita o "sucesso silencioso" que aconteceu agora).

## FASE 2 — Frontend: unificar fluxo do Workflow
**Arquivos a editar:**

### `src/pages/Workflow.tsx`
Substituir a `handleDeleteSession` (linhas 743-829) por chamada única à RPC:
```ts
const { data, error } = await supabase.rpc('delete_workflow_session_cascade', {
  p_session_pk: sessionId,
  p_action: deleteAction
});
if (error) throw error;
// usar data.deleted_* para mensagem de sucesso ("3 pagamentos removidos, 1 agendamento removido")
```
Remover toda a lógica manual de `update session_id=null` e `delete`.

### `src/hooks/useWorkflowRealtime.ts`
- Atualizar `deleteSession(id, action: 'preserve'|'refund'|'remove')` para também usar a RPC.
- Manter assinatura compatível para chamadas existentes.

### `src/utils/sessionDeletionUtils.ts`
- Marcar `orphanPaymentsThenDeleteSession` e `deleteSessionWithOptions` como **deprecated** (manter export por 1 release para evitar quebra) e fazer eles chamarem a RPC internamente.

### `src/components/workflow/FlexibleDeleteModal.tsx`
- **Remover** (modal antigo de 2 opções, não está mais em uso pelo card colapsado — vou validar usos antes de apagar para evitar quebras).

## FASE 3 — Sincronização Workflow ↔ Agenda
- Após a RPC retornar com `deleted_appointment > 0`, disparar `window.dispatchEvent(new CustomEvent('agenda:refresh'))` para que a `AgendaContext` re-buscar (já existe esse padrão para outros eventos). Garante que o card azul desapareça imediatamente da Agenda sem F5.

## FASE 4 — Backfill seguro do estado órfão atual
Migration adicional (idempotente) com 3 passos, **não destrutivos**:

1. **Marcar** todas as transações órfãs `session_id IS NULL` com sufixo `[orphan-pre-fix]` na descrição (caso ainda não tenha) — para auditoria.
2. **Não excluir automaticamente** transações órfãs (algumas podem ser legítimas — pagamentos avulsos, integrações antigas). Em vez disso, criar uma **view** `vw_transacoes_orfas` para que o usuário decida no extrato (futura UI: botão "Excluir órfã").
3. **Caso específico do Eduardo Valmor (sessão `68f97f40`)**: como o usuário confirmou que tentou excluir hoje sem sucesso, executar via migration um cleanup pontual usando a nova RPC para essa sessão exata (`p_action='remove'`). Isso resolve a inconsistência visível agora sem mexer em dados de outros usuários.

## FASE 5 — Telemetria & defesa
- Adicionar `console.log('🗑️ [WORKFLOW-DELETE]', { sessionId, action, result })` antes/depois da RPC.
- Toast de erro **explícito** quando `data.deleted_session === 0` (hoje o `.delete()` não retorna erro mesmo quando RLS bloqueia 0 linhas — esse é provavelmente o motivo da exclusão de hoje ter "passado" sem efeito).

## FASE 6 — QA manual sugerido
1. Criar sessão de teste com pagamento → excluir com "Estornar e excluir" → conferir estorno no extrato + sumiço da Agenda.
2. Criar sessão de teste com pagamento → excluir com "Excluir tudo permanentemente" → conferir sumiço total no extrato + Agenda.
3. Criar sessão sem pagamento → excluir → conferir sumiço.
4. Sessão com galeria + cobrança Asaas paga → excluir "permanentemente" → conferir que cobrança permanece (com `session_id=NULL`) mas sessão e appointment somem.

---

# 🔍 Sobre o projeto Gallery
**Não há ação necessária no projeto Gallery** para este bug. A FK `clientes_sessoes.galeria_id → galerias(id) ON DELETE SET NULL` já protege a galeria de ser apagada acidentalmente. A nova RPC respeita esse padrão.

**Sugestão futura (não no escopo desta correção):** quando uma sessão é excluída em "remove" e havia galeria vinculada, registrar em `audit_log` para que o painel de Galleries no Gallery exiba aviso "Sessão de origem foi excluída" — mas isso é UX, não integridade.

---

# ✅ Resultado esperado após a implementação
- "Excluir tudo permanentemente" passa a **realmente apagar** transações, sessão e appointment numa transação atômica.
- Agenda atualiza em tempo real (sem F5).
- Pagamentos pré-existentes do gateway (Asaas/MP/InfinitePay) com confirmação externa são preservados como cobrança histórica (sem vínculo) — protege contabilidade.
- Backlog de 50 órfãs antigas fica visível em uma view para limpeza manual posterior, sem risco de exclusão automática indevida.
- Sessão `68f97f40` do Eduardo Valmor é limpa imediatamente via migration pontual.

Posso prosseguir com a implementação?