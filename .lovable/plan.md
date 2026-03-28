

# Remover Toasts Redundantes na Criação de Agendamentos

## Problema

Ao criar um agendamento com novo cliente, 3 toasts aparecem empilhados:
1. "Cliente adicionado com sucesso" (do hook `useClientesRealtime`)
2. "Novo cliente adicionado ao CRM automaticamente" (do `AppointmentForm`)
3. "Novo agendamento criado" (do `Agenda.tsx`)

Isso atrapalha a usabilidade, especialmente em mobile, e é redundante — o próprio agendamento aparecendo na tela já confirma o sucesso.

## Solução

Remover **todos** os toasts de sucesso do fluxo de criação/edição/exclusão de agendamentos e do fluxo de criação de cliente via agenda. Manter apenas toasts de **erro** (validação, falhas de rede).

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/agenda/AppointmentForm.tsx` | Remover `toast.success('Novo cliente adicionado ao CRM automaticamente')` (linha 369) |
| `src/pages/Agenda.tsx` | Remover `toast.success("Novo agendamento criado")` (linha 155) e `toast.success("Agendamento atualizado")` se existir |
| `src/components/agenda/AppointmentDetails.tsx` | Remover `toast.success('Agendamento atualizado com sucesso')` (linha 142) e `toast.success` de exclusão (linha 147) |
| `src/hooks/useClientesRealtime.ts` | Remover `toast.success('Cliente adicionado com sucesso')` (linha 171) — este hook é usado em outros contextos, mas o toast de sucesso na página de Clientes (`Clientes.tsx:451`) já cobre esse caso separadamente |
| `src/hooks/useClientesRealtime.tsx` | Remover `toast.success('Cliente adicionado com sucesso')` (linha 155) — mesmo caso |

### O que NÃO remover

- Toasts de **erro** (`toast.error`) — validação de campos, falhas de rede
- Toasts em contextos fora da agenda (compartilhamento, edição de cliente, conflitos)

