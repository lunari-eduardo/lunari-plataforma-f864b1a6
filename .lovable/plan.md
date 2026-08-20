# Reconstrução da Capa Editorial — Lunari Gallery

## 1. Auditoria da implementação atual

Arquivo único: `src/components/deliver/covers/variants/EditorialCover.tsx` (registrado em `covers/registry.ts` como `editorial`, renderizado por `CoverRenderer` dentro de `ClientDeliverGallery.tsx`, que resolve `gallery.settings.coverId`).

Estrutura atual:

- **Desktop (`hidden md:block`)**: três camadas absolutas.
  - Camada 1 — `DesktopTitleBlock` com `color = baseTextColor` em `left-[5vw] top-1/2`.
  - Camada 2 — moldura da foto em `top-[8vh] bottom-[16vh] right-[5vw] w-[48vw]`, `z-20`, opaca.
  - Camada 3 — **segunda instância** de `DesktopTitleBlock` com `overlayTextColorDesktop`, recortada por `clipPath: inset(8vh 5vw 16vh 47vw)` — valores **hardcoded em strings**, duplicando a geometria da foto.
- **Mobile (`flex md:hidden`)**: fluxo vertical puro — foto `aspect-[3/4]` seguida de `MobileTitleBlock` empilhado abaixo. Nenhuma sobreposição, nenhum clipping.
- **Tipografia**: escolha de tamanho por degraus de classes Tailwind baseada em `maxLineLength` (4 faixas), com `whitespace-nowrap` no desktop e `break-words` no mobile.
- **Luminância**: `useImageLuminance(coverUrl, 'left' | 'bottom')` — amostra 45% esquerdos ou 50% inferiores da **imagem inteira**, não da região real de sobreposição.

### Problemas confirmados

| # | Problema | Causa raiz |
|---|---|---|
| P1 | Título fica atrás da foto ao reduzir a largura | A foto é `w-[48vw]` fixa e o título é `w-[66vw]` com `whitespace-nowrap`: as duas caixas colidem e a camada base (`z-10`) fica sob a foto (`z-20`). O clip da camada 3 começa em `47vw`, então o trecho entre o fim visível do texto e `47vw` some. |
| P2 | Geometria duplicada | A posição da foto existe em dois lugares independentes: classes Tailwind da moldura e a string `inset(8vh 5vw 16vh 47vw)`. Qualquer mudança de enquadramento quebra o recorte (viola o requisito 9). |
| P3 | Mobile não é editorial | Estrutura em fluxo (`flex-col`), foto e título empilhados pelo navegador (viola requisitos 4 e 12). |
| P4 | Contraste sobre a foto impreciso | A luminância é medida em uma região arbitrária da imagem, não na interseção real texto×foto. Além disso `drop-shadow` branco é usado como muleta. |
| P5 | Escala tipográfica em degraus | Saltos bruscos entre breakpoints; `whitespace-nowrap` gera overflow horizontal em títulos longos em telas médias. |
| P6 | Duas árvores de DOM de título | Já respeitam mesmas props, mas dependem de o CSS resolver idêntico nas duas — frágil (sem garantia formal). |
| P7 | Fundo cortado | `overflow-hidden` + `min-h-screen` sem `dvh` no mobile causa corte com barra de endereço do iOS. |

---

## 2. Decisão de arquitetura

Avaliação das opções pedidas:

- **Opção C (snapshot/imagem gerada)** — rejeitada. Perde texto selecionável/acessível, exige render server-side com fontes, invalida em cada edição, pesa no storage e não resolve breakpoints intermediários.
- **Opção D (versões por breakpoint geradas)** — rejeitada pelos mesmos motivos, multiplicados.
- **Escolhida: Opção A + B combinadas** — *motor de composição determinística*: um **layout spec** em coordenadas normalizadas (0–1), resolvido por faixa de viewport, com a geometria da foto como **fonte única de verdade**, e persistência opcional de overrides do spec no `settings` da galeria (Opção B) para composições ajustadas pelo fotógrafo no futuro.

Isso entrega composição controlada (nada é decidido pelo fluxo do navegador), estabilidade (uma só fonte de geometria), performance (CSS puro + um `ResizeObserver`) e manutenção simples (spec declarativo em um arquivo).

### Modelo conceitual

```text
CoverComposition = {
  photo:   { x, y, w, h }   // fração da viewport (0..1)
  title:   { x, y, anchor, widthFrac, maxFontVw, minFontPx }
  subtitle,date,cta         // ancorados às bordas do frame
}
```

Regras:
- Tudo é `position: absolute` dentro de um palco `100dvw × 100dvh`. Nada em fluxo.
- O `clip-path` do título sobreposto é **derivado** do mesmo objeto `photo` que posiciona a moldura — impossível divergirem.
- A sobreposição é garantida por construção: `title.x + title.width > photo.x` é uma invariante do spec, validada em dev.

---

## 3. Etapas de implementação

### Etapa 1 — Núcleo geométrico
Novo `src/components/deliver/covers/editorial/composition.ts`:
- Tipos `Rect`, `EditorialSpec`.
- Três specs nomeados: `desktop` (≥1024), `compact` (640–1023), `mobile` (<640) — cada um com sua própria composição, não uma versão reduzida da outra.
- `resolveSpec(width, height, aspectRatio, titleMetrics)` retorna retângulos em **px absolutos**, já resolvidos.
- Invariante de sobreposição verificada em DEV (`console.warn` se não houver interseção).

Specs propostos (frações):

```text
desktop  photo { x .50  y .10  w .45  h .74 }   title { x .06  y .50 (centro)  w .58 }
compact  photo { x .38  y .12  w .56  h .60 }   title { x .06  y .46          w .62 }
mobile   photo { x .28  y .10  w .70  h .58 }   title { x .05  y .60          w .82 }
```

No mobile o título nasce **abaixo-esquerda** e avança sobre a borda esquerda da foto — exatamente o diagrama do item 12; a foto é deslocada para a direita para abrir a coluna de tipografia.

### Etapa 2 — Motor tipográfico contínuo
Novo `useFittedTitle(lines, boxWidthPx, fontFamily)`:
- Mede a largura real de cada linha com `CanvasRenderingContext2D.measureText` (font-size de referência 100px) — uma medição por mudança de texto/fonte, memoizada.
- Calcula `fontSize = boxWidth / maxRatio`, aplicando `clamp(minPx, calculado, maxPx)`.
- Resultado: escala contínua, sem degraus, sem `whitespace-nowrap` causando overflow, e sem quebra de palavra involuntária.
- Quebra de linha continua sendo a lógica atual (conector `&`/`e`/`+`, senão divisão equilibrada), extraída para `splitTitle.ts` e testada.

### Etapa 3 — Camada única de título, renderizada duas vezes por contrato
Novo `TitleComposition.tsx`:
- Componente puro que recebe `{ lines, fontSizePx, color, fontFamily }` e nada mais.
- Renderizado duas vezes com **props idênticas exceto `color`** e envolto em wrappers de posição idênticos (`style` gerado pela mesma função `titleBoxStyle(spec)`), garantindo posição/quebra/tracking iguais por construção.
- Remoção de todos os `drop-shadow` — o contraste passa a vir do cálculo de cor, não de sombra.
- A camada sobreposta recebe `clipPath: inset(top right bottom left)` calculado em px a partir do `Rect` da foto resolvido.

### Etapa 4 — Contraste sobre a interseção real
Refatorar `useImageLuminance` para `useRegionLuminance(url, regionInImageSpace)`:
- O componente calcula a interseção `titleBox ∩ photoRect`, converte para coordenadas normalizadas **dentro da imagem** (considerando `object-fit: cover`: escala e offset do recorte), e amostra apenas essa sub-região no canvas 32×32.
- Fallback seguro se CORS bloquear (`#FFFFFF` sobre vinheta escura).
- Resultado: `#171513` sobre foto clara, `#F5F2EC` sobre foto escura, recalculado quando foto ou geometria mudam.

### Etapa 5 — Reescrita do `EditorialCover.tsx`
- Palco único `relative w-full h-[100dvh] overflow-hidden` com cor de fundo do tema (claro `#F7F4EE` / escuro `#12100E`).
- Um `ResizeObserver` no palco alimenta `resolveSpec`.
- Ordem de camadas: fundo → título base (`z-10`) → foto (`z-20`) → título recortado (`z-30`) → subtítulo/data/CTA (`z-40`).
- Subtítulo ancorado sob o bloco do título; data à esquerda e `VER GALERIA →` à direita, ambos na barra inferior do palco, independentes da foto.
- Sem numeração, sem nome do estúdio, sem categoria, sem ornamentos (item 18) — `issueNumber`/`studioName`/`category` deixam de ser usados nesta variante.
- Remoção completa dos blocos `hidden md:block` / `flex md:hidden`: um único DOM servindo todas as faixas, com spec diferente.

### Etapa 6 — Persistência opcional do spec (Opção B)
- `settings.editorialCover` (JSON) na galeria pode conter overrides parciais do spec por faixa (`photo`, `title`, `focal`).
- `resolveSpec` faz merge: `defaults ← overrides`. Ausente = comportamento padrão, retrocompatível.
- Nenhuma UI de edição nesta entrega; apenas o contrato de dados pronto (a tela de personalização pode consumir depois).

### Etapa 7 — Validação
- Playwright: capturar 360, 414, 768, 1024, 1440 e 1920 px com título curto (`SESSÃO TESTE`), longo (`MARIANA & RAFAEL`) e palavra única, nos temas claro e escuro.
- Checar por breakpoint: sobreposição presente, sem overflow horizontal, data e CTA visíveis, sem duplicação perceptível, contraste correto na interseção.
- `tsgo` + build.

---

## 4. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/deliver/covers/editorial/composition.ts` | novo — specs e resolvedor geométrico |
| `src/components/deliver/covers/editorial/splitTitle.ts` | novo — quebra de título |
| `src/components/deliver/covers/editorial/useFittedTitle.ts` | novo — escala tipográfica por medição |
| `src/components/deliver/covers/editorial/TitleComposition.tsx` | novo — bloco tipográfico puro |
| `src/hooks/useImageLuminance.ts` | estendido com amostragem por região arbitrária (mantém API atual para as outras capas) |
| `src/components/deliver/covers/variants/EditorialCover.tsx` | reescrito |
| `src/components/deliver/covers/thumbnails.tsx` | miniatura `EditorialThumbnail` atualizada para refletir a nova composição |

Nenhuma outra variante de capa (`fullscreen`, `split`, `floating-frame`) é tocada; `CoverRenderer`, registry e `ClientDeliverGallery` permanecem inalterados.

---

## 5. Critérios de aceitação

Desktop: título contínuo atravessando a borda esquerda da foto, ~30% da área visual, cor trocando exatamente na borda da imagem, foto ~45% da largura, data/CTA estáveis na base.
Mobile: foto deslocada à direita, título sobreposto à sua borda esquerda, nenhum empilhamento em fluxo, sem overflow, data e CTA visíveis.
Ambos: nenhuma duplicação perceptível, nenhuma geometria hardcoded em dois lugares, recomposição estável em qualquer largura entre 320 e 2560 px.
