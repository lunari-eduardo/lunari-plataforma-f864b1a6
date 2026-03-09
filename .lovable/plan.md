

# Fix Visual: Alinhar com Gallery + Corrigir Bugs

## Problemas Identificados

Comparei o código atual com o projeto [Lunari Gallery](/projects/8f0538c4-45b7-450e-b9bb-169d0dcc657e) e identifiquei as diferenças que causam os bugs visuais:

### 1. Card.tsx usa `.glass` class errada
- **Gallery**: `"rounded-lg border bg-card text-card-foreground shadow-sm backdrop-blur-xl"` — usa `bg-card` normal
- **Atual**: `"glass text-card-foreground"` — a classe `.glass` força `background: hsl(var(--glass-bg)) !important` que sobrescreve tudo e causa transparência excessiva em TODOS os cards do sistema

### 2. DashboardBackground — Aurora com gradientes errados
- **Gallery**: Usa `linear-gradient` múltiplos com `inset-[-20%]` e classe CSS `aurora-animate`
- **Atual**: Usa `radial-gradient` com `inset-0` e animação inline — resultado visual diferente

### 3. DashboardThreeCanvas — Rotação diferente
- **Gallery**: Usa `useFrame((_, delta)` com rotação baseada em delta (frame-rate independent) e configs de eixo/direção separadas
- **Atual**: Usa `clock.getElapsedTime()` com rotação em todos os eixos simultaneamente — movimento diferente e potencialmente mais pesado

### 4. Classe CSS `aurora-animate` ausente
- **Gallery**: Define `.aurora-animate { animation: aurora 20s ease infinite; }` no CSS
- **Atual**: Usa `style={{ animation: 'aurora 20s ease-in-out infinite' }}` inline — funciona mas é inconsistente

### 5. DashboardBackground lazy-load pode estar falhando
- **Gallery**: Tudo num único arquivo `Home.tsx`, sem lazy load — funciona direto
- **Atual**: Usa `lazy(() => import('./DashboardThreeCanvas'))` — pode causar flash ou falha silenciosa

## Plano de Correção

### 1. `src/components/ui/card.tsx`
Alinhar com Gallery — remover `.glass`, usar `bg-card backdrop-blur-xl`:
```tsx
"rounded-lg border bg-card text-card-foreground shadow-sm backdrop-blur-xl"
```

### 2. `src/components/backgrounds/DashboardBackground.tsx`
Reescrever para coincidir com Gallery:
- Mover a cena 3D para dentro do mesmo arquivo (sem lazy load)
- Aurora: trocar radial-gradient por linear-gradient com `inset-[-20%]` e classe `aurora-animate`
- Detectar dark mode via MutationObserver no `document.documentElement` (como Gallery faz)

### 3. `src/components/backgrounds/DashboardThreeCanvas.tsx`
Remover arquivo separado. A lógica 3D vai direto no `DashboardBackground.tsx`, replicando exatamente:
- `RING_CONFIGS` com `axis`, `period`, `direction` separados
- `TorusRing` com rotação delta-based por eixo
- `OrbitingSphere` como filho dos rings (não posição absoluta)
- `OrbitalScene` como grupo wrapper

### 4. `src/index.css`
Adicionar classes CSS que faltam:
```css
.aurora-animate {
  animation: aurora 20s ease infinite;
}
```
As keyframes `aurora`, `eclipse-float`, `eclipse-float-reverse` já estão no arquivo — apenas a classe utilitária `.aurora-animate` falta.

### 5. Manter `InternalBackground.tsx` e `Layout.tsx` como estão
Estes estão corretos e alinhados com a especificação.

## Arquivos

**Modificar:**
- `src/components/ui/card.tsx` — Trocar `.glass` por classes do Gallery
- `src/components/backgrounds/DashboardBackground.tsx` — Reescrever com 3D inline, aurora linear-gradient, MutationObserver
- `src/index.css` — Adicionar `.aurora-animate`

**Remover:**
- `src/components/backgrounds/DashboardThreeCanvas.tsx` — Mover lógica para DashboardBackground

