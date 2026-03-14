# Lunari Design Rules — Visual Component System

## 3-Layer Architecture

```
App Background (Layer 0)  →  fixed, decorative, z-0
  ↓
Page Container (Layer 1)  →  structural, no glass, no background
  ↓
Glass Cards (Layer 2)     →  interactive, glass, hover states
```

---

## Layer 0 — App Background

Already implemented via `InternalBackground` / `DashboardBackground`.

- Light: radial gradients with terracotta tints over `#f8f7f5`
- Dark: radial gradients with terracotta tints over `#0f0f10`
- **Never** add glass or blur to this layer

---

## Layer 1 — Page Container

Structural only. Centers and constrains content.

```
max-width: 1400px
margin: 0 auto
padding: 32px
```

**Never** add: blur, glass, background-color, shadows.

---

## Layer 2 — Glass Cards

All interactive cards use one of these classes:

| Class | Use Case |
|---|---|
| `.lunari-card` | Default card (lists, content) |
| `.lunari-panel` | Dashboard panels (no hover lift) |
| `.lunari-list-card` | Workflow rows (compact, grid-aligned) |
| `.glass` | Legacy utility (same principle) |

---

## Hover Rules (CRITICAL)

### ✅ Always do:
- **Increase** background opacity on hover (e.g. `0.55 → 0.75`)
- **Increase** shadow depth on hover
- Small lift is OK (`translateY(-2px)`) but optional

### ❌ Never do:
- `hover:opacity-*` on buttons or cards (reduces visibility)
- `hover:bg-transparent` or reducing background alpha
- `group-hover` that reduces sibling opacity
- `hover:bg-black/*` over white glass (darkens instead of elevating)

### Correct hover pattern:

```css
/* Light */
.card { background: rgba(255,255,255,0.55); }
.card:hover { background: rgba(255,255,255,0.75); }

/* Dark */
.dark .card { background: rgba(40,40,42,0.55); }
.dark .card:hover { background: rgba(60,60,62,0.70); }
```

### Button hover:
```
❌  hover:opacity-90
✅  hover:bg-destructive/90
```

Change the **background color/alpha**, not the **element opacity**.

---

## Terracotta Palette Reference

| Token | Value | Use |
|---|---|---|
| Primary | `#AC5E3A` / `hsl(19 49% 45%)` | CTAs, links, accents |
| Primary hover | `hsl(24 35% 59%)` | Hover states |
| Primary glow | `hsl(19 49% 60%)` | Shadows, glows |
| Background light | `#F8F7F5` / `hsl(30 40% 96%)` | App background |
| Background dark | `#0F0F10` / `hsl(20 15% 6%)` | App background |

---

## Shadow Hierarchy

```
Base:      shadow-sm  or  0 1px 3px rgba(0,0,0,0.04)
Expanded:  shadow-md  or  0 4px 16px rgba(0,0,0,0.06)
Hover:     shadow-lg  or  0 8px 28px rgba(0,0,0,0.08)
```

Hover shadow must **always** be >= expanded shadow.

---

## Page Structure Template

```tsx
<AppBackground>
  <Sidebar />
  <PageContainer>
    <Header />
    <LunariPanel />    {/* dashboard widgets */}
    <LunariCard />     {/* content cards */}
    <LunariListCard /> {/* workflow rows */}
  </PageContainer>
</AppBackground>
```
