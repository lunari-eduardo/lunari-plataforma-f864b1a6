

# Fix: Agendamentos não carregam ao navegar para meses fora da janela inicial

## Causa Raiz

A função `loadMonthData` existe no `AgendaContext` mas **nunca é chamada** por nenhum componente. O carregamento inicial busca apenas o mês atual ±1 (fev-abr para março). Ao navegar para maio, janeiro, etc., nenhuma requisição é feita.

## Solução

Adicionar um `useEffect` na página `Agenda.tsx` que observa mudanças na `date` de navegação e chama `loadMonthData` automaticamente para o mês visível. Isso garante que ao navegar para qualquer mês, os dados são carregados sob demanda (com cache para não recarregar meses já buscados).

## Alterações

### `src/pages/Agenda.tsx`
- Importar `loadMonthData` do hook `useAgenda` (via `useAppointments` ou diretamente do contexto)
- Adicionar `useEffect` que reage a `date` e `view`:
  - Extrai `year` e `month` da data atual
  - Chama `loadMonthData(year, month)`
  - Para view `week`, carrega também o mês adjacente (semana pode cruzar meses)
  - Para view `year`, carrega os 12 meses do ano visível

### `src/hooks/useAppointments.ts`
- Expor `loadMonthData` do contexto neste hook para que fique acessível via `useAgenda()`

### `src/hooks/useAgenda.ts`
- Propagar `loadMonthData` do `useAppointments`

Nenhuma lógica nova — apenas conectar a função existente ao ciclo de navegação.

