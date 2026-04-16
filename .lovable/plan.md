

# Fix: Botão "Cobrar via link" não aparece — `cliente_id` nunca é gravado nos agendamentos

## Causa raiz (confirmada via DB)

Query em `appointments` mostra que **TODOS** os agendamentos (incluindo os criados com cliente do CRM selecionado) têm `cliente_id = NULL`. Existem **dois bugs**:

### Bug 1 (principal) — Mismatch de nomenclatura no save
`AppointmentForm.tsx` (linha 415) envia o campo como `clientId`:
```ts
const appointmentData = { ..., clientId: clientInfo.clientId, ... }
```

Mas o `SupabaseAgendaAdapter.addAppointment` (linha 126) lê `appointment.clienteId`:
```ts
cliente_id: appointment.clienteId  // ← undefined → NULL no DB
```

Resultado: o vínculo CRM **nunca é persistido** ao criar/editar agendamento. O `appointment.clienteId` chega vazio em `AppointmentDetails`, e a condição `formData.status === 'a confirmar' && appointment.clienteId` cai no `else`, exibindo a mensagem "Vincule um cliente do CRM…".

### Bug 2 — Update também ignora
O método `updateAppointment` no adapter (linha 385) lê `updates.clienteId`, então editar e re-salvar também não corrige.

## Plano de correção

### 1. `AppointmentForm.tsx` — padronizar para `clienteId`
No objeto `appointmentData` (linha ~402-420), trocar `clientId` por `clienteId` (mesmo nome usado pelo tipo `Appointment` e pelo adapter):
```ts
const appointmentData = {
  ...,
  client: clientInfo.client,
  clienteId: clientInfo.clientId,  // ← era clientId
  ...
};
```

### 2. `SupabaseAgendaAdapter.ts` — fallback defensivo
Aceitar ambas as chaves no insert e update para retro-compatibilidade com qualquer outro caller:
```ts
cliente_id: appointment.clienteId || (appointment as any).clientId || null
```

### 3. `AppointmentDetails.tsx` — fallback por nome para dados legados
Para agendamentos antigos (já criados com `cliente_id NULL`), resolver por nome usando `useClientesRealtime`:
```ts
const { clientes } = useClientesRealtime();
const resolvedClienteId = appointment.clienteId 
  || clientes.find(c => c.nome === appointment.title)?.id 
  || null;
```
Trocar todas as ocorrências de `appointment.clienteId` por `resolvedClienteId` nas condições do botão e na prop do `ChargeModal`. Isso faz o botão aparecer **imediatamente** para todos os agendamentos pendentes que têm cliente CRM correspondente, sem precisar migrar dados.

### 4. (Opcional) Migration de hidratação retroativa
SQL para preencher `cliente_id` em agendamentos antigos via match por `title = clientes.nome` + `user_id`:
```sql
UPDATE appointments a SET cliente_id = c.id
FROM clientes c
WHERE a.cliente_id IS NULL
  AND a.user_id = c.user_id
  AND lower(trim(a.title)) = lower(trim(c.nome));
```
Recomendado para manter integridade futura (gallery sync, métricas por cliente, etc.).

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/agenda/AppointmentForm.tsx` | Renomear `clientId` → `clienteId` no payload |
| `src/adapters/SupabaseAgendaAdapter.ts` | Fallback `clienteId \|\| clientId` no insert e update |
| `src/components/agenda/AppointmentDetails.tsx` | Resolver `clienteId` por nome quando ausente; usar `resolvedClienteId` |
| Migration SQL | Hidratar `cliente_id` em agendamentos legados via match por título |

