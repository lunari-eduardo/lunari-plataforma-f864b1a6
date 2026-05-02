
# Análise da Integração Google Calendar — Diagnóstico e Plano de Correção

## Estado atual

A integração existe e funciona em casos básicos: conectar/desconectar, criar evento ao confirmar, sync manual em massa. Porém uma varredura completa (`google-calendar-sync`, `google-calendar-sync-all`, `google-calendar-callback`, `google-calendar-disconnect`, `googleCalendarSync.ts`, `useGoogleCalendarIntegration.ts`, `SupabaseAgendaAdapter.ts`) revelou problemas reais que afetam confiabilidade, especialmente para "agendamentos futuros existentes" e "alterações em tempo real".

Diagnóstico no banco:
- 288 appointments confirmados — 217 com `google_sync_status='pending'` e **0 com `google_event_id`** (ou seja, nenhum sincronizado de fato), 71 sem status nenhum.
- Nenhum usuário com integração ativa no momento (tabela `usuarios_integracoes` para `google_calendar` está vazia → última conexão foi removida/expirou). Isso explica o backlog enorme de "pending".

## Bugs e problemas encontrados

### 1. Duração do evento é sempre 1h fixa (CRÍTICO)
`google-calendar-sync/index.ts` linha 202–204 e `google-calendar-sync-all` linha 254–259 fazem `end = addHour(time)`. Ignora completamente:
- A duração real do tipo de agendamento (`type`/categoria) configurada pelo usuário.
- Pacotes que duram 2h, 3h, ensaios curtos de 30min, etc.

Resultado: todos os eventos no Google Calendar aparecem com 1h, criando sobreposições falsas e eventos errados.

### 2. Sync em "create" depende de status já estar 'confirmado' no momento do INSERT
`SupabaseAgendaAdapter.addAppointment` (linha 344–349) chama sync sempre, mas a edge function só sincroniza se `appointment.status === 'confirmado'`. Para appointments criados como "a confirmar" e depois mudados para "confirmado", o `updateAppointment` (linha 396–479) só dispara sync se `wasConfirmed` for true E não dispara se mudaram **outros** campos depois — ok aqui, mas:
- Se o usuário muda **cliente, descrição, tipo** em um appointment já confirmado e sincronizado, **NÃO** há sync (linhas 471–479 só checam `date || time`). O evento no Google fica desatualizado.

### 3. Race condition no UPDATE
Linha 462–464: ao confirmar, dispara sync **sem await** (`syncAppointmentToGoogleCalendar(...)` sem await). O `try/catch` envolvente sugere espera, mas a Promise é fire-and-forget. Combinado com o fato de que a edge function busca o appointment do banco, geralmente funciona, mas se o cliente fizer outra mudança imediata, há risco de sobrescrita inversa.

### 4. Falta retry automático para "pending" e "error"
Quando o Google retorna erro (token expirado entre chamadas, rate limit, 5xx), o appointment é marcado como `pending`/`error` mas **nada** tenta sincronizar de novo automaticamente. Só o botão manual "Sincronizar agora" (`syncExisting`) limpa o backlog. Isso explica os 217 pendentes.

### 5. `google-calendar-sync-all` só CRIA, nunca atualiza/remove
Linha 272–282 sempre faz POST. Se um appointment tinha `google_event_id` mas ficou marcado `error`, o sync em massa **cria um evento duplicado** em vez de tentar PUT no existente. Também não trata appointments que foram removidos no Lunari mas continuam no Google.

### 6. `expira_em` calculado errado após refresh
Linhas 177 e 182 do sync: usam `Date.now() + 3600 * 1000` (1h fixa) em vez do `expires_in` retornado pelo Google. Funciona, mas pode marcar como expirado antes ou depois do real. Pequeno, mas inconsistente.

### 7. Sem realtime/postgres trigger
Toda a sync depende do código frontend chamar a edge function. Se a alteração vier de outro lugar (webhook, edge function de pagamento, RPC, importação), o Google Calendar **não recebe**. Não há trigger no banco que dispare sync via `pg_net`.

### 8. CORS desatualizado
Faltam headers `x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version` em todas as 4 edge functions. Pode causar falhas intermitentes em browsers/SDKs novos.

### 9. Disconnect apaga `google_event_id` mas deixa eventos no Google
Linha 82–88 do disconnect: zera referências locais mas **não deleta eventos** do calendário antes de revogar token. Eventos órfãos ficam no Google Calendar do usuário.

### 10. Sem indicador visual de sync por appointment
UI mostra apenas `pendingCount` agregado. Nenhum badge/ícone por agendamento mostrando "sincronizado", "pendente" ou "erro" — usuário não sabe qual evento específico falhou.

## Plano de Correção

### Fase 1 — Correções críticas de dados (maior impacto)

1. **Duração real do evento**
   - Em `google-calendar-sync` e `google-calendar-sync-all`: buscar `availability_types.duration` (ou tabela equivalente que mapeia categoria → duração) com base em `appointment.type` e usuário. Fallback 60min se não encontrar.
   - Adicionar coluna opcional `duration_minutes` em `appointments` (migration) para sobrescrever quando o agendamento tiver duração customizada (ex.: vinda de pacote/sessão).

2. **Sync em qualquer mudança relevante de appointment confirmado**
   - Em `SupabaseAgendaAdapter.updateAppointment`: disparar sync sempre que o appointment estiver confirmado E qualquer um destes mudar: `date, time, type, description, cliente_id, status`.
   - Aguardar (`await`) a Promise para garantir consistência sequencial.

3. **Trigger no banco como rede de segurança**
   - Migration: criar trigger `AFTER INSERT OR UPDATE OR DELETE ON appointments` que enfileira na nova tabela `google_calendar_sync_queue (appointment_id, action, attempts, last_error, scheduled_at)`.
   - Função RPC + cron job (`pg_cron` a cada 1 min) chama edge function `google-calendar-sync-worker` que processa a fila com backoff exponencial (1min, 5min, 15min, 1h, 6h, max 5 tentativas).
   - Garante que mudanças vindas de qualquer origem (webhook de pagamento, RPC, admin) sejam refletidas.

4. **Refazer `google-calendar-sync-all` para suportar UPDATE e DELETE**
   - Se `google_event_id` existe → PUT para reconciliar.
   - Se appointment foi cancelado/excluído mas tem `google_event_id` órfão (caso `disconnect` não tenha rodado) → DELETE no Google.
   - Atualizar `expira_em` usando `data.expires_in` real.

### Fase 2 — UX e robustez

5. **Indicador por appointment**
   - Badge no card da agenda: ícone Google Calendar com cores: verde (synced), amarelo (pending), vermelho (error + tooltip com erro), cinza (sem integração).
   - Botão "Tentar novamente" inline para appointments em erro.

6. **Disconnect mais limpo**
   - Antes de revogar token: opcionalmente deletar todos `google_event_id` do calendário do Lunari (modal de confirmação: "Manter eventos no Google" vs "Remover eventos sincronizados").

7. **CORS atualizado**
   - Adicionar headers ausentes em todas as 4 edge functions.

8. **Feedback realtime na UI**
   - Subscribe em `appointments` (campo `google_sync_status`) via Supabase Realtime para atualizar badges sem reload.

### Fase 3 — Recuperação do backlog atual

9. **Migration one-shot** que reseta o backlog atual:
   - Marcar todos os 217 `pending` para reentrarem na fila do worker assim que a Fase 1.3 estiver no ar.
   - Como nenhum usuário tem integração ativa no momento, o worker simplesmente vai pular e zerar o status quando não houver integração — sem chamadas inúteis ao Google.

## Detalhes técnicos

```text
appointments ──(trigger)──► google_calendar_sync_queue
                                       │
              pg_cron (1 min) ─────────┘
                     │
                     ▼
        google-calendar-sync-worker (edge fn)
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   refresh token             Google API
   se necessário        (POST/PUT/DELETE)
        │                         │
        └──────────► UPDATE appointments
                     SET google_event_id, google_sync_status
                     UPDATE queue SET attempts++, last_error
```

Tabelas/colunas novas:
- `appointments.duration_minutes integer` (nullable, default null).
- `google_calendar_sync_queue (id uuid pk, appointment_id uuid, user_id uuid, action text check in (create,update,delete), attempts int default 0, last_error text, next_attempt_at timestamptz default now(), created_at timestamptz default now())`.
- Index `(next_attempt_at, attempts)` para o worker escolher próximos.

Edge functions:
- Nova: `google-calendar-sync-worker` (sem JWT, chamada apenas pelo cron com header secreto).
- Atualizar: `google-calendar-sync`, `google-calendar-sync-all`, `google-calendar-disconnect`, `google-calendar-callback` (CORS, duração, expires_in real, suporte a delete de órfãos).

Frontend:
- `useAppointmentSyncStatus(appointmentId)` hook com realtime.
- Badge `<GoogleSyncBadge status="synced|pending|error|none" error?="..." onRetry?={...}/>`.
- Modal de disconnect com opção de remoção em massa.

## Itens fora de escopo (mencionar mas não fazer agora)

- Sync **bidirecional** (Google → Lunari): hoje só Lunari → Google. Implementar webhooks Google Calendar Push é trabalho grande, fica para depois.
- Múltiplos calendários por usuário.
- Convites para participantes via email.

Após aprovação implemento Fases 1–3 nesta ordem; UI da Fase 2 pode ser entregue logo após a 1 para feedback imediato.
