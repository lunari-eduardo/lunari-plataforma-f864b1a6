# Centro de Notificações — Plano de Implementação

## Estado atual

O sino no Header (`src/components/layout/Header.tsx`, linha 52) usa `useState(2)` hardcoded e não abre nada ao clicar. Decorativo. O sistema já tem várias fontes de eventos espalhadas (lembretes de produção, tarefas, cobranças, contratos, leads, formulários, galerias, aniversários) mas sem um ponto único de acesso.

## Visão geral da solução

Transformar o sino num **Popover lateral** (estilo Notion/Linear) com:

- Lista agregada e ordenada por prioridade/recência
- Agrupamento por categoria (com tabs: "Tudo", "Pendências", "Financeiro", "Clientes")
- Badge com contagem de **não lidas**
- Ações rápidas inline (marcar lida, dispensar, "ir para...")
- Atualização em tempo real via canais Supabase já existentes
- Persistência leve do estado lido/dispensado (sem nova tabela na v1 — usa `localStorage` por usuário; v2 opcional migra para tabela)

## Fontes de notificação (mapeadas no banco/hooks atuais)

Categoria **Pendências (Produção/Tarefas)**

- Produtos não produzidos → reaproveita `useProductionReminders` (já existe)
- Tarefas com `due_date <= hoje` e `status != done` → query em `tasks`
- Tarefas atrasadas (vencidas há >1 dia) → mesma query, prioridade alta

Categoria **Financeiro**

- Contas faturadas e **vencidas** (`fin_transactions` onde `status='faturado'` AND `data_vencimento < hoje`)
- Contas vencendo em ≤3 dias
- Pagamentos confirmados via cobrança hoje (`cobrancas` com `status='pago'` e `created_at` recente, ou via `clientes_transacoes`)
- Cobranças enviadas e ainda não pagas há >7 dias

Categoria **Clientes / Comercial**

- Aniversários hoje/amanhã → reaproveita `useBirthdayAlert`
- Leads novos sem follow-up há >2 dias (`leads` por `status` + `created_at`)
- Respostas de formulário recebidas (`formulario_respostas` recentes)

Categoria **Documentos**

- Contratos assinados (`contratos.status='assinado'` recente)
- Contratos enviados há >3 dias sem assinatura

Categoria **Agenda**

- Agendamentos confirmados nas últimas 24h

## Arquitetura técnica

### Novos arquivos

- `src/types/notifications.ts` — tipos `Notification`, `NotificationCategory`, `NotificationPriority`
- `src/hooks/useNotifications.ts` — hook agregador central que combina todas as fontes, aplica estado lido/dispensado e expõe `notifications`, `unreadCount`, `markAsRead`, `markAllAsRead`, `dismiss`
- `src/hooks/notifications/useFinancialNotifications.ts`
- `src/hooks/notifications/useTaskNotifications.ts`
- `src/hooks/notifications/useContractNotifications.ts`
- `src/hooks/notifications/useClientNotifications.ts` (aniversários + leads + formulários)
- `src/hooks/notifications/useAgendaNotifications.ts`
- `src/services/NotificationStateService.ts` — persistência localStorage com chave por user_id (`notif_state_${userId}`) guardando `{ readIds: string[], dismissedIds: string[], lastSeenAt }`
- `src/components/notifications/NotificationBell.tsx` — sino + Popover
- `src/components/notifications/NotificationList.tsx` — lista agrupada com tabs
- `src/components/notifications/NotificationItem.tsx` — item individual com ícone por categoria, título, descrição, timestamp relativo, ações
- `src/components/notifications/NotificationEmptyState.tsx`

### Modificações

- `src/components/layout/Header.tsx` — substituir o Button do sino por `<NotificationBell />`

### Identidade estável dos itens

Cada notificação tem ID determinístico baseado em fonte+entidade:

- `task-overdue-${taskId}`
- `fin-overdue-${transactionId}`
- `cobranca-paid-${cobrancaId}`
- `birthday-${clienteId}-${YYYYMMDD}`
- `contract-signed-${contratoId}`

Isso garante que "marcar como lida" persiste mesmo após refetch.

### Realtime

Reusar `useSupabaseRealtime` nas tabelas-chave (`tasks`, `fin_transactions`, `cobrancas`, `contratos`, `formulario_respostas`, `appointments`) já suportadas pelo `RealtimeSubscriptionManager`. As notificações se atualizam automaticamente.

### Performance

- Hook agregador com `useMemo` para combinar/ordenar
- Queries com filtros restritivos (últimos 30 dias, status relevantes)
- Limite de 50 itens na lista; "Ver todas" leva à rota relacionada

## UI/UX

```text
┌─ Header ──────────────────────────────┐
│              🔔(8) 🌙 👤              │
└────────────────┬──────────────────────┘
                 │ click
                 ▼
   ┌──────────────────────────────────────┐
   │ Notificações          [Marcar todas] │
   ├──────────────────────────────────────┤
   │ [Tudo] [Pendências] [$ ] [Clientes]  │
   ├──────────────────────────────────────┤
   │ ● 🔴 Conta vencida                   │
   │   R$ 1.700,00 — Aluguel · há 2h     │
   │   [Ver] [Dispensar]                  │
   ├──────────────────────────────────────┤
   │ ● 📦 Produto pendente                │
   │   4x Foto Impressa — Bárbara Gündel  │
   │   [Ir ao Workflow]                   │
   ├──────────────────────────────────────┤
   │ ○ ✅ Contrato assinado               │
   │   Priscila Richa · há 1d            │
   ├──────────────────────────────────────┤
   │           [Ver todas]                │
   └──────────────────────────────────────┘
```

Detalhes visuais:

- Largura ~400px, altura máx 600px com scroll nativo
- Glassmorphism igual ao restante do app
- Bolinha colorida à esquerda = não lida; cinza = lida
- Ícone categórico (Bell/DollarSign/Package/User/FileText/Calendar)
- Cores de prioridade: vermelho (vencida/atrasada), âmbar (próxima), verde (sucesso/pago/assinado), azul (info)
- Timestamp relativo em pt-BR (`date-fns` formatDistance)
- Click no item: marca como lida + navega para a rota de origem
- Botão "Marcar todas como lidas" no header do popover
- Badge desaparece quando `unreadCount === 0`

## Priorização e ordenação

1. Críticas (vencidas, atrasadas) primeiro
2. Próximas 24h
3. Sucessos recentes (pagamento, assinatura)
4. Informativas

Dentro de cada nível, mais recente primeiro.

## Fora do escopo (v2 futura)

- Tabela `notifications` no Supabase para multi-device sync
- Notificações push (PWA)
- Configuração de quais categorias ativar por usuário
- Email digest diário

## Arquivos que serão criados/editados

- Criados: 11 arquivos (tipos, hooks, serviço, 4 componentes UI)
- Editados: 1 arquivo (`Header.tsx`)