# Home Lunari — Correção estrutural + elevação premium

## O que quebrou (causa confirmada)

O bloco de cores `site` (gold, graphite, offwhite, ink, linhas) foi inserido **dentro do plugin de tipografia** do `tailwind.config.ts` (linha 86, aninhado no bloco `li` do `typography`), e não dentro de `theme.extend.colors` (que começa só na linha 104).

Consequência: **nenhuma classe `bg-site-*`, `text-site-*`, `border-site-*` existe**. Todas as seções novas da Home ficam sem fundo e sem cor de texto, herdando o fundo claro `#FAFAF7` do `SiteLayout`. Seções que deveriam ser escuras viram claras, e textos pensados para fundo escuro ficam quase invisíveis — exatamente o que aparece nos prints.

Problemas secundários confirmados na leitura:

1. `Hero.tsx` usa `src="/api/placeholder/800/600"` — rota inexistente, gera o retângulo com imagem quebrada.
2. `.site-scope` força `color: inherit` em todos os elementos, o que anula qualquer fallback de contraste quando um token falha. É o que transforma um bug de token em site inteiro ilegível.
3. `.site-reveal` inicia em `opacity: 0`; se algum bloco não entra no observer (ou o conteúdo já está acima da dobra em telas altas), o texto fica invisível — sem rede de segurança.
4. `SiteNav` é `fixed z-[100]`, mas o print 3 mostra o dropdown sobreposto ao rodapé: o menu abre sem `aria`/estado de fechamento por rota, e o conteúdo interno colide.

## Plano

### Onda 1 — Reparo estrutural (bloqueante)
- Mover o grupo `site` para dentro de `theme.extend.colors`, corrigindo o aninhamento quebrado do `typography`, e revalidar o config.
- Trocar `.site-scope { color: inherit }` por cores explícitas: `.site-scope` define `color: var(--site-ink)` e `.site-scope [data-tone="dark"]` define `var(--site-on-dark)`. Nada mais herda cor cega.
- `.site-reveal` ganha rede de segurança: só aplica `opacity: 0` quando o JS marca `data-reveal-armed`, e o hook arma no mount. Sem JS ou sem observer, o conteúdo aparece.

### Onda 2 — Contrato de seção (evita a próxima regressão)
- Criar `SiteSection` como primitivo único: recebe `tone="dark" | "light"`, aplica fundo, cor de texto, cor de borda e padding vertical. Toda seção da Home e das páginas internas passa a usá-lo.
- Regra: nenhuma seção define fundo solto; a alternância claro/escuro vira propriedade de dados, não improviso por seção.
- Sequência definida da Home: Hero (dark) → Módulos (light) → Tour (dark) → Gallery (light) → Lu (dark) → Preços (light) → Fechamento (dark).

### Onda 3 — Hero premium de verdade
- Remover o placeholder quebrado. Substituir por composição real: mockup da interface Studio renderizado em componente (janela, barra superior, dados reais de sessão), sem depender de imagem externa.
- Halo dourado suave, badge de status flutuante, entrada em cascata (título → lead → CTAs → mockup).

### Onda 4 — Auditoria de contraste em todo o site
- Varredura de `/studio`, `/gallery`, `/gallery/select`, `/gallery/transfer`, `/precos`, `/sobre`, páginas legais.
- Cada título, corpo, eyebrow e borda revalidado contra o fundo real, mínimo AA (4.5:1 para corpo, 3:1 para títulos grandes).
- Padronizar a escala tipográfica das páginas Gallery Select/Transfer como referência única (Geist para UI, Instrument Serif só em ênfase, Geist Mono só em eyebrow).

### Onda 5 — Refino premium
- Nav: fundo transparente no topo que vira vidro fosco ao rolar, dropdown com fechamento por rota e por clique fora, âncora correta.
- Microinterações contidas: hover com elevação de 2px, sublinhado dourado que cresce, cursor de destaque só em CTA.
- Ritmo vertical consistente (padding 96/128px desktop, 64/80px mobile) e largura máxima única.
- Mobile: menu em painel completo, grid de módulos em coluna única, tipografia reduzida sem perder hierarquia.

### Onda 6 — Verificação
- Screenshot automatizado das rotas públicas em desktop e mobile, com checagem de que nenhuma seção renderiza texto de baixo contraste.
- Conferência do console sem erros e sem requisições 404 de imagem.

## Detalhes técnicos
- Arquivos centrais: `tailwind.config.ts`, `src/index.css` (`.site-scope`, `.site-reveal`), `src/hooks/use-reveal.ts`, `src/components/site/typography.tsx`, `src/components/site/primitives.tsx`, `src/components/site/SiteNav.tsx`, `src/components/home/*`.
- Sem novas dependências, sem mudança de stack, sem tocar em rotas do app autenticado nem nas páginas legais.
- Tokens permanecem os oficiais do Silent Luxury: gold `#C9A87C`, graphite `#262421`, offwhite `#F4F1EA`, ink `#2A2724`.
