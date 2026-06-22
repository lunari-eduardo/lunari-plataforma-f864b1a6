---
module: agenda
status: pilot
owner: core
since: 2026-06-22
capabilities:
  queries:
    - agenda.appointments.list
    - agenda.appointments.get
    - agenda.availability.list
    - agenda.availability.findNext
    - agenda.slot.check
  commands:
    - agenda.appointments.create
    - agenda.appointments.confirm
    - agenda.appointments.reschedule
    - agenda.appointments.cancel
    - agenda.availability.add
    - agenda.availability.clearDate
    - agenda.availability.deleteSlot
events:
  emitted:
    - agenda.appointment.created
    - agenda.appointment.confirmed
    - agenda.appointment.rescheduled
    - agenda.appointment.cancelled
    - agenda.availability.changed
  consumed: []
tables:
  - appointments
  - availability_slots
  - availability_types
  - agenda_settings
integrations:
  - workflow (via DB trigger no INSERT/UPDATE de appointments)
  - financial (via DB trigger ao cancelar com action=refund)
---

# Módulo Agenda

## Propósito
Gerencia agendamentos do fotógrafo, slots de disponibilidade publicáveis e
configurações de horário de trabalho. É o "calendário" do Lunari e a porta de
entrada para sessões que viram itens de workflow.

## Glossário
- **Appointment**: agendamento de uma sessão (confirmado ou pendente).
- **AvailabilitySlot**: horário publicado como disponível para o cliente reservar.
- **AvailabilityType**: categoria visual de slot (ex: "Ensaio externo", cor).
- **Slot**: par `(date yyyy-MM-dd, time HH:mm)`. Resolução mínima do calendário.
- **Sessão de workflow**: derivada de um appointment confirmado, criada por trigger.

## Fluxo principal — criar agendamento confirmado
1. UI chama `createAppointment.execute({...})`.
2. Capability valida schema, autoriza (`agenda:write`), persiste via repo.
3. Trigger no banco cria a sessão correspondente em `workflow_sessions`.
4. Capability emite `agenda.appointment.created`.
5. Listener de `workflow` (futuro) reage para hidratar caches.

## Fluxos alternativos
- **Criar como "a confirmar"**: mesmo fluxo, sem ocupação de slot nem workflow.
- **Confirmar depois**: `confirmAppointment` → emite `agenda.appointment.confirmed`.
- **Reagendar**: `rescheduleAppointment` → idempotente, emite `agenda.appointment.rescheduled`.
- **Cancelar com estorno**: `cancelAppointment({ action: "refund" })` aciona trigger
  financeiro que cria transação espelho (regra de Refunds/Estorno Integrity).

## Restrições / regras de negócio
- Datas são sempre ISO `yyyy-MM-dd` na timezone local do usuário. A conversão
  para `Date` JS só acontece no adapter de infraestrutura.
- `status` financeiro NUNCA é escrito daqui — é gerado por trigger.
- Reagendamento idempotente: chamadas repetidas com mesmos `(id, date, time)`
  são no-op silencioso.
- Operações de escrita são serializadas por `idempotencyKey` no executor.
- Slots ocupados por agendamento `confirmado` não podem receber outro confirmado
  (a regra é aplicada pela query `findNextAvailableSlot` + UI; no banco há trigger).

## Casos de erro (códigos)
- `AGENDA.APPOINTMENT_NOT_FOUND` — id inexistente.
- `AGENDA.SLOT_CONFLICT` — slot ocupado.
- `AGENDA.NO_SLOT_AVAILABLE` — busca não encontrou slot no horizonte.
- `AGENDA.INVALID_DATE_RANGE` — `start > end`.
- `AGENDA.REPOSITORY_FAILURE` — falha de infra (rede, Supabase).

## Arquitetura
```
src/modules/agenda/
├── domain/            ← puro (zod, lógica de conflito, ports, eventos)
├── application/
│   ├── queries/       ← reads (listAppointmentsByRange, findNextAvailableSlot…)
│   └── commands/      ← writes (createAppointment, rescheduleAppointment…)
├── infrastructure/    ← repos Supabase + DI container
├── index.ts           ← API pública do módulo
└── MODULE.md          ← este arquivo
```

A camada `presentation/` (hooks React + componentes) será introduzida na Onda 3,
substituindo gradualmente o `AgendaContext` legado sem quebrar a UI atual.

## Como o AI Assistant usa este módulo
Cada capability é registrada no `capabilityRegistry` (shared/capability) com
descrição em PT-BR, schema Zod e exemplos. O bridge AI converte para
tool-calling format via `capabilityToAITool`. Permissões são validadas
automaticamente pelo executor — o LLM nunca precisa "saber" de RLS.

## Migração / compatibilidade
- Adapter `SupabaseAppointmentsRepository` delega para o legado
  `SupabaseAgendaAdapter`, então triggers, gallery sync e workflow creation
  continuam idênticos.
- `AgendaContext`, `useAgenda`, `useAppointments` permanecem funcionando até
  a Onda 3 migrar a UI para hooks deste módulo.

---

## Onda 3 — Camada de apresentação (React)

A camada `presentation/` expõe hooks finos que conversam com as capabilities
via TanStack Query. Toda página/componente novo **deve** consumir esses hooks
em vez de chamar Supabase direto.

### Setup global (já feito em `src/App.tsx`)

```tsx
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <CapabilityRuntimeProvider>      {/* mapeia user → AuthUser */}
      <AgendaInvalidationBridge />   {/* eventBus → invalidate queries */}
      {/* resto da app */}
    </CapabilityRuntimeProvider>
  </AuthProvider>
</QueryClientProvider>
```

### Hooks disponíveis

Queries:
- `useAppointmentsRangeQuery({ start, end })`
- `useAppointmentByIdQuery(id)`
- `useAvailabilityQuery({ start, end })`
- `useNextFreeSlotQuery(input)`

Mutations:
- `useCreateAppointmentMutation()`
- `useConfirmAppointmentMutation()`
- `useRescheduleAppointmentMutation()`
- `useCancelAppointmentMutation()`
- `useAddAvailabilityMutation()`
- `useClearAvailabilityMutation()`

### Exemplo

```tsx
import {
  useAppointmentsRangeQuery,
  useCreateAppointmentMutation,
} from "@/modules/agenda";

function MinhaAgenda() {
  const { data: appointments = [], isLoading } =
    useAppointmentsRangeQuery({ start: "2026-07-01", end: "2026-07-31" });

  const create = useCreateAppointmentMutation({
    onError: (e) => console.error(e.domain.code, e.domain.message),
  });

  // ...
}
```

### Query keys

`agendaKeys` é o ÚNICO local que define as chaves de cache. Sempre invalide
através dele — nunca strings literais — para manter consistência com o
`AgendaInvalidationBridge`.

### Migração incremental

Os hooks legados (`useAgenda`, `useAppointments`, `useAvailability`,
`AgendaContext`) continuam funcionando. A migração será feita componente a
componente nas próximas ondas. Não há quebra de contrato nesta onda.

### Onda 5 (em andamento) — eventos unificados por range

Novo hook `useUnifiedEventsRangeQuery({ start, end })` em
`@/modules/agenda` produz o array `UnifiedEvent[]` consumido pelas views
(`DailyView`, `WeeklyView`, `MonthlyView`, `AnnualView`,
`MiniMonthCalendar`, `AgendaSidebar`) sem depender de `AgendaContext`.
Mantém o mesmo shape público (`unifiedEvents`, `getEventsForDate`,
`getEventForSlot`) do legado `useUnifiedCalendar`, mas exige um intervalo
explícito — alinhado ao contrato `yyyy-MM-dd` do domínio e ao cache
particionado por range do TanStack Query.

Concluído na Onda 5 (passo 3): todos os componentes da Agenda
(`DailyView`, `WeeklyView`, `MonthlyView`, `AnnualView`,
`MiniMonthCalendar`, `AgendaSidebar`, `UnifiedEventCard`,
`DayPreviewPopover`, `DayRevenueKPI`) e utilitários
(`agendaRevenueCalc`, `useAgendaOptimizations`) passaram a importar o
tipo `UnifiedEvent` de `@/modules/agenda/presentation`.

Concluído na Onda 5 (passo 4): o hook legado `useUnifiedCalendar` foi
**removido** do projeto. `useTodayOverview` já consome
`useAppointmentsRangeQuery` diretamente e nenhum outro arquivo
importava o hook. O tipo `UnifiedEvent` agora vive exclusivamente em
`@/modules/agenda/presentation/unifiedEvents.ts`.

### Onda 6 (em andamento) — descomissionar `useAgenda`

Passo 1 concluído: tipos de UI (`Appointment`, `AppointmentStatus`,
`ProdutoIncluido`) foram movidos para
`@/modules/agenda/presentation/types.ts` e re-exportados pelo barrel.
O shim `@/hooks/useAgenda` agora apenas re-exporta esses tipos por
compatibilidade. Todos os imports type-only em adapters, services,
contexts, utils e componentes passaram a apontar para
`@/modules/agenda/presentation`. Restam ~6 consumidores do hook
`useAgenda` em si (mutations/escritas), que serão migrados para as
mutations do módulo nos próximos passos.



Passo 2 concluído (Onda 6): os consumidores de leitura de
`useAgenda().appointments` foram migrados para
`useAppointmentsRangeQuery` do módulo:
- `useAutomationEngine` agora consome uma janela de hoje +120 dias
  (suficiente para as regras D-2 / D-1 / alerta de 72h).
- `AvailabilityConfigModal` consome janela ampla (-60 / +180 dias)
  para preservar slots com sessões ao limpar disponibilidade.
- `DataLayer.ts` tinha import órfão de `useAgenda`, removido.

Passo 3 concluído (Onda 6): introduzido
`useLegacyAgendaMutations` em
`@/modules/agenda/presentation/legacyMutations.ts`. Esse adaptador
transitório expõe a API legada (`addAppointment`,
`updateAppointment`, `deleteAppointment`, `loadMonthData`) a partir
do módulo, isolando consumidores (`Agenda.tsx`,
`LeadSchedulingModal`, `SchedulingConfirmationModal`) do hook
`@/hooks/useAgenda`. Internamente ainda delega ao `useAppointments`
(AgendaContext); a migração para `useCreate/Reschedule/Cancel…Mutation`
baseadas em capabilities fica para a Onda 7.

Passo 4 concluído (Onda 6): `src/hooks/useAgenda.ts` foi
**removido**. Os últimos imports type-only restantes
(`useConflictResolution`, `useIntegration`, `useSlotAvailabilityCheck`,
`useAgendaConflict`) passaram a importar `Appointment` /
`AppointmentStatus` de `@/modules/agenda/presentation`.

### Onda 7 — descomissionar contexto e realtime legados

**Passos 7a + 7b concluídos:**
- Nova capability `agenda.availability.deleteSlot` + mutation
  `useDeleteAvailabilitySlotMutation` no módulo.
- `src/hooks/useAvailability.ts` refatorado para shim:
  - `availability` agora vem de `useAvailabilityQuery` (cache TanStack).
  - `addAvailabilitySlots`, `clearAvailabilityForDate` e
    `deleteAvailabilitySlot` chamam as mutations do módulo
    (invalidação via `AgendaInvalidationBridge`).
  - `availabilityTypes` + CRUD de tipos seguem em `AgendaContext`
    até a modularização dos tipos.
- API pública do hook preservada: nenhum call site precisou mudar.

**Passo 7c concluído:**
- Novo `src/modules/agenda/infrastructure/realtime.ts` assina canais
  Supabase para `appointments` e `availability_slots` filtrados por
  `user_id` e publica eventos do domínio (`agenda.appointment.*`,
  `agenda.availability.changed`) no `eventBus`.
- `AgendaRealtimeListener` (presentation) monta o subscribe junto ao
  `AgendaInvalidationBridge` em `App.tsx`, ativando invalidação
  TanStack automática em todas as abas/sessões do mesmo usuário.
- `src/hooks/useAgendaRealtime.tsx` (órfão) removido.
- Canais legados em `AgendaContext` permanecem coexistindo até o 7d
  remover o contexto — não há conflito porque cada canal usa nome
  único por `channelId`.

**Passo 7d1 concluído:**
- Nova capability `agenda.appointments.update` (genérica, patch parcial)
  + `useUpdateAppointmentMutation`.
- Novo hook composto `useAppointmentMutations` em
  `presentation/appointmentMutations.ts`: expõe `addAppointment` /
  `updateAppointment` / `deleteAppointment` aceitando `Date` (normaliza
  para ISO antes de chamar as mutations), substituindo o adaptador
  transitório `useLegacyAgendaMutations` (arquivo removido).
- `Agenda.tsx`, `LeadSchedulingModal` e `SchedulingConfirmationModal`
  migrados para o novo hook. O `useEffect` de `loadMonthData` em
  `Agenda.tsx` foi removido — o range já inclui buffer e o TanStack
  cuida do cache por chave.
- Novo evento `agenda.appointment.updated` cobre invalidações
  cross-tab via `AgendaInvalidationBridge`.

**Passo 7d2 concluído:**
- `useIntegration` reescrito: lê appointments via
  `useAppointmentsRangeQuery` (janela -6/+12 meses) e usa
  `useAppointmentMutations` para criar/atualizar/remover.
- `src/hooks/useAppointments.ts` **removido**. Não há mais consumidores do
  `AgendaContext.appointments` fora do próprio contexto.

**Passo 7d3 concluído:**
- Criado `src/hooks/useAvailabilityTypes.ts` standalone (TanStack +
  `AgendaService`) com cache via `agendaKeys.availabilityTypes()`.
- `src/hooks/useAgendaSettings.ts` reescrito standalone (TanStack +
  `AgendaService`), cache via `agendaKeys.settings()`. API
  (`setDefaultView`, `setWorkingHours`, etc.) preservada.
- `src/hooks/useAvailability.ts` não depende mais de `AgendaContext`:
  agrega `useAvailabilityQuery` + `useAvailabilityTypes`.
- `AgendaProvider` removido de `PhotographerApp.tsx`.
- `src/contexts/AgendaContext.tsx` **deletado**. Realtime já é
  coberto por `AgendaRealtimeListener` (7c) e invalidações por
  `AgendaInvalidationBridge` + eventos do módulo.

**Passo 7e1 concluído:**
- Criado `domain/ports.availabilityTypes.ts` + `infrastructure/availabilityTypes.supabase.ts`
  (mantém storage em `localStorage` enquanto não há tabela dedicada).
- `infrastructure/availability.supabase.ts` reescrito: fala direto com Supabase
  (loadSlots/addMany/clearForDate/delete), sem delegar para `SupabaseAgendaAdapter`.
- `container.ts` expõe `availabilityTypes` como dep injetável e injeta no
  `SupabaseAvailabilityRepository` para resolução de cores/labels.
- `src/hooks/useAvailabilityTypes.ts` agora usa `getAgendaDeps().availabilityTypes`
  diretamente (não passa mais por `AgendaService`/legacy adapter).

**Passo 7e2 concluído:**
- Criado `domain/ports.settings.ts` + `infrastructure/settings.supabase.ts`
  (mantém storage em `localStorage` enquanto não há tabela dedicada).
- `container.ts` expõe `settings` como dep injetável.
- `src/hooks/useAgendaSettings.ts` agora usa `getAgendaDeps().settings`
  diretamente (não passa mais por `AgendaService`/legacy adapter).

**Passo 7e3 concluído:**
- `infrastructure/appointments.supabase.ts` reescrito sem `SupabaseAgendaAdapter`.
  Toda a lógica de side-effects foi portada:
  - Criação de sessão de workflow (`WorkflowSupabaseService.createSessionFromAppointment`)
    + patch redundante de categoria/pacote/valor_base_pacote em `setTimeout(1s)`
    + fallback de criação em `setTimeout(2s)` quando a 1ª tentativa retorna `null`.
  - Sync Google Calendar (`syncAppointmentToGoogleCalendar`) em create/update/delete,
    sempre tolerante a falhas.
  - `delete` mantém os 3 caminhos do legado: `remove` (RPC `delete_appointment_cascade`),
    `refund` (cria estornos + apaga sessão) e `preserve` (zera valores + marca como
    histórico, com resolução de sessão em duas etapas para evitar OR perigoso).
- Repository é puro Supabase: `getAgendaDeps().appointments` não toca mais no adapter legado.

**Pendente:**
- 7e4: deletar `SupabaseAgendaAdapter`/`AgendaStorageAdapter` e enxugar `AgendaService`.

Esses passos têm impacto direto em realtime/cache e devem ser
validados manualmente; serão tratados em rodadas separadas.


