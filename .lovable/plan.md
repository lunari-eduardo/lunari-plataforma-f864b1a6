# Plano de Transformação: Capa FLOATING FRAME (Ajuste Editorial/Moderno)

Este plano detalha a reconstrução da capa `FloatingFrameCover.tsx` (ou a criação de uma nova lógica de composição se necessário) para atingir o visual "Editorial Flutuante" solicitado: fotografia horizontal centralizada com sombra suave, tipografia serifada monumental abaixo e fundo off-white minimalista.

## 1. Análise da Arquitetura Atual
- **EditorialCover.tsx**: Atualmente usa um sistema complexo de "costura" (split-screen) com inversão de cores. Não serve como base direta para o Floating Frame, mas possui o motor tipográfico (`useFittedTitle`) que queremos reaproveitar.
- **FloatingFrameCover.tsx**: É uma implementação básica com foto em proporção 16:10, sombra 2xl e flex vertical simples. Precisamos elevar o nível dessa implementação para o padrão "Lunari Premium".

## 2. Nova Composição Visual (Floating Frame v2)
### Geometria (Desktop)
- **Fundo**: `#F7F4EE` (Off-white) fixo, ignorando o tema escuro se o usuário optar por esta estética editorial "física".
- **Container da Foto**:
    - Centralizado horizontalmente.
    - Margem superior generosa (ex: `15vh`).
    - Sombras: `shadow-[0_20px_50px_rgba(0,0,0,0.15)]` para simular profundidade real.
    - Proporção: Horizontal (3:2 ou 16:10).
- **Bloco de Texto**:
    - Posicionado imediatamente abaixo da foto com espaçamento controlado (`mt-12` a `mt-20`).
    - **Título**: Serif Display (proporcional à largura do container, mas não monumental a ponto de tocar as bordas, preservando o "respiro").
    - **Subtítulo**: Sans-serif, tracking alto (`tracking-[0.3em]`), posicionado abaixo do título.
- **CTA**: Botão minimalista, borda de 1px, centralizado.

### Geometria (Mobile)
- A foto reduz proporcionalmente mantendo a margem de respiro lateral (ex: `px-6`).
- A sombra é suavizada para não parecer pesada em telas pequenas.
- Hierarquia vertical estrita: Foto -> Título -> Subtítulo -> CTA.

## 3. Plano de Implementação Técnica

### Fase 1: Motor de Composição
1. **Novo Spec**: Criar `src/components/deliver/covers/editorial/floatingSpec.ts` para calcular as dimensões e espaçamentos baseados no viewport.
    - Diferente do Editorial atual, o Floating Frame não tem "seam". Ele tem um "anchor point" central.
2. **Reuso Tipográfico**: Garantir que `useFittedTitle` suporte o novo alinhamento centralizado sem quebras indesejadas.

### Fase 2: Componente `FloatingFrameCover.tsx`
1. **Limpeza**: Remover elementos de numeração, estúdio ou identificação que poluem a peça.
2. **Camadas**:
    - `Layer 0`: Background off-white.
    - `Layer 1`: Fotografia com `aspect-ratio` e `shadow-floating`.
    - `Layer 2`: Bloco de texto (`flex flex-col items-center`).
3. **Refinamento da Sombra**: Implementar uma sombra difusa que "vaze" para baixo e para os lados, criando a sensação de papel flutuante.

### Fase 3: Responsividade
1. Ajustar o `max-height` da foto no mobile para não empurrar o texto para fora da primeira dobra (fold).
2. Garantir que o CTA tenha o tamanho de toque (44px) adequado mesmo sendo minimalista.

## 4. Detalhes de Design (DNA Lunari)
- **Tipografia**: Usar a fonte serifada configurada na galeria.
- **Espaço Negativo**: Mínimo de 8% de margem em todos os lados para a fotografia.
- **Cor**: Manter o contraste preto sobre off-white para o texto, garantindo a estética editorial clássica.

---
**Nenhuma alteração foi realizada no código ainda.** Aguardando aprovação do plano para iniciar a implementação da nova `FloatingFrameCover`.
