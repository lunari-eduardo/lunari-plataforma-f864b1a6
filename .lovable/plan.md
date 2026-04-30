## Objetivo

Ordenar as sessões do Workflow por **data + horário** (ao invés de só data), espelhando a ordem visual da Agenda. Sessões do mesmo dia passam a aparecer na ordem cronológica do horário agendado (08:00 antes de 14:00 etc.), exatamente como na tela de Agenda — Dia.

## Mudanças

### 1. `src/pages/Workflow.tsx` — Ordenação padrão (sem sortField)

No `useMemo` de `sortedSessions` (linhas ~733–742), o branch padrão hoje compara só `parseDateFromStorage(a.data)`. Vou compor a chave de ordenação com `data + hora`:

- Para cada sessão, montar um timestamp combinado: timestamp da data + minutos de `session.hora` (formato `HH:mm`).
- Sessões sem `hora` recebem fallback `00:00` para irem ao topo do dia (mesmo comportamento da Agenda quando não há horário).
- Mantém ordem **decrescente por dia** (mais recentes primeiro), mas **crescente por horário dentro do mesmo dia** (08:00 → 18:00), igual à Agenda.

### 2. `src/pages/Workflow.tsx` — Ordenação manual por coluna "Data"

No `getSortValue` (linhas ~702–706), quando `headerKey === 'date'`, somar os minutos de `session.hora` ao timestamp da data. Assim, ao clicar em "Data ↑/↓" no header, o desempate dentro do mesmo dia continua sendo o horário (asc preserva 08:00 antes de 14:00; desc inverte).

### 3. Helper de parsing

Criar um pequeno utilitário inline (ou em `src/utils/dateUtils.ts`) `parseHoraToMinutes(hora: string): number` que aceita `"HH:mm"` ou `"HH:mm:ss"` e retorna minutos desde meia-noite, com fallback `0` para valores inválidos/vazios.

## Critérios de aceite

- No Workflow, abrindo o mês, sessões do mesmo dia aparecem na ordem 08:00 → 18:00 (igual ao print da Agenda enviado).
- Dias diferentes continuam ordenados do mais recente para o mais antigo por padrão.
- Clicar em "Data" no header ordena por data + hora (asc/desc) sem quebrar.
- Sessões sem horário definido aparecem no topo do dia respectivo.
- Não há mudança em filtros, integração com Galeria, cache, ou realtime.

## Fora de escopo

- Não altera ordenação de outros sortFields (nome, status, categoria, valores).
- Não toca em `WorkflowCacheManager` nem em queries do Supabase (a ordenação fina por hora é feita no cliente, onde a `hora` já está disponível).