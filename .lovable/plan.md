

# Melhorar visualização da lista de lançamentos

## Problema
A lista está visualmente apagada no modo light: fontes pequenas, sem separadores visuais entre seções, e sem contraste suficiente para leitura rápida.

## Mudanças

### 1. Seções com separadores visuais (`LancamentosTab.tsx`)
- Adicionar uma **borda lateral colorida** (left border 3px) em cada seção usando `info.corBorda` do `GRUPOS_CONFIG`
- Aumentar spacing entre seções: `space-y-1` → `space-y-3`
- Header da seção: fonte `text-sm` → `text-base font-bold`
- Adicionar um fundo sutil no header: `bg-muted/30 rounded-lg`
- Seções vazias colapsadas: manter com opacidade reduzida

### 2. Tabela desktop mais legível (`TabelaLancamentos.tsx`)
- Fontes maiores: `text-xs` → `text-sm` nas colunas Data e Status; `text-sm` → `text-base` na Descrição
- Headers da tabela: `text-[10px]` → `text-xs`
- Padding das células: `px-3 py-1.5` → `px-3 py-2.5`
- Separadores entre linhas: `border-border/20` → `border-border/40`
- Valor em `font-semibold` em vez de `font-medium`

### 3. Mobile mais legível (`TabelaLancamentosMobile.tsx`)
- Trocar cores hardcoded (`text-gray-900`, `bg-gray-100`) por tokens do tema (`text-foreground`, `bg-muted`)
- Aumentar padding e fonte do nome do item

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/financas/LancamentosTab.tsx` | Spacing entre seções, borda lateral colorida, header maior |
| `src/components/financas/TabelaLancamentos.tsx` | Fontes maiores, padding maior, separadores mais visíveis |
| `src/components/financas/TabelaLancamentosMobile.tsx` | Trocar cores hardcoded por tokens do tema |

