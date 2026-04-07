

# Fix: Modal do editor de templates — labels, scroll e aproveitamento de tela

## Problemas

1. **Sem labels visíveis**: Os campos Nome, Categoria, Descrição e Tempo têm labels `text-xs text-muted-foreground` muito discretos — parecem invisíveis no fundo claro do modal
2. **Sem scroll**: `ScrollArea` (Radix) dentro de flex container com `max-h-[90vh]` não funciona corretamente — mesmo problema já documentado no modal de cobranças. Conteúdo fica cortado sem possibilidade de rolar
3. **Modal estreito**: `max-w-3xl` (48rem) não aproveita bem telas desktop de 1532px

## Correções

### 1. Labels visíveis com hierarquia clara

Trocar os labels de `text-xs text-muted-foreground` para `text-sm font-medium` — visíveis e com contraste adequado. Manter o padrão existente de `<Label>` acima do input.

### 2. Substituir ScrollArea por div nativa com overflow

Mesmo padrão já aplicado no ChargeModal (documentado na memória):
```
ScrollArea className="flex-1 pr-4"
→
div className="flex-1 min-h-0 overflow-y-auto pr-4"
```

### 3. Ampliar largura do modal

Trocar `max-w-3xl` por `max-w-4xl` para aproveitar melhor a tela no desktop (1532px viewport).

## Arquivo a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/configuracoes/FormularioTemplateEditor.tsx` | Substituir ScrollArea por div nativa, melhorar labels, ampliar max-w |

