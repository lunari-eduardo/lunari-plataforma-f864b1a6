
# Plano: Menu de Opcoes (tres pontinhos) nos Horarios Vazios da Agenda Diaria

## Visao Geral

Adicionar um botao discreto "..." (MoreVertical) em cada horario vazio na DailyView. Ao clicar, abre um dropdown com 3 opcoes:

1. **Disponivel** - Abre o AvailabilityConfigModal pre-configurado para aquele horario (funcionalidade existente)
2. **Bloquear** - Marca o horario com fundo avermelhado e badge "Bloqueado". Clicar no slot bloqueado pergunta se quer desbloquear (em vez de abrir modal de agendamento)
3. **Excluir** - Remove o horario da lista do dia (mesmo que seja padrao)

## Como Funciona o Bloqueio

O bloqueio sera implementado reutilizando o sistema de **availability slots** ja existente, criando um slot com um `typeId` especial de tipo "bloqueado". Isso garante persistencia no Supabase sem criar tabelas novas.

- Ao bloquear: cria um `AvailabilitySlot` com label "Bloqueado" e cor vermelha
- Ao clicar num slot bloqueado: exibe AlertDialog perguntando "Deseja liberar este horario?" em vez de abrir o modal de agendamento
- A deteccao de bloqueio e feita verificando `slot.label === 'Bloqueado'` no availability

## Alteracoes

### 1. `src/components/agenda/DailyView.tsx` (principal)

- Importar `MoreVertical` do lucide-react e `DropdownMenu` do radix
- Importar `AlertDialog` para confirmacao de desbloqueio
- Adicionar estado para controlar o slot bloqueado selecionado (`unlockConfirmTime`)
- No trecho onde renderiza slots vazios (sem eventos):
  - Adicionar botao "..." que abre DropdownMenu com 3 opcoes
  - Detectar se o horario esta bloqueado (availability com label "Bloqueado")
  - Se bloqueado: mostrar fundo avermelhado + badge "Bloqueado" e interceptar o clique para perguntar se quer desbloquear
  - Se nao bloqueado: manter comportamento atual (clique abre modal de agendamento)
- Funcao `handleBlock(time)`: cria availability slot com label "Bloqueado" e cor vermelha
- Funcao `handleUnblock(time)`: remove o availability slot de bloqueio
- Funcao `handleRemoveTimeSlot(time)`: remove o horario da lista usando `saveTimeSlots` do hook (filtra o horario e salva o array sem ele)

### 2. `src/hooks/useCustomTimeSlots.ts` (adicionar removeTimeSlot)

- Adicionar funcao `removeTimeSlot(time: string)` que filtra o horario do array e salva via `saveTimeSlots`
- Retornar `removeTimeSlot` no objeto de retorno do hook

### Nenhuma tabela nova necessaria

O bloqueio usa a tabela `availability_slots` existente. A exclusao usa a tabela `custom_time_slots` existente.

## Comportamento Visual

| Estado do slot | Fundo | Conteudo | Clique |
|---|---|---|---|
| Vazio normal | branco | "Clique para criar agendamento" + botao "..." | Abre modal de agendamento |
| Disponivel | cor do tipo | Badge "Disponivel" + botao remover + "..." | Abre modal de agendamento |
| Bloqueado | vermelho claro | Badge "Bloqueado" + "..." | Pergunta se quer desbloquear |
| Com evento | azul | Card do evento | Abre detalhes do evento |

## Compatibilidade

- Desktop: dropdown abre normalmente ao clicar no "..."
- Mobile: DropdownMenu do Radix ja funciona com touch nativamente
- O botao "..." fica discreto (opacidade baixa) e aparece mais visivel no hover/focus
