# Refatoração arquitetural da página Workflow

> **Documento vivo.** Consultar antes de iniciar cada Onda. Atualizar a tabela de progresso ao final de cada Onda.

Objetivo: transformar a página atual (1.195 linhas de `Workflow.tsx`, 1.181 linhas de `useWorkflowRealtime`, 665 do `WorkflowCacheContext`, ~14k linhas no total no escopo workflow) em um motor por camadas, com superfície tipada que o Assistente de IA possa chamar diretamente.

## Progresso das Ondas

| Onda | Status | Notas |
|---|---|---|
| 1 — Domain + Indexers | ✅ concluída | `features/workflow/{domain,store,index.ts}` criados; `useWorkflowRealtime` virou shim do tipo canônico; `tsgo` limpo |
| 2 — Data layer + repos | ✅ concluída | `data/{sessionsRepo,transactionsRepo,rpc}.ts`; `Context.fetchAndCacheMonth` migrado (smoke); `tsgo` limpo |
| 3 — Realtime unificado | ✅ concluída | `realtime/useWorkflowRealtimeV2` ativo por padrão; canais legados de **sessões** (`workflow-realtime` no Context, `workflow-sessions-${user.id}` no hook) gated por `isWorkflowRealtimeV2Enabled()`. Canais de **métricas** mantidos (sub-onda futura: substituir por listener do evento `workflow-session-updated`). Fallback: `VITE_WORKFLOW_REALTIME_V2="false"`. |
| 4 — Actions + Queries | ✅ concluída | Capabilities **implementadas e registradas**: `workflow.advanceCard`, `workflow.updateFields`, `workflow.deleteSession`, `workflow.addPayment`, `workflow.refundPayment`, `workflow.reconcileFotosExtras`, `workflow.createQuickSession`, `workflow.syncFromAgenda`, `workflow.getCardBySession`, `workflow.listMonth`, `workflow.statusOptions`, `workflow.search`, `workflow.metricsForMonth`, `workflow.pendingPayments`. **4a/4b/4c** concluídas. **4d** concluída — `workflow.addPayment` agora delega ao `PaymentSupabaseService.saveSinglePaymentTracked` (preserva binding + idempotência); `AppContext.addPayment` (pagamento rápido) e `useSessionPayments.addPayment` (modal) roteiam pela Capability via flag `VITE_WORKFLOW_PAYMENT_CAPABILITY` (default on). |
| 5 — Components + Hooks finos | ⬜ | |
| 6 — AI surface + remoção de shims | ⬜ | |

---

## 1. INVENTÁRIO

### Page principal
- `src/pages/Workflow.tsx` — **1.195 linhas**. God-component: fetch (cache + ensureMonthLoaded), filtros (search/categoria/situação), ordenação, recálculo otimista de `valor_total` e `fotos_extras`, `delete_workflow_session_cascade` RPC, gerenciamento de colunas, métricas, ouvinte de `CustomEvent('workflow-session-updated')`, persistência de UI em local/sessionStorage. Importado por `app-photographer/PhotographerApp.tsx`.

### Context / provider
- `src/contexts/WorkflowCacheContext.tsx` — **665 linhas**. Cache memória + IndexedDB + BroadcastChannel + canal realtime `workflow-realtime` + 6 pontos de `supabase.from('clientes_sessoes')` + normalização parcial + preload de 4 meses + reconciliação por id/session_id. Importado por: `Workflow.tsx`, `WorkflowCacheManager.tsx`, `hooks/useWorkflowData.ts`, `useWorkflowPackageData.ts`, `useAppointmentWorkflowSync.ts`, `useProductionReminders.ts`, `useDashboardFinanceiro.ts`, `ConfigurationContext.tsx`, `DataLayer.ts`.

### Hooks
- `useWorkflowRealtime.ts` — **1.181 linhas**, canal `workflow-sessions-${user.id}`, 11 `.from('clientes_sessoes')`, 2 `.from('clientes_transacoes')`.
- `useWorkflowData.ts` (310), `useUnifiedWorkflowData.ts` (210, suspeita de morto), `useWorkflowCacheInit.ts` (133).
- `useWorkflowMetrics.ts` (124), `useWorkflowMetricsByYear.ts` (139, canal próprio), `useWorkflowMetricsRealtime.ts` (97, canal próprio).
- `useWorkflowPackageData.ts` (157), `useWorkflowStatus.ts` (43), `useWorkflow.ts` (18).
- `useAppointmentWorkflowSync.ts` (302), `useAppointmentWorkflowInfo.ts` (183).

### Services
- `services/WorkflowSupabaseService.ts` — **720 linhas**, ~10 pontos `clientes_sessoes`.
- `services/WorkflowCacheManager.ts` — **762 linhas**, segundo cache paralelo ao Context.
- `services/AgendaWorkflowIntegrationService.ts` — 347 linhas.

### Utils
- `utils/workflowNormalization.ts` (91), `utils/workflowSessionsAdapter.ts` (161), `utils/workflowCacheManager.ts` (334 — terceiro "cacheManager"), migrators.

### Components (~7,4k linhas)
- Tabela: `WorkflowTable.tsx` (825), `WorkflowTableHeader.tsx` (8), `ColumnSettings.tsx` (104).
- Cards: `WorkflowCard.tsx` (85), `WorkflowCardCollapsed.tsx` (594), `WorkflowCardExpanded.tsx` (632), `WorkflowCardList.tsx` (84).
- Modais: `WorkflowDeleteConfirmModal.tsx` (184), `FlexibleDeleteModal.tsx` (120), `ReconcileExtrasModal.tsx` (160), `GerenciarProdutosModal.tsx` (479), `GalleryUpgradeModal.tsx` (62), `WorkflowPaymentsModal.tsx` (28).
- Form: `QuickSessionAdd.tsx` (776), `WorkflowPackageCombobox.tsx` (180), `PackageCombobox.tsx` (96), `ProductCombobox.tsx` (130), `CategoryCombobox.tsx` (81).
- Filtros/painel: `WorkflowFilters.tsx` (234), `WorkflowTasksPanel.tsx` (292).
- Badges/aux: `StatusBadge`, `ColoredStatusBadge`, `FinancialStatusBadge`, `FotosExtrasPaymentBadge`, `RegrasCongeladasIndicator`, `DataFreezingStatus`, `AuditInfo`, `DebugPricingRules`, `AutoPhotoCalculator`, `SessionChangeLog`, `FinancialSummary`, `WorkflowSyncButton`.

### Domain types
- `src/types/workflow.ts` (93): `SessionData`, `SessionPayment`, `ProdutoWorkflow`, `CategoryOption`, `PackageOption`, `ProductOption`.
- `WorkflowSession` mora dentro de `useWorkflowRealtime.ts` (anti-pattern).

---

## 2. DIAGNÓSTICO

- **Mistura**: page faz fetch+cache+filtro+sort+RPC+UI; Context mistura cache+IDB+BC+realtime+fetch+normalização; useWorkflowRealtime junta 4 hooks em 1.
- **Três cache managers** com mesmo nome (`contexts/`, `services/`, `utils/`).
- **4 canais realtime** simultâneos (`workflow-realtime`, `workflow-sessions-*`, `workflow-metrics-year-*`, `workflow-metrics-*`).
- **Prop-drilling**: `WorkflowTable` 15+ props; opções viajam page→table→card→combobox.
- **Hot paths**: `filteredSessions` faz `removeAccents`+regex por keystroke; `sortedSessions` re-sorta com regex de moeda; `sessionsData = workflowSessions.map(convertSessionToData)` a cada `mergeUpdate`; 3 hooks de métricas recomputam.
- **Realtime eco**: optimistic + realtime sem `sequence`; fallback `window.addEventListener('workflow-session-updated')` é sintoma.
- **Tipos**: `WorkflowSession` em hook; `SessionData` em types; conversor obrigatório.
- **Side-effects escondidos**: `useEffect` de visibilidade chama `ensureMonthLoaded`; localStorage espalhado em 5 `useState`; `dispatchEvent` informal.
- **IA sem superfície**: `handleAddPayment` é `console.log`; `updateSession` privado do componente; regra `preserve/refund/remove` mora no modal.

---

## 3. ARQUITETURA-ALVO

```text
src/features/workflow/
  domain/    session, payment, money, pricing, filters, sort (zero React/Supabase)
  data/      sessionsRepo, transactionsRepo, appointmentsBridge, rpc (< 250 linhas cada)
  realtime/  useWorkflowRealtime único, multiplexado, com sequence anti-eco
  store/     workflowStore (Zustand) + indexers (byId, bySessionId, byMonth, byStatus,
             byCliente, byGaleria) + selectors memoizados + persistence (IDB + BC)
  actions/   defineCommand por mutação (Zod input/output, perms, side-effects, idem)
  queries/   defineQuery por leitura (números, nunca strings de moeda)
  hooks/     useWorkflowData / useWorkflowActions / useWorkflowNavigation /
             useWorkflowModals / useWorkflowColumns (binding React fino)
  components/ shell + header + views + modals + form/* + details/* (≤ 250 linhas)
  ai/        tools.ts (LLM) + context.ts (page snapshot) + permissions.ts
```

Regras: `domain/` sem React/Supabase; `data/` só Supabase; `store/` sem fetch; `actions/` única superfície de mutação; cada arquivo ≤ 250 linhas; sem `useEffect` de fetch fora de `realtime/` e `hooks/`.

---

## 4. CONTRATO PARA O AI ASSISTANT

### Actions
| Action | Descrição | Input | Output | Side-effects | Idempotência |
|---|---|---|---|---|---|
| `workflow.advanceStatus` | Move sessão no funil | `{sessionId, toStatus}` | `{from,to}` | db:clientes_sessoes, event | `adv:{id}:{to}` 10min |
| `workflow.updateFields` | Atualiza campos (sanitizado) | `{sessionId, fields}` | `Session` | db, event | hash(fields) 10min |
| `workflow.addPayment` | Pagamento manual | `{sessionId, valor, data, forma, obs?}` | `{paymentId}` | db:clientes_transacoes, event | `pay:{id}:{hash}` 10min |
| `workflow.refundPayment` | Estorna | `{paymentId, motivo?}` | `{estornoId}` | db | `ref:{id}` 24h |
| `workflow.deleteSession` | Excluir/arquivar | `{sessionId, action:preserve|refund|remove}` | resumo RPC | rpc | `del:{id}:{act}` 1h |
| `workflow.createQuickSession` | Cria rápida | `{clienteId, data, hora, categoria, pacote?, valorBase?}` | `{sessionId}` | db | `quick:{cli}:{data}:{hora}` 10min |
| `workflow.reconcileFotosExtras` | Reconcilia | `{sessionId}` | `{antes,depois}` | db | `rec:{id}` 5min |
| `workflow.syncFromAgenda` | Espelha appointment | `{appointmentId}` | `{sessionId, reused}` | db | `sync:{app}` 10min |

### Queries
| Query | Params | Retorno | Cache |
|---|---|---|---|
| `workflow.listMonth` | `{year, month}` | `Session[]` | Store (mês) |
| `workflow.getById` | `{sessionId}` | `Session\|null` | Store first |
| `workflow.search` | `{q,year?,month?,status?,situacao?,categoria?,limit}` | `Session[]` | TTL 30s |
| `workflow.metricsForMonth` | `{year,month}` | `{previsto,recebido,restante,sessoes}` (number) | derivada |
| `workflow.pendingPayments` | `{rangeDays?:30}` | `{sessionId,cliente,restante,vencimento?}[]` | derivada |
| `workflow.sessionTimeline` | `{sessionId}` | `Event[]` | TTL 60s |
| `workflow.statusOptions` | — | `{value,label,color}[]` | estática |

### Page snapshot
```
{ route:'/workflow', currentMonth:{year,month},
  filters:{search,categoria,situacao,sortField,sortDirection},
  selection:{sessionId|null}, visibleSessionIds:[],
  counts:{total,pagas,pendentes,restanteTotalCentavos},
  permissions:{canWrite,canDelete,canRefund,hasGalleryIntegration},
  capabilities:[...], userTz:'America/Sao_Paulo' }
```

### Erro padrão
`{ code:'VALIDATION'|'FORBIDDEN'|'NOT_FOUND'|'CONFLICT'|'RATE_LIMITED'|'PROVIDER_DOWN'|'INTERNAL', message, retriable, userMessage }`

---

## 5. PERFORMANCE & REALTIME

- Indexers em store: `byId`, `bySessionId`, `byMonth`, `byCliente`, `byGaleria`, `byStatus`, `byPaymentStatus`.
- Patch local + `lastSeq` por id (anti-eco); reconciliação full só em refresh manual, perda > 5s, ou gap de seq.
- **1 canal único** `workflow:user:{userId}` ouvindo `clientes_sessoes`, `clientes_transacoes`, `cobrancas` filtrados por `user_id`.
- `listMonth` é unidade de paginação; preload 3 meses (atual + anterior + próximo). Histórico > 12 meses só sob demanda.
- Tabela virtualizada (`@tanstack/react-virtual`) se > 80 linhas.

---

## 6. MIGRAÇÃO EM ONDAS

### Onda 1 — Domain + Indexers
- Criar `features/workflow/domain/{session,payment,money,pricing,filters,sort}.ts`.
- Mover `WorkflowSession` de `useWorkflowRealtime` → `domain/session.ts`.
- Criar `store/workflowStore.ts` (Zustand) com indexers byId/byMonth.
- Shim: `useWorkflowRealtime` re-exporta `WorkflowSession`.
- Smoke: `tsgo` limpo; página continua igual.

### Onda 2 — Data layer
- `data/sessionsRepo.ts`, `transactionsRepo.ts`, `rpc.ts` (< 250 cada, único ponto Supabase por tabela).
- Context.fetchAndCacheMonth → `sessionsRepo.listByMonth`.
- Shim: `WorkflowSupabaseService` e `services/WorkflowCacheManager` viram fachadas finas.
- Smoke: contagem de sessões pré/pós idêntica.

### Onda 3 — Realtime unificado
- `realtime/useWorkflowRealtime.ts` v2: 1 canal + fan-out com `lastSeq`.
- Apagar `workflow-realtime` (Context), `workflow-metrics-${year}-${month}`, `workflow-metrics-year-${year}`.
- Remover `window.addEventListener('workflow-session-updated')`.
- Flag `VITE_WORKFLOW_REALTIME_V2` para fallback.

### Onda 4 — Actions + Queries
- Implementar §4 com `defineCommand`/`defineQuery`, registrar em `capabilityRegistry`.
- Migrar `Workflow.tsx`: `updateSession`→`workflow.updateFields`, delete→`workflow.deleteSession`, `handleStatusChange`→`workflow.advanceStatus`, `handleAddPayment`→`workflow.addPayment` (era `console.log`).

### Onda 5 — Components + Hooks finos
- `Workflow.tsx` < 150 linhas (`<WorkflowShell>`).
- `WorkflowTable` 825 → `TableView` + `TableRow` (< 250 cada).
- `WorkflowCardCollapsed/Expanded` (594+632) → `components/details/*`.
- `QuickSessionAdd` 776 → `form/QuickAdd/{Header,DateTime,ClientPicker,PackagePicker,Products,Totals,Footer}`.
- `GerenciarProdutosModal` 479 → `modals/Produtos/{List,Editor,Totals}`.
- Glassmorphism, z-index, sem toast de sucesso, R2 — mantidos.

### Onda 6 — AI surface + cleanup
- `ai/tools.ts`, `ai/context.ts`, `ai/permissions.ts`.
- Remover shims das Ondas 2/3: `WorkflowSupabaseService`, `services/WorkflowCacheManager`, `utils/workflowCacheManager`, `useUnifiedWorkflowData`, `useWorkflowData` (se morto), `useWorkflowMetricsByYear`, `useWorkflowMetricsRealtime`.

---

## 7. MÉTRICAS DE SUCESSO

| Métrica | Hoje | Alvo |
|---|---|---|
| `Workflow.tsx` | 1.195 | < 150 |
| `WorkflowCacheContext.tsx` | 665 | 0 (extinto) |
| `useWorkflowRealtime.ts` | 1.181 | < 250 |
| Maior componente | `WorkflowTable` 825 | < 250 |
| Maior modal | `QuickSessionAdd` 776 | < 250 cada arquivo |
| Canais realtime workflow | 4 | **1** |
| `from('clientes_sessoes')` em workflow | 22 | ≤ 3 (todas em `sessionsRepo`) |
| Cache managers paralelos | 3 | 1 (`store/persistence`) |
| Refetch após mutate erro | full reload | 0 (patch + seq) |
| Re-renders por update | todas as linhas | só `id` mudado |
| Conversão `SessionData` por keystroke | sim | 0 (filtros sobre `Session`) |
| Actions IA tipadas | 0 | 8 actions + 7 queries |

---

## 8. RISCOS E ROLLBACK

| Onda | Risco | Detecção | Rollback |
|---|---|---|---|
| 1 | Re-export quebra consumidor | `tsgo` CI | Revert PR único |
| 2 | Repo diverge do fetch (filtro `neq historico`, JOIN clientes) | Contagem pré/pós | Flag `VITE_WORKFLOW_USE_REPO`, fallback Service |
| 3 | Perda de evento → UI parada | Telemetria gap; polling 30s em dev | Flag `VITE_WORKFLOW_REALTIME_V2=false`, canal antigo paralelo |
| 3 | Eco volta | React Profiler + `lastSeq` | Desligar flag |
| 4 | Idempotência bloqueia mutation | Log de hits | Reduzir TTL / key mais específica |
| 4 | RPC muda payload | Zod no output | try/catch para caminho legado |
| 5 | Quebra visual mobile | Playwright 3 viewports | `components/_legacy/` por 1 release |
| 5 | localStorage de colunas perdido (nova key) | Migração one-shot | Ler ambas as keys por 30 dias |
| 6 | IA executa mutação indesejada | perms + audit + Zod | Desligar `ai/tools.ts` |
| 6 | Remoção de shim quebra import distante | Grep CI bloqueia | Reintroduzir shim 1 release |

Restrições respeitadas: pt-BR; sem toast de sucesso; glassmorphism; z-index; R2; RLS; capabilities tipadas; eventos via `src/modules/workflow/`.
