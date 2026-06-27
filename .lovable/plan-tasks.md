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
- [ ] Onda 1 — domain + store + selectors (em andamento).
- [ ] Ondas 3–7.
