

# Metas: Modo exclusivo (Meses OU Categorias) + Remover meta de faturamento

## Mudanças

### 1. Modo exclusivo: Meses ou Categorias

Adicionar um seletor de modo logo após o toggle "Usar metas personalizadas":
- **Por Meses**: define meta de lucro para cada mês do ano (comportamento atual, sem faturamento)
- **Por Categorias**: define meta de lucro anual por categoria de sessão (Newborn, Família, etc.) — sem vínculo com mês

Quando o usuário escolhe um modo, o outro fica inativo. O modo selecionado é salvo no banco.

### 2. Remover campo "Meta de Faturamento"

Em todos os lugares (meses e categorias), remover o campo de faturamento. Manter apenas **Meta de Lucro**.

### 3. Modo "Por Categorias" — layout

- Lista das categorias configuradas no sistema
- Para cada uma: campo "Meta de Lucro (anual)"
- Botão "Adicionar categoria" se nem todas estão listadas
- Salvar com `mes = 0` (ou valor fixo) na tabela `metas_personalizadas` para indicar meta anual por categoria

### 4. Hook — ajustes

- Novo campo `modo_metas: 'mensal' | 'categoria'` salvo em `pricing_configuracoes`
- `salvarMetaCategoria`: usar `mes = 0` para metas anuais por categoria
- `getMetaParaMes`: quando modo = categoria, ignorar mês e buscar por categoria
- Remover `meta_faturamento` dos upserts (setar sempre 0)

---

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/financas/MetasConfigTab.tsx` | Seletor de modo; remover inputs de faturamento; modo categorias com layout simples |
| `src/hooks/useMetasPersonalizadas.ts` | Novo campo `modoMetas`; salvar/ler modo; categoria com `mes=0`; remover faturamento |
| `src/types/metas.ts` | Adicionar `modo_metas` ao tipo |
| Migration SQL | Adicionar `modo_metas TEXT DEFAULT 'mensal'` em `pricing_configuracoes` |

## Detalhes técnicos

- `pricing_configuracoes.modo_metas`: `'mensal'` ou `'categoria'`
- Metas por categoria: salvam com `mes = 0`, `categoria = <id>`, `meta_faturamento = 0`, `meta_lucro = valor`
- Metas por mês: salvam com `mes = 1..12`, `categoria = '__geral__'`, `meta_faturamento = 0`, `meta_lucro = valor`
- Referência da precificação no header: remover "Meta anual" (faturamento), manter apenas "Lucro anual" e "Lucro mensal"
- Resumo Anual: mostrar apenas total de lucro

