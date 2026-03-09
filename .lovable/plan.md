

# Fix: Elementos brancos no dark mode do Dashboard

## Causa raiz

O `tailwind.config.ts` define `bg-card-gradient` com cores **hardcoded em branco**:

```js
'card-gradient': 'linear-gradient(180deg, #FFFFFF 0%, #F7F8F9 100%)',
```

Essa classe é usada extensivamente em:
- **DailyHero.tsx**: Badges (linhas 62, 66, 113, 117)
- **KPIGroupCard.tsx**: Cards internos dos KPIs (linhas 51, 64, 92, 115, 130)

No dark mode, esses gradientes continuam brancos porque são valores fixos que não respondem ao tema.

## Correção

### `tailwind.config.ts` (linha 214)

Trocar o gradiente hardcoded por variáveis CSS que respeitam o tema:

```js
'card-gradient': 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--muted)))',
```

Isso faz o gradiente usar `--card` (claro no light, escuro no dark) automaticamente.

### `src/index.css`

Nenhuma alteração necessária — as variáveis `--card` e `--muted` já estão definidas para ambos os modos.

## Arquivos
- **Modificar**: `tailwind.config.ts` — 1 linha (bg-card-gradient)

