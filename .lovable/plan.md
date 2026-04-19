

# Plano de correção: Inconsistências no Extrato (Competência)

## Diagnóstico (confirmado via DB para Abril/2026)

| Métrica | Workflow | Extrato Caixa | Extrato Competência |
|---|---|---|---|
| Recebido | R$ 13.414 | R$ 39.798 | R$ 13.514 (correto) |
| Demonstrativo "Receita Sessões" | — | R$ 39.798 | **R$ 11.164** ❌ |
| Previsto / A Receber | R$ 17.584 / R$ 4.170 | — | — / **R$ 0,00** ❌ |

**3 bugs identificados:**

### Bug 1 — Demonstrativo (R$ 11.164) ≠ Card "Entradas pagas" (R$ 13.619) no mesmo modo

**Causa:** O demonstrativo (`useExtratoCalculationsSupabase`) faz JOIN `clientes_transacoes → clientes_sessoes!fk_transacoes_session_id` e usa `data_sessao` como referência. Pagamentos com `session_id` apontando para registros sem JOIN válido (sessão deletada, FK órfã, ou pagamentos da `cobranca` que materializam linhas no extrato mas não estão no JOIN) **caem fora do demonstrativo**.

Já o card de resumo soma direto das linhas da view `extrato_unificado` (que usa `COALESCE(cs.data_sessao, ct.data_transacao)`) — captura os órfãos via fallback.

**Fix:** Trocar a query do demonstrativo para **ler a mesma view `extrato_unificado`** (filtrando `tipo='entrada'`, status='Pago', regime selecionado). Garante consistência absoluta com cards e tabela detalhada.

### Bug 2 — "A Receber = R$ 0,00" no Competência (deveria mostrar saldo das sessões do mês)

**Causa:** Hoje `totalAReceber` = soma de linhas com `status='Agendado'` no extrato. Mas:
- Pagamentos só geram linha quando ocorrem (`clientes_transacoes`)
- O **saldo restante** de uma sessão (`valor_total - valor_pago`) nunca vira linha
- Resultado: extrato no regime competência ignora R$ 4.520 a receber de sessões de abril

**Fix:** No regime **competência**, calcular `totalAReceber` somando `(valor_total - COALESCE(valor_pago,0))` de `clientes_sessoes` com `data_sessao` no período + `fin_transactions` tipo entrada não-pagas. No regime caixa, manter lógica atual (entradas agendadas reais).

### Bug 3 — "Saldo Projetado" não inclui receita prevista a receber

**Causa:** `saldoProjetado = totalEntradas - totalSaidas`, onde `totalEntradas` só inclui transações que viraram linha. Despesas agendadas via `fin_transactions` viram linhas (entram em `saidasAgendadas`) — mas saldo a receber de sessões não.

**Fix:** Após corrigir Bug 2, recalcular: `saldoProjetado = entradasPagas + entradasAgendadas + receitaPrevistaSessoes - (saidasPagas + saidasAgendadas)`.

## Plano em 3 etapas

### Etapa 1 — Demonstrativo lê da view `extrato_unificado`

`useExtratoCalculationsSupabase.ts`:
- Substituir queries diretas em `clientes_transacoes`, `fin_transactions` por **query única na view** `extrato_unificado` filtrada por `user_id`, regime e período.
- Agrupar resultados por `tipo` (entrada/saida) + `categoria_grupo` (já exposto na view).
- Receitas: separar por `origem` (workflow=sessões; gallery=produtos; financeiro com grupo `Receita Não Operacional`=avulsas).
- Despesas: agrupar por `categoria_grupo` (já vem da view).
- Taxas gateway: continuar lendo `clientes_transacoes` (não estão na view), com mesmo filtro de data por regime.

### Etapa 2 — Card "A Receber" e "Saldo Projetado" inteligentes por regime

`useExtratoCalculationsSupabase.ts` — adicionar query auxiliar:

```ts
// Apenas no regime COMPETÊNCIA: saldo a receber de sessões do período
const { data: saldoSessoes } = await supabase
  .from('clientes_sessoes')
  .select('valor_total, valor_pago')
  .gte('data_sessao', dataInicio)
  .lte('data_sessao', dataFim);

const receitaPrevistaSessoes = regime === 'competencia'
  ? saldoSessoes.reduce((s, x) => s + (x.valor_total - (x.valor_pago||0)), 0)
  : 0;
```

Recalcular:
- `totalAReceber = entradasAgendadas + receitaPrevistaSessoes`
- `saldoProjetado = entradasPagas + totalAReceber - (saidasPagas + saidasAgendadas)`

No card "A Receber", adicionar legenda contextual:
- Caixa: "Entradas agendadas"
- Competência: "Saldo de sessões + agendadas"

### Etapa 3 — Tooltip explicativo no card Saldo Projetado

Atualizar subtítulo do card para refletir a lógica nova: "Pagas + a receber − despesas". Adicionar tooltip pequeno explicando a fórmula.

## Anti-bugs

1. **Sem dupla contagem**: pagamentos já efetivados aparecem como `entradasPagas` (linhas reais). O `receitaPrevistaSessoes` usa `valor_total - valor_pago`, então nunca soma o que já foi pago.
2. **Regime caixa não muda**: lógica atual preservada — `receitaPrevistaSessoes = 0`.
3. **Performance**: query auxiliar de saldo é leve (apenas 2 colunas). View `extrato_unificado` substitui 4-5 queries do demonstrativo por 1 só.
4. **Realtime**: invalidação já cobre `clientes_transacoes` e `fin_transactions`. Adicionar `clientes_sessoes` ao canal para refletir mudanças em valor_total/valor_pago.
5. **Workflow vs Extrato**: após correção, "Recebido R$ 13.414" no Workflow ≈ "Receita Sessões" no demonstrativo competência. Pequena diferença pode persistir se houver venda avulsa (sem session_id workflow) — esperado.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useExtratoCalculationsSupabase.ts` | Demonstrativo lê de `extrato_unificado`; calcula `receitaPrevistaSessoes`; recalcula `saldoProjetado` e `totalAReceber` |
| `src/hooks/useExtratoSupabase.ts` | Adicionar `clientes_sessoes` ao canal realtime |
| `src/components/extrato/ExtratoSummaryCards.tsx` | Subtítulos contextuais por regime; tooltip no Saldo Projetado |

