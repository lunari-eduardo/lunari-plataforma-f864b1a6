# Capa Editorial — causa raiz encontrada e correção definitiva

Sim, é possível. O efeito que você quer (um único título atravessando a costura e trocando de cor exatamente na borda da foto) está implementado quase todo certo — o que quebrou é **um erro de sistema de coordenadas no recorte (clip-path)**. Por isso o título "sumiu" do lado creme e sobrou só o fragmento "LE" em cima da água.

## Causa raiz (confirmada no código)

`clip-path: inset(...)` é calculado **relativo à caixa do próprio elemento**, não à tela. Em `EditorialCover.tsx` os recortes são calculados em coordenadas da tela e aplicados a caixas de título que começam em `x = 6% da largura` e têm `52%` de largura:

- Título base: `inset(0 (largura - costura) 0 0)` → recorte à direita maior que a própria caixa → **título base 100% invisível**.
- Título sobreposto: `inset(0 0 0 costura)` → corta os primeiros ~618px de uma caixa de ~765px → **sobra só o final da palavra** ("LE" no seu print).

Efeitos colaterais visíveis no print: nenhum texto no lado creme, fragmento solto sobre a foto, e o bloco de título sem centragem vertical real (a caixa tem altura fixa mas o `items-center` não é ancorado à costura).

## Solução definitiva

Trocar a arquitetura de recorte por **duas camadas de tela cheia**, ambas do tamanho exato do container, com o título posicionado por coordenadas absolutas idênticas nas duas. Assim os dois `clip-path` passam a usar o **mesmo sistema de coordenadas da costura**, e o alinhamento vira matematicamente impossível de divergir.

```text
container (100% x 100dvh)
├── layer FOTO      inset(0 0 0 seam)         → foto full-bleed do lado direito
├── layer TÍTULO A  full-size, clip: lado creme  (cor escura)
└── layer TÍTULO B  full-size, clip: lado foto   (cor por contraste local)
        ambos com o mesmo <TitleComposition> na mesma posição absoluta
```

Correções incluídas na mesma passada:

1. **Recorte correto**: `clipTheme = inset(0 calc(100% - seam) 0 0)` e `clipPhoto = inset(0 0 0 seam)` aplicados a camadas full-size — nunca à caixa do título.
2. **Ancoragem à costura**: a caixa do título é posicionada de forma que a palavra cruze a costura de verdade (o texto começa no lado creme e avança um percentual definido para dentro da foto), em vez de depender de largura de conteúdo.
3. **Tipografia que cabe**: `useFittedTitle` passa a respeitar largura **e** altura disponíveis (limite por número de linhas), com mínimo/máximo por breakpoint, evitando estouro e evitando o "mínimo 32px" atropelando telas pequenas.
4. **Centragem vertical real** do bloco de título via caixa com `top` calculado a partir do centro da composição, não valores soltos.
5. **Contraste local corrigido**: `useSeamContrast` hoje mede a interseção usando retângulos em coordenadas de tela contra o retângulo da foto, com `Math.min(1, ...)` que distorce a região. Passa a receber a **interseção já calculada** (somente a parte do título que está sobre a foto), mapeada para as coordenadas reais da imagem considerando `object-fit: cover`.
6. **Fallback seguro**: se a imagem falhar por CORS/erro, cai para branco com leve sombra de leitura, nunca fica invisível.
7. **Data e CTA**: posicionados por âncoras (baixo-esquerda no lado creme, baixo-direita sobre a foto) com `transform` de compensação, para não vazarem fora da tela.
8. **Mobile**: costura horizontal — foto full-bleed embaixo, título ancorado cruzando a borda superior da foto (nunca empilhado abaixo dela), com a mesma lógica de recorte rotacionada.

## Se preferir eliminar a possibilidade

Alternativa mais simples que também entrego se você quiser: título **inteiramente** no lado creme, sem cruzar a foto (composição editorial clássica, zero risco de bug de recorte/contraste). Mas a correção acima resolve o efeito real — não é uma limitação do navegador.

## Arquivos tocados

- `src/components/deliver/covers/variants/EditorialCover.tsx` — reescrita das camadas e âncoras.
- `src/components/deliver/covers/editorial/composition.ts` — spec com âncoras de costura e overshoot do título.
- `src/components/deliver/covers/editorial/useFittedTitle.ts` — ajuste largura+altura.
- `src/components/deliver/covers/editorial/useSeamContrast.ts` — amostragem só da interseção real, com `cover` mapping.

Sem mudanças de banco, dados ou regras de negócio.

## Etapas

1. Ajustar `composition.ts` (âncoras + overshoot + centragem).
2. Ajustar `useFittedTitle` e `useSeamContrast`.
3. Reescrever camadas de `EditorialCover.tsx`.
4. Verificar em desktop (1440, 1040) e mobile (390) via preview, com foto clara e escura.
