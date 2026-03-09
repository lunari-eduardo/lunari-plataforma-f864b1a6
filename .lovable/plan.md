

# Redesign Visual Premium Glassmorphism + Fundo 3D Orbital

## Escopo

Implementar a identidade visual "Premium Glassmorphism" com fundo 3D orbital no dashboard e fundos animados nas páginas internas, conforme especificação completa do usuário.

## Ordem de Implementação

### 1. CSS Variables + Classe .glass + Scrollbar (`src/index.css`)

Atualizar `:root` e `.dark` com todas as novas variables (terra-50 a terra-900, glass tokens, primary-hover, primary-glow, warning, success). Adicionar classe `.glass` no `@layer components`. Atualizar scrollbar global. Remover a regra global de `box-shadow: none !important` no hover (linhas 520-529) que conflita com glass hover.

### 2. Tailwind Config (`tailwind.config.ts`)

Adicionar:
- `terra` color scale (50-900)
- `primary.hover`, `primary.glow`
- `boxShadow`: glass, glass-hover
- Keyframes: `eclipse-float`, `eclipse-float-reverse`, `aurora`
- Animations correspondentes

### 3. Componentes UI — Glassmorphism

**Card.tsx**: Aplicar classe `glass` como base, remover `bg-card` e `border-border/50` hardcoded.

**Dialog.tsx (DialogContent)**: Adicionar `backdrop-blur-xl bg-popover border-border/50`.

**Dropdown.tsx (DropdownMenuContent + SubContent)**: Adicionar `backdrop-blur-xl`.

**Popover.tsx (PopoverContent)**: Adicionar `backdrop-blur-xl`.

**Sheet.tsx (SheetContent)**: Adicionar `backdrop-blur-xl bg-background/80`.

### 4. DashboardBackground — Fundo 3D Orbital

Instalar `@react-three/fiber@^8.18.0`, `three@^0.160.0`, `@types/three@^0.160.0`.

Criar `src/components/backgrounds/DashboardBackground.tsx`:
- Base gradient (white light / dark gradient)
- Canvas Three.js com 4 anéis toroidais (copper #F28C52, rotações lentas) + 2 esferas orbitantes
- Aurora gradient overlay com animação suave
- SVG noise overlay (feTurbulence, 2% opacidade)
- Respeitar `prefers-reduced-motion`

### 5. InternalBackground — Fundo para páginas internas

Criar `src/components/backgrounds/InternalBackground.tsx`:
- 2 blobs radiais terra-cota animados (eclipse-float)
- 2 glows externos maiores com blur intenso
- SVG noise overlay (4.5% opacidade)
- Opacity reduzida no dark mode (25%)

### 6. Layout Integration

**Layout.tsx**: Renderizar `<InternalBackground />` como fundo padrão.

**Header.tsx**: Atualizar para `backdrop-blur-xl bg-white/40 dark:bg-background/60 border-border/30`.

**Index.tsx (Dashboard)**: Renderizar `<DashboardBackground />` como fundo dentro da página.

**Layout.tsx**: Condicionar `InternalBackground` para não aparecer no dashboard (o dashboard tem seu próprio fundo).

### 7. Body base

Atualizar `body` no CSS para fundo transparente (a profundidade vem dos componentes de fundo).

## Arquivos a Criar

- `src/components/backgrounds/DashboardBackground.tsx`
- `src/components/backgrounds/InternalBackground.tsx`

## Arquivos a Modificar

- `src/index.css` — Variables, .glass, scrollbar, body
- `tailwind.config.ts` — Terra scale, shadows, keyframes
- `src/components/ui/card.tsx` — Glass base
- `src/components/ui/dialog.tsx` — Backdrop blur
- `src/components/ui/dropdown-menu.tsx` — Backdrop blur
- `src/components/ui/popover.tsx` — Backdrop blur
- `src/components/ui/sheet.tsx` — Backdrop blur
- `src/components/layout/Layout.tsx` — InternalBackground condicional
- `src/components/layout/Header.tsx` — Glass header
- `src/pages/Index.tsx` — DashboardBackground

## Notas Técnicas

- A regra global `box-shadow: none !important` (linhas 520-529 do index.css) será removida pois impede o glass hover de funcionar
- Three.js renderiza em canvas com `alpha: true` para transparência
- Anéis usam `MeshBasicMaterial` com `transparent: true` para performance
- `prefers-reduced-motion` desativa Canvas 3D e animações de blob

