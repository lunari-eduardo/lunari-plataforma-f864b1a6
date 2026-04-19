

# Separação Caixa vs Competência no Financeiro

## Diagnóstico do problema

Hoje **todo o módulo financeiro mistura dois regimes** em um único campo de data:

| Origem | Campo de data atual | Significado real |
|---|---|---|
| `clientes_transacoes` (pagamentos sessão) | `data_transacao` | **CAIXA** — quando o dinheiro entrou |
| `clientes_sessoes` | `data_sessao` | **COMPETÊNCIA** — quando o serviço foi prestado |
| `fin_transactions` (despesas/receitas avulsas) | `data_vencimento` | Mistura dos dois (vencimento ≠ pagamento) |

**Sintoma reportado** (confirmado via DB):
- Pagamentos como o de R$ 250 com `data_transacao = 2026-04-19` mas `data_sessao = 2025-11-21`
- Card "Entradas (pagas)" do mês mostra R$ 12.428 (caixa do mês)
- Demonstrativo mostra R$ 39.903 (mistura de caixa + sessões antigas pagas hoje)
- Inconsistência visual → impossível ler o real desempenho do mês

## Estratégia de solução: Toggle global Caixa/Competência

Adicionar **um seletor único** no topo do Extrato (e Dashboard) que alterna o regime contábil. **Toda** a página reage ao toggle: cards de resumo, demonstrativo, tabela detalhada e exportações.

### Definição dos regimes

| Regime | Pagamentos sessão | Despesas/receitas avulsas | Quando usar |
|---|---|---|---|
| **Caixa** (padrão) | Filtra por `data_transacao` | Filtra por `data_vencimento` quando `status = 'Pago'` | Fluxo de caixa real, conciliação bancária |
| **Competência** | Filtra por `data_sessao` (fallback `data_transacao`) | Filtra por `data_vencimento` (independe de status) | Análise de performance do período de prestação do serviço |

## Plano em 5 etapas

### Etapa 1 — View `extrato_unificado` ganha duas datas

Migration: adicionar coluna `data_competencia` à view (não destrutivo, pois o front continua lendo `data` como caixa).

```sql
-- Pagamentos workflow: data_competencia = data_sessao (com fallback)
COALESCE(cs.data_sessao, ct.data_transacao) AS data_competencia
-- Estornos: mesma lógica
-- Receitas/despesas avulsas: data_competencia = data_vencimento (já é competência)
COALESCE(ft.data_competencia, ft.data_vencimento) AS data_competencia
-- Taxas gateway: data_competencia = data_sessao do pagamento de origem
```

Para `fin_transactions` (despesas/receitas avulsas), adicionar coluna opcional `data_competencia DATE NULL` na tabela. Quando NULL, usar `data_vencimento` como fallback (zero quebra para dados antigos). UI passa a expor o campo no modal de lançamento (opcional, ajuda no futuro).

### Etapa 2 — Hook `useExtratoSupabase` aceita `regime`

Novo parâmetro `regime: 'caixa' | 'competencia'` (default `caixa`).

```ts
const dataColumn = regime === 'caixa' ? 'data' : 'data_competencia';
query = query.gte(dataColumn, dataInicio).lte(dataColumn, dataFim);
query = query.order(dataColumn, { ascending: false });
```

A view retorna ambas as colunas; mapeamos a "data exibida" baseada no regime para que a tabela detalhada também mostre a data correta.

### Etapa 3 — Hook `useExtratoCalculationsSupabase` (demonstrativo)

Mesma lógica: receber `regime` e trocar a coluna usada nas queries Supabase:
- `clientes_transacoes`: filtrar por `data_transacao` (caixa) OU JOIN com `clientes_sessoes` filtrando por `data_sessao` (competência).
- `fin_transactions`: filtrar por `data_vencimento` (caixa exige `status = 'Pago'`, competência ignora status).

Cuidado anti-bug: para taxas de gateway no regime competência, a data de referência também é `data_sessao` (a taxa pertence economicamente à sessão, não ao recebimento).

### Etapa 4 — UI: Toggle global

`ExtratoTab.tsx`: adicionar `<SegmentedControl>` "Caixa | Competência" ao lado dos filtros de período. Persistir escolha em `localStorage` (`extrato_regime_default`).

Cards de resumo, demonstrativo e tabela passam a refletir o regime selecionado. Adicionar **badge sutil** no header da seção (ex.: "Visão por Caixa") + tooltip explicando a diferença.

`DashboardFinanceiro`: aplicar mesmo toggle (mesmo `localStorage` key) para coerência entre telas. Métricas "Receita", "Despesas", "Lucro" passam a respeitar o regime.

### Etapa 5 — Exportação PDF + indicação visual nas linhas

- PDF (`unifiedPdfUtils.ts`) inclui no cabeçalho: "Regime: Caixa" ou "Regime: Competência" + período.
- Tabela detalhada: quando `data_competencia ≠ data` (caixa), mostrar a data de competência em texto secundário abaixo da data principal: `19/04/2026 · ref. 21/11/2025`. Torna óbvio para o fotógrafo que aquele pagamento se refere a uma sessão antiga.

## Anti-bugs / cuidados

1. **Compatibilidade**: view continua expondo `data` (caixa). Apenas adicionamos `data_competencia`. Nenhum hook existente quebra.
2. **NULL-safe**: `COALESCE(cs.data_sessao, ct.data_transacao)` garante que pagamentos sem sessão vinculada (vendas avulsas, estornos órfãos) não desaparecem do demonstrativo.
3. **Sem duplicação**: não criamos novas tabelas/transações — apenas mudamos a coluna usada nos filtros.
4. **Filtros server-side preservados**: paginação, ordenação e contagem continuam no Supabase.
5. **Realtime**: invalidação por `queryKey` que inclui `regime` evita cache cruzado entre os modos.
6. **Teste de regressão**: depois da etapa 1, rodar query comparativa para validar que `SUM(valor)` no regime caixa = soma atual antes da mudança.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Adicionar coluna `data_competencia` em `fin_transactions` (opcional NULL) e recriar view `extrato_unificado` com `data_competencia` |
| `src/hooks/useExtratoSupabase.ts` | Aceitar `regime`, trocar coluna de filtro/ordem |
| `src/hooks/useExtratoCalculationsSupabase.ts` | Aceitar `regime`, ajustar queries do demonstrativo |
| `src/hooks/useExtratoData.ts` + `src/hooks/useExtrato.ts` | Propagar `regime` |
| `src/components/financas/ExtratoTab.tsx` | Toggle Caixa/Competência + persistência localStorage |
| `src/components/extrato/ExtratoTable.tsx` | Mostrar data de competência secundária quando diferir |
| `src/components/financas/DashboardFinanceiro.tsx` + hooks de métricas | Respeitar mesmo toggle |
| `src/utils/unifiedPdfUtils.ts` | Indicar regime no PDF |
| `ModalNovoLancamentoRefatorado.tsx` | Campo opcional "Data de competência" em despesas/receitas avulsas |

