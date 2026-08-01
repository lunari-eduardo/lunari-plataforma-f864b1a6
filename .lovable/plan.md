# Home: reset pós-Hero + nova Seção 01 "O problema"

## Escopo

Duas entregas em um único passo:

1. Remover todas as seções da Home abaixo da Hero.
2. Criar a nova primeira seção ("O problema") logo abaixo da Hero.

Preservado sem qualquer alteração: Header (`SiteNav`), Hero (`LunariHero`), Footer (`SiteFooter`), tokens de cor, tipografia, espaçamentos e componentes globais.

## 1. Limpeza da Home

`src/pages/site/HomePage.tsx` passa a renderizar apenas:

```text
<SEOHead />        (mantido, sem mudança de copy)
<LunariHero />     (intocado)
<ProblemaSection />   (nova)
```

Deixam de ser renderizadas na Home:
`ProblemSection`, `UnifiedFlowSection`, `GallerySection`, `AISection`, `WhatsAppSection`, `ProofSection`, `PricingSection`, `ClosingSection`.

Os arquivos das seções antigas permanecem no repositório (não são deletados) porque `PricingSection` e outras podem ser reaproveitadas em `/precos` e nas próximas seções. Apenas os imports da Home saem. A `ProblemSection.tsx` atual é substituída na prática pela nova seção e fica órfã — será removida quando a nova Home estiver fechada.

## 2. Nova seção "O problema"

Novos arquivos:

- `src/components/landing/problema/ProblemaSection.tsx` — casca da seção, grid 2 colunas.
- `src/components/landing/problema/FragmentToEcosystem.tsx` — composição visual da coluna direita.

### Layout

```text
desktop (>=1024px)                    mobile
┌──────────────┬──────────────┐       ┌──────────────┐
│ texto        │ composição   │       │ texto        │
│ (5/12)       │ (7/12)       │       ├──────────────┤
└──────────────┴──────────────┘       │ composição   │
                                      └──────────────┘
```

Usa `SectionShell tone="light"` (fundo `#FAFAF7`, container 1200px, py 24/32) — mesmo shell das demais seções, sem alterar o primitivo.

### Coluna esquerda (texto)

- `EyebrowTag index="01"` → "O custo invisível"
- H2 em Instrument Serif (`displayFont`), 36px mobile / 52-56px desktop, tracking -0.025em:
  "O problema não é a falta de organização. É ter que organizar tudo sozinho."
  Com "organizar tudo sozinho" em itálico terracota `#b0632f` (único destaque de accent do bloco de texto).
- Abaixo, as frases em linhas curtas separadas (não parágrafo corrido), cada uma com `Reveal` em cascata (delay 0.04s), 16-17px, cor `rgba(10,10,10,0.62)`, leading generoso:
  - Seu atendimento acontece no WhatsApp.
  - Sua agenda está em outro lugar.
  - Os contratos ficam em outro sistema.
  - As cobranças em outro.
  - As fotos em outro.
- Separador hairline, e o fecho em peso maior / cor `#0A0A0A`:
  - "No fim do dia, quem conecta tudo é você."
  - "O Lunari foi criado para que o sistema faça esse trabalho."

Sem CTA nesta seção (ela não vende — só provoca).

### Coluna direita (composição)

Componente único com dois estados controlados por progresso de scroll (`useScroll` + `useTransform` do framer-motion, já usado no projeto), dentro de um bloco `sticky` no desktop com altura de ~140vh de trilho para permitir a transição sem sensação de "salto".

Estado 1 — Gestão fragmentada
- 6 mini-cards espalhados em posições levemente irregulares (rotação ±1.5°, offsets Y diferentes): WhatsApp, Agenda, Planilha, Contratos, Banco, Galeria.
- Cada card: fundo branco, borda `TOKENS.hair`, radius 10px, ícone lucide discreto (mesmo peso, 14px, cor 45% ink), label 12px.
- Entre eles, segmentos de linha tracejada interrompidos (SVG `stroke-dasharray`, terminando "no vazio") sugerindo conexões que não se completam.
- Sombra baixa, uniforme.

Estado 2 — Ecossistema Lunari
- Conforme o progresso avança (0.35 → 0.85), os cards convergem para posições de órbita ao redor de um núcleo central "Lunari".
- Núcleo: card maior, borda hairline mais forte, wordmark Lunari em Instrument Serif.
- Labels dos cards trocam por crossfade para: Cliente, Agenda, Financeiro, Workflow, Gallery, Histórico.
- Linhas: as tracejadas quebradas viram traços contínuos ligando cada módulo ao núcleo, desenhadas via `pathLength` animado; glow apenas como `stroke` terracota a 8-10% de opacidade sob a linha principal.

### Microinterações
- `EASE = [0.16, 1, 0.3, 1]` (token existente), durações 0.6-0.9s.
- Fade de entrada via `Reveal`.
- Movimento de card limitado a translate/scale suave; profundidade só por sombra (`0 8px 24px -16px rgba(10,10,10,0.18)` → `-12px` no estado conectado).
- Sem parallax agressivo, sem blur/glass, sem gradiente forte, sem neon.
- `useReducedMotion`: renderiza direto o Estado 2 estático, sem trilho sticky.

### Responsividade
- <1024px: sem sticky nem scroll-driven. A composição vira um bloco com dois quadros empilhados — "Hoje" (fragmentado) e "Com Lunari" (conectado) — cada um entrando com `Reveal`. Cards em grid 2×3, legibilidade preservada, nenhuma sobreposição.
- Alturas fixas por breakpoint para evitar CLS.

## Detalhes técnicos

- Sem novas dependências: `framer-motion` e `lucide-react` já estão no projeto.
- Zero mudança em `primitives.tsx`, `SiteLayout.tsx`, `SiteNav`, `SiteFooter`, `LunariHero`.
- Nenhuma cor nova: apenas `TOKENS.paper`, `TOKENS.ink`, `TOKENS.ember`, `TOKENS.hair`.
- Linhas em SVG com `viewBox` proporcional para escalar sem recálculo em JS.
- Sem backend, sem migração, sem mudança de rota.
