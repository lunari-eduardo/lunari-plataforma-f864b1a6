# Módulo: Tasks

Status: **em construção** (Onda 1 de 7 — domain + store).

## 6 critérios PRODUCT_GUIDE

1. **Para quem é?** Fotógrafos e equipes que precisam organizar afazeres operacionais (manuais ou gerados por automações/IA) ao longo do fluxo Lead → Pós-venda.
2. **Qual problema resolve?** Centraliza tarefas, checklists, conteúdos e documentos com prazo e responsável, em Kanban/Lista, ligadas (opcionalmente) a Sessão, Cliente, Orçamento.
3. **Qual a jornada coberta?** Captura rápida → enriquecer (prazo, responsável, anexo) → mover entre colunas → concluir/reabrir → arquivar.
4. **Como mede sucesso?** Tempo médio para conclusão, taxa de atraso, % geradas por automação concluídas, throughput diário.
5. **Quais dependências?** `task_statuses`, `task_people`, `task_tags`, `task_attachments`, R2 (anexos), `eventBus` (cross-módulo), Lu (IA).
6. **Eventos emitidos/consumidos?** Emite `TaskCreated/Updated/Moved/Completed/Reopened/Deleted/Snoozed/Assigned/DueSoon/Overdue/TemplateApplied`. Consome `WorkflowSessionCreated`, `AgendaAppointmentCreated`.

## Capabilities (Onda 3)

A definir — ver `.lovable/plan-tasks.md`.

## Boundaries

- UI **nunca** chama `supabase.from('tasks')` direto — usa capabilities/hooks.
- Realtime único multiplexado em `infrastructure/realtime/tasksRealtimeChannel.ts`.
- Anexos via `attachmentsStorage` (R2).
