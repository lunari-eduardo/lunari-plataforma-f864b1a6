# Home | Seções 04, 05 e 06 — Studio, Gallery e Lunari

## Ritmo e continuidade

Seção 03 (O fluxo) é clara. A sequência fica:

```text
04 Studio   escuro  #0B0B0B   texto esquerda (40) / visual direita (60)
05 Gallery  claro   #F7F5F2   visual esquerda (60) / texto direita (40)
06 Lunari   escuro  #0B0B0B   texto esquerda (40) / visual direita (60)
```

Alternância de fundo e de lado respeitada. Acento único: dourado fosco `#C9A87C`.

Observação sobre a copy: pela regra já registrada do site, eyebrows não recebem numeração. Serão renderizados como `• LUNARI STUDIO`, `• LUNARI GALLERY`, `• LUNARI`. Todo o resto da copy entra exatamente como enviado.

## Etapa 1 — Primitivas compartilhadas

Novo arquivo `src/components/landing/shared/ProductSection.tsx` com três peças reutilizadas pelas três seções:

- `ProductSection` — casca com fundo (`dark`/`light`), padding vertical generoso, grid 40/60 com `order` invertível, empilhamento mobile texto → visual, tudo alinhado à esquerda.
- `Chips` — lista de rótulos em tipografia pura: texto pequeno, tracking largo, separador por espaçamento (sem caixa, sem ícone, sem borda). Hover: cor sobe para dourado, transição 200ms.
- `ProductCTA` — link em texto com seta `→`; hover desloca a seta 4px e sublinha em dourado.

Fade + translate Y de 12px na entrada via `Reveal` existente. Nenhuma animação dependente de scroll.

Transição suave entre seção clara e escura: faixa de 96px no topo da seção escura com gradiente vertical do tom claro anterior para `#0B0B0B` (apenas transição de fundo, não é elemento decorativo).

## Etapa 2 — Seção 04, Studio

Arquivo: `src/components/landing/studio/StudioSection.tsx`

- Texto (40%): eyebrow, headline em Instrument Serif italic dourada, título em duas linhas (Geist 600), parágrafos curtos com respiro, chips, CTA para `/studio`.
- Visual (60%): composição ilustrativa única em SVG/React — **"a linha do atendimento"**: uma coluna vertical de finas linhas horizontais de larguras diferentes representando marcos de um mesmo atendimento (agenda, contrato, pagamento, seleção, entrega), com rótulos discretos em mono e um único ponto dourado marcando o estado atual. Ocupa quase toda a altura da seção, sem moldura, sem card, sem sombra, fundindo-se ao fundo. Não repete a composição da Hero nem o hub da Seção 01.

## Etapa 3 — Seção 05, Gallery

Arquivo: `src/components/landing/gallery/GallerySectionHome.tsx`

- Fundo claro, visual à esquerda, texto à direita, tudo alinhado à esquerda.
- Copy conforme enviada, chips e CTA para `/gallery`.
- Visual (60%): composição editorial única — uma folha de contato em tons de papel (grade irregular de retângulos em tons `#E8DFCF`→`#C9B99A`), com dois quadros marcados por um traço fino dourado no canto. Sugere seleção sem desenhar interface. Sem molduras pesadas, sem janela de browser, sem cards flutuantes.

## Etapa 4 — Seção 06, Lunari

Arquivo: `src/components/landing/assistente/LunariAgentSection.tsx`

- Fundo escuro, texto à esquerda, visual à direita.
- Copy conforme enviada; nenhuma linguagem de chatbot.
- Visual (60%): composição de **comando → ação**: uma frase de comando em tipografia display, e abaixo dela três linhas finas que se desdobram em resultados objetivos em mono (`agendamento criado`, `pagamento registrado`, `tarefa concluída`), ligadas por traços dourados de 1px. Sem balões, sem avatar, sem interface de chat.

## Etapa 5 — Montagem e verificação

- Registrar as três seções em `src/pages/site/HomePage.tsx`, na ordem 04 → 05 → 06.
- Conferir contraste, alinhamento à esquerda, ordem mobile e ausência de glassmorphism/gradiente exagerado.
- Revisão em viewport mobile e desktop com screenshot.

## Notas técnicas

- Sem dependências novas; `framer-motion` e as primitivas de `landing/primitives.tsx` já cobrem o necessário.
- Cores sempre explícitas nas seções (regra `.site-scope`), nunca tokens do app.
- Composições visuais são SVG/JSX — sem geração de imagem, sem vídeo (limite de 4 vídeos, todos em heros).
- Sem backend, sem mudanças de rota além dos links de CTA já existentes.
