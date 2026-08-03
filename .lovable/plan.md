# Home | Seção Lunari Studio — ilustração como protagonista

## Situação

A seção hoje é textual demais: chips de funcionalidades à esquerda e uma timeline desenhada em JSX à direita. O ajuste substitui tudo isso por uma única ilustração premium.

## Etapa 1 — Imagem

A imagem enviada nesta mensagem **não pôde ser lida** pelo ambiente (erro de leitura no arquivo). Preciso que seja reenviada antes da implementação.

Ao receber, ela vira um asset do projeto (ponteiro CDN em `src/assets/`), importado direto na seção. Sem cópia de binário no repositório.

## Etapa 2 — Lado esquerdo (45%)

Arquivo: `src/components/landing/studio/StudioSection.tsx`

- Tag: `• LUNARI STUDIO` (sem numeração, conforme regra do site).
- Headline serif dourada: "Fotografar já dá trabalho suficiente."
- Título em duas linhas: "Seu estúdio muda todos os dias. / O sistema precisa acompanhar."
- Texto: bloco de linhas curtas ("Clientes chegam. / Pagamentos são confirmados. / Contratos são assinados. / Fotos são selecionadas. / Novos pedidos aparecem."), depois "Nada disso acontece separado." e o parágrafo de fechamento.
- CTA: "Conheça o Studio →" para `/studio`.
- **Removidos**: os chips CRM / Agenda / Contratos / Financeiro / Workflow / Análise de Vendas.

## Etapa 3 — Lado direito (55%)

- Remoção completa do componente `AtendimentoLine` (timeline, eixo, marcadores, rótulos).
- Só a ilustração, ocupando praticamente toda a metade direita.
- Apresentação: `border-radius` grande (~24px), sombra externa suave, halo dourado muito discreto atrás da imagem, fundo preto absoluto por baixo, respiro generoso ao redor. Sem moldura, sem card, sem borda.

## Etapa 4 — Grid e animação

- `ProductSection` passa a aceitar proporção 45/55 (hoje 40/60) via prop opcional, sem quebrar Gallery e Lunari.
- Mobile: texto → imagem (ordem já garantida pelo empilhamento).
- Entrada da imagem: `opacity 0 → 1`, `translateX 40px → 0`, ~700ms, ease-out, uma única vez. Sem parallax.

## Etapa 5 — Verificação

- Screenshot desktop e mobile (iOS/Safari incluído no check de viewport).
- Conferir contraste no fundo escuro, ausência de elementos textuais à direita e peso visual da ilustração.

## Notas técnicas

- Sem dependências novas; `framer-motion` já cobre a animação.
- Cores explícitas (regra `.site-scope`), nunca tokens do app.
- Alternância de fundo do site preservada: Studio segue escuro, Gallery clara, Lunari escura.
