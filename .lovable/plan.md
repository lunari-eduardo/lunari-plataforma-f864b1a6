# Home | Nova Hero — duas colunas, fundo claro, vídeo de interface

Escopo: `src/components/landing/LunariHero.tsx` (reescrita), `src/components/landing/HeroMedia.tsx` (novo player claro `HeroInterfaceVideo`) e um novo `src/components/landing/mockups/HeroLoop.tsx` (fallback animado). Nav, Footer, Seção 01 e tokens permanecem intocados.

## 1. Mudança de tema da Hero

A Hero hoje é dark (obsidian + gold, vídeo full-bleed atrás do texto). Passa a ser **clara**, alinhada ao restante da Home:

- fundo `TOKENS.paper` (#FAFAF7), texto `TOKENS.ink`;
- botão primário grafite (`PrimaryButton` já existente), secundário ghost com borda hairline;
- terracota (`TOKENS.ember`) só no ponto do eyebrow e num único detalhe da composição;
- sem gradiente forte, sem glass, sem neon. Muito espaço negativo (padding 128–160px no desktop).

O `HeroBackgroundVideo` dark deixa de ser usado na Home (arquivo mantido para não quebrar outros imports).

## 2. Estrutura

```text
┌───────────────────────────┬──────────────────────────────┐
│ eyebrow                   │                              │
│ título (2 linhas)         │   composição visual          │
│ subtítulo                 │   (vídeo da interface)       │
│ [Começar teste] [Studio]  │   ~ 56% da largura           │
│ 30 dias · sem cartão      │                              │
└───────────────────────────┴──────────────────────────────┘
```

- Desktop: grid `44% / 56%`, alinhamento vertical central, `max-w-[1200px]`.
- Mobile: coluna única — texto primeiro, composição abaixo, ainda visível na primeira dobra parcial.

## 3. Copy (exatamente como aprovado)

- Eyebrow: PARA FOTÓGRAFOS QUE VIVEM DA FOTOGRAFIA
- Título: "O sistema que administra seu estúdio inteiro. Não apenas uma parte dele." — a segunda frase em `ink` a 55% de opacidade, criando hierarquia sem mudar tamanho.
- Subtítulo: parágrafo do primeiro contato à entrega + as três negativas ("Sem retrabalho. / Sem informações espalhadas. / Sem perder tempo procurando o que já deveria estar organizado.") em bloco próprio, menor e mais claro.
- Primário: Começar teste gratuito → `/auth`
- Secundário: Conhecer o Studio → `/studio`
- Abaixo: "30 dias gratuitos. Sem cartão de crédito." em 12px mono, opacidade baixa.

## 4. Composição visual (vídeo)

Novo componente `HeroInterfaceVideo`:

- moldura clara: card branco, raio 16px, borda hairline, sombra longa e discreta (`0 40px 80px -48px rgba(10,10,10,0.28)`);
- `<video>` `muted loop playsinline preload="none"`, com `poster` como LCP;
- fontes esperadas: `/public/media/hero-ui-1080.mp4` (desktop) e `/public/media/hero-ui-720.mp4` (mobile), `poster` `/public/media/hero-ui-poster.jpg`;
- respeita `prefers-reduced-motion`, `saveData` e redes 2g/3g → mostra só o poster;
- vinheta branca suave nas bordas para o vídeo "morrer" no papel em vez de terminar em corte duro.

**Hoje `public/media/` está vazio** — os arquivos ainda não existem. Enquanto não houver vídeo, o componente cai automaticamente num fallback: `HeroLoop`, uma composição da interface renderizada em HTML/CSS (evolução do `HeroMockup` já existente), com uma micro-narrativa em loop lento de ~14s:

1. um cliente muda de etapa no workflow;
2. um contrato passa a "assinado";
3. um pagamento muda de status;
4. uma galeria aparece vinculada ao atendimento;
5. um card discreto da Lu surge e desaparece.

Cada passo com fade de 600ms e ~2,4s de permanência. Nenhum movimento brusco, nenhum badge piscando. Assim que os MP4 forem colocados em `public/media/`, o vídeo assume sem nenhuma alteração de código.

## 5. Animações

- Entrada: fade + 20px de subida, stagger 0.08s entre eyebrow, título, subtítulo, botões e nota; composição entra com fade + escala 0.985→1 em 900ms.
- Nenhuma animação atrelada a scroll na Hero.
- `useReducedMotion` → tudo estático.

## 6. Detalhes técnicos

- Sem novas dependências (`framer-motion`, `lucide-react`, tokens existentes).
- Altura: `min-h-[88svh]` desktop / `auto` com padding no mobile; dimensões fixas da moldura (aspect-ratio 16/10) para evitar CLS.
- `LunariHero` continua exportado com o mesmo nome; `HomePage.tsx` não muda.
- Sem backend, sem migração, sem mudança de rota.
- SEO: `<h1>` único mantido na Hero; texto do título permanece em DOM (não em imagem/vídeo).
