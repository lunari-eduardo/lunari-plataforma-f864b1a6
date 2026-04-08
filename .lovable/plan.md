

# Proteção de dados existentes ao configurar disponibilidade

## Problema
Ao usar o modal de configurar disponibilidade, as ações "Substituir existentes" e "Bloquear" removem slots de disponibilidade/bloqueio já configurados sem verificação. O usuário quer garantir que agendamentos, bloqueios e disponibilidades manuais existentes nunca sejam sobrescritos automaticamente.

Atualmente:
- **Bloquear dia inteiro** (linha 160): remove TODOS os slots existentes do dia, incluindo disponibilidades manuais
- **Liberar modo "replace"** (linhas 229-233): remove slots existentes nos horários alvo, incluindo bloqueios
- **Horários padrão** (`defaultTimeSlots`): já são seguros — apenas definem a grade visual, não apagam dados

## Correções

### Arquivo: `src/components/agenda/AvailabilityConfigModal.tsx`

**1. `handleBloquear` — Proteger slots com agendamentos**
- No modo `fullDay` (linha 160), antes de remover slots existentes, pular os que têm agendamentos no mesmo horário (já verifica para `specific`, mas não para `fullDay`)
- Adicionar aviso se houver agendamentos no dia: "X agendamentos mantidos"

**2. `handleLiberar` modo `replace` — Não remover bloqueios**
- Na lógica de replace (linhas 229-233), ao remover slots existentes, pular os que são `label === 'Bloqueado'` — bloqueios devem ser removidos manualmente
- Adicionar toast informativo: "Y bloqueios mantidos"

**3. Texto da UI — Esclarecer comportamento**
- "Substituir existentes" → mudar descrição para "Recria horários disponíveis (bloqueios são preservados)"
- "Criar novos horários" → mudar descrição para "Adiciona onde não houver disponibilidade ou bloqueio"
- Modo `create` (linha 243): além de pular existentes, também pular horários que estão bloqueados

### Arquivo: `src/components/agenda/DailyView.tsx`

**4. `handleMarkAvailable` — Não sobrescrever bloqueio**
- Na linha 122-124, antes de remover existing, verificar se é bloqueio. Se for, exibir toast "Desbloqueie primeiro" e retornar sem alterar

**5. `handleBlockSlot` — Não sobrescrever disponibilidade marcada manualmente**
- Comportamento atual está correto (remove disponibilidade e cria bloqueio), pois bloquear é ação intencional. Manter como está.

## Resumo de proteções

| Ação | Agendamentos | Bloqueios | Disponibilidades |
|------|-------------|-----------|------------------|
| Bloquear dia inteiro | ✅ Preserva | ✅ Preserva (atualiza) | ⚠️ Remove (intencional) |
| Bloquear horário | ✅ Pula | ✅ Atualiza | ⚠️ Remove (intencional) |
| Liberar (criar) | ✅ Pula | ✅ Preserva | ✅ Pula existente |
| Liberar (substituir) | ✅ Pula | ✅ Preserva | 🔄 Recria |
| Marcar disponível (menu) | ✅ N/A | ✅ Preserva (toast) | 🔄 Recria |
| Horários padrão | ✅ Não toca | ✅ Não toca | ✅ Não toca |

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/agenda/AvailabilityConfigModal.tsx` | Proteger bloqueios no modo replace; proteger agendamentos no fullDay; textos descritivos |
| `src/components/agenda/DailyView.tsx` | `handleMarkAvailable` não sobrescreve bloqueios |

