

# Corrigir Preview Flutuante Cortado no Calendario Mensal

## Problema

O popover de preview esta posicionado com `position: absolute` dentro da celula do dia, que por sua vez esta dentro de um container com `overflow-auto`. Isso causa:
- Popover cortado quando a celula esta perto das bordas (direita, inferior)
- Barras de rolagem horizontais e verticais aparecem para acomodar o popover que "vaza"

## Solucao

Renderizar o popover usando **React Portal** (`createPortal` para `document.body`) com posicionamento calculado dinamicamente baseado no viewport, similar ao que frameworks como Radix/Floating UI fazem.

### Logica de posicionamento inteligente

1. Usar `ref` na celula do dia para obter `getBoundingClientRect()`
2. Calcular se ha espaco suficiente a direita (padrao) -- senao, posicionar a esquerda
3. Calcular se ha espaco suficiente abaixo (padrao) -- senao, alinhar pela parte inferior da celula
4. Popover fica em `position: fixed` no body, fora de qualquer container com overflow

```text
Celula no meio:          Celula na borda direita:
+------+                          +------+
| Dia  |--[Preview]      [Preview]--| Dia  |
+------+                          +------+

Celula no canto inferior direito:
                [Preview]--+------+
                           | Dia  |
                           +------+
```

### Alteracoes

**Arquivo: `src/components/agenda/MonthlyView.tsx`**
- Adicionar `ref` ao div da celula do dia
- Substituir o bloco do popover absoluto por um portal com posicionamento calculado
- Usar `useEffect` ou calculo inline para determinar posicao (top/left) baseado no `getBoundingClientRect` da celula e dimensoes do viewport

**Arquivo: `src/components/agenda/DayPreviewPopover.tsx`**
- Sem alteracoes no componente visual -- apenas o container que o envolve muda

### Detalhes tecnicos

O calculo de posicao no `DayCell`:
- Obter rect da celula via `cellRef.current.getBoundingClientRect()`
- Se `rect.right + 270 > window.innerWidth` -> posicionar a esquerda (`left = rect.left - 270`)
- Senao -> posicionar a direita (`left = rect.right + 4`)
- Se `rect.top + popoverHeight > window.innerHeight` -> alinhar pelo bottom (`top = rect.bottom - popoverHeight`)
- Senao -> alinhar pelo top (`top = rect.top`)
- Usar `position: fixed` com z-index alto

