

# Glassmorphism e Ajustes Visuais no Sistema

## Problemas Identificados

1. **WorkflowCardList** usa `bg-gradient-to-b from-gray-100/80 via-gray-50 to-gray-100/60` — fundo sólido cinza que bloqueia o background decorativo
2. **Container principal do Workflow** (`border rounded-lg` na linha 929) não tem glass styling
3. **Links de clientes** usam `text-blue-600` em 6 ocorrências no `WorkflowCardCollapsed.tsx` — devem usar `text-primary`
4. **InternalBackground** tem blobs com opacidade 0.35 e container com `opacity-100` — muito saturado no light mode
5. **Barra de métricas** usa `bg-muted/50` — sólido
6. **Ícones de produtos** usam `text-blue-600` — devem usar `text-primary`

## Alterações

### `src/components/workflow/WorkflowCardList.tsx`
- Remover `bg-gradient-to-b from-gray-100/80 via-gray-50 to-gray-100/60 dark:bg-gradient-to-b dark:from-[#0e0e0e] dark:via-[#131313] dark:to-[#0e0e0e]`
- Substituir por background transparente (sem bg, apenas o overflow container)

### `src/pages/Workflow.tsx`
- Linha 823: Métricas `bg-muted/50` → `bg-white/30 backdrop-blur-lg dark:bg-white/[0.04]`
- Linha 929: Container `border rounded-lg` → adicionar glass: `border rounded-lg bg-white/30 backdrop-blur-xl dark:bg-white/[0.04] border-white/50 dark:border-white/10`
- Linha 931: `p-4 border-b` → adicionar `border-white/40 dark:border-white/10`

### `src/components/workflow/WorkflowCardCollapsed.tsx`
- 6 ocorrências de `text-blue-600 hover:text-blue-800` nos links de cliente → `text-primary hover:text-primary/80`
- 3 ocorrências de `text-blue-600` nos ícones Package → `text-primary`

### `src/components/backgrounds/InternalBackground.tsx`
- Container externo: `opacity-100` → `opacity-90` (light mode: 10% menos opaco)
- Blobs principais: `rgba(172, 94, 58, 0.35)` → `rgba(172, 94, 58, 0.22)` (menos saturados)
- Blobs de glow externo: reduzir proporcionalmente

### `src/components/workflow/WorkflowCardExpanded.tsx`
- `text-blue-600` nos ícones Package → `text-primary`

