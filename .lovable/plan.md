# Capa Editorial — reconstrução do zero (arquitetura "Seam")

## Estado atual verificado

O código da capa Editorial foi removido: `variants/EditorialCover.tsx` não existe mais, `registry.ts` já não referencia `editorial` e `thumbnails.tsx` não exporta `EditorialThumbnail`. Restam apenas `fullscreen`, `floating-frame` e `split`. O `CoverRenderer` e o contrato `CoverVariantProps` (`coverPhoto`, `sessionName`, `subtitle`, `sessionDate`, `sessionFont`, `titleCaseMode`, `isDark`, `textColor`, `onEnter`) permanecem intactos — a nova capa se conecta neles sem alterar `ClientDeliverGallery`.

Ou seja: partida limpa, sem dívida da implementação anterior.

---

## 1. A ideia central: uma costura (seam), não uma moldura

A referência enviada não tem moldura flutuante. Tem **duas superfícies coladas**:

```text
┌───────────────────────┬────────────────────────────┐
│  FUNDO DO TEMA        │   FOTOGRAFIA FULL-BLEED    │
│                       │                            │
│   À ESPE│RA           │                            │
│   DE VO │CÊ           │  ← o título atravessa      │
│         │                 a costura                │
│   ENSAIO GESTANTE     │                            │
│                       │                            │
│ 19 · AGOSTO · 2026    │        VER GALERIA →       │
└───────────────────────┴────────────────────────────┘
                        ↑
                    a costura
```

Isso resolve, por construção, todos os problemas que derrubaram a versão anterior:

- **A geometria vira um único número**: a posição da costura (`seam`, uma fração de 0 a 1). Foto e recorte do título derivam do mesmo valor — impossível divergirem.
- **A troca de cor acontece numa linha reta única**, não numa caixa com quatro bordas. O recorte é `inset(0 0 0 seam)` de um lado e `inset(0 calc(100% - seam) 0 0)` do outro.
- **Não existe "atrás da foto"**: o título é sempre desenhado acima do plano da foto; o que muda é só a cor.
- **A foto sangra até as bordas**, então nenhuma redução de largura cria vazios estranhos ou empurra elementos.

---

## 2. Composição por faixa de viewport

Cada faixa tem sua própria composição — não é a mesma reduzida.

### Desktop (≥ 1024px) — costura vertical

- Foto: `left: seam`, até a borda direita, altura total. `seam = 0.42`.
- Título: bloco ancorado à esquerda em `x = 6%`, centro vertical em ~46%, largura útil até `~0.80` da tela — ou seja, avança cerca de 38% para dentro da fotografia.
- Subtítulo: sob o título, alinhado à esquerda, sempre no lado do fundo (nunca cruza).
- Data: canto inferior esquerdo (lado fundo). CTA: canto inferior direito (sobre a foto).

### Tablet (640–1023px) — costura vertical deslocada

- `seam = 0.34`, título com escala reduzida e quebra mais agressiva. Mesma linguagem.

### Mobile (< 640px) — costura **horizontal**

Girar a costura em 90° preserva a estética e resolve o mobile de forma nativa:

```text
┌────────────────────────┐
│   FUNDO DO TEMA        │
│                        │
│   À ESPERA             │
│───DE─VOCÊ──────────────│ ← costura horizontal
│   (a segunda linha     │
│    entra na foto)      │
│      FOTOGRAFIA        │
│      FULL-BLEED        │
│                        │
│ 19 · AGO   VER GAL. →  │
└────────────────────────┘
```

- Foto: `top: seam` (`seam = 0.46`), até a base, largura total.
- Título: ancorado à esquerda, posicionado de modo que a **última linha atravesse a costura** — a sobreposição é garantida pelo cálculo, não pelo acaso.
- Subtítulo: acima da costura. Data e CTA: barra inferior sobre a foto, com contraste próprio.

Nenhum elemento em fluxo normal em nenhuma faixa. Tudo absoluto dentro de um palco `100dvw × 100dvh`.

---

## 3. Contraste automático — medido exatamente onde o texto entra

Regra em duas regiões, como pedido:

- **Fora da foto**: cor do tema (`#171513` no claro, `#F5F2EC` no escuro), ou `textColor` se o fotógrafo definiu.
- **Dentro da foto**: cor calculada da imagem.

O cálculo amostra **somente a faixa da fotografia onde o título realmente incide**, não a imagem inteira:

1. Converter a caixa do título para coordenadas dentro da imagem, compensando o `object-fit: cover` (escala + offset do recorte).
2. Amostrar essa sub-região num canvas 32×32 e calcular luminância ITU-R BT.709.
3. `luminância > 140` → texto `#12100E`; senão → `#F7F4EE`.
4. Fallback seguro em caso de bloqueio CORS: texto claro (a foto recebe uma vinheta sutil no lado da costura, garantindo legibilidade mínima).

O mesmo cálculo, com sua própria região, define a cor do CTA que fica sobre a foto.

Nenhum `drop-shadow` ou filtro: o contraste vem da cor, não de muleta visual.

---

## 4. Título como uma única peça

O título é renderizado por **um componente puro** que recebe apenas `{ lines, fontSizePx, fontFamily, letterSpacing, color }`. Ele é montado duas vezes, com **props idênticas exceto `color`**, dentro de wrappers cujo `style` é produzido pela **mesma função**. Assim, quebra de linha, tracking, escala e posição são iguais por construção, não por coincidência.

Cada camada recebe um `clip-path` complementar derivado do mesmo `seam`. O resultado visual é uma palavra só que muda de cor ao cruzar a linha — exatamente a referência.

### Escala tipográfica contínua

Nada de degraus por breakpoint. A largura real de cada linha é medida uma vez com `canvas.measureText` a 100px, e o tamanho final é `clamp(min, larguraDisponível / maiorRazão, max)`. Isso garante:

- título sempre ocupando a presença gráfica pretendida (~25–40% da composição);
- nenhum overflow horizontal em largura nenhuma;
- nenhuma quebra involuntária de palavra.

### Quebra de linha deliberada

Regras, em ordem: conector (`&`, `e`, `+`) → duas linhas; duas palavras → uma por linha; três ou mais → divisão equilibrada por contagem de caracteres; palavra única → linha única em escala maior. Máximo de duas linhas; um terceiro bloco reduz escala em vez de criar linha extra.

---

## 5. Tipografia e conteúdo

- Título: serif display de alto contraste — `sessionFont` quando definido, senão a pilha `'Bodoni Moda', 'Playfair Display', Didot, serif`. `tracking: -0.02em`, `line-height: 0.86`, caixa alta.
- Subtítulo: sans discreta, ~11px, `tracking: 0.3em`, caixa alta, opacidade 0.6, com um traço curto abaixo (como na referência).
- Data: microtipografia `19 · AGOSTO · 2026`, mono-espaçamento generoso.
- CTA: `VER GALERIA →` com sublinhado fino, sem botão. Seta desloca 4px no hover.

Somente esses quatro elementos. Sem numeração, sem nome do estúdio, sem categoria, sem ornamentos.

---

## 6. Etapas de implementação

**Etapa 1 — Geometria**
`covers/editorial/composition.ts`: tipo `EditorialSpec` (`orientation: 'vertical' | 'horizontal'`, `seam`, caixa do título, âncoras de rodapé) e `resolveSpec(width, height)` retornando tudo em px. Invariante checada em DEV: a caixa do título precisa cruzar a costura.

**Etapa 2 — Tipografia**
`splitTitle.ts` (quebra) e `useFittedTitle.ts` (medição por canvas + `clamp`).

**Etapa 3 — Bloco tipográfico**
`TitleComposition.tsx`: componente puro, sem lógica, sem estado.

**Etapa 4 — Contraste**
`useSeamContrast.ts`: amostragem de sub-região com compensação de `object-fit: cover`; retorna cor para o título e para o CTA.

**Etapa 5 — Capa**
`variants/EditorialCover.tsx`: palco `h-[100dvh]`, `ResizeObserver`, camadas fundo → foto → título base (recortado no lado do fundo) → título sobre foto (recortado no lado da foto) → rodapé. Foto com `<img>` real (`object-cover`, `loading="eager"`, `decoding="async"`) e um leve `scale` no hover.

**Etapa 6 — Registro**
Reinserir `editorial` em `registry.ts` e recriar `EditorialThumbnail` em `thumbnails.tsx` refletindo a costura vertical.

**Etapa 7 — Validação**
Playwright em 360 / 414 / 768 / 1024 / 1440 / 1920 px, temas claro e escuro, com títulos curto, longo e de palavra única. Verificar: travessia da costura presente, troca de cor exatamente na linha, sem overflow, data e CTA legíveis, sem duplicação perceptível. Depois `tsgo` e build.

---

## 7. Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/deliver/covers/editorial/composition.ts` | novo |
| `src/components/deliver/covers/editorial/splitTitle.ts` | novo |
| `src/components/deliver/covers/editorial/useFittedTitle.ts` | novo |
| `src/components/deliver/covers/editorial/useSeamContrast.ts` | novo |
| `src/components/deliver/covers/editorial/TitleComposition.tsx` | novo |
| `src/components/deliver/covers/variants/EditorialCover.tsx` | novo |
| `src/components/deliver/covers/registry.ts` | reinsere a variante `editorial` |
| `src/components/deliver/covers/thumbnails.tsx` | nova `EditorialThumbnail` |

`CoverRenderer`, `types.ts`, as outras três capas e `ClientDeliverGallery` permanecem intactos.

---

## 8. Critérios de aceitação

**Desktop**: fotografia sangrando até as bordas ocupando ~58% da largura; título dominante atravessando a costura com troca de cor exatamente nela; subtítulo, data e CTA estáveis; sem duplicação perceptível.

**Mobile**: costura horizontal; título nunca empilhado abaixo da foto; ao menos uma linha do título dentro da fotografia; sem overflow; data e CTA visíveis e legíveis sobre a foto; composição visivelmente desenhada para mobile.

**Ambos**: recomposição estável e contínua de 320 a 2560px, sem saltos de escala e sem geometria duplicada no código.
