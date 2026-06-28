# Plano — Página Finanças (refatoração modular + IA enxuta)

> Padrão Workflow/Tarefas (Constituição Lunari v1.0 + ARQUITETURA OFICIAL v1.0). **Escopo da IA reduzido ao que a Lu realmente vai usar** — cobranças, cartões, vendas avulsas e provedor saem da superfície de IA (continuam funcionando na UI, mas sem capability nem snapshot).

## 0. Escopo da IA

1. Criar lançamentos (despesa/receita) por categoria + subcategoria.
2. Perguntar quando categoria/subcategoria ficar ambígua.
3. Criar novas subcategorias (`financial_items`).
4. Aceitar forma de lançamento (único/parcelado/recorrente) e forma de pagamento.
5. Criar e ler metas.
6. Ler dashboard e extrato.

Fora do escopo da IA: cobranças via gateway, cartões, vendas avulsas, configuração de provedor.

## 1. Estrutura-alvo

```text
src/modules/finance/
  MODULE.md
  domain/{types,events,rules,selectors}.ts
  ports/{transactionsRepo,itemsRepo,extratoRepo,goalsRepo}.ts
  infrastructure/supabase/{transactionsRepo,itemsRepo,extratoRepo,goalsRepo}.ts
  infrastructure/realtime/{financeRealtimeChannel.ts,FinanceRealtimeBridge.tsx}
  application/commands/{createTransaction,updateTransaction,deleteTransaction,
                        markTransactionPaid,markTransactionPending,
                        createFinancialItem,setGoal}.ts
  application/queries/{listTransactions,listFinancialItems,listExtrato,
                       extratoSummary,dashboardKpis,listGoals,goalsProgress}.ts
  presentation/store/{transactionsStore,itemsStore}.ts
  presentation/hooks/{useTransactions,useFinancialItems,useExtrato,
                      useDashboardKpis,useGoals}.ts
  presentation/components/{TransactionModal,LancamentosView,ExtratoView,
                           DashboardView,MetasView,ConfiguracoesView}.tsx
  ai/{permissions,context,tools,index}.ts
```

## 2. Ondas

### Onda 0 — Limpeza + esqueleto + hotfix Realtime ✅ (esta entrega)
- Remover `src/pages/Financas.tsx` (stub).
- Criar esqueleto `src/modules/finance/*` + `MODULE.md`.
- Salvar este plano em `.lovable/plan-finance.md`.
- Hotfix `useCobranca`: canal `cobrancas-${userId}` + filtro `user_id=eq.${userId}`.

### Onda 1 — Domain + Stores
- `domain/types.ts`: `Transacao`, `ItemFinanceiro`, `MetaPersonalizada`, `FormaPagamento`, `Grupo`, `Status`.
- `domain/events.ts`: `finance.transaction.created/updated/deleted/paid/reopened`, `finance.item.created`, `finance.goal.upserted`.
- `domain/rules.ts` + `selectors.ts` puros.
- Stores versionados padrão `tasksStore` (`transactionsStore`, `itemsStore`).

### Onda 2 — Ports + Infrastructure
- Ports tipados.
- Repos Supabase migram lógica de `SupabaseFinancialTransactionsAdapter`, `SupabaseFinancialItemsAdapter`, leitura de `extrato_unificado`, e `metas_personalizadas`.
- Adapters antigos delegam aos novos repos.

### Onda 3 — Realtime unificado
- Canal `finance-${userId}` cobrindo `fin_transactions` + `financial_items`.
- `FinanceRealtimeBridge` em `App.tsx` atrás de flag `VITE_FINANCE_REALTIME_V2`.
- Bridge aplica patch nos stores + invalida `['extrato']` debounced.
- `useFinancialTransactionsSupabase`/`useExtratoSupabase` viram facades.

### Onda 4 — Capabilities (12 total)

Todas via `defineCommand`/`defineQuery`, Zod `.strict()`, `audit:"on-success"`.

**Lançamentos** (5): `finance.transaction.create`, `.update`, `.delete` (APPROVAL), `.markPaid`, `.markPending`.
**Itens** (2): `finance.item.create`, `.list`.
**Metas** (3): `finance.goal.set`, `.list`, `.progress`.
**Leitura** (3): `finance.extrato.list`, `.summary`, `finance.dashboard.kpis`.

Hooks antigos passam a usar `useRunCapability`.

### Onda 5 — UI canônica
- `TransactionModal` único (substitui `ModalNovoLancamentoRefatorado` + `NovaTransacaoModal` + `EditTransactionModal`); campos `modo` + `formaPagamento`.
- Botão "+ Nova subcategoria" inline no seletor de item.
- Botão "+ Nova meta" em `MetasConfigTab`.
- Views extraídas: `LancamentosView`, `ExtratoView`, `DashboardView`, `MetasView`, `ConfiguracoesView`.
- Remover `TabelaTransacoesInline`, `TabelaTransacoes`, `DemonstrativoSimplificado` (se redundante).
- `NovaFinancas.tsx` → ~40 linhas.

### Onda 6 — Superfície de IA
- `permissions.ts`: `FINANCE_PERMISSIONS = ["finance:read","finance:write","finance:delete"]`; `REQUIRES_APPROVAL = ["finance.transaction.delete"]`.
- `context.ts` — `buildFinancePageSnapshot(v1)` com: tab, filtroMesAno, regime, kpis, groupCounts, visibleTransactionIds (≤30), goalsProgress, extratoSummary, **items (≤50) com {id,nome,grupo}**, formasPagamento, permissions, capabilities.
- `tools.ts`: derivado do `capabilityRegistry` prefixo `finance.`.

Regra ASSISTANT: ao lançar valor com categoria por nome, chamar `finance.item.list` antes; se 0 ou >1 match → **perguntar** antes de criar ou usar.

### Onda 7 — Cleanup
- `@deprecated` em `useFinancialTransactionsSupabase`, `useNovoFinancas`, `useExtratoSupabase`.
- `useFinancialNotifications` → `eventBus.on("finance.transaction.*")`.
- `supabase--linter` antes/depois.
- Não tocar em `useSessionPayments`, `usePaymentIntegration`, modais de cobrança/cartão/venda avulsa.

## 3. Contratos críticos

### `finance.transaction.create` (Zod `.strict()`)
```ts
{
  itemId: uuid,
  valor: number().positive(),
  dataVencimento: dateISO,
  dataCompetencia?: dateISO,
  observacoes?: string().max(500),
  modo: 'unico'|'parcelado'|'recorrente'|'cartao',
  formaPagamento: 'dinheiro'|'pix'|'transferencia'|'boleto'|'cartao_debito'|'cartao_credito',
  parcelaTotal?: int().min(2).max(60),
  cartaoId?: uuid,
  dataCompra?: dateISO
}
```
Proibido: `status`, `valor_pago`, `valor_total` (gerados por trigger).

### `finance.item.create`
```ts
{ nome: string().min(2).max(60), grupo: Grupo }
```
Idempotente por `(user_id, lower(nome), grupo)` — retorna existente se já houver.

### `finance.goal.set`
```ts
{
  ano: int(), mes: int().min(1).max(12),
  categoria: '__geral__' | uuid,
  metaFaturamento: number().min(0),
  metaLucro: number().min(0)
}
```
Upsert único por `(user_id, ano, mes, categoria)`.

### `finance.extrato.list`
Via view `extrato_unificado`. `pageSize` máx 200. Default `regime:'caixa'`, `pageSize:50`.

## 4. Riscos

| Risco | Mitigação |
|---|---|
| Lu chuta subcategoria errada | `context.items` + regra de desambiguação no ASSISTANT_GUIDE. |
| Item duplicado | Idempotência por `(user_id, lower(nome), grupo)`. |
| Payload com campos derivados | Zod `.strict()`. |
| Evento de extrato perdido no realtime | Bridge invalida `['extrato']` debounced. |
| `useCobranca` canal sem `user_id` | Hotfix na Onda 0. |
| Quebra de UX nos modais legados | Migrar 1 entrypoint por vez na Onda 5. |
| Metas com cálculo paralelo | `setGoal` delega a `GoalsIntegrationService` existente. |

## 5. Critérios de pronto
- `Financas.tsx` removido; `NovaFinancas.tsx` ≤ 60 linhas.
- `useCobranca` realtime filtrado por `user_id`.
- `MODULE.md` cobre os 6 critérios do `PRODUCT_GUIDE`.
- 12 capabilities `finance.*` com Zod + audit.
- `buildFinancePageSnapshot(v1)` carrega items, formasPagamento, kpis, goalsProgress, extratoSummary.
- 1 canal Realtime por usuário cobrindo `fin_transactions` + `financial_items`.
- `supabase--linter` sem regressões.
