

# Diagnóstico e Plano de Correção: CRM, Pagamentos e Agenda

## Problemas Identificados

### 1. CRM em loop de carregamento (a cada ~3s)

**Causa raiz**: `useClientSessionsRealtime.ts` (linha 45) e `useClientMetricsRealtime.ts` (linha 30) ambos fazem `setLoading(true)` a cada refetch causado por eventos realtime. Quando qualquer alteração ocorre nas tabelas `appointments`, `clientes_sessoes` ou `clientes_transacoes`, os 3 canais realtime disparam `debouncedRefetch()` com apenas 150ms de debounce. Cada refetch mostra o spinner de "Carregando histórico..." novamente, tornando a página inutilizável.

**Agravante**: O trigger `cleanup_occupied_availability` (SQL) dispara ao confirmar um agendamento e deleta slots de `availability_slots`. Se o agendamento original foi confirmado e depois excluído/reagendado, os eventos em cascata (delete appointment → delete session → delete transactions) geram múltiplos eventos realtime, cada um disparando um refetch com spinner.

**Correção**: Não mostrar spinner (`setLoading(true)`) em refetches realtime — apenas no carregamento inicial. Usar um padrão "stale-while-revalidate": manter dados visíveis enquanto recarrega silenciosamente.

### 2. Erro ao adicionar pagamento manual

**Causa raiz**: Em `useSessionPayments.ts` (linha 420-438), o `addPayment` chama `saveSinglePaymentToSupabase()` que usa `sessionId` (o `id` UUID da sessão, passado via `sessionData.id`). Porém, `saveSinglePaymentTracked` faz `getSessionBinding(sessionKey)` que busca primeiro por UUID (`id`), depois por `session_id` (text). O problema é que o `paymentExists()` (linha 651) busca por `ilike('descricao', '%${paymentId}%')` — se o `paymentId` contiver caracteres especiais do formato `pay-timestamp-random`, o `ILIKE` pode falhar silenciosamente. Mais importante: se a sessão não for encontrada (binding null na linha 670), o pagamento falha silenciosamente retornando `false` sem toast de erro ao usuário.

**Correção**: Adicionar toast de erro no `addPayment` quando o save falha. Adicionar try-catch com feedback ao usuário.

### 3. Agendamento desaparecido (12/03 → 17/03)

**Causa raiz**: O trigger SQL `cleanup_occupied_availability` deleta slots de `availability_slots` quando um appointment é confirmado. Mas NÃO deleta appointments. O problema reportado provavelmente foi causado por uma operação de "limpar disponibilidade para data" (`clearAvailabilityForDate`) no `AvailabilityConfigModal.tsx` (linha 154) que remove TODOS os slots da data — incluindo availability markers que visualmente indicavam o agendamento na agenda. O appointment em si permanece no banco, mas pode ter sido deletado manualmente ou via cascade.

**Não há bug no trigger** — o trigger `cleanup_occupied_availability` só age sobre `availability_slots`, não sobre `appointments`. O desaparecimento do appointment foi provavelmente uma operação manual ou um bug de UI que ocultou o card.

## Plano de Alterações

### 1. `src/hooks/useClientSessionsRealtime.ts` — Eliminar loop de loading

- Linha 45: `setLoading(true)` → remover do `loadSessions` quando é refetch (não é carregamento inicial)
- Adicionar flag `isInitialLoad` via useRef
- No refetch via realtime: não tocar em `loading`, apenas atualizar `sessions` silenciosamente

```
Antes: loadSessions() → setLoading(true) → spinner → fetch → setLoading(false)
Depois: refetch()  → fetch silencioso → setSessions() (sem spinner)
        initial()  → setLoading(true) → fetch → setLoading(false) (com spinner)
```

### 2. `src/hooks/useClientMetricsRealtime.ts` — Mesmo padrão

- Linha 30: `setLoading(true)` no `calculateMetrics` → apenas no primeiro carregamento
- Refetches via realtime: silenciosos

### 3. `src/hooks/useSessionPayments.ts` — Feedback de erro no addPayment

- Linha 420-438: Adicionar tratamento de erro com toast quando `saveSinglePaymentToSupabase` falha
- Mover a chamada para async/await com try-catch e `toast.error('Erro ao salvar pagamento')`

### 4. `src/components/payments/SessionPaymentsManager.tsx` — Toast de sucesso/erro

- Após `addPayment`, mostrar `toast.success('Pagamento adicionado')` ou `toast.error()` se falhar

### 5. `src/hooks/useClientSessionsRealtime.ts` — Aumentar debounce

- Linha 306: debounce de 150ms → 500ms para evitar refetches excessivos durante operações em cascata

5 arquivos alterados. Foco em eliminar o loop de loading e dar feedback nos pagamentos.

