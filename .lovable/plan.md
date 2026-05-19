# Correção: Workflow em branco + 400 em fin_transactions

## Diagnóstico

**Problema 1 — Tela em branco no Workflow (TypeError: Cannot read properties of undefined reading 'toFixed')**

Em `src/hooks/useWorkflowRealtime.ts`, a função `convertToSessionData` (linhas ~1040–1083) chama `.toFixed()` **direto** em valores que são `NULL` no banco:

- Linha 1042: `packageValue = Number(pkg.valor_base) || session.valor_total;` — se ambos forem null, fica `undefined`.
- Linha 1064: `packageValue.toFixed(2)` — crasha.
- Linha 1074–1076: `session.valor_total.toFixed(...)`, `session.valor_pago.toFixed(...)` — sem fallback.
- Linha 1077: `(session.valor_total - session.valor_pago).toFixed(...)` — `NaN.toFixed` retorna string mas a subtração com null gera `NaN`.

Confirmado no schema (`clientes_sessoes`): `valor_total`, `valor_pago`, `valor_foto_extra`, `valor_total_foto_extra`, `valor_adicional`, `desconto` são todos `nullable`. Basta uma sessão recém-criada (ou afetada por trigger) com esses campos `null` para quebrar o `useMemo`/`map` do Workflow inteiro — daí a tela em branco "sem ninguém ter mexido".

**Problema 2 — 400 Bad Request em `fin_transactions`**

A query em `src/hooks/notifications/useFinancialNotifications.ts:29-36` faz:
```
.select('id, valor, data_vencimento, status, item_id, financial_items!inner(descricao, categoria, tipo)')
```
Mas a FK real de `fin_transactions.item_id` aponta para `fin_items_master` (não `financial_items`). E `fin_items_master` só tem colunas `nome, grupo_principal, ativo, is_default` — não tem `descricao/categoria/tipo`. Por isso o PostgREST devolve 400. Esse hook roda no shell de notificações em quase toda página, gerando ruído e abortando o fetch.

## Plano de correção

### 1. `src/hooks/useWorkflowRealtime.ts` — hardening de `convertToSessionData`
Normalizar todos os valores numéricos com `Number(x) || 0` antes de qualquer `toFixed`, e envolver a função inteira em `try/catch` retornando um objeto seguro em caso de erro (para nunca derrubar o `map` do Workflow).

- Criar helper local `fmtBRL(n)` que faz `Number(n || 0).toFixed(2).replace('.', ',')`.
- Substituir todas as ocorrências nas linhas 1064–1078 por `fmtBRL(...)`.
- `packageValue` recebe fallback final `|| 0`.
- Try/catch no corpo: se algo der errado para uma sessão específica, logar `console.warn` e retornar o registro com strings `'R$ 0,00'` em vez de explodir o array todo.

### 2. `src/hooks/notifications/useFinancialNotifications.ts` — corrigir 400
Trocar o embed para a tabela correta (`fin_items_master`) e usar colunas existentes:
```
.select('id, valor, data_vencimento, status, item_id, fin_items_master!inner(nome, grupo_principal)')
```
Ajustar o uso (`t.fin_items_master?.nome ?? 'Conta'`).
Adicionar `if (error) { console.warn(...); return; }` em todos os `await supabase.from(...)` deste hook para falhar silenciosamente sem travar o sino de notificações.

### 3. Hardening defensivo (prevenção para escala)
- **`src/hooks/useWorkflowPackageData.ts`**: já tem normalização (BLOCO B). Validar e adicionar `try/catch` no map externo.
- **`src/pages/Workflow.tsx` (linhas 509, 517, 756)**: revisar uso de `pacote.valor_base`, `produto.preco_venda` — já têm `|| 0`, ok.
- **`src/components/workflow/WorkflowTable.tsx` (linhas 562, 691)**: garantir `Number(value) || 0` antes de `toFixed` (defesa contra strings ou null vindos de regras congeladas).
- **`src/components/workflow/WorkflowCardCollapsed.tsx` / `WorkflowCardExpanded.tsx`**: idem, blindar `formatCurrency` interno.
- Adicionar `ErrorBoundary` ao redor do conteúdo principal de `Workflow.tsx` para que um futuro erro em um card não pinte a página inteira de branco.

### 4. Verificação
- Após edits, abrir `/app/workflow` e validar carregamento, sem erro no console.
- Confirmar que `GET /rest/v1/fin_transactions?...` retorna 200.
- Conferir notificações financeiras populando corretamente.

## Fora de escopo
- Não migrar `financial_items` ↔ `fin_items_master` (são tabelas distintas; o hook simplesmente apontava para a errada).
- Não tornar colunas `valor_*` em `NOT NULL` no banco — risco em dados legados; preferimos hardening no app.
- Não mexer no sidebar, Google Calendar, sync, etc.

## Arquivos a editar
1. `src/hooks/useWorkflowRealtime.ts`
2. `src/hooks/notifications/useFinancialNotifications.ts`
3. `src/components/workflow/WorkflowTable.tsx` (defensivo)
4. `src/components/workflow/WorkflowCardCollapsed.tsx` (defensivo)
5. `src/components/workflow/WorkflowCardExpanded.tsx` (defensivo)
6. `src/pages/Workflow.tsx` (adicionar `ErrorBoundary` no wrapper principal)
