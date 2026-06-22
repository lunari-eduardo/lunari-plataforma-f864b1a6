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

Próximo passo: migrar `src/pages/Agenda.tsx` para calcular o range a
partir da view ativa (`day`/`week`/`month`/`year`) e consumir o novo
hook, removendo a dependência de `useUnifiedCalendar` legado.
