

# Fix: Dashboard Layout Quebrado — Sidebar, Z-index e Cards Dark Mode

## Problemas Identificados

### 1. Sidebar desaparece APENAS no Dashboard
**Causa raiz**: `DashboardBackground` tem `fixed inset-0 z-0` e é renderizado **dentro** do `Index.tsx` (via `<Outlet />`). O gradiente base é **opaco** (branco sólido no light, gradiente escuro no dark), cobrindo toda a viewport — incluindo a área do sidebar. O sidebar não tem z-index explícito, então fica atrás.

Camadas atuais no Dashboard:
```text
z-50  Header (ok — tem z-50)
z-10  <main> content (cards do dashboard)
z-0   DashboardBackground (fixed inset-0 — COBRE TUDO, inclusive sidebar)
---   Sidebar (sem z-index — escondido atrás do background)
```

### 2. Menu pisca e desaparece no light mode
O sidebar renderiza primeiro, depois o `DashboardBackground` monta com gradiente branco opaco por cima.

### 3. Cards brancos/transparentes no dark mode
`--card: 20 12% 10% / 0.4` — apenas 40% de opacidade. Contra o fundo 3D escuro, os cards ficam quase invisíveis. Texto claro sobre fundo quase transparente = ilegível.

## Correções

### 1. `src/components/layout/Layout.tsx`
Mover o `DashboardBackground` do Index.tsx para o Layout.tsx, renderizando-o condicionalmente (como já faz com InternalBackground). Adicionar `relative z-20` ao sidebar para garantir que fique acima de qualquer background fixo.

```text
Camadas corrigidas:
z-50  Header
z-20  Sidebar (novo z-index)
z-10  <main> content
z-0   DashboardBackground (fixed, mas atrás do sidebar)
```

### 2. `src/pages/Index.tsx`
Remover `<DashboardBackground />` e seu import — o background agora vem do Layout.

### 3. `src/index.css`
Aumentar opacidade dos cards para legibilidade:
- Light: `--card: 30 30% 98% / 0.65` (era 0.38)
- Dark: `--card: 20 12% 10% / 0.72` (era 0.4)
- Light `--popover: 30 30% 98% / 0.7` (era 0.42)

### 4. `src/components/layout/Sidebar.tsx`
Adicionar `relative z-20` ao container do sidebar desktop para ficar acima dos backgrounds fixos.

## Arquivos Modificados
- `src/components/layout/Layout.tsx` — importar e renderizar DashboardBackground condicionalmente
- `src/pages/Index.tsx` — remover DashboardBackground
- `src/components/layout/Sidebar.tsx` — adicionar z-20
- `src/index.css` — ajustar opacidade de --card e --popover

