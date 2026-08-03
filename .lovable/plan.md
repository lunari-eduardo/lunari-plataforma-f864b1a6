# Home v3 — Porte do "Remix of Lunari Studio Suite" + saneamento visual do site

## Decisões já fechadas
- Tipografia: **escala e famílias das páginas Gallery Select/Transfer** (Geist / Geist Mono / Instrument Serif como serifa de destaque). Fraunces, Archivo e IBM Plex Mono do projeto Remix **não** entram.
- Nav e rodapé do Remix **substituem globalmente** SiteNav/SiteFooter atuais (mantendo todos os links atuais, incluindo Legal/Termos/Privacidade/Exclusão/Segurança/Cookies).
- Conteúdo: **estrutura e visual do Remix**, com dados reais do Lunari (planos vindos de `src/content/site/pricing.ts`, rotas reais, copy dos módulos alinhada ao produto).
- Nenhuma página legal é removida.

## Situação atual (verificada)
- A home (`src/pages/site/HomePage.tsx`) monta `LunariHero`, `RotinaSection`, `FluxoSection`, `StudioSection`, `GalleryHomeSection`, `LunariAgentSection` — todos em `src/components/landing/`.
- Páginas internas (`StudioPage`, `GallerySelectPage`, `GalleryTransferPage`, `GalleryOverviewPage`, `PrecosPage`, `SobrePage`, `ContatoPage`) usam `src/components/site/primitives.tsx`, que tem sistema de tons `light | dark | navy` já pintando fundo **e** cor de texto juntos.
- Os títulos usam `SectionTitle` (`src/components/site/SectionTitle.tsx`) e há regra `.site-scope` em `src/index.css` forçando `color: inherit` — necessária porque o CSS global do app pinta `h1..h6` com `--foreground`.
- O projeto Remix é TanStack Start + Tailwind v4 (`@theme inline`, cores em oklch, utilitários `bg-graphite`, `text-ondark`, `eyebrow`, `reveal`). Este projeto é Vite + React Router + Tailwind v3 → **o porte exige tradução de tokens, não cópia literal de classes**.

## Onda 1 — Sistema de tokens do site (fundação)
1. Criar `src/components/site/theme.ts` com o mapa oficial de superfícies do site, traduzindo os tokens do Remix (oklch → hex) e casando com o DNA atual:
   - `graphite #262421`, `graphiteSoft #2E2B27`, `lineDark rgba(255,255,255,0.10)`
   - `offwhite #F4F1EA`, `warmwhite #FBFAF7`, `lineLight rgba(10,10,10,0.10)`
   - `ink #2A2724`, `inkMuted #7C766D`, `onDark #F2EDE4`, `onDarkMuted #B9B1A4`
   - `gold #C9A87C`, `goldPale #E4CFA8`, `goldDeep #9A7F52`
2. Registrar esses tokens em `tailwind.config.ts` (`colors.site.*`) e como CSS vars sob `.site-scope` em `src/index.css`, para que classes utilitárias e estilos inline usem a mesma fonte de verdade.
3. Adicionar em `src/index.css` (escopo `.site-scope`) as utilidades portadas do Remix: `.site-eyebrow` (Geist Mono, 11px, tracking .22em, uppercase) e `.site-reveal` (fade + translateY, com `prefers-reduced-motion`).
4. Portar o hook de revelação: `src/hooks/use-reveal.ts` (IntersectionObserver, `data-visible`), usado pelo componente `Reveal` da home nova.
5. **Sem novas fontes**: `index.html` já carrega Geist, Geist Mono e Instrument Serif. Fraunces continua carregada apenas para o app; nenhuma nova requisição de fonte é adicionada.

## Onda 2 — Escala tipográfica única (referência: Gallery Select/Transfer)
Criar `src/components/site/typography.tsx` com os componentes que passam a ser obrigatórios em TODO o site, com os tamanhos já usados nas páginas Gallery:
- `SiteEyebrow` — Geist Mono 11px / .22em / uppercase, ouro.
- `SiteH1` — 44px mobile → 76px desktop, `leading-[1.02]`, `tracking-[-0.032em]`, Geist 600, com opção de palavra-âncora em Instrument Serif itálico ouro.
- `SiteH2` — 36px → 52px, `leading-[1.06]`, `tracking-[-0.028em]`.
- `SiteH3` — 22px → 26px.
- `SiteLead` — 17px → 19px, `leading-[1.55]`.
- `SiteBody` — 16px → 17px, `leading-[1.6]`.
- `SiteSmall` / `SiteLabel` — 13px e 11px mono.
Cada componente recebe `tone` (`light|dark`) e sempre define a cor explicitamente — nunca depende de herança.
`SectionTitle.tsx` passa a ser um wrapper fino de `SiteH2` (retrocompatível, sem quebrar as páginas existentes).

## Onda 3 — Home nova (porte seção a seção)
Criar `src/components/home/` com as seções do Remix reescritas em Tailwind v3 + tokens da Onda 1 + tipografia da Onda 2:

| Arquivo novo | Origem no Remix | Fundo | Dados reais |
|---|---|---|---|
| `Hero.tsx` | `home/Hero.tsx` | escuro | CTA → `/auth`; spotlight de mouse + halo ouro mantidos |
| `mockups/CommandCenter.tsx` | idem | escuro | mock do Studio (sidebar + painel) |
| `TrustStrip.tsx` | idem | escuro | números reais já usados em `MetricsStrip` |
| `Modules.tsx` | idem | claro | CRM, Agenda, Orçamentos, Contratos, Financeiro, Workflow, Gallery |
| `Tour.tsx` | idem | escuro | abas do fluxo Lead → Pós-venda |
| `Continuity.tsx` | idem | claro | "uma base de dados só" |
| `LuSection.tsx` | idem | escuro | assistente Lu, com efeito de digitação |
| `Switching.tsx` | idem | claro | comparativo "6 ferramentas vs Lunari" |
| `Pricing.tsx` | idem | claro | **planos lidos de `src/content/site/pricing.ts`**, toggle mensal/anual, link para `/precos` |
| `FinalCta.tsx` | idem | escuro | CTA → `/auth` |

Ajustes obrigatórios no porte:
- `<a href="#...">` do Remix → `NavLink`/`useNavigate` quando o destino for rota real.
- `bg-linear-to-r` (v4) → `bg-gradient-to-r` (v3); `color-mix(...)` mantido apenas dentro de `style` inline.
- `font-display` → Instrument Serif somente em 1–2 palavras-âncora por seção; o resto em Geist.
- Motion: reaproveitar `Reveal` (IntersectionObserver) em vez de framer-motion, como no Remix.

`HomePage.tsx` passa a montar apenas as seções novas, mantendo o `SEOHead` atual (título/descrição/canonical).

## Onda 4 — Nav e rodapé globais
- `src/components/site/SiteNav.tsx` reescrito a partir de `home/SiteNav.tsx` do Remix: fixo, transparente no topo, `bg-graphite/85 + backdrop-blur` ao rolar, dropdown de Produtos.
  - Links reais: Studio, Gallery (Select / Transfer / Visão geral), Preços, Sobre, Contato, Conteúdos + CTA "Entrar" / "Testar grátis".
  - Como o nav é escuro e existem páginas com hero claro, o nav ganha `data-surface` derivado da primeira seção da rota: em heros claros usa versão clara (texto `ink`, borda `lineLight`). Isso elimina o risco de texto claro sobre fundo claro no topo.
- `src/components/site/SiteFooter.tsx` reescrito a partir de `home/SiteFooter.tsx` (rodapé claro `offwhite`), preservando as 3 colunas atuais e **todos** os links legais.
- `SiteLayout.tsx`: fundo base passa a ser o token do site; mantém `site-scope` e o reset de scroll.

## Onda 5 — Auditoria de contraste e alternância em todas as páginas
Varredura página a página, corrigindo os dois defeitos relatados (títulos apagados e texto claro em fundo claro):
1. Regra dura: **nenhuma seção pode herdar cor**. Toda seção define `background` + `color` no próprio elemento; todo título/parágrafo usa os componentes da Onda 2 com `tone` explícito.
2. Reescrever os helpers de tom em `src/components/site/primitives.tsx` para derivarem de `theme.ts` (`toneBg`, `toneText`, `toneMuted`, `toneHair`), removendo os literais soltos `rgba(10,10,10,...)`/`#0A0A0A` espalhados.
3. Substituir `GradientHalo` (hoje usa `176,99,47`, terracota — proibido pelo DNA do site) por halo ouro `201,168,124`.
4. Definir e aplicar a alternância oficial claro/escuro por página:
   - **Home**: escuro → escuro(strip) → claro → escuro → claro → escuro → claro → claro(pricing) → escuro → rodapé claro. O único par claro-claro (Switching + Pricing) é o "mesmo capítulo comercial" previsto no DNA.
   - **Studio**: hero escuro → métricas claras → feature escura → feature clara → feature escura → CTA escuro → FAQ claro.
   - **Gallery Select / Transfer / Visão geral**: mesma cadência; hoje `GallerySelectPage` abre hero claro e usa `MetricsStrip` claro em seguida — passa a alternar corretamente.
   - **Preços / Sobre / Contato / Legais**: hero escuro, corpo claro, CTA escuro.
5. `BreadcrumbTrail` hoje é sempre escuro sobre claro (`text-[#0A0A0A]/45`) e aparece antes de heros que passarão a ser escuros — ganha `tone` e é integrado ao topo do hero.
6. Páginas legais (`LegalPageShell`) recebem o novo tipo/tokens sem mudar conteúdo jurídico.

## Onda 6 — Limpeza e verificação
- Remover os componentes da home antiga que ficarem órfãos: `landing/LunariHero.tsx`, `landing/rotina/`, `landing/fluxo/`, `landing/studio/`, `landing/gallery/`, `landing/assistente/`, `landing/problema/`, além de `LandingHero.tsx` e demais arquivos `landing/*` sem import.
  - `landing/primitives.tsx` **não** é removido de imediato: as páginas internas ainda importam dele; ele passa a reexportar de `site/theme.ts` e é retirado depois que todas as páginas migrarem.
- Verificação: varredura por classes de cor cruas (`text-white`, `#0A0A0A`, `text-[#F5F1EA]`) nos arquivos do site; checagem de contraste (mínimo AA) em cada seção via captura Playwright das rotas `/`, `/studio`, `/gallery`, `/gallery/select`, `/gallery/transfer`, `/precos`, `/sobre`, `/contato`, `/legal/termos` — desktop e mobile.
- Atualizar `docs/constitution/DESIGN_DNA_SITE.md` e a memória do site com: escala tipográfica oficial, tokens de superfície e a regra "nenhuma seção herda cor".

## Notas técnicas
- Nada de Tailwind v4: todo utilitário `@theme`/`@utility` do Remix vira token em `tailwind.config.ts` + CSS var sob `.site-scope`.
- Nenhuma mudança em rotas do app (`/app/*`), checkout, auth ou backend. Trabalho 100% em apresentação do site público.
- Nenhuma fonte nova é carregada; a escala é a das páginas Gallery.
