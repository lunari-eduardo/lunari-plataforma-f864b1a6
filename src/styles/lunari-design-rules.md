# Lunari Design Rules — Visual Component System

> Fonte de verdade: `docs/constitution/DESIGN_DNA.md`. Este arquivo é o resumo operacional das mesmas regras aplicadas a componentes.

## Identidade — Lunari Grafite

Único preset visual do sistema. Distribuição obrigatória: **85% Neutros · 12% Grafite · 3% Dourado**.

- **Grafite `#171717`** — assinatura da marca, CTAs (light), sidebar (light e dark).
- **Neutros** — superfícies, textos, bordas. Fundo claro `#F7F7F5`, fundo escuro `#0E0E0E`.
- **Dourado `#C6A36A`** — reservado a ícones, microinterações, hover em gráficos e Assistente IA. **Nunca fundo de botão** no modo light. No modo dark o botão primário usa dourado suave `#EDE7DA` (quase branco) com texto grafite.

Nunca usar cores literais em componentes (`text-white`, `bg-black`, `#ef4444`, `purple-*`, `orange-*`). Sempre tokens.

---

## Arquitetura de Camadas

```
App Background (Layer 0)  →  fixed, decorativo, z-0
  ↓
Page Container (Layer 1)  →  estrutural, sem glass, sem background
  ↓
Glass Cards (Layer 2)     →  interativo, glass, hover controlado
```

- Layer 0: gradientes neutros sobre `--surface-0`. Nunca glass/blur nesta camada.
- Layer 1: `max-width: 1400px; margin: 0 auto; padding: 32px`. Nada de blur/glass/background aqui.
- Layer 2: use `.lunari-card`, `.lunari-panel`, `.lunari-list-card` ou `.glass`.

---

## Regras de Hover (críticas)

### ✅ Faça:
- **Aumentar** opacidade do fundo (`0.55 → 0.75`).
- **Aumentar** profundidade da sombra.
- Micro-lift `translateY(-2px)` é opcional.

### ❌ Nunca:
- `hover:opacity-*` em cards ou botões.
- `hover:bg-transparent` ou reduzir alpha do fundo.
- `group-hover` que reduza opacidade dos irmãos.
- `hover:bg-black/*` sobre glass claro (escurece em vez de elevar).

### Padrão correto:

```css
/* Light */
.card { background: hsl(var(--glass-tint) / 0.55); }
.card:hover { background: hsl(var(--glass-tint) / 0.75); }

/* Dark */
.dark .card { background: hsl(0 0% 100% / 0.05); }
.dark .card:hover { background: hsl(0 0% 100% / 0.08); }
```

### Botão:
```
❌  hover:opacity-90
✅  hover:bg-primary/90   (ou variante hover do token)
```

Alterar **cor/alpha do fundo**, não a **opacidade do elemento**.

---

## Tokens de referência

| Token | Uso |
|---|---|
| `--primary` | CTAs, foco (grafite no light, quase-branco no dark). |
| `--foreground` / `--muted-foreground` | Texto Nível 1 / Nível 3. |
| `--accent-gold` | Ícones, microinterações, hover em gráficos. Nunca fundo amplo. |
| `--chart-1..9` | Escala monocromática cinza→preto para gráficos. |
| `--chart-10` | Dourado — reservado a hover/ponto ativo. |
| `--success` / `--warning` / `--error` | Estados semânticos (nunca decoração). |
| `--sidebar-*` | Sidebar sempre grafite, independente do modo. |

---

## Hierarquia de Sombras

```
Base:      shadow-sm  (var(--shadow-1))
Expandido: shadow-md  (var(--shadow-2))
Hover:     shadow-lg  (var(--shadow-3))
```

Sombra de hover deve **sempre** ser ≥ sombra do estado expandido.

---

## Gráficos

- Recharts em escala **monocromática** por padrão (`--chart-1..9`).
- Dourado (`--chart-10` / `--accent-gold`) só em hover, tooltip ativo ou ponto de destaque único.
- Legendas e labels em `text-muted-foreground`.

---

## Sidebar

- Sempre grafite (`--sidebar-bg` = `#171717`) em light e dark.
- Item ativo: fundo `--sidebar-accent`, texto `--sidebar-accent-fg`, ícone em `--accent-gold`.
- Nunca aplicar `bg-background` ou `text-foreground` na sidebar — use os tokens `--sidebar-*`.

---

## Estrutura de página

```tsx
<AppBackground>
  <Sidebar />
  <PageContainer>
    <Header />
    <LunariPanel />    {/* widgets de dashboard */}
    <LunariCard />     {/* cards de conteúdo */}
    <LunariListCard /> {/* linhas de workflow */}
  </PageContainer>
</AppBackground>
```
