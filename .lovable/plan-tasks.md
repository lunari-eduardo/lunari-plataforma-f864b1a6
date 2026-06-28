# Plano — Página Tarefas (refatoração modular + IA)

> Fonte de verdade entre ondas. Referencia obrigatória: `docs/constitution/*`.
> Padrão alvo: `src/modules/tasks/` (mesmo molde de `src/features/workflow/`).

## Inventário (resumido)

- `src/pages/Tarefas.tsx` (312 linhas) — Kanban + Lista + DnD + filtros. Subcomponentes declarados dentro do render (`StatusColumn`, `ListView`) ⇒ violação `block-editor`.
- 29 componentes em `src/components/tarefas/` (6.817 linhas no total).
- **4 modais sobrepostos**: `QuickTaskModal` (298), `TaskFormModal` (378), `UnifiedTaskModal` (465), `TaskDetailsModal` (481).
- Hooks: `useSupabaseTasks` (232), `useSupabaseTaskStatuses` (266), `useSupabaseTaskTags`, `useSupabaseTaskPeople`, `useTaskTemplates` (259), `useTaskAttachments`, `useTaskCaptions`, `notifications/useTaskNotifications`.
- Consumidores externos: `Agenda.tsx`, `WorkflowTasksPanel.tsx`, `WorkflowTasksDock.tsx`, `useTodayOverview`, `HighPriorityDueSoonCard`, `useAutomationEngine`.

## Débitos técnicos

1. **6 canais realtime `tasks_changes` simultâneos** (um por chamada de `useSupabaseTasks`).
2. **Refetch full-table** em cada evento realtime; sem dedupe vs. optimistic update.
3. **`status === 'done'` hardcoded** no hook — quebra `task_statuses` configuráveis.
4. **Anexos em modelo duplo**: coluna `tasks.attachments` JSONB + tabela `task_attachments`.
5. **`as any` em cascata** nos pontos de mutação.
6. **3 modais de criação/edição** + 1 detalhe duplicando o mesmo formulário.
7. **Workflow toca CRUD direto** em `tasks` (sem capability).
8. **Sem capabilities/IA**: Lu não consegue operar tarefas via superfície tipada.
9. **Sem snapshot de página** para a Lu (filtros, seleção, contagens).
10. **Sem virtualização** Kanban/Lista.
11. **Filtros de data** ignoram timezone.

## Arquitetura alvo

```text
src/modules/tasks/
  MODULE.md
  domain/         types, events, rules (isDone, isOverdue, canTransition), selectors
  application/
    commands/     create, update, move, complete, reopen, delete, snooze, assign,
                  applyTemplate, checklist.*, attachment.*, caption.*, createFromAutomation
    queries/      list, getById, todayOverview, dueSoon, overdue, countsByStatus, timeline
    handlers/     onWorkflowSessionCreated, onAgendaAppointmentCreated
  ports/          tasksRepo, statusesRepo, templatesRepo, attachmentsStorage, notifications
  infrastructure/
    supabase/     repos
    realtime/     tasksRealtimeChannel (único) + bridge.tsx
    storage/      attachmentsR2
  presentation/
    store/        tasksStore (Zustand-like + indexadores)
    hooks/        useTasks, useTaskStatuses, useTaskFilters, useKanbanDnD
    components/   TasksPage, KanbanBoard/*, ListView/*, Cards/*, Modals/*, Sections/*
  ai/             permissions, context (snapshot v1), tools, prompts
  server/         (edge functions futuras)
  docs/           ARCHITECTURE, EVENTS
  tests/          rules, selectors, commands
```

## Capabilities (superfície IA + UI)

| Capability | Approval |
|---|---|
| `tasks.create` / `tasks.update` / `tasks.assign` / `tasks.snooze` | não |
| `tasks.move` / `tasks.complete` / `tasks.reopen` | não |
| `tasks.delete` | **sim** |
| `tasks.checklist.add` / `.toggle` / `.reorder` / `.remove` | não |
| `tasks.attachment.add` | não |
| `tasks.attachment.remove` | **sim** |
| `tasks.template.apply` | não |
| `tasks.template.delete` | **sim** |
| `tasks.bulkMove` (>10) | **sim** |
| `tasks.search` / `tasks.todayOverview` / `tasks.dueSoon` / `tasks.overdue` / `tasks.timeline` | n/a |

Snapshot `buildTasksPageSnapshot(v1)`: view, filtros, total/status, taskSelecionada, ids dos 20 cards visíveis, contagens por bucket de prazo.

## Ondas

- **Onda 0** — Sanidade & docs. Salva este plano. Linter Supabase. Documenta inventário.
- **Onda 1** — Domain + Store + Selectors (zero efeito visual). Indexers Map. `isDone(status, statuses)`.
- **Onda 2** — Ports + Repos Supabase + canal realtime único + shim em `useSupabaseTasks`.
- **Onda 3** — Commands + capabilities. Migra `Tarefas` e `Agenda` para chamar capabilities (UX igual).
- **Onda 4** — Unifica modais (`TaskFormModal` único + `TaskDetailsDrawer`). Quebra `Tarefas.tsx` em componentes fora do render.
- **Onda 5** — Anexos em R2 unificado (deprecar `task_attachments` ou consolidar; decisão: JSONB+R2 url).
- **Onda 6** — Surface IA da Lu (permissions, snapshot, tools registry, aprovação humana, auditoria).
- **Onda 7** — Limpeza, virtualização, notificações por eventBus, remoção do hook legado.

## Critérios de aceite

- [ ] 1 canal realtime para `tasks` (verificável no DevTools).
- [ ] Página principal <250 linhas; nenhum componente >300.
- [ ] Zero `as any` em `presentation/`.
- [ ] `rg "supabase\.from\('tasks'\)" src` somente em `modules/tasks/infrastructure/`.
- [ ] Lu opera todas as capabilities listadas com snapshot.
- [ ] Aprovação humana nas ações destrutivas.
- [ ] Status terminal customizável (`is_terminal`) sem quebrar `completed_at`.
- [ ] Anexos no R2.
- [ ] Sem toasts de sucesso em CRUD.
- [ ] Tests verdes em `domain/rules`, `selectors`, `commands`.

## Riscos & rollback

| Risco | Mitigação | Rollback |
|---|---|---|
| Quebrar criação via Agenda na Onda 4 | Switch atômico no PR | Reverter import |
| Realtime único deixar consumidor de fora | Shim do hook antigo até Onda 7 | Feature flag `VITE_TASKS_REALTIME_V2` |
| Perder anexos na reconciliação | Backfill dry-run + tabela backup | Restaurar do backup |
| `isDone` quebrar contas com status renomeado | Coluna `is_terminal` em `task_statuses` | Fallback para key `'done'` |
| IA executar bulkMove indevido | Approval >10 + auditoria + costHint | Revogar permission flag |

## Estado de execução

- [x] Onda 0 — plano salvo, inventário consolidado.
- [x] Onda 1 — domain + store + selectors.
- [x] Onda 2 — ports, repos Supabase e canal realtime único (bridge montada em App.tsx, backoff + visibilidade).
- [x] Onda 3 — capabilities (commands + queries) registradas; eventos no LunariEvents.
- [x] Onda 4a — Tarefas.tsx quebrada: `KanbanColumn`, `TasksListView`, `ChecklistPanel` lendo do `tasksStore`.
- [x] Onda 4b.1 — `TaskModal` (view+edit, multi `text_blocks`) e `TaskQuickModal` canônicos em `modules/tasks/presentation/components/`. `TaskFormModal` reexporta `TaskModal`.
- [x] Onda 4b.2 — Removidos órfãos: `UnifiedTaskModal`, `TemplateManagerModal`, `TemplateSelector`, `TaskTypeSelector` (root+forms), `TaskAttachmentsSection`, `TaskCaptionsSection`, `forms/TaskSimpleForm`, `forms/TaskChecklistForm`.
- [x] Extras — Undo stack (3), `useSupabaseTasks` virou facade, `REPLICA IDENTITY FULL`, anti-eco por `updated_at`, save otimista com fechamento antes do round-trip.

### Próximos passos

- [x] **Onda 4b.3** — Componentes ativos movidos para `modules/tasks/presentation/components/{cards,filters,kanban,forms}/`. Pasta `src/components/tarefas/` eliminada. Typecheck OK.
- [x] **Onda 4c** — Capabilities `tasks.tags.{create,update,delete,reorder}` e `tasks.people.{create,update,delete,reorder}` + queries `tasks.tags.list` e `tasks.people.list`. Repos Supabase isolados em `infrastructure/supabase/{tagsRepo,peopleRepo}.ts`, stores singleton (`tagsStore`, `peopleStore`) com canal realtime único e hooks `useSupabaseTaskTags`/`useSupabaseTaskPeople` convertidos em facades. Captions vivem no JSONB da tarefa (sem tabela) e Templates ainda em localStorage — fora do escopo dessa onda. Critério `rg 'from\("task_(tags|people)"\)' src` só em `modules/tasks/infrastructure/`. Typecheck OK.
- [x] **Onda 4d** — `isTerminalKey` (helper no `taskStatusesStore` + retorno do hook `useSupabaseTaskStatuses`). Consumidores migrados: `useSupabaseTasks` (completed_at), `WorkflowTasksPanel`, `AgendaTasksSection`, `useTaskNotifications` (query dinâmica via `task_statuses.is_done`). `ManageTaskStatusesModal` já oferece toggle "Concluído" por status. Typecheck OK.
- [ ] **Onda 5** — Anexos no R2: novo `attachmentsR2.ts` + capabilities `tasks.attachment.add/remove` via edge functions `r2-upload/r2-signed-url/r2-delete`. Backfill dry-run de `task_attachments` → JSONB. `DROP TABLE task_attachments` em migração separada após validação.
- [x] **Onda 6** — IA da Lu: `src/modules/tasks/ai/` (permissions, `buildTasksPageSnapshot(v1)`, tools registry derivado do capabilityRegistry com `needsApproval` + permissions). Pronto para o adaptador da Lu plugar.
- [x] **Onda 7** — Cleanup: `useSupabaseTasks` marcado `@deprecated` (facade pura, sem canal próprio); `useTaskNotifications` reage instantaneamente aos eventos `tasks.*` no eventBus (polling 5min mantido como fallback); linter Supabase rodado (issues pré-existentes, fora do escopo de tarefas). Virtualização Kanban com dnd-kit avaliada e adiada — risco de quebrar sortable não justificado para volumes atuais; reabrir se uma coluna passar de 100 cards.

### Pausas para teste manual

| Após | O que testar |
|---|---|
| 4b.3 | Criar/editar/excluir via Tarefas, Agenda, Workflow; DnD; Undo; filtros |
| 4c | CRUD de tags/pessoas/legendas/templates; aplicar template |
| 4d | Renomear status terminal; concluir/reabrir; métricas |
| 5 | Upload, preview, delete, backfill conferido |
| 6 | Lu executa cada tool; aprovações disparam; auditoria gravada |
