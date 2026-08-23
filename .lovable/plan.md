# Reconstrução do Motor de Arte — Editor de Propostas (Comercial)

## Diagnóstico (causa raiz confirmada por leitura de código)

### Por que toda proposta com IA fica igual
1. **Prompt fixo no Worker** (`workers/proposals-ai/src/index.ts` linhas 200–224): o JSON exigido é sempre o mesmo — mesmos blocos, mesma ordem, mesmos campos. A IA não tem nenhuma decisão de layout para tomar; ela só preenche texto. A única variação possível é `design_tokens`.
2. **Sanitize destrutivo** (`workers/proposals-ai/src/sanitize.ts`): mesmo que a IA inventasse algo diferente, `sanitizeBlock` descarta tudo que não está na lista fixa de campos. `props` passa, mas o prompt nunca instrui variantes — e o renderer ignoraria.
3. **Um renderer rígido por bloco** (`VisualRenderer.tsx`): cada tipo tem exatamente 1 layout hardcoded. `CoverBlock` é sempre o hero com blob arredondado (`rounded-[2rem]`) — é exatamente o "modelo quebrado" do print. Não existe conceito de **variante de composição**.
4. **`EditorialComposition` invisível para a IA**: o bloco existe no frontend mas NÃO está em `BLOCK_TYPES` do worker — a IA nunca pode usá-lo.

### Fotos que não respeitam orientação
- Nenhum ponto do sistema lê `naturalWidth/naturalHeight`. Containers usam alturas fixas (`h-[400px] @md:h-[600px]`) ou `%` absolutas (`EditorialBlock` photo_a/photo_b). `object-cover` corta retratos em caixas paisagem e vice-versa.

### Portfólio sem montagem automática
- `GalleryRenderer` usa `columns-2/3/4` CSS (masonry de colunas) — **quebra a ordem das fotos** e não distribui por orientação. O modo `grid` exige `span`/`ratio` manuais por foto. O multi-upload existe no código (`AddImageTile`/`uploadMultipleProposalImages`) mas não dispara nenhum auto-layout — as fotos entram como "normal/auto" e a grade fica caótica.

### Personalização tipográfica limitada
- Tokens globais (`--pa-font-display/body`) funcionam e o preset "Editorial Lunari (PDF)" já existe, mas: não há override por bloco, não há controle de tracking/uppercase/escala, e nenhum renderer usa o estilo letterspaced wide (`tracking-[0.3em]` + uppercase) que define o look das referências (capa.jpg/pacotes.jpg).

---

## Estratégia: "Template-first, IA preenche" (em vez de "IA inventa layout")

As referências (capa.jpg, pacotes.jpg, info.jpg) são composições **estáticas e reproduzíveis** — não exigem engine generativa. A solução definitiva é:

1. **Catálogo de variantes de composição** codificadas à mão, fiéis ao PDF, uma por `props.variant`.
2. **A IA escolhe variantes + preenche conteúdo + extrai paleta**, nunca inventa estrutura.
3. **Um template oficial "Lunari Editorial"** (réplica do PDF) disponível como modelo pronto.

```text
HOJE: briefing → IA gera JSON fixo → sanitize corta → 1 renderer rígido → sempre igual
NOVO: briefing → IA escolhe variantes do catálogo + tokens → sanitize valida variante
      → renderer despacha para a composição escolhida → layouts realmente diferentes
```

---

## FASE 1 — Sistema de Variantes (fundação do motor)

**Arquivos:** `src/pages/comercial/blocks/registry.ts`, novo `src/pages/comercial/components/editor/variants/`

1. Adicionar `variant` ao `BlockDefinition` (campo `layoutFields` do tipo `select`, com opções nomeadas e descrição visual).
2. Criar `variants/Cover/`, `variants/Pricing/`, `variants/Editorial/`, `variants/Gallery/` — cada renderer vira um *switch* sobre `props.variant` (fallback = variante atual, retrocompatível com propostas existentes).
3. **CoverBlock — 3 variantes:**
   - `poster-split` (**réplica de capa.jpg**): topo em `--pa-cream` com hairline vertical + eyebrow letterspaced → título serif gigante (`tracking-[0.12em]`, uppercase, ocupa ~30% da altura) → subtítulo letterspaced → foto full-bleed abaixo → assinatura do estúdio centrada no rodapé da capa. Mobile: mesma estrutura (já é vertical por natureza).
   - `seam-side`: split vertical foto/fundo (usa o padrão já validado da Gallery).
   - `minimal-center`: composição atual (mantida como fallback).
4. **PricingTable — variante `numbered-editorial` (réplica de pacotes.jpg):**
   - Header: eyebrow "PACOTES" letterspaced → título serif display grande (`ESTÚDIO`) → linha de apoio.
   - Cards: número serif grande `01/02/03`, título letterspaced, hairlines duplas, features com ícones finos, bloco de preço "À VISTA / R$ X / OU Nx DE R$ Y" (campos novos: `price_cash`, `price_installments`).
   - Suporte a foto vertical ao lado do card (usa `image_ref` já existente).
   - Bordas finas `border` + fundo `--pa-cream`, radius 0.
   - Manter variante `cards-classic` (atual).
5. **EditorialBlock — variante `split-portrait` (réplica de info.jpg):** coluna de texto com parágrafos espaçados (`leading-[2]`, tracking largo) à esquerda + foto retrato 4/5 à direita. Sem blend/absolute — grid limpo.
6. Novo tipo `DividerBlock` (hairline + rótulo letterspaced, ex.: "PACOTE — ESTÚDIO OU EXTERNO") para o ritmo de página do PDF.

**Critério de saída:** criar manualmente, via "Adicionar Seção", uma proposta visualmente equivalente às 3 referências.

## FASE 2 — Template oficial "Lunari Editorial" (modelo pronto)

**Arquivos:** `supabase` (insert em `proposal_templates`), `BibliotecaComercialPage.tsx`

1. Compor o documento completo com as variantes da Fase 1: `CoverBlock(poster-split)` → `EditorialBlock(split-portrait)` → `DividerBlock` → `PricingTable(numbered-editorial)` → `Gallery(editorial-rows)` → `CTABlock` → `FooterTerms`.
2. Tokens: preset "Editorial Lunari (PDF)" já existente (Cormorant Garamond + Jost, paleta areia).
3. Persistir como template oficial em `proposal_templates` (via SQL `run_sql`, marcado `is_official`) para aparecer na biblioteca como ponto de partida em 1 clique.
4. Botão "Usar modelo" na biblioteca clona blocos+tokens para um material novo.

## FASE 3 — Motor de IA orientado a variantes

**Arquivos:** `workers/proposals-ai/src/index.ts`, `sanitize.ts` (e redeploy do worker)

1. **Catálogo no prompt**: descrever cada variante com "quando usar" (ex.: `numbered-editorial` → 2–4 pacotes com foto; `poster-split` → capa com título curto e impactante). A IA devolve `props.variant` por bloco.
2. **Diversidade real**: parâmetro `layout_pack` (`editorial-classic`, `modern-minimal`, `noir`) que pré-seleciona famílias de variantes + seed de combinações; temperature 0.9 para texto, mas variantes escolhidas por regra (não aleatório cego).
3. **`sanitize.ts`**: incluir `EditorialComposition` e `DividerBlock` em `BLOCK_TYPES`; validar `variant` contra whitelist por tipo (inválida → default); passar `props.layout`/`variant` saneados em vez de descartar.
4. **Referências multimodais** (já existem): reforçar instrução — "mapear a referência para a variante mais próxima e extrair hex reais para design_tokens", nunca inventar estrutura fora do catálogo.
5. **Título da capa**: instruir a IA a devolver `title` curto (1–3 palavras) para `poster-split`, evitando quebra feia no display gigante.

**Critério de saída:** 3 gerações seguidas com mesmo briefing produzem composições visivelmente distintas (não só cores diferentes).

## FASE 4 — Mídia inteligente (orientação + grid automático)

**Arquivos:** `blocks/uploadImage.ts`, `blocks/EditableImage.tsx`, `variants/Gallery/`

1. **Captura de orientação no upload**: ao fazer upload, ler `naturalWidth/naturalHeight` e gravar `{ w, h }` junto ao `image_ref` (novo campo `meta` por imagem). Migração suave: imagens antigas sem meta → detectar on-load no cliente uma única vez e persistir.
2. **Containers orientados**: `CoverBlock`/`EditorialBlock` escolhem aspect do frame pela orientação real (retrato → 4/5, paisagem → 3/2, quadrado → 1/1) salvo override manual. Fim dos cortes indesejados.
3. **Gallery — auto-layout justificado**: substituir `columns-*` (quebra ordem) pelo padrão de **linhas justificadas** já provado no módulo Gallery (`RowMasonryGrid`): preserva ordem 1→N, altura igualada por linha, largura ∝ AR real. `span`/`ratio` manuais viram override opcional, não obrigação.
4. **Multi-upload com montagem automática**: ao colar N fotos, o bloco distribui automaticamente (ordem preservada, linhas balanceadas) sem nenhuma configuração. Botão "Reorganizar automaticamente" para re-aplicar.

## FASE 5 — Personalização tipográfica real

**Arquivos:** `blocks/design.ts`, `registry.ts`, renderers

1. **Catálogo curado de pares de fontes** (~8 pares: Cormorant/Jost, Playfair/Inter, Fraunces/Space Grotesk, Libre Caslon/Jost, Cinzel/Jost, Italiana/Manrope, Marcellus/Inter, DM Serif/Outfit) no seletor global — `ensureFontLoaded` já injeta dinamicamente.
2. **Tokens tipográficos estendidos**: `display_tracking` (ex.: 0.12em), `display_transform` (uppercase/none), `scale` (0.9/1/1.1) — aplicados via CSS vars nos renderers.
3. **Override por bloco**: `props.typography` opcional por seção (herda global, sobrescreve local).

## FASE 6 — Paridade público/editor e validação

1. `PublicProposalViewer` renderiza variantes idênticas ao editor (mesmos componentes — já é o caso, garantir com a Fase 1).
2. Fontes: preload no link público (eliminar FOIT) + `font-display: swap`.
3. Teste de aceite: gerar link público do template oficial e comparar lado a lado com capa.jpg / pacotes.jpg / info.jpg.
4. QA de regressão: propostas V1/V2 antigas abrem sem crash (`normalizeBlock` com variant default).

## Fora de escopo (conforme solicitado)
- Limpeza/reorganização do painel lateral de edição (fica para etapa posterior).

## Riscos e mitigações
- **Worker precisa de redeploy** (Fase 3) — mudança de prompt/sanitize só vale após deploy; validar com geração real.
- **Variantes novas em docs antigos** → sempre fallback para variante default; sanitize nunca rejeita bloco por variante desconhecida.
- **Performance das fontes** → carregar apenas os pesos usados (300/400/500) e cachear via `loadedFonts` (já existe).

## Ordem de execução proposta
Fase 1 → Fase 2 → validação visual com você → Fase 4 → Fase 3 (worker) → Fase 5 → Fase 6.
