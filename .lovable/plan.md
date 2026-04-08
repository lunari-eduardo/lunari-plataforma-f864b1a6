

# Correções de Disponibilidade + Horários de Trabalho Padrão

## Problemas identificados

### 1. Sem opção de desbloquear horário bloqueado
No `DailyView.tsx` (linha 373), quando o slot está bloqueado, o `TimeSlotOptionsMenu` recebe `onBlock={() => {}}` — um no-op. Não existe opção "Desbloquear" no menu. O clique no card abre um `AlertDialog` de confirmação (`unlockConfirmTime`), mas o menu de 3 pontos não oferece essa ação.

**Correção**: Adicionar prop `onUnblock` ao `TimeSlotOptionsMenu` e exibi-la condicionalmente no lugar de "Bloquear" quando o slot já está bloqueado. No card bloqueado, trocar o menu atual por um que tenha "Desbloquear" e "Excluir horário".

### 2. Compartilhar diz "não há horários disponíveis"
**Causa raiz**: `handleMarkAvailable()` (linha 127) cria slots sem `typeId`. O `ShareAvailabilityModal` filtra por `slot.typeId || 'default'` e depois tenta encontrar esse ID em `availabilityTypes`. Como nenhum tipo real tem id `'default'`, `getAvailableTypes()` retorna array vazio → mostra "Não há horários disponíveis".

**Correção**: Incluir `typeId: tipo?.id` ao criar slots de disponibilidade em `handleMarkAvailable`. Também ajustar o `ShareAvailabilityModal` para tratar slots sem `typeId` como "Disponível" genérico (fallback), garantindo que sempre apareçam no compartilhamento.

### 3. Horários de trabalho padrão (nova funcionalidade)
Atualmente cada dia usa `DEFAULT_TIME_SLOTS` hardcoded ou slots customizados por data. O usuário quer definir **uma vez** seus horários de trabalho (ex: 10, 11, 14, 15, 16h) e que esses sejam o padrão para todos os dias futuros.

**Solução**: Estender `AgendaSettings` com campo `defaultTimeSlots: string[]`. Esse array substitui o `DEFAULT_TIME_SLOTS` hardcoded. Quando um dia não tem `custom_time_slots`, usa os `defaultTimeSlots` das settings. O modal de disponibilidade ganha um submodal/seção para configurar esses horários padrão.

## Plano de implementação

### Passo 1: Corrigir menu de desbloqueio
**Arquivo**: `src/components/agenda/TimeSlotOptionsMenu.tsx`
- Adicionar prop opcional `isBlocked?: boolean` e `onUnblock?: () => void`
- Quando `isBlocked`, mostrar "Desbloquear" (com ícone unlock) no lugar de "Bloquear"

**Arquivo**: `src/components/agenda/DailyView.tsx`
- No bloco de slot bloqueado (linha 373), passar `isBlocked={true}` e `onUnblock={() => handleUnblockSlot(time)}` ao `TimeSlotOptionsMenu`

### Passo 2: Corrigir compartilhamento
**Arquivo**: `src/components/agenda/DailyView.tsx`
- Em `handleMarkAvailable`, adicionar `typeId: tipo?.id` ao objeto do slot

**Arquivo**: `src/components/agenda/ShareAvailabilityModal.tsx`
- Em `getAvailableTypes()`, incluir slots sem `typeId` como tipo genérico "Disponível" com cor padrão `#10b981`, para que não sejam ignorados
- Garantir que slots com `label === 'Bloqueado'` sejam excluídos do compartilhamento

**Arquivo**: `src/components/agenda/AvailabilityConfigModal.tsx`
- Na ação "liberar", também incluir `typeId` dos tipos ao criar slots

### Passo 3: Horários de trabalho padrão
**Arquivo**: `src/types/agenda-supabase.ts`
- Adicionar `defaultTimeSlots?: string[]` à interface `AgendaSettings`

**Arquivo**: `src/hooks/useCustomTimeSlots.ts`
- Receber `defaultTimeSlots` das settings como fallback em vez do array hardcoded
- Quando não houver custom slots para a data, usar `defaultTimeSlots` (se configurado) ou o fallback atual

**Arquivo**: `src/components/agenda/AvailabilityConfigModal.tsx`
- Adicionar aba/seção "Horários de Trabalho" no modal de configurar disponibilidade
- Interface com chips dos horários selecionados, botão para adicionar/remover horário
- Ao salvar, persiste via `updateSettings` no `AgendaSettings`

**Arquivo**: `src/hooks/useAgendaSettings.ts`
- Adicionar `setDefaultTimeSlots` como convenience setter

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/agenda/TimeSlotOptionsMenu.tsx` | Prop `isBlocked` + opção "Desbloquear" |
| `src/components/agenda/DailyView.tsx` | Passar `isBlocked`/`onUnblock` + adicionar `typeId` no `handleMarkAvailable` |
| `src/components/agenda/ShareAvailabilityModal.tsx` | Fallback para slots sem `typeId`, excluir bloqueados |
| `src/components/agenda/AvailabilityConfigModal.tsx` | Incluir `typeId` ao liberar + seção "Horários de Trabalho" |
| `src/types/agenda-supabase.ts` | `defaultTimeSlots` em `AgendaSettings` |
| `src/hooks/useCustomTimeSlots.ts` | Usar `defaultTimeSlots` das settings como fallback |
| `src/hooks/useAgendaSettings.ts` | `setDefaultTimeSlots` convenience setter |

