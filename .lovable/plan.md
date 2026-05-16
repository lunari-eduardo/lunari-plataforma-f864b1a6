
# Sidebar com Expansão por Hover (Desktop)

## Objetivo
Transformar a sidebar desktop atual (`src/components/layout/Sidebar.tsx`) — hoje controlada por clique no botão chevron — em uma sidebar que expande automaticamente ao hover e recolhe ao sair, com animação suave, sem layout shift agressivo e sem afetar o comportamento mobile (bottom nav + drawer continua igual).

## Comportamento

**Recolhida (default, 64px / `w-16`)**
- Apenas ícones centralizados
- Tooltip suave ao hover de cada ícone (Radix Tooltip, delay ~400ms)
- Item ativo continua destacado como hoje

**Expandida (hover, 192px / `w-48`)**
- Ícones + labels (mesma estrutura atual)
- Logo "Lunari" aparece no topo com fade
- Labels com fade-in leve (não slide brusco)

**Transições**
- Expandir: 200ms `cubic-bezier(0.32, 0.72, 0, 1)` (curva Linear/Vercel)
- Recolher: 240ms mesma curva
- Labels: opacidade com 120ms, atrasada ~60ms na expansão; some primeiro no recolhimento
- Pequeno delay de intent: 60ms antes de expandir, 120ms antes de recolher (evita "piscar" ao passar de raspão)

## Mudanças técnicas

### `src/components/layout/Sidebar.tsx`
1. Remover botão chevron e estado `isDesktopExpanded` controlado por clique.
2. Estado novo: `isHovered` controlado por `onMouseEnter` / `onMouseLeave` no container desktop, com `setTimeout` de intent (refs para clear no unmount).
3. Container desktop:
   - `transition-[width] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]`
   - Largura: `w-16` → `w-48` baseada em `isHovered`
   - `will-change: width` durante transição
4. NavItem desktop: sempre renderiza ícone + label; label envolto em `<span>` com `transition-opacity duration-150` + `opacity-0 pointer-events-none` quando recolhido, `opacity-100 delay-[60ms]` quando expandido. `whitespace-nowrap overflow-hidden` no container do label para evitar quebra durante animação.
5. Tooltips: quando recolhido, envolver cada `NavItem` com `<Tooltip>` (shadcn) `side="right"`. Quando expandido, tooltip desabilitado (`open={false}` ou `disabled`).
6. Logo "Lunari" opcional no topo da sidebar desktop, mesma técnica de fade do label.
7. Mobile (bottom nav + drawer): intocado.

### Evitar layout shift no conteúdo principal
- Verificar `src/App.tsx` / layout pai: se o conteúdo usa `flex` ao lado da sidebar, ele vai redimensionar a cada hover. Solução: a sidebar desktop fica `fixed` (ou `absolute`) sobre o conteúdo quando expandida, mantendo um spacer `w-16` fixo no fluxo.
  - Implementação: wrapper externo `w-16 shrink-0` (spacer), sidebar real `fixed top-0 left-0 h-screen w-16 hover:w-48`. Conteúdo principal nunca se move.
- Confirma o requisito "não empurrar conteúdo principal bruscamente".

### Performance
- Animar apenas `width` (com `will-change`) e `opacity` — propriedades baratas.
- Sem re-render: `isHovered` afeta apenas classes, NavItems não remontam.
- `React.memo` no NavItem se necessário (verificar se já há renders custosos).

### Acessibilidade
- `aria-expanded` no container
- Foco via teclado também expande (via `onFocus`/`onBlur` capture na sidebar) — mantém usabilidade keyboard
- Tooltips com `aria-label` já vêm do shadcn

## Arquivos afetados
- `src/components/layout/Sidebar.tsx` (refactor principal)
- `src/App.tsx` ou layout pai (verificar e ajustar wrapper se necessário para fixed + spacer)
- Nenhuma mudança em mobile, em rotas, em lógica de plano/PRO badge

## Fora de escopo
- Submenus (estrutura preparada via espaço para children, mas não implementados agora)
- Persistir preferência de "sempre expandida" (removendo o chevron, perdemos esse toggle — confirmar se OK ou se devo manter um pin opcional)

## Ponto a confirmar
Devo **remover totalmente** o botão chevron de expandir/recolher, ou manter um botão "pin" que fixa a sidebar expandida (ignorando hover)? Recomendação: remover (mais clean, alinhado com Linear/Raycast). Se preferir pin, adiciono um ícone discreto no rodapé.
