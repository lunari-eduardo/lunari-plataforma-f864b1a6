# Capa Editorial — composição exclusiva para mobile (iPhone/Android)

Desktop permanece intocado. Toda mudança fica restrita ao ramo `orientation === 'horizontal'` (largura < 640px) da composição.

## Diagnóstico do mobile atual

- A costura está em `0.48` da altura: metade da tela é creme vazio. No print, quase 45% da capa é espaço morto acima do subtítulo.
- O bloco de título está centrado exatamente na costura e centralizado horizontalmente (`text-align: center`), o que empurra a massa tipográfica para o meio e deixa o topo sem nenhum elemento de ancoragem.
- A foto ocupa apenas a metade inferior; num retrato vertical (formato dominante em ensaio) isso corta muito da pessoa e faz a imagem parecer "colada".
- Data e CTA ficam sobre a foto no rodapé sem margem de área segura — em iPhone com home indicator e em Android com barra de gestos eles encostam na borda.

## Direção escolhida

Entre as duas alternativas da sua mensagem, a melhor para mobile é **foto grande ocupando a maior parte da tela, com o título descendo sobre ela** — não a foto centralizada à direita (isso é a lógica de desktop encolhida, e em 390px de largura sobraria uma coluna de texto estreita demais para uma serif display).

Composição nova (retrato):

```text
┌──────────────────────────┐  0%
│  creme                   │
│  SESSÃO MATERNIDADE      │  ← subtítulo ancorado, alinhado à esquerda
│  TESTE DE               │
├──────────────────────────┤  costura ≈ 32% da altura
│  NOVA CAPA   (branco)    │  ← mesma palavra atravessando a foto
│                          │
│        FOTOGRAFIA        │  ← 68% da tela, full-bleed
│                          │
│                          │
│  20 · AGOSTO · 2026      │
│              VER GALERIA→│  ← respeitando safe-area
└──────────────────────────┘  100%
```

Regras:

1. Costura mobile sobe de `0.48` para `0.32`; a foto passa a ocupar `y: 0.32 → 1` (68% da altura).
2. O bloco de título deixa de ser centralizado: passa a alinhamento à esquerda com margem de `0.08` da largura, igual ao desktop — mantém a mesma identidade editorial e evita a "quebra centrada" que descaracteriza a peça.
3. O título é posicionado por **âncora na costura**, não por centro: a primeira linha termina logo acima da costura e a segunda linha nasce dentro da foto. Isso garante a travessia de cor sempre, independentemente de o título ter 1 ou 2 linhas.
   - Título de 1 linha: a linha é centrada verticalmente na costura (metade creme, metade foto), reproduzindo o efeito do desktop.
4. Escala tipográfica mobile: alvo de largura `0.84` da tela, teto de `18vw` mantido, piso subindo de 32px para 34px, e limite adicional de altura para que o bloco (subtítulo + 2 linhas) nunca ultrapasse 34% da altura da tela.
5. Subtítulo continua ancorado ao topo do bloco de título, agora alinhado à esquerda (sem `items-center`), com o filete curto abaixo.

## Ajustes específicos de iOS/Android

- Altura: usar `100svh` com fallback `100dvh` no mobile. `dvh` muda quando a barra do Safari recolhe e faz a costura "pular" durante o scroll; `svh` mantém a composição estável.
- Rodapé (data + CTA): posições passam a considerar `env(safe-area-inset-bottom)` e `env(safe-area-inset-left/right)`, com um piso de 24px.
- Alvo de toque do CTA: mínimo 44×44px em mobile (hoje é uma linha de texto com 1px de borda).
- Remover `hover:scale-105` da foto no mobile (hover em touch fica preso no estado ampliado) e desativar o zoom lento quando `prefers-reduced-motion`.
- `ResizeObserver` com debounce por `requestAnimationFrame` para evitar recomposição a cada pixel durante a mudança de barra de endereço.

## Contraste na travessia (mobile)

A leitura de luminância continua igual, mas com o retângulo de interseção derivado da nova âncora: apenas a faixa do título que cai abaixo da costura. Como a foto mobile agora ocupa 68% da tela, a região amostrada corresponde ao topo real da imagem — hoje ela amostra uma faixa deslocada porque o retângulo é calculado a partir do centro do bloco.

## Arquivos tocados

- `src/components/deliver/covers/editorial/composition.ts` — `MOBILE_SPEC`: nova costura, novo `photoRect`, `titleBox` alinhado à esquerda e ancorado à costura; `datePos`/`ctaPos` com margem de área segura.
- `src/components/deliver/covers/variants/EditorialCover.tsx` — ramo horizontal: título alinhado à esquerda, posicionamento por âncora de costura, altura `svh`, safe-area no rodapé, alvo de toque do CTA, sem hover-scale no touch.
- `src/components/deliver/covers/editorial/useFittedTitle.ts` — teto de altura para o bloco no modo horizontal.

Sem mudanças no desktop/tablet, no banco ou em regras de negócio.

## Etapas

1. Atualizar `MOBILE_SPEC` (costura 0.32, foto 68%, título à esquerda com âncora na costura).
2. Ajustar o ramo horizontal do `EditorialCover` (alinhamento, âncora, safe-area, CTA tocável, svh).
3. Ajustar o limite de altura do título no `useFittedTitle` para o modo horizontal.
4. Verificar em 390×844 (iPhone 14), 430×932 (iPhone Pro Max), 360×800 (Android médio) e 412×915, com título de 1 e de 2 linhas, foto clara e escura, e com scroll iniciando/recolhendo a barra do Safari.
