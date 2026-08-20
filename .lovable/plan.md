# Plano de Varredura e Correção: Capa Editorial Mobile (Fotos Verticais e Composição)

O objetivo é corrigir a visualização da Capa Editorial em dispositivos mobile, garantindo que fotos verticais não sejam cortadas agressivamente, eliminando o excesso de espaço vazio na parte superior e aprimorando o efeito de "costura" do título sobre a imagem.

## 1. Diagnóstico do Problema Mobile
- **Corte de Fotos Verticais:** A proporção atual de 32/68 (`seam: 0.32`) força a foto a ocupar apenas a parte inferior, cortando o topo de fotos verticais.
- **Espaço Superior Ocioso:** A área do tema (superior) está muito grande (32% da altura), empurrando o conteúdo para baixo.
- **Título Descolado:** O título está ancorado na costura, mas a sobreposição sobre a foto é mínima ("um milímetro"), o que dilui o efeito visual editorial.
- **Composição Horizontal:** Em mobile, o layout é `horizontal` (split topo/fundo), o que exige maior sensibilidade à proporção da imagem.

## 2. Soluções Propostas (Surgical Fixes)

### A. Reajuste de Geometria (composition.ts)
- **Ajuste da Costura (Seam):** Alterar `seam` de `0.32` para `0.20` ou `0.25` no `MOBILE_SPEC`. Isso reduz o espaço vazio no topo e sobe a foto, revelando mais da parte superior da imagem.
- **Expansão da Foto:** A `photoRect` ocupará `1 - seam` da altura, mantendo-se full-bleed.
- **Reposicionamento do Título:** Ajustar a `titleBox.y` para garantir que o bloco de texto (especialmente a segunda linha) entre profundamente na área da foto.

### B. Otimização do Enquadramento da Foto (EditorialCover.tsx)
- **Object-Position:** Implementar controle de `object-position` (ou `background-position`) para garantir que o rosto/foco da foto vertical seja priorizado no corte horizontal.
- **Proteção de Proporção:** Ajustar a lógica de renderização para que, em fotos verticais extremas, a altura da foto seja respeitada sem estiramento.

### C. Tipografia e Sobreposição (useFittedTitle.ts & EditorialCover.tsx)
- **Aumento da Escala:** Ajustar o `maxFontSizeVw` para mobile no `EditorialCover.tsx` (atualmente entre 12 e 24) para permitir um título mais impactante.
- **Ancoragem de Sobreposição:** Ajustar o `translateY` do `titleBoxStyle` em mobile para que a "linha de costura" atravesse o centro do bloco de texto, garantindo que a primeira linha fique no tema e a segunda na foto de forma clara e deliberada.

## 3. Plano de Implementação Detalhado

### Fase 1: Ajuste de Arquitetura de Mobile (composition.ts)
1. Modificar `MOBILE_SPEC`:
   - `seam: 0.22` (Reduzir espaço superior).
   - `titleBox.y: 0.22` (Ancorar exatamente na nova costura).
   - `photoRect.y: 0.22`, `photoRect.height: 0.78`.

### Fase 2: Refinamento de Camadas (EditorialCover.tsx)
1. Alterar `titleBoxStyle` para mobile:
   - Garantir que o `transform: translateY(-50%)` em conjunto com a ancoragem na costura divida o título perfeitamente.
   - Aumentar o `line-height` ou espaçamento entre linhas se necessário para a sobreposição ser mais visível.
2. Adicionar `backgroundPosition: 'center 20%'` na camada da foto para fotos verticais, garantindo que cabeças não sejam cortadas no mobile.

### Fase 3: Calibração de Tamanho (useFittedTitle.ts)
1. Ajustar os limites de `fontSize` no hook para mobile para evitar que o título fique pequeno demais quando a foto sobe.

## 4. Garantia de Estabilidade
- **No Desktop Changes:** Todas as alterações serão protegidas por condicionais de `spec.orientation === 'horizontal'` ou `isMobile`, preservando o layout desktop que já foi aprovado como "perfeito".
- **Safe Areas:** Manter o uso de `env(safe-area-inset-*)` para garantir que o CTA e a Data não fiquem sob a barra de navegação do iOS/Android.

---
*Este plano foca em transformar a "falha de corte" em uma "intenção editorial", aproximando a foto do topo enquanto mantém a elegância da tipografia sobreposta.*
