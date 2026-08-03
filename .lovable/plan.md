# Home | Seção 03 — Timeline em scroll travado (sem imagem)

## Objetivo

Remover a imagem editorial da Seção 03 e transformar a seção em um bloco de leitura guiada: título fixo à esquerda, timeline à direita, e a página só avança para a próxima seção depois que o último item da timeline for revelado.

## Mudanças

### 1. Remover o visual
- Deletar a coluna da direita com `fluxoImg` em `FluxoSection.tsx`.
- Remover o import e o asset `src/assets/home-fluxo.jpg`.

### 2. Estrutura sticky (desktop)
- A seção vira um container alto (`height: 260vh`) que serve de "trilho" de scroll.
- Dentro dele, um bloco `sticky top-0 h-screen` centraliza o conteúdo: enquanto o usuário rola esses 260vh, a tela permanece na Seção 03 — só libera para a Seção 04 quando a timeline chega ao item 07.
- Grid interno: 40–45% texto (esquerda) / 55–60% timeline (direita), mantendo a alternância do DNA (Seção 02 teve visual à esquerda).

### 3. Coluna esquerda (fixa)
- Eyebrow `• O FLUXO`, título em duas linhas e subtítulo, sem alteração de copy.
- Fica visualmente parado durante todo o trecho sticky (não é sticky isolado: o pai já está travado).

### 4. Coluna direita — timeline
- Ocupa 90% da altura da seção visível (`h-[90vh]`, com `max-h` de segurança), com os 7 itens distribuídos verticalmente (`justify-between`) — respiro proporcional em vez de gap fixo.
- Linha vertical de 1px `rgba(11,11,11,0.14)` percorrendo toda a coluna.
- Ponto dourado 7px derivado de `scrollYProgress` do trilho, indo de 0% a 100% da linha.
- Progresso mapeado para o índice ativo: item atinge contraste pleno (título 100%, descrição fade-in) quando o ponto o alcança. Nenhum outro efeito.
- Descrições permanecem curtas (1–2 linhas) para caber em 90vh sem scroll interno.

### 5. Mobile
- Sem sticky e sem trilho de 260vh: a seção volta ao fluxo normal, título → subtítulo → timeline empilhados, altura automática e espaçamento fixo entre itens.
- O ponto dourado continua acompanhando o scroll da lista.

### 6. Acessibilidade e motion
- `useReducedMotion`: sem sticky travado (altura natural), ponto estático no topo e todos os itens em contraste pleno.
- Semântica mantida: `<ol>` com um `<li>` por etapa, h2 único na seção.

## Arquivos

- Editar: `src/components/landing/fluxo/FluxoSection.tsx`
- Remover: `src/assets/home-fluxo.jpg`

Sem backend, sem dependências novas, sem mudanças de copy.
