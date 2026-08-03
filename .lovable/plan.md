# Home | Seção Lunari Studio — ilustração como protagonista

## Situação

A seção hoje é textual demais: chips de funcionalidades à esquerda e uma timeline desenhada em JSX à direita. O ajuste substitui tudo isso pela ilustração enviada (composição escura com Agenda, Sessão, Cliente e Financeiro ligados por fios dourados).

Imagem recebida e legível. Ela será registrada como asset do projeto (ponteiro CDN em `src/assets/`), importada direto na seção.

## Etapa 1 — Lado esquerdo (45%)

Arquivo: `src/components/landing/studio/StudioSection.tsx`

- Tag: `• LUNARI STUDIO` (sem numeração, conforme regra do site).
- Headline serif dourada: "Fotografar já dá trabalho suficiente."
- Título em duas linhas: "Seu estúdio muda todos os dias. / O sistema precisa acompanhar."
- Texto: linhas curtas ("Clientes chegam. / Pagamentos são confirmados. / Contratos são assinados. / Fotos são selecionadas. / Novos pedidos aparecem."), depois "Nada disso acontece separado." e o parágrafo de fechamento.
- CTA: "Conheça o Studio →" para `/studio`.
- **Removidos**: os chips CRM / Agenda / Contratos / Financeiro / Workflow / Análise de Vendas.

## Etapa 2 — Lado direito (55%)

- Remoção completa do componente `AtendimentoLine` (timeline, eixo, marcadores, rótulos).
- Só a ilustração, ocupando praticamente toda a metade direita.
- Como a arte já tem fundo preto absoluto, ela é fundida ao fundo da seção: sem moldura, sem card, sem borda visível, `border-radius` grande apenas nas bordas onde encosta no conteúdo, e máscara de fade suave nas bordas esquerda e inferior para que dissolva no `#0B0B0B` da seção.
- Halo dourado extremamente discreto por trás, sombra externa suave.

## Etapa 3 — Sobreposição sutil

Conforme pedido, a imagem invade levemente a coluna de texto para parecer parte do ambiente:

- Desktop: a imagem estende ~40–60px para dentro da coluna esquerda (margem negativa), atrás do texto (`z-index` menor), com fade lateral para que nada de texto perca legibilidade.
- Escala levemente maior que a coluna (~105%) e leve sangria para a direita, reforçando a sensação de cena contínua em vez de print recortado.
- Mobile: sem sobreposição. Texto → imagem, largura total com fade nas bordas.

## Etapa 4 — Grid e animação

- `ProductSection` passa a aceitar proporção 45/55 (hoje 40/60) via prop opcional, sem alterar Gallery e Lunari.
- Entrada da imagem: `opacity 0 → 1`, `translateX 40px → 0`, ~700ms, ease-out, uma única vez. Sem parallax, sem outros efeitos.

## Etapa 5 — Verificação

- Screenshot desktop e mobile (checagem de viewport iOS/Safari incluída).
- Conferir legibilidade do texto na área de sobreposição, ausência de qualquer elemento textual à direita e peso visual da ilustração.

## Notas técnicas

- Sem dependências novas; `framer-motion` já cobre a animação.
- Cores explícitas (regra `.site-scope`), nunca tokens do app.
- Alternância de fundo do site preservada: Studio escuro, Gallery clara, Lunari escura.
- Imagem com `loading="lazy"` e `alt` descritivo para SEO/acessibilidade.
