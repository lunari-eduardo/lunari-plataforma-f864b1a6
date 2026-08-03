# Home | Seção 03 — "Uma única linha. Do primeiro contato à entrega."

## Correção de DNA (antes da seção)

O DNA do site cita "terracota" como acento. Isso é revogado: o único acento do site passa a ser **dourado fosco `#C9A87C`** (token `TOKENS.gold`), com preto `#0B0B0B`, off-white `#F7F5F2` e branco.

- Atualizar `docs/constitution/DESIGN_DNA_SITE.md`: seção "Cores" passa a listar escuro, claro, dourado fosco; remover qualquer menção a terracota.
- Atualizar a memória `mem://constitution/design-dna-site-v1` com a mesma regra.
- Trocar o `TOKENS.ember` remanescente no eyebrow da Seção 02 (`RotinaSection.tsx`) por `TOKENS.gold`.

Também fica registrado que o ritmo escuro→claro admite exceção narrativa: Seção 02 e 03 compartilham o mesmo fundo claro, porque a mudança é de conteúdo, não de cor (regra explícita deste briefing). Isso será anotado no DNA para não gerar conflito futuro.

## Nova seção

Novo arquivo `src/components/landing/fluxo/FluxoSection.tsx`, montado em `HomePage.tsx` logo após `RotinaSection`.

- Fundo `#F7F5F2`, texto `#0B0B0B`, sem contraste de cor com a seção anterior.
- Desktop: grid 45% (texto + timeline) / 55% (composição visual), coluna de texto à esquerda — mantém a alternância do DNA (Seção 02 teve visual à esquerda).
- Mobile: título → subtítulo → timeline → imagem.
- Padding generoso (`py-28 md:py-40`), sem cards, caixas, sombras, ícones ou setas.

### Copy

- Eyebrow: `• O FLUXO` (sem numeração), mono, tracking largo, ponto em dourado.
- Título (h2, cor explícita `#0B0B0B`): "Uma única linha." / "Do primeiro contato à entrega." em duas linhas.
- Subtítulo: "Cada etapa continua exatamente de onde a anterior terminou."

### Timeline

Sete itens (01 Lead, 02 Agenda, 03 Contrato, 04 Sessão, 05 Galeria de seleção, 06 Pagamentos, 07 Entrega) com número, título e descrição curta exatamente como na copy enviada.

- Só texto. Número em mono 11px dourado-neutro, título 16–17px, descrição 14–15px em `rgba(11,11,11,0.55)`.
- Respiro alto entre itens (`gap` ~40px desktop), mas altura total contida: descrições em uma ou duas linhas.
- Linha vertical única de 1px preta (`rgba(11,11,11,0.14)`) percorrendo todos os itens à esquerda.
- Um único ponto dourado fosco (6px) sobre a linha, cuja posição é derivada do progresso de scroll da seção (`useScroll` + `useTransform`).
- Conforme o ponto passa por cada etapa, aquele item ganha contraste (título vai de 45% para 100% de opacidade; descrição faz fade-in). Nenhum outro efeito.
- `useReducedMotion`: ponto fica estático no topo e todos os itens ficam em contraste pleno.

### Visual (coluna direita)

Uma única composição editorial, gerada como imagem em `src/assets/home-fluxo.jpg`, retrato 4:5, sem moldura e sem sombra: uma sequência limpa e vertical de fragmentos de interface do Lunari (cliente → agenda → contrato → pagamento → sessão → galeria) sobre off-white, apenas preto/off-white/dourado, muito espaço negativo. Nada de dashboard, screenshot ou múltiplas janelas. Sticky discreto no desktop para acompanhar a leitura da timeline; parallax mínimo.

## Arquivos

- Novo: `src/components/landing/fluxo/FluxoSection.tsx`
- Novo asset: `src/assets/home-fluxo.jpg`
- Editar: `src/pages/site/HomePage.tsx`, `src/components/landing/rotina/RotinaSection.tsx` (acento dourado)
- Editar docs/memória: `docs/constitution/DESIGN_DNA_SITE.md`, `.lovable/memory/constitution/design-dna-site-v1.md`

Sem backend, sem dependências novas. SEO: apenas `alt` descritivo na imagem; h2 único na seção (h1 continua na Hero).
