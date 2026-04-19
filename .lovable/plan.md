

# Plano de correção: Inconsistências do Extrato (cards × demonstrativo)

## Diagnóstico (confirmado via DB para Abril/2026)

### Bug 1 — Demonstrativo mostra **R$ 0,00** em todas as despesas ❌

**Causa raiz** (`useExtratoCalculationsSupabase.ts` linhas 132–194):
- A view `extrato_unificado` já retorna `categoria = grupo_principal` (ex: `"Despesa Fixa"`, `"Despesa Variável"`, `"Investimento"`).
- O código **ignora isso** e cria um mapa `itemToGrupo` mapeando `nome_do_item → grupo` (ex: `"Aluguel" → "Despesa Fixa"`).
- Depois faz `itemToGrupo.get(l.categoria)` onde `l.categoria` **já é o grupo** ("Despesa Fixa"). O lookup retorna `undefined` → **nenhuma linha entra em nenhum grupo** → Total Despesas = R$ 0,00.
- Mesmo problema afetaria o nome dos itens: usaria "Despesa Fixa" como nome em vez de "Aluguel".

Confirmação via DB: a view retorna corretamente 11 linhas de despesa em abril (R$ 5.255,74 total).

### Bug 2 — Cards superiores mostram **R$ 23.780** mas demonstrativo mostra **R$ 39.903** ❌

**Causa raiz** (`useExtratoCalculationsSupabase.ts` linhas 51–82):
- Os cards (`resumo`) são calculados a partir de `linhasFiltradas` — que vêm **paginadas** de `useExtratoSupabase` (apenas 100 linhas da página atual).
- Há 193 movimentações no período: a página 1 cobre só ~50% do total → cards mostram metade.
- O demonstrativo, corretamente, faz query própria sem paginação → mostra os R$ 39.903 reais.
- **Resultado:** cards inconsistentes com demonstrativo, tabela e realidade.

Mesma causa explica:
- "Saídas (pagas) R$ 0,00" + "Futuras R$ 705,06": as despesas pagas de abril (~R$ 4.488) estão em páginas posteriores; a página 1 (mais recente) só contém agendadas de 30/04 e 21/04.
- "A Receber R$ 0,00" no Caixa.

## Correção em 2 frentes

### Fix 1 — Demonstrativo: usar `categoria` da view diretamente (sem mapa)

`useExtratoCalculationsSupabase.ts` (linhas 132–194):
- **Remover** a query a `fin_items_master` e o mapa `itemToGrupo`.
- Agrupar despesas direto por `l.categoria` (que já é o `grupo_principal`).
- Para nome do item, usar `l.descricao` (que é o `fim.nome` exposto pela view — ex: "Aluguel", "Internet").
- Receita não operacional: filtrar por `l.categoria === 'Receita Não Operacional'` direto.

```ts
// Despesas agrupadas direto pela coluna categoria da view
for (const grupo of GRUPOS_DESPESAS) {
  const linhasGrupo = saidasFinanceiro.filter(l => l.categoria === grupo);
  if (linhasGrupo.length === 0) continue;
  const itensPorNome: Record<string, number> = {};
  linhasGrupo.forEach(l => {
    const nome = l.descricao || 'Item desconhecido';
    itensPorNome[nome] = (itensPorNome[nome] || 0) + Number(l.valor);
  });
  // ...
}
```

Ganhos: 1 query a menos, código mais simples, agrupamento correto, nomes corretos dos itens.

### Fix 2 — Cards superiores: query agregada **sem paginação**

`useExtratoCalculationsSupabase.ts` — adicionar nova `useQuery` que faz **soma agregada por tipo+status** na view `extrato_unificado` filtrada por período/regime, sem usar `linhasFiltradas`.

```ts
const { data: totaisPeriodo } = useQuery({
  queryKey: ['extrato-totais-periodo', regime, filtros.dataInicio, filtros.dataFim, filtros.tipo, filtros.origem, filtros.status, filtros.busca],
  queryFn: async () => {
    const dataColumn = regime === 'competencia' ? 'data_competencia' : 'data';
    let q = supabase.from('extrato_unificado')
      .select('tipo,status,valor')
      .eq('user_id', user.id)
      .gte(dataColumn, filtros.dataInicio)
      .lte(dataColumn, filtros.dataFim);
    // aplicar mesmos filtros de tipo/origem/status/busca usados na tabela
    const { data } = await q;
    // somar por (tipo,status)
    return agregar(data);
  }
});
```

Recalcular `resumo` a partir de `totaisPeriodo` (não mais de `linhasFiltradas`). Manter `linhasFiltradas` apenas para a tabela detalhada paginada.

**Importante:** os filtros aplicados (tipo/origem/status/busca) precisam estar na queryKey **e** na query, para os cards refletirem exatamente o que o usuário filtrou — coerente com a tabela.

### Fix 3 — Garantir que filtros do extrato afetam totais

`useExtratoSupabase` hoje só aplica filtros de período. Filtros de tipo/origem/status/busca são aplicados **client-side** depois. Isso significa que paginação + busca produzem resultados imprecisos. Para os totais agregados serem corretos, vamos:

- Mover filtros de `tipo`, `origem`, `status` para server-side em `useExtratoSupabase` e na nova query agregada (mesma lógica em ambos).
- Manter `busca` (texto livre) client-side por simplicidade — quando usuário digitar texto, o card mostrará total agregado do período (sem filtro de busca) com nota "(filtros de texto não afetam o total)" — alternativa simples.

## Anti-bugs

1. **Sem dupla contagem:** novos totais vêm direto da view (única fonte). Cards, tabela e demonstrativo passam a usar a mesma fonte.
2. **Performance:** query agregada retorna ~3 colunas × N linhas; reduce client-side. Sem JOINs adicionais.
3. **Filtros server-side:** mover `tipo`/`origem`/`status` para `.eq()` no Supabase em ambas queries (paginada e agregada) para coerência total.
4. **Realtime preservado:** invalidação atual (`extrato-unificado`) também invalida `extrato-totais-periodo` se prefixo coincidir — usar mesmo prefixo na queryKey.
5. **Receita Prevista (competência):** continua via query separada `extrato-receita-prevista-sessoes` — sem mudança.

## Resultados esperados (Abril/2026, regime Caixa)

| Métrica | Antes | Depois |
|---|---|---|
| Entradas (pagas) card | R$ 23.780 ❌ | **R$ 39.903** ✅ |
| Saídas (pagas) card | R$ 0,00 ❌ | **R$ 4.550,68** ✅ |
| Demonstrativo Total Despesas | R$ 0,00 ❌ | **R$ 5.255,74** ✅ |
| Demonstrativo Despesas Fixas | (vazio) ❌ | Aluguel, Internet, Canva… ✅ |
| Saldo Real | R$ 23.780 ❌ | **R$ 35.352** ✅ |

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useExtratoCalculationsSupabase.ts` | (1) Remover mapa `itemToGrupo`, agrupar despesas por `l.categoria` direto; usar `l.descricao` como nome do item. (2) Nova query agregada `extrato-totais-periodo` para alimentar `resumo` independente de paginação. |
| `src/hooks/useExtratoSupabase.ts` | Aplicar filtros de `tipo`/`origem`/`status` server-side (preparação para totais consistentes). |
| `src/hooks/useExtrato.ts` | Passar filtros completos para `useExtratoCalculationsSupabase` (não só período). |

