# Refinamento Visual — Charts, Fundo e Hover

## Diagnóstico

Após inspeção de `src/index.css`, `src/lib/visualTheme.ts` e dos componentes de gráficos/dashboard, identifiquei 3 problemas concretos:

### 1. Gráficos ignoram o preset de brand
As variáveis `--chart-2..--chart-10` em `src/index.css` (linhas 97‑105) estão fixadas em hues terracota (`16 55% 40%`, `14 52% 33%`, `24 35% 59%`...). Quando o usuário troca o preset para "Neutro Mono", "Midnight Indigo", etc., apenas `--chart-1` muda (porque deriva de `--brand-h/s/l`); todos os demais continuam terracota — exatamente o que aparece nas screenshots de Finanças e Análise de Vendas (gráficos com barras laranja/bege mesmo após escolher Neutro Mono).

Além disso, `GraficosFinanceiros.tsx` ainda tem 2 cores hardcoded:
- L64: `fill="hsl(39, 50%, 70%)"` (barra "Lucro")
- L127: `fill="#8884d8"` (pie chart fallback)

### 2. Fundo bege fixo (light) / marrom (dark)
`--surface-0..--surface-4` no light usam hue 30 (warm/bege) e no dark hue 20 (warm marrom). Não há controle de temperatura no Visual Theme Studio — `surfaceHue/surfaceSaturation` existem em `visualTheme.ts` mas não são aplicados em `applyTheme()` nem refletidos no CSS.

### 3. Hover invertido
O padrão atual em `DashboardKpiCards.tsx` e diversos cards usa `bg-card/40` (semi-transparente sempre) + `hover:shadow-md`. Já as primitives `.glass-1/2/3` no `index.css` aumentam alpha no hover (vão de leve→médio→pesado), mas KPIs/cards customizados não usam essas classes — ficam etéreos sempre e "somem" visualmente no hover por contraste insuficiente. O usuário quer: **default mais translúcido / hover mais sólido**, aplicado de forma consistente.

---

## Plano

### Fase A — Charts derivados do brand (5 min, zero risco)

Reescrever `--chart-2..--chart-10` em `src/index.css` para derivarem matematicamente de `--brand-h` (mesma matiz, variando saturação e luminosidade). Resultado: paleta de 10 tons sempre coerente com o preset ativo.

```css
--chart-1:  var(--brand-h) var(--brand-s) var(--brand-l);
--chart-2:  var(--brand-h) calc(var(--brand-s) - 10%) calc(var(--brand-l) - 8%);
--chart-3:  var(--brand-h) calc(var(--brand-s) - 20%) calc(var(--brand-l) + 12%);
--chart-4:  calc(var(--brand-h) + 20) var(--brand-s) calc(var(--brand-l) + 6%);
... (escala harmônica até --chart-10)
```

Substituir também as 2 cores hardcoded em `GraficosFinanceiros.tsx` por `hsl(var(--chart-2))` e `hsl(var(--chart-3))`.

Ajustar dark equivalente (linhas 253‑262) com a mesma lógica derivada.

### Fase B — Temperatura de fundo configurável

1. **`src/index.css`** — refatorar surfaces para usarem variáveis de hue/saturação dinâmicas:
   ```css
   --surface-hue: 30;
   --surface-sat: 30%;
   --surface-0: var(--surface-hue) var(--surface-sat) 96%;
   --surface-1: var(--surface-hue) calc(var(--surface-sat) - 10%) 98%;
   ... (etc.)
   ```
   E versão dark equivalente com luminosidades baixas.

2. **`src/lib/visualTheme.ts` → `applyTheme()`** — passar a injetar `--surface-hue` e `--surface-sat` (campos já existem na config, só não eram aplicados).

3. **`src/pages/AdminVisualTheme.tsx`** — adicionar na aba **"Modo & Forma"** dois sliders novos:
   - **Temperatura do fundo** (hue 0‑360) — quente (laranja/bege) ↔ frio (azul/cinza)
   - **Saturação do fundo** (0‑40%) — neutro ↔ tingido
   
   E atualizar cada preset em `THEME_PRESETS` com valores apropriados (ex.: Neutro Mono já tem `surfaceHue: 220, surfaceSaturation: 6`, mas não estava sendo aplicado).

### Fase C — Inverter padrão de hover (glass → solid)

Princípio: cards/painéis ficam **mais translúcidos em repouso** e **se solidificam no hover**, dando feedback de "foco" em vez de desaparecer.

1. **`src/index.css`** — reescrever `.glass-1/2/3:hover` para subir o alpha (já fazem isso parcialmente; reforçar contraste). Adicionar nova utility:
   ```css
   .interactive-surface {
     background: hsl(var(--surface-2) / 0.55);
     backdrop-filter: blur(var(--glass-blur-md));
     border: 1px solid hsl(var(--border-subtle));
     transition: background .2s ease, box-shadow .2s ease, border-color .2s ease;
   }
   .interactive-surface:hover {
     background: hsl(var(--surface-2));      /* sólido */
     border-color: hsl(var(--border-default));
     box-shadow: var(--shadow-3);
   }
   ```

2. **Sweep dirigido (não global)** — substituir o padrão `bg-card/40 dark:bg-card/5 backdrop-blur-md ... hover:shadow-md` por `interactive-surface` nos arquivos onde esse padrão aparece. Mapeado:
   - `src/components/financas/dashboard/DashboardKpiCards.tsx` (6 cards)
   - `src/components/dashboard/KPIGroupCard.tsx`
   - `src/components/dashboard/ReceitaPrevistaCard.tsx`
   - `src/components/dashboard/ProductionRemindersCard.tsx`
   - `src/components/dashboard/FinancialRemindersCard.tsx`
   - `src/components/dashboard/DailyHero.tsx`
   - cards equivalentes em `src/components/analise-vendas/` (SalesMetricsCards, OriginHighlightCard, SalesGoalsCard)
   
   Não tocar em popover/dialog/sidebar — esses já têm comportamento próprio correto.

3. **Documentar** no `src/styles/lunari-design-rules.md` o novo padrão "interactive-surface" como default para cards navegáveis.

---

## Validação (após implementação)

1. Abrir `/app/admin/visual-theme`, aplicar preset **Neutro Mono** → conferir que gráficos de Finanças e Análise de Vendas mudam de terracota para tons azul/cinza.
2. Mexer no slider **Temperatura do fundo** → fundo deve transicionar de bege quente para neutro/frio em tempo real.
3. Passar mouse pelos cards do dashboard financeiro → devem ficar **mais sólidos** (não mais transparentes), com leve elevação de sombra.
4. Conferir dark mode em todos os três casos.

---

## Escopo explícito do que NÃO será feito

- Não tocaremos em lógica de negócio, queries ou hooks.
- Não migraremos persistência para Supabase (continua em localStorage por agora — já documentado).
- Não removeremos classes legadas (`lunari-*`, `card-lunar`) — apenas a nova utility convive.
- Hover de botões, inputs, sidebar e modais permanecem como estão (já estão corretos).

Aprove para eu executar as 3 fases em sequência (A → B → C) sem pausas.
