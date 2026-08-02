# Home | Seção 02 — "Uma rotina que cresce"

Substitui a atual Seção 01 ("O custo invisível" / `ProblemaSection` + `FragmentToEcosystem`) pela nova seção editorial logo abaixo da Hero. Os arquivos antigos permanecem no projeto (não são importados pela Home), para não quebrar nada.

## Novo componente

`src/components/landing/rotina/RotinaSection.tsx`

- Fundo `TOKENS.paper` (#FAFAF7), texto `TOKENS.ink` — contraste imediato com a Hero escura.
- Container centralizado `max-w-[1120px]`, coluna única, padding vertical generoso (`py-32 md:py-44`).
- Sem cards, ícones, listas, grids, molduras, linhas ou mockups.

### Conteúdo (exato)

- Eyebrow: `01 • UMA ROTINA QUE CRESCE` — mono, 12px, tracking largo, opacidade baixa, ponto em `TOKENS.ember`.
- Título (h2, `max-w-[880px]`, centralizado): "Administrar um estúdio nunca foi apenas fotografar." — Geist 600, `text-[38px] md:text-[64px]`, tracking `-0.03em`, leading 1.05.
- Texto (`max-w-[640px]`, centralizado, 18–19px, leading 1.85, `rgba(10,10,10,0.62)`), cada frase em parágrafo próprio com respiro grande entre elas:
  1. Um estúdio cresce quando os clientes chegam.
  2. Mas a operação cresce junto.
  3. Foi entendendo essa realidade que o Lunari nasceu.
  4. Não para reinventar a forma de fotografar.
  5. Mas para organizar tudo o que acontece antes, durante e depois de cada ensaio.

### Imagem protagonista

- Uma única imagem 16:9, largura total do container, sem borda, sem moldura, sem sombra pesada.
- Gerada especificamente para a seção (referência: a foto enviada — mesa clara, luz natural lateral, provas fotográficas, contrato parcialmente visível, agenda, caneta metálica, tecidos neutros, profundidade de campo, minimalismo). Sem telas, sem notebook, sem câmera, sem pessoas.
- Salva em `src/assets/home-rotina.jpg` e importada como ES6 (`<img>` com `alt` descritivo, `loading="lazy"`, `decoding="async"`, aspect-ratio fixo 16/9 para evitar CLS).

### Microinterações

- Fade + 16px de subida na entrada, stagger suave (eyebrow → título → parágrafos → imagem), duração ~0.9s com o ease editorial já usado (`EASE`).
- Imagem: parallax discreto no scroll (translateY de aproximadamente -3% a +3% via `useScroll`/`useTransform`) e nada além disso.
- `useReducedMotion` desliga fade e parallax.

## Alterações em arquivos

- `src/pages/site/HomePage.tsx`: trocar `ProblemaSection` por `RotinaSection`.
- Novo: `src/components/landing/rotina/RotinaSection.tsx`.
- Novo asset: `src/assets/home-rotina.jpg`.

## Técnico

- Sem novas dependências (framer-motion e tokens já existentes).
- Sem backend, sem rotas, sem mudanças de SEO além da imagem com alt.
