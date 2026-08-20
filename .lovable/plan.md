# Plano de Varredura e Correção: Contraste da Capa Editorial (Versão Final)

## 1. Análise do Problema Atual
O sistema de amostragem de luminância (`useSeamContrast.ts`) falhou ao detectar que uma imagem clara (#d8d3cd) necessitava de texto escuro, mantendo-o branco. Isso ocorre por dois motivos principais:
1.  **Threshold Inadequado:** O limite atual de 160 de luminância é muito permissivo para o branco em fundos claros (high-key).
2.  **Falta de Histerese:** Pequenas variações de tons claros na imagem podem "enganar" a média aritmética simples, especialmente se a amostragem for feita em baixa resolução (64px).

## 2. Diagnóstico Técnico
- **Amostragem:** Atualmente, tiramos uma média global da área de intersecção. Se a foto for clara mas tiver detalhes escuros (textura, sombras sutis), a média cai e o texto vira branco, ficando ilegível.
- **Tema da Galeria:** O `baseColor` (preto no tema claro) não está sendo usado como âncora de segurança. Se o fundo é claro, o overlay sobre a foto também deve tender ao escuro, a menos que a foto seja comprovadamente escura.

## 3. Plano de Ação Detalhado

### 3.1 Refinamento do Motor de Contraste (`useSeamContrast.ts`)
1.  **Ajuste de Threshold Dinâmico:** 
    - Se `isDark` (tema da galeria) for falso (Tema Claro), baixar o threshold de "foto clara" para ~135. Isso força o texto a ficar preto mais cedo.
    - Se `isDark` for verdadeiro (Tema Escuro), manter o threshold em ~160.
2.  **Weighted Sampling (Amostragem Ponderada):**
    - Em vez de uma média simples, usar a luminância do "pior caso". Se uma porcentagem significativa da área de intersecção for clara, o texto *deve* ser preto.
3.  **Cross-Origin & Cache:** 
    - Garantir que `img.crossOrigin = 'anonymous'` e o uso de `media.lunarihub.com` não causem falhas silenciosas de leitura de pixels (o que resulta em luminância 0 = texto branco).

### 3.2 Sincronização no Componente (`EditorialCover.tsx`)
1.  **Injeção de BaseColor:** Passar explicitamente o `baseColor` calculado pelo tema para o hook de contraste.
2.  **Lógica de Coerência:** Se `isPhotoLight` for verdadeiro, o `overlayColor` DEVE ser idêntico ao `baseColor` para manter a unidade visual do design editorial.

### 3.3 Garantia de Mobile
1.  **Amostragem Horizontal:** Validar se no mobile (costura horizontal) a área de amostragem não está pegando a parte superior (bege) da tela, o que enviesaria a luminância para cima.

## 4. Cronograma de Implementação
- **Fase 1:** Atualização do Hook `useSeamContrast` com novos thresholds e log de depuração interno.
- **Fase 2:** Integração do `baseColor` no fluxo de decisão de cores.
- **Fase 3:** Teste de regressão com a cor específica relatada (#d8d3cd).
