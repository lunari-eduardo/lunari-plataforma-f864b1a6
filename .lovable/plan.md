# Seção Lunari Studio — texto mínimo, ilustração protagonista

## Objetivo

Reduzir a seção a: frase serif → título curto → lista de ferramentas → CTA. Toda a carga de venda passa para a ilustração, que ocupa 65% da largura.

## Etapa 1 — Grid 35/65

Arquivo: `src/components/landing/shared/ProductSection.tsx`

- A prop `ratio` passa a aceitar `"35/65"` além de `"40/60"` e `"45/55"`.
- `md:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]`.
- Gallery e Lunari não são afetadas.

## Etapa 2 — Coluna de texto enxuta

Arquivo: `src/components/landing/studio/StudioSection.tsx`

- Tag: `• LUNARI STUDIO`.
  Observação: o pedido traz "03 •", mas a regra do site (DESIGN_DNA_SITE) proíbe numeração nas seções. Mantenho sem número; se preferir com "03", confirmo e aplico.
- Frase serif dourada em duas linhas: "Fotografar já dá / trabalho suficiente."
- Título em duas linhas, maior que hoje (~34px mobile / ~52px desktop): "Seu sistema / precisa te ajudar."
- **Removidos**: todos os parágrafos abaixo do título (`ProductBody` sai da seção).

## Etapa 3 — Lista de ferramentas

Nova lista vertical logo abaixo do título, dentro do próprio `StudioSection.tsx`:

- Itens: CRM, Agenda, Orçamentos AI, Contratos, Financeiro, Workflow.
- Cada item com uma seta fina dourada (`→`, opacidade baixa) como marcador — sem caixa, chip, bullet ou check.
- Tipografia 18–20px, peso médio, cor clara sobre o preto; espaçamento vertical ~14px.
- Hover: item ganha cor dourada e a seta desliza 2px.
- Entrada em cascata discreta (stagger ~40ms) reaproveitando `SoftReveal`.

## Etapa 4 — CTA

- "Conheça o Studio →" apenas texto, sem borda inferior fixa; underline só no hover.
- Como o `ProductCTA` compartilhado tem borda permanente (usada por Gallery e Lunari), a seção Studio passa a usar uma variante local com `text-decoration` no hover, sem alterar o componente compartilhado.

## Etapa 5 — Ilustração

- Mantém a arte atual, agora em 65%: leve aumento de sangria para a direita e sobreposição sutil sobre a coluna de texto no desktop, preservando as máscaras de fade e o halo dourado.
- Mobile: sem sobreposição, largura total.

## Etapa 6 — Verificação

- Screenshots desktop e mobile.
- Conferir hierarquia de leitura em menos de 5 segundos, ausência de parágrafos e alinhamento à esquerda perfeito.

## Notas técnicas

- Sem novas dependências.
- Cores explícitas (`.site-scope`), nunca tokens do app.
- Nenhuma mudança em Gallery/Lunari além da nova opção de `ratio`.
