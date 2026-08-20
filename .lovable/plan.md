# Capa Editorial — 3 correções cirúrgicas (sem quebrar a costura)

O efeito de costura (título único trocando de cor na borda da foto) está funcionando e **não será alterado**. Os três problemas restantes têm causas independentes e localizadas.

## Problema 1 — Cor do texto sobre a foto só acerta depois de sair e voltar

Causa (confirmada no código): a leitura de contraste (`useSeamContrast`) roda antes da geometria existir. No primeiro render `size = {0,0}`, então o retângulo de interseção do título é `0x0`; a função de luminância cai no fallback (`return isDark ? 0 : 255`) e decide texto escuro. Quando a geometria chega, o efeito reexecuta, mas o `new Image()` com `crossOrigin='anonymous'` reaproveita a entrada de cache sem cabeçalho CORS e o `onload` não repinta — a cor errada fica congelada. Ao voltar à página, a imagem já está em cache com CORS resolvido e a cor correta aparece.

Correção:
1. Não executar amostragem enquanto `size.width === 0` ou a interseção tiver área zero — sair cedo mantendo o estado anterior.
2. Separar o carregamento da imagem (uma vez, com `decode()` + `onerror`) da amostragem (recalculada quando a geometria muda), guardando o `HTMLImageElement`/canvas em `ref`. Assim mudanças de layout não dependem de um novo `onload`.
3. `onerror`: refazer a tentativa uma vez **sem** `crossOrigin` para detectar apenas o caso de falha; se ainda falhar, fallback determinístico = branco com sombra de leitura sutil (nunca texto escuro invisível).
4. Estado inicial neutro: enquanto não houver medição, a camada sobre a foto renderiza branco (aparência correta na maioria das fotos) em vez de escuro.

## Problema 2 — Foto com corte desproporcional (parece tela cheia com faixa branca por cima)

Causa: a camada da foto é `absolute inset-0` com `background-size: cover` sobre **a tela inteira** e depois recortada por `clip-path`. Ou seja, a imagem é enquadrada para 100% da largura e só a parte direita fica visível — exatamente a sensação de "foto cobrindo a tela com um bloco branco colado por cima".

Correção: a foto passa a ocupar apenas o próprio retângulo (`spec.photo`), posicionada em `left/top/width/height` reais, com `object-fit: cover` **dentro desse retângulo**. Sem `clip-path` na foto (a costura vira a própria borda do elemento). O recorte volta a ser proporcional ao lado direito (desktop) / inferior (mobile).

Consequência positiva: o mapeamento de `cover` usado no cálculo de contraste passa a bater com o que é exibido, porque ambos usarão o mesmo retângulo. A função de amostragem será ajustada para simular `cover` com a proporção real de `spec.photo` (hoje ela simula um quadrado 64×64, o que distorce a região amostrada).

## Problema 3 — Subtítulo escondido atrás do título

Causa: o subtítulo tem posição fixa (`y = 0.35` da altura) enquanto o bloco de título é centrado verticalmente e cresce conforme o texto — em títulos de duas linhas os dois se sobrepõem.

Correção: o subtítulo deixa de ter posição absoluta própria e passa a ser **ancorado ao bloco de título**: renderizado logo acima da primeira linha, com espaçamento proporcional ao tamanho da fonte calculada (`fontSize * 0.5`), na mesma coluna do título. Ele fica no lado creme e usa a cor base (sem participar da costura). No mobile, mesma regra com âncora horizontal centrada.

## Arquivos tocados

- `src/components/deliver/covers/variants/EditorialCover.tsx` — foto no retângulo próprio; subtítulo ancorado ao título; estado inicial de cor neutro.
- `src/components/deliver/covers/editorial/useSeamContrast.ts` — guarda de geometria, carregamento único com `decode()`/`onerror`, amostragem com proporção real da foto.
- `src/components/deliver/covers/editorial/composition.ts` — remoção do `subtitlePos` fixo (substituído por âncora derivada do título); nenhum outro valor de costura alterado.

Sem mudanças de banco, dados ou regras de negócio. Camadas de recorte do título permanecem exatamente como estão.

## Etapas

1. Ajustar `useSeamContrast` (guarda + carregamento único + amostragem proporcional).
2. Reposicionar a foto em `EditorialCover` para o retângulo real.
3. Ancorar o subtítulo ao bloco de título e limpar `composition.ts`.
4. Verificar em 1440, 1040 e 390 no preview, com foto clara e escura, e com recarga limpa (cache frio e cache quente) para confirmar a cor correta no primeiro acesso.
