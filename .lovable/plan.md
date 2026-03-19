

# Plano: Taxas de Gateway como Despesa no Extrato e Demonstrativo

## Regra Financeira (imutável)

```text
Receita = valor bruto (R$100)    ← valor da venda
Taxa    = despesa (R$2,95)       ← custo operacional
Lucro   = 100 - 2,95 = R$97,05
```

Receita NUNCA usa `valor_liquido`. O campo `valor` (bruto) já está correto no demonstrativo — não será alterado.

## O que falta hoje

1. A view `extrato_unificado` só mostra pagamentos como entrada. As taxas (`taxa_gateway`, `taxa_antecipacao`) gravadas em `clientes_transacoes` **não aparecem como despesa** em lugar nenhum.
2. O demonstrativo (`useExtratoCalculationsSupabase`) busca despesas apenas de `fin_transactions`. Taxas de gateway não são consultadas.
3. Não existe lançamento automático de despesa para taxas — o trigger grava os valores nas colunas informativas mas não gera uma linha de saída.

## Mudanças

### 1. View `extrato_unificado` — Novo bloco UNION ALL para taxas

Adicionar um terceiro bloco que transforma registros de `clientes_transacoes` com taxas > 0 em linhas de saída:

```sql
UNION ALL
SELECT ct.id,
  ct.data_transacao AS data,
  'saida'::text AS tipo,
  'Taxa Gateway / Antecipação'::text AS descricao,
  'taxa_gateway'::text AS origem,
  c.nome AS cliente,
  cs.pacote AS projeto,
  cs.categoria AS categoria_session,
  'Taxas de Gateway'::text AS categoria,
  NULL::integer, NULL::integer,
  COALESCE(ct.taxa_gateway, 0) + COALESCE(ct.taxa_antecipacao, 0) AS valor,
  'Pago'::text AS status,
  NULL::text, NULL::text,
  ct.user_id, ct.session_id, ct.created_at
FROM clientes_transacoes ct
  LEFT JOIN clientes c ON ct.cliente_id = c.id
  LEFT JOIN clientes_sessoes cs ON ct.session_id = cs.session_id AND ct.user_id = cs.user_id
WHERE ct.tipo = 'pagamento'
  AND (COALESCE(ct.taxa_gateway, 0) + COALESCE(ct.taxa_antecipacao, 0)) > 0
```

### 2. Demonstrativo — Adicionar categoria "Taxas de Gateway"

No `useExtratoCalculationsSupabase`, após calcular receitas (que continuam usando `p.valor` bruto), buscar taxas de `clientes_transacoes` e adicioná-las como uma categoria de despesa:

```typescript
const { data: taxasGateway } = await supabase
  .from('clientes_transacoes')
  .select('taxa_gateway, taxa_antecipacao')
  .eq('tipo', 'pagamento')
  .gte('data_transacao', filtros.dataInicio)
  .lte('data_transacao', filtros.dataFim);

const totalTaxasGw = (taxasGateway || []).reduce(
  (sum, t) => sum + Number(t.taxa_gateway || 0), 0);
const totalTaxasAnt = (taxasGateway || []).reduce(
  (sum, t) => sum + Number(t.taxa_antecipacao || 0), 0);

// Adicionar ao array de categorias de despesa
if (totalTaxasGw + totalTaxasAnt > 0) {
  categorias.push({
    grupo: 'Taxas de Gateway',
    itens: [
      ...(totalTaxasGw > 0 ? [{ nome: 'Taxa Gateway', valor: totalTaxasGw }] : []),
      ...(totalTaxasAnt > 0 ? [{ nome: 'Taxa Antecipação', valor: totalTaxasAnt }] : []),
    ],
    total: totalTaxasGw + totalTaxasAnt
  });
}
```

### 3. Receita — NÃO alterar

A receita no demonstrativo já usa `p.valor` (bruto). Isso está correto e não será tocado.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | Recriar `extrato_unificado` com bloco de taxas como saída |
| `src/hooks/useExtratoCalculationsSupabase.ts` | Buscar taxas de `clientes_transacoes` e adicioná-las como categoria de despesa no demonstrativo |

## Resultado esperado

```text
DEMONSTRATIVO:
  Receita com sessões:        R$ 100,00  (bruto)
  TOTAL RECEITAS:             R$ 100,00

  Taxas de Gateway:
    Taxa Gateway:             R$   2,95
  TOTAL DESPESAS:             R$   2,95

  Resultado Líquido:          R$  97,05
```

