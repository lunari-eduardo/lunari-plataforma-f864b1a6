

# Refatoracao Completa -- Modal "Configurar Disponibilidade"

## Resumo

Reescrever o `AvailabilityConfigModal` com uma interface limpa, sequencial e intuitiva. Remover complexidade desnecessaria (gerenciador de tipos, dropdowns, campos separados de data) e substituir por um fluxo guiado em 3 secoes claras.

## Nova Estrutura do Modal

```text
+-------------------------------------------+
|  Configurar disponibilidade           [X]  |
+-------------------------------------------+
|                                           |
|  Secao 1 -- Acao                          |
|  [ Liberar horarios | Bloquear horarios ] |
|                                           |
|  Secao 2 -- Periodo                       |
|  +-------Calendar Range--------+          |
|  |  << Fevereiro 2026 >>       |          |
|  |  ...dias com range...       |          |
|  +-----------------------------+          |
|                                           |
|  Aplicar para:                            |
|  ( ) Todos os dias do periodo             |
|  ( ) Dias especificos da semana           |
|    [Dom][Seg][Ter][Qua][Qui][Sex][Sab]    |
|                                           |
|  Secao 3 -- Aplicacao                     |
|                                           |
|  Se BLOQUEAR:                             |
|  ( ) Dia inteiro                          |
|  ( ) Horarios especificos                 |
|    [08:00]-[12:00] (X)                    |
|    + Adicionar horario                    |
|                                           |
|  Se LIBERAR:                              |
|  ( ) Criar novos horarios                 |
|  ( ) Substituir horarios existentes       |
|    [HH:MM] (X)                            |
|    + Adicionar horario                    |
|                                           |
+-------------------------------------------+
|  Remover deste periodo    Cancelar  Salvar |
+-------------------------------------------+
```

## Alteracoes

### Arquivo: `src/components/agenda/AvailabilityConfigModal.tsx` (reescrita completa)

**Remover:**
- Botao "Gerenciar tipos" e todo o Dialog secundario de tipos
- Dropdown Select de tipo de disponibilidade
- Campos separados de "Data inicial" e "Data final" com Popovers
- Textos explicativos longos
- Switch "Substituir existentes" no formato atual
- Toda logica de gerenciamento de tipos (handleAddType, handleDeleteType, handleStartEdit, handleSaveEdit, etc.)

**Adicionar:**
- **Secao 1 - Acao**: Botao segmentado horizontal (toggle group) com duas opcoes: "Liberar horarios" e "Bloquear horarios". Sem dropdown.
- **Secao 2 - Periodo**: Calendario unico com `mode="range"` do react-day-picker. Primeiro clique = inicio, segundo clique = fim, intervalo destacado. Abaixo: radio para "Todos os dias" ou "Dias especificos" com checkboxes compactos dos dias da semana.
- **Secao 3 - Aplicacao**: Conteudo condicional baseado na acao:
  - Se BLOQUEAR: Radio "Dia inteiro" / "Horarios especificos". Se horarios especificos, mostrar campos de hora inicio-fim com botao adicionar.
  - Se LIBERAR: Radio "Criar novos" / "Substituir existentes" com texto curto explicativo em opacidade menor. Campos de horario para adicionar.
- **Rodape**: Link discreto vermelho "Remover deste periodo" a esquerda. "Cancelar" ghost + "Salvar" primario a direita.

**Logica de save:**
- Manter `computeTargetDatesBetween` para calcular datas alvo
- Se BLOQUEAR + dia inteiro: criar slot com `isFullDay: true`, label "Bloqueado", cor vermelha
- Se BLOQUEAR + horarios especificos: criar slots com label "Bloqueado" para cada intervalo
- Se LIBERAR + criar novos: adicionar slots sem remover existentes (pular conflitos com agendamentos)
- Se LIBERAR + substituir: remover existentes antes de adicionar novos
- Validar que nao ha agendamento confirmado antes de substituir

**Estado simplificado:**
- `action`: 'liberar' | 'bloquear'
- `dateRange`: { from: Date, to: Date }
- `weekdayMode`: 'all' | 'specific'
- `selectedWeekdays`: number[]
- `blockMode`: 'fullDay' | 'specific' (so quando action = bloquear)
- `liberarMode`: 'create' | 'replace' (so quando action = liberar)
- `timeSlots`: { start: string, end?: string }[]
- `fullDayDescription`: string

### Arquivo: `src/components/ui/calendar.tsx`

Nenhuma alteracao necessaria -- ja suporta `mode="range"` via react-day-picker.

### Nenhuma alteracao em hooks ou tipos

- `useAvailability` permanece igual
- `AvailabilitySlot` e `AvailabilityType` permanecem iguais
- Os tipos de disponibilidade continuam existindo no sistema (usados pelo handleMarkAvailable na DailyView), apenas o gerenciador e removido deste modal

## Diretrizes visuais

- Espacamento vertical generoso entre secoes (space-y-6)
- Sem bordas internas pesadas nos blocos
- Titulos de secao: text-sm font-medium text-foreground
- Texto auxiliar: text-xs text-muted-foreground (opacidade natural)
- Botao segmentado usa estilo toggle-group compacto
- Calendario embutido diretamente (sem popover)
- Animacao suave com transicoes CSS ao alternar opcoes
- Modal max-w-[480px], responsivo para mobile
- Fundo neutro, visual de ferramenta rapida (nao formulario administrativo)

