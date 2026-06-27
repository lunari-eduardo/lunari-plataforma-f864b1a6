# Lunari — Arquitetura Definitiva

> Documento vivo. É a **lei** para todos os módulos novos e para a migração dos existentes.
> Padrão: **Hexagonal (Ports & Adapters) + CQRS leve + Capability Manifest**.

---

## 1. Princípios

1. **Uma única superfície de regra de negócio.** UI, Assistente IA, Edge Functions, API pública futura, mobile e automações consomem a **mesma** capability. Nunca duplicar lógica.
2. **Domínio puro.** `domain/` não importa React, Supabase, fetch, Date.now() direto, nem qualquer I/O. Só TS + Zod + funções puras.
3. **I/O isolado atrás de Ports.** Toda dependência externa (DB, storage, clock, auth, notifier, payments) entra via interface declarada em `ports/`.
4. **CQRS leve.** Commands (mutações) e Queries (leituras) são unidades diferentes, com cache, permissões e auditoria distintas.
5. **Capability Manifest.** Todo use case é declarado por `defineCommand` / `defineQuery` e registrado num manifesto machine-readable. É a fonte única que alimenta UI hooks, tool router da IA, gerador OpenAPI e doc do módulo.
6. **Server-side autoritativo.** Mutações sensíveis (financeiro, exclusão, cobrança, envios, ações da IA) **sempre** executam em Edge Function, mesmo quando a UI também chama localmente.
7. **Eventos de domínio.** Integração entre módulos é por Event Bus tipado, nunca por `useEffect` cruzado.
8. **Docs vivem com o código.** Cada módulo tem `docs/MODULE.md` parcialmente gerado a partir do manifesto.

---

## 2. Camadas

```text
┌──────────────────────────────────────────────────────────────┐
│  Presentation     React UI · Mobile (futuro) · CLI           │
│  AI Transport     LLM tool router · voz · automações         │
│  External         REST/Webhook público · integrações         │
├──────────────────────────────────────────────────────────────┤   primary
│  Application      Use Cases (commands + queries)             │   adapters
│                   Policies · Events · Manifest               │
├──────────────────────────────────────────────────────────────┤
│  Domain           Entities · Value Objects · Invariantes     │ ◄ núcleo puro
│                   Domain Services (regra pura, sem I/O)      │
├──────────────────────────────────────────────────────────────┤
│  Ports            Interfaces (Repository, Clock, Notifier,   │
│                   EventBus, Auth, FileStorage, Payments…)    │
├──────────────────────────────────────────────────────────────┤
│  Infrastructure   Supabase repos · R2 · Asaas/MP · Realtime  │ secondary
│                   Cache · IndexedDB · Google Calendar        │ adapters
└──────────────────────────────────────────────────────────────┘
```

Regras de dependência (futuramente reforçadas por `eslint-plugin-boundaries`):

- `domain` → nada além de `domain`.
- `application` → `domain` + `ports` + `shared/capability` + `shared/event-bus`.
- `infrastructure` → implementa `ports`, pode importar `domain`.
- `presentation` → consome `application` via hooks; **nunca** importa `infrastructure`.
- `ai/` → consome o manifesto; nunca define regra.
- `server/` → importa `application` + `infrastructure` selecionada.

---

## 3. Layout único por módulo

```text
src/modules/<modulo>/
├─ domain/
│   ├─ entities/        Appointment.ts, Cliente.ts (branded types + invariantes)
│   ├─ value-objects/   Money.ts, DateRange.ts, Slot.ts
│   ├─ services/        funções puras (ex.: precoSessao.ts)
│   └─ errors.ts        DomainError discriminado
│
├─ application/
│   ├─ use-cases/
│   │   ├─ commands/   createAppointment.ts, rescheduleAppointment.ts ...
│   │   └─ queries/    listAppointmentsByRange.ts, findFreeSlots.ts ...
│   ├─ policies/        authorize.ts (RBAC + ownership)
│   ├─ events/          schemas + emitters
│   ├─ validators/      schemas Zod compartilhados (reutilizados pela UI)
│   └─ manifest.ts      registry das capabilities do módulo
│
├─ ports/               interfaces (AppointmentsRepo, Clock, Notifier, EventBus, …)
│
├─ infrastructure/
│   ├─ repos/           SupabaseAppointmentsRepo.ts
│   ├─ realtime/        useAgendaRealtime.ts (único, multiplexado)
│   ├─ adapters/        Asaas, MercadoPago, Google Calendar
│   └─ mappers/         row → domain
│
├─ presentation/
│   ├─ hooks/           useCapability(...), useAgendaData, useAgendaNavigation
│   ├─ store/           agendaViewStore.ts (Zustand — só view-state)
│   ├─ components/      shell · header · views · modals · form/* · details/*
│   └─ pages/           AgendaPage.tsx (orquestrador < 120 ln)
│
├─ ai/                  transporte, não regra
│   ├─ tools.ts         exporta manifesto no formato AI SDK
│   ├─ prompts.ts       prompts e few-shot oriundos de manifest.examples
│   └─ context.ts       page snapshot serializável (rota, filtros, seleção, perms)
│
├─ server/              executor remoto (Edge Functions Supabase)
│   └─ capability-handler.ts
│
├─ tests/
│   ├─ unit/            domain
│   ├─ use-case/        com ports mockados
│   ├─ integration/     repos reais
│   └─ e2e/             UI
│
├─ docs/
│   ├─ MODULE.md        ver MODULE_TEMPLATE.md
│   └─ CHANGELOG.md
│
└─ index.ts             API pública do módulo (somente o que pode ser importado de fora)
```

---

## 4. Contrato de capability

Toda capability é declarada com `defineCommand` / `defineQuery` (em `src/shared/capability/`):

```ts
export const rescheduleAppointment = defineCommand({
  id: "agenda.appointment.reschedule",
  title: "Remarcar agendamento",
  description: "Move um agendamento existente para uma nova data/hora.",
  input: z.object({
    appointmentId: z.string().uuid(),
    newDate: z.string().date(),
    newTime: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  output: z.object({ appointmentId: z.string(), date: z.string(), time: z.string() }),
  permissions: ["agenda:write"],
  sideEffects: ["db:appointments", "event:agenda.rescheduled"],
  needsApproval: ({ input, user }) => false,
  idempotencyKey: ({ appointmentId, newDate, newTime }) =>
    `resched:${appointmentId}:${newDate}T${newTime}`,
  audit: "always",
  costHint: "cheap",
  examples: [
    { nl: "Remarca a sessão da Ana p/ sexta 14h", input: { /* … */ }, output: { /* … */ } },
  ],
  handler: async (input, ctx) => {
    // usa ctx.ports.*, emite eventos via ctx.events, retorna output
  },
});
```

O wrapper cuida automaticamente de:

- validação Zod (input/output);
- autorização via `policies/authorize`;
- log em `audit_log` (quando `audit !== "never"`);
- emissão dos eventos declarados em `sideEffects`;
- idempotência (chave persistida em `system_cache`);
- conversão para tool do AI SDK, gerador OpenAPI, hook React tipado.

### Execução: local vs remoto

| Capability | Onde executa | Por quê |
|---|---|---|
| Query barata, dados no cache | cliente | latência |
| Query agregada/pesada | Edge Function | reuso + cache HTTP |
| Command sem risco (UI optimistic) | cliente + servidor (echo) | UX + autoridade |
| Command sensível (financeiro, exclusão, envio, cobrança) | **servidor obrigatório** | segurança/audit |
| Command iniciado pela IA | **sempre servidor** | usuário não vê input antes |

Cada use case exporta o **mesmo** `handler`. O transporte remoto é uma Edge Function genérica `lunari-capability/{id}` que importa o use case do módulo e o roda com a sessão do usuário.

---

## 5. Estado no cliente

- **TanStack Query** = cache de queries. Chave = `capabilityId + input`. Invalidação por evento de domínio.
- **Zustand** por módulo = **só view-state** (filtros, modais, navegação). Nunca dado de servidor.
- **Realtime** = invalidador do TanStack Query, não fonte primária. Multiplexar a inscrição por módulo, com `sequence` anti-eco.

---

## 6. Event Bus

`src/shared/event-bus/` expõe um bus tipado in-process. Eventos são discriminados (`agenda.rescheduled`, `financeiro.cobrancaPaga`, `workflow.etapaAvancada`). Catálogo central em `application/events/`. Adapter opcional Supabase Realtime / Postgres NOTIFY para distribuição cross-tab e cross-serviço.

Regra: capability **só pode emitir** eventos declarados em seu `sideEffects: ["event:*"]`.

---

## 7. Segurança transversal

- **Auth port** injetado: no servidor lê JWT; no cliente lê `AuthContext`.
- **RLS** continua sendo a defesa final. Capabilities não substituem RLS.
- **Audit**: tabela `audit_log` existente recebe registro de toda capability `audit:"always"`.
- **Idempotência**: chave em `system_cache` (TTL 24h).
- **Permissões**: declaradas na capability; `policies/authorize` decide; UI esconde botão se `user` não tem.
- **Rate-limit/cost**: capability declara `costHint`; IA respeita orçamento por sessão.

---

## 8. Adoção (ondas)

1. **Fundação** (este PR) — `src/shared/capability`, `event-bus`, `result`, `ports`, docs, gerador.
2. Agenda (piloto).
3. Tarefas.
4. CRM (Clientes/Leads).
5. Workflow (passa a consumir eventos da Agenda).
6. Financeiro.
7. Galeria.
8. Precificação / Configurações.
9. Relatórios / Análise de Vendas.
10. Suporte (já modular — adapta).
11. Admin.
12. AI Assistant (liga tool router no manifest agregado).

Critério de "pronto" por módulo: lint de boundaries verde · `MODULE.md` gerado · ≥ 80% das capabilities cobertas por teste · shims antigos marcados `@deprecated`.

---

## 9. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Migração big-bang quebra produção | adoção módulo a módulo, com shims em `contexts/`, `services/`, `hooks/` reexportando do novo módulo |
| Use case isomórfico depende de lib incompatível no edge | `domain/` e `application/` ESM puros, sem React/DOM; CI roda build do edge a cada PR |
| Manifest divergir do código | `defineCommand` é a única forma de criar capability; lint proíbe handlers soltos; doc gerada do código |
| IA chamando comando destrutivo | `needsApproval` + Human-in-the-loop + audit obrigatório |
| Performance | TanStack Query + indexers em store; Edge Function com cache HTTP; `costHint` por capability |
| Curva de aprendizado | `bun run gen:module <nome>` cria scaffold completo |

---

## 10. Convenções de nome

- IDs de capability: `<modulo>.<entidade>.<verbo>` → `agenda.appointment.reschedule`.
- IDs de evento: `<modulo>.<verboPassado>` → `agenda.rescheduled`.
- Tabelas de domínio referenciadas em `docs/MODULE.md` (seção Entidades).
- Erros: `errors.ts` exporta union discriminada `DomainError = { code: "AGD_CONFLICT"; … } | …`.

---

## 11. O que NÃO fazer

- Não importar `@/integrations/supabase/client` fora de `infrastructure/`.
- Não declarar regra de negócio dentro de hook ou componente.
- Não criar `XxxService` novo na pasta `src/services/` (legado).
- Não criar `XxxContext` novo para dado de servidor.
- Não fazer integração entre módulos via import direto de hooks — usar evento.
- Não escrever capability sem `defineCommand`/`defineQuery`.
- Não expor handler de capability fora do `index.ts` do módulo.
