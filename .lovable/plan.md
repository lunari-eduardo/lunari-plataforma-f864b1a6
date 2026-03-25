

# Otimizar Métricas do Workflow + Exibir Créditos

## Problemas Identificados

1. **Métricas lentas**: `useWorkflowMetricsRealtime` chama `supabase.auth.getUser()` (requisição HTTP) a cada navegação de mês, depois faz outra query para buscar sessões. São 2 roundtrips por troca de mês. O realtime subscription também dispara `loadMetrics()` sem debounce, causando múltiplas queries simultâneas.

2. **Créditos ocultos**: `calculateRestante()` em `WorkflowCardCollapsed.tsx` e `WorkflowTable.tsx` usa `Math.max(0, total - valorPago)`, eliminando valores negativos (créditos/sobrepagamentos). Na barra de métricas, `aReceber` também pode ser negativo mas não é tratado.

## Plano

### 1. Calcular métricas a partir do cache local (eliminar query extra)

O `WorkflowCacheContext` já carrega todas as sessões do mês via `getSessionsForMonthSync()`. Em vez de fazer uma query separada no `useWorkflowMetricsRealtime`, calcular as métricas diretamente dos dados já em cache.

**Arquivo**: `src/pages/Workflow.tsx`
- Remover `useWorkflowMetricsRealtime` do Workflow
- Calcular `financials` com `useMemo` a partir de `filteredSessions` (que já vêm do cache):
  ```
  previsto = sum(valor_total)
  receita = sum(valor_pago) 
  aReceber = previsto - receita
  sessoes = count
  ```
- Resultado: 0 queries extras na navegação mensal — métricas instantâneas

### 2. Mostrar créditos (valores negativos) nas sessões

**Arquivo**: `src/components/workflow/WorkflowCardCollapsed.tsx`
- Remover `Math.max(0, ...)` do `calculateRestante()`
- Quando `restante < 0`: exibir em amarelo com prefixo `+` (ex: `+R$ 120,00`) indicando crédito
- Quando `restante > 0`: manter vermelho (pendente)
- Quando `restante === 0`: manter verde (R$ 0,00)

**Arquivo**: `src/components/workflow/WorkflowTable.tsx`  
- Mesma lógica: remover `Math.max(0, ...)` do `calculateRestante()`

### 3. Exibir créditos na barra de métricas

**Arquivo**: `src/pages/Workflow.tsx`
- Quando `aReceber < 0`, exibir "Crédito" em amarelo em vez de "A Receber" em laranja
- Formato: `+R$ 232,00` em amarelo

### 4. Manter `useWorkflowMetricsRealtime` para o Dashboard Financeiro

O hook continua existindo para uso no `useDashboardFinanceiro`, mas o Workflow não o usa mais — ganha velocidade ao ler do cache local.

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Workflow.tsx` | Calcular métricas do cache local, remover hook de realtime, tratar crédito na barra |
| `src/components/workflow/WorkflowCardCollapsed.tsx` | Remover `Math.max(0,...)`, exibir crédito em amarelo |
| `src/components/workflow/WorkflowTable.tsx` | Remover `Math.max(0,...)` do `calculateRestante` |

## Impacto

- Navegação mensal: de ~2 queries (800ms+) para 0 queries (instantâneo)
- Créditos visíveis: sessões com sobrepagamento mostram `+R$ X` em amarelo
- Sem breaking changes: Dashboard Financeiro continua usando o hook original

