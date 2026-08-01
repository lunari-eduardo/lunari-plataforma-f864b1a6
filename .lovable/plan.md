# Seção 01 "O custo invisível" — refinamento do hub

Escopo: apenas `src/components/landing/problema/FragmentToEcosystem.tsx` e uma linha de copy em `ProblemaSection.tsx`. Hero, Header, Footer, tokens, tipografia e espaçamentos permanecem intocados.

## 1. Núcleo = símbolo da marca

O card central "Lunari / um só sistema" é removido (desktop e mobile).

No lugar entra o símbolo já existente no repositório: `src/assets/branding/lunari-icon-black.png`, importado como asset ES6, renderizado a 44px (desktop) / 36px (mobile), sem card, sem borda, sem texto.

Para que as linhas não passem por trás dele, o símbolo fica sobre um disco do próprio fundo (`#FAFAF7`) de ~72px com halo radial suave — os traços terminam no raio desse disco, nunca no meio da arte.

## 2. Layout de hub

Reescrita da geometria: cada módulo tem um único traço reto que sai da borda do disco central e termina na borda do card. Nenhuma linha cruza o centro; nenhuma linha cruza outra.

```text
                 Cliente
                    │
    Gallery ──── (símbolo) ──── Agenda
                 ╱     ╲
          Workflow     Financeiro
                    │
                Histórico
```

Posições finais (% do palco), já com a compactação de ~15% pedida (raio médio cai de ~40% para ~34%):

| Módulo | posição |
|---|---|
| Cliente | 50 / 16 (topo, hierarquia) |
| Agenda | 79 / 37 |
| Financeiro | 72 / 70 |
| Histórico | 50 / 84 |
| Workflow | 28 / 70 |
| Gallery | 21 / 37 |

O cálculo do traço passa a ser feito por trigonometria a partir do centro, com recuo (`inset`) no início (raio do disco) e no fim (borda do card), em vez de `M50 50 L x y` — é isso que elimina a sensação de linha passando por baixo.

## 3. Conexões mais presentes

- Traço principal: `rgba(10,10,10,0.18)` → `rgba(10,10,10,0.21)`, espessura `0.6` → `0.75` (non-scaling-stroke).
- Halo terracota de apoio reduzido a `0.06` e mantido só como profundidade.
- Nó de chegada: ponto de 1.6px na borda do card, na cor do traço, reforçando "conexão individual".

## 4. Animação em três estágios

O trilho de scroll sobe de 115vh para 150vh para dar respiro aos três momentos. Progresso `p` normalizado 0→1:

| Faixa | Estágio |
|---|---|
| 0 → 0.30 | **Independência.** Cards nas posições fragmentadas, rotação ±1.5°, sem nenhuma linha. Os traços tracejados "no vazio" atuais são removidos — independência é dita pela ausência de conexão, não por traços quebrados. |
| 0.30 → 0.65 | **Aproximação.** Cards migram para a órbita e trocam label por crossfade; as linhas começam a ser desenhadas (`pathLength` 0→1) partindo de fora em direção ao centro, em opacidade baixa (até ~60% do valor final). O símbolo ainda não existe. |
| 0.65 → 1 | **Unidade.** Símbolo entra com fade de 0→1 e escala 0.92→1 entre 0.72 e 0.95 (curva `EASE = [0.16,1,0.3,1]`), as linhas completam opacidade, os pontos de conexão acendem por último. |

Cada linha recebe um `delay` derivado do índice (stagger via faixas de `useTransform` levemente escalonadas), evitando que as 6 conexões apareçam em bloco.

## 5. Sistema vivo (pulso)

Depois de montado, um pulso percorre as conexões a cada 6s: um `circle` de 1.2px com `offsetPath`/`motion` animando de centro → módulo, opacidade máxima 0.28, duração 1.6s, stagger de 0.12s entre módulos, `repeatDelay` de ~4.4s. Sem glow, sem neon, sem blink — só um ponto neutro grafite deslizando.

O loop só inicia quando `p >= 0.95` (composição pronta) e pausa fora da viewport (`useInView`) para não custar CPU.

## 6. Microinterações de hover

Ao passar o mouse num módulo:
- card sobe 2px, sombra vai de `0 8px 24px -16px` para `0 12px 26px -14px`;
- a linha correspondente sobe para `rgba(10,10,10,0.34)` e espessura 0.95;
- o símbolo central escala para 1.03;
- transição 220ms, `EASE`.

Estado gerenciado por um `hovered: string | null` no `Stage`, sem re-render dos demais cards (valores via `motion` props).

## 7. Copy

Em `ProblemaSection.tsx`, apenas a última linha muda:

- de: "O Lunari foi criado para que o sistema faça esse trabalho."
- para: "Enquanto você fotografa, o Lunari mantém tudo conectado e organizado."

Título, linhas do problema e o fecho "No fim do dia, quem conecta tudo é você." permanecem iguais.

## 8. Mobile e reduced-motion

- Mobile: os dois quadros ("Hoje" / "Com Lunari") continuam, mas o quadro conectado perde o card de texto e passa a mostrar o símbolo centralizado acima do grid 2×3, com traços curtos saindo dele para as duas colunas. Sem scroll-driven, sem pulso.
- `useReducedMotion`: renderiza o estado final estático (símbolo + linhas completas), sem trilho sticky e sem pulso.

## Detalhes técnicos

- Sem novas dependências: `framer-motion`, `lucide-react` e o PNG do símbolo já existem.
- Sem mudanças em `primitives.tsx`, `SiteLayout`, `SiteNav`, `SiteFooter`, `LunariHero`.
- Cores restritas a `TOKENS.paper`, `TOKENS.ink`, `TOKENS.ember`, `TOKENS.hair`.
- Alturas fixas por breakpoint para evitar CLS; SVG com `viewBox` proporcional.
- Sem backend, sem migração, sem mudança de rota.

## Sugestões extras (padrão Apple / Linear) — opcionais

1. **Anel de órbita fantasma**: círculo hairline a 2% de opacidade passando pelos 6 módulos, revelado junto ao símbolo. Reforça "um sistema" sem adicionar ruído. Recomendo incluir.
2. **Hierarquia por peso, não por tamanho**: "Cliente" com label em `ink` sólido e os demais a 78% de opacidade — comunica o ponto de origem sem aumentar o card.
3. **Legenda de estágio** ("Hoje" → "Com Lunari") em 10px uppercase no canto do palco, com crossfade no estágio 3 — dá leitura imediata a quem não rola devagar. Fica a seu critério; sem ela a seção é mais silenciosa.
