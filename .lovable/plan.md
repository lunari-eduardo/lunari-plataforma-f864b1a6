# Seção 02 da Home — reconstrução sob o Design_DNA_SITE

O Design_DNA_SITE v1.0 já foi salvo como regra oficial em `docs/constitution/DESIGN_DNA_SITE.md` e registrado na memória do projeto. A partir de agora ele rege todas as seções do site institucional.

## Diagnóstico da Seção 02 atual

`RotinaSection.tsx` viola três regras do DNA:

1. Coluna única centralizada — o DNA exige layout dividido em todas as seções.
2. Imagem 16:9 abaixo do texto — a Seção 02 deve ter o visual à esquerda e o texto à direita no desktop.
3. Cinco parágrafos empilhados centralizados — bloco de texto denso demais, com pouca hierarquia.

O ritmo de cor está correto: Hero escura → Seção 02 clara.

## Nova Seção 02

Reescrever `src/components/landing/rotina/RotinaSection.tsx`:

- Fundo claro `#F7F5F2`, texto `#0B0B0B`.
- Grid desktop de 2 colunas: **visual à esquerda (56%)**, **texto à direita (44%)**, alinhado ao topo com muito respiro (`py-32 md:py-44`, gap grande).
- Mobile: texto primeiro, visual depois (ordem invertida via `order` no grid) — regra explícita do DNA.
- Sem cards, molduras, sombras, linhas ou ícones.

### Conteúdo (exato, conforme a copy final)

- Eyebrow: `01 • UMA ROTINA QUE CRESCE` — mono, 11–12px, tracking largo, ponto em terracota.
- Título (h2): "Administrar um estúdio nunca foi apenas fotografar." — Geist 600, `text-[34px] md:text-[52px]`, tracking `-0.03em`, leading 1.06.
- Texto, cada frase em parágrafo próprio, alinhado à esquerda, 17–18px, leading 1.8, tom `rgba(11,11,11,0.62)`:
  1. Um estúdio cresce quando os clientes chegam.
  2. Mas a operação cresce junto.
  3. Foi entendendo essa realidade que o Lunari nasceu.
  4. Não para reinventar a forma de fotografar.
  5. Mas para organizar tudo o que acontece antes, durante e depois de cada ensaio.

Agrupamento por respiro: frases 1–2 juntas, depois espaço maior, frases 3–5 juntas — evita o bloco denso proibido pelo DNA.

### Visual

- Reutilizar `src/assets/home-rotina.jpg` (composição editorial já dentro do padrão: mesa clara, luz natural, provas fotográficas, papel).
- Proporção vertical/retrato `4:5` no desktop para equilibrar a coluna de texto; `16:9` no mobile via `aspect-ratio` responsivo.
- Sem borda, sem moldura, sem sombra. Cantos retos.

### Movimento

- Fade + 14px de subida na entrada, stagger curto (eyebrow → título → texto; visual entra em paralelo).
- Parallax discreto na imagem (translateY ~-3% a +3%).
- `useReducedMotion` desliga tudo. Nenhum conteúdo depende de scroll para ser entendido.

## Arquivos

- Reescrever: `src/components/landing/rotina/RotinaSection.tsx`
- Sem mudanças em `HomePage.tsx` (a seção já está montada lá)
- Sem novas dependências, sem backend, sem SEO novo além do `alt` da imagem
