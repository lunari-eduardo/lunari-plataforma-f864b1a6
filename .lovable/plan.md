

# Cards Transparentes, Inputs Alinhados e Descrição Expansível

## 1. Card transparente por padrão, branco no hover

**`WorkflowCard.tsx`** — Inverter a lógica atual:
- Base: `bg-transparent` (sem fundo, sem blur) com borda sutil `border-border/30`
- Hover collapsed: `hover:bg-white/55 hover:backdrop-blur-xl` (glass aparece no hover)
- Expanded: `bg-white/50 backdrop-blur-xl` (mantém glass enquanto aberto)
- Dark mode segue o mesmo princípio

Remover `backdrop-blur-xl` e `backdrop-saturate` do estado base. Aplicar apenas no hover e expanded.

## 2. Padronizar inputs e combobox na row colapsada

**`WorkflowCardCollapsed.tsx`** — Unificar estilos:
- Todos os inputs (Descrição, Fotos Extras) e combobox triggers (Pacote) devem usar a mesma classe: `h-7 text-xs border border-border/40 rounded-md bg-transparent`
- Remover `shadow-neumorphic` e `hover:shadow-neumorphic-pressed` do trigger do `WorkflowPackageCombobox.tsx`
- Remover `bg-background/50` e `focus:bg-background` dos inputs — usar `bg-transparent focus:bg-white/60 dark:focus:bg-white/10`

**`WorkflowPackageCombobox.tsx`** — Limpar trigger:
- Trocar `shadow-neumorphic hover:shadow-neumorphic-pressed` por estilos consistentes com os inputs

## 3. Descrição expande quando card abre

**`WorkflowCardCollapsed.tsx`** — Quando `isExpanded=true`:
- O input de descrição muda de `<Input>` (single-line truncado) para `<Textarea>` com `min-h-[28px]` e auto-resize, mostrando o texto completo
- Usar `rows={1}` com CSS `field-sizing: content` ou calcular altura baseado no conteúdo
- Alternativa mais simples: quando expandido, remover `truncate` e permitir `whitespace-normal` com `max-h-[80px] overflow-y-auto`

Na prática: usar um `<Textarea>` condicional com `className="resize-none min-h-[28px]"` e `rows` calculado pelo tamanho do texto, ou simplesmente trocar a classe do Input para remover truncate e deixar wrap natural quando expandido.

## Resumo de arquivos

```text
Arquivo                              Mudança
────────────────────────────────────  ────────────────────────────
WorkflowCard.tsx                     bg-transparent base, glass no hover/expanded
WorkflowCardCollapsed.tsx            Inputs padronizados, descrição expansível
WorkflowPackageCombobox.tsx          Remover neumorphic shadows do trigger
```

3 arquivos. Apenas CSS/className. Zero lógica de negócio.

