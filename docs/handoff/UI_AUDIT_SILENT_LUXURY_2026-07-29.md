# Auditoria de UI — 6 páginas · Padronização "Silent Luxury"

> Data: 2026-07-29 · Status: **Ondas 0, 1, 2, 3 e 6 implementadas**, ondas 4, 5 e 7 pendentes.
> Fonte de verdade visual: `docs/constitution/DESIGN_DNA.md` + `src/styles/lunari-design-rules.md`.

## Referência do padrão (o que é "certo" hoje)

Base: Finanças + `src/components/layout/PageContainer.tsx` e `PageHeader.tsx`.

```text
PageContainer  → max-w-[79rem] mx-auto w-full px-4 md:px-6   (variant default)
PageHeader     → h1 text-[15px] font-semibold + p text-xs muted, pb-4
Métricas       → MetricIconBadge (dourado fosco) + valor text-[26px]
Cards          → border-border/20 bg-card/60 shadow-sm rounded-xl
Escala tipo    → 15px título de página · 13px título de seção · 12px corpo · 11px legenda
Ícones         → h-4 w-4 (ação) · h-3.5 w-3.5 (inline) · muted ou dourado em badge
Espaçamento    → seções space-y-4 · interno de card p-4/p-5 · fim de página pb-10
```

---

## 1. AGENDA (`src/pages/Agenda.tsx` + `src/components/agenda/*`)

### Inconsistências
1. Sem `PageContainer`/`PageHeader`; largura manual `max-w-7xl` (`Agenda.tsx:319`).
2. Card glass envolvendo a página inteira (`Agenda.tsx:320`): `bg-card/30 backdrop-blur-xl border-white/50`. Cria caixa-dentro-de-caixa e reduz contraste dos textos secundários.
3. Sete larguras de modal diferentes: `sm:max-w-[500px]`, `[600px]`, `[480px]`, `sm:max-w-md`, `sm:max-w-lg`, `sm:max-w-2xl`, `max-w-md`
   (AgendaModals 78/97/112/129, AvailabilityConfigModal:321, ClientEditModal 165/189/212, ConflictResolutionModal:110, ShareAvailabilityModal 204/226, ActionChoiceModal:80, SlotConflictDialog:45).
4. Scroll de modal inconsistente: `max-h-[80vh]`, `[85vh]`, `[90vh]`, e `BudgetAppointmentDetails.tsx:93` com scroll no filho — corta o footer no iOS.
5. `DialogTitle` com `text-lg font-semibold` (`AgendaModals.tsx:80`) em vez de 15px.
6. Footers não padronizados (uns com `DialogFooter`, outros com botões soltos).
7. `pb-20 md:pb-4` — desktop termina colado.
8. `DataIntegrityPanel` de debug no fluxo principal, sem hierarquia.

### Padronizar
- `PageContainer variant="wide"` + `PageHeader title="Agenda"`, mantendo `AgendaHeader` como barra de ação.
- Remover glass do card externo → `border-border/20 bg-card/60 shadow-sm` (year/month podem ficar sem card).
- Aplicar `dialogSize()` + `DIALOG_SHELL/BODY/FOOTER` de `src/lib/dialogTokens.ts` nos 11 modais.
- `DialogTitle` → `DIALOG_TITLE_CLS`.
- `pb-20 md:pb-10`.

### Manter
Lógica de conflitos, swipe, atalhos, sidebar condicional, `AnnualView` a 1600px (grade de 12 meses justifica).

---

## 2. TAREFAS (`src/pages/Tarefas.tsx`, `Tarefas.css`, `modules/tasks/presentation/*`)

### Inconsistências
1. Glass nos cards de tarefa — `Tarefas.css:71-152` (`backdrop-filter: blur(16px) saturate(160%)`, gradiente branco, borda branca), aplicado em `TaskCard.tsx:110`.
2. Performance: `backdrop-filter` por card; com 40+ cards trava no Safari/iOS.
3. Contraste: `text-muted-foreground` sobre gradiente branco fica ~3.1:1 no light (abaixo de AA).
4. Dois cards para a mesma entidade: `TaskCard` (glass) vs `CleanTaskCard:35` (`bg-lunar-background border-lunar-border/60`).
5. Cores fora de token: `bg-lunar-background`, `rgba(255,255,255,…)`.
6. `glass-btn-primary` (`Tarefas.tsx:315`) fora do `Button` do sistema.
7. Sem `PageHeader` — única página sem título.
8. Sem container (`px-2` cru, `Tarefas.tsx:298`).

### Padronizar
- Cards → `.task-card` (já criada na Onda 0), preservando `--card-color` e o `::before`.
- **Colunas kanban mantêm o glass** (pedido explícito).
- `glass-drag-overlay` mantido (overlay flutuante), com card interno sólido.
- `glass-btn-primary` → `<Button size="sm">`.
- `PageContainer variant="wide"` + `PageHeader title="Tarefas"`, sem alterar `h-[calc(100vh-4rem)]`.

### Manter
DnD (`rectIntersection`, sensores, optimistic patch), undo, filtros, `ChecklistPanel`, scroll horizontal `onWheel`.

---

## 3. CLIENTES + PERFIL

### Lista (`src/pages/Clientes.tsx`)
1. Sem `PageContainer`/`PageHeader`.
2. Arquivo monolítico (869 linhas) — **sem refatoração estrutural nesta etapa**, só classes.
3. Modos cards/lista com paddings e tipografia divergentes.
4. Paginação manual em vez do componente `Pagination`.

### Perfil (`ClienteDetalhe.tsx` + `cliente-detalhe/*`)
1. `ScrollArea` + `max-w-7xl px-4 md:px-6 lg:px-8` manual (linhas 42-43).
2. `ClientMetricsGrid.tsx` fora do padrão: `text-green-600`, `text-emerald-500`, `text-blue-600`, `text-orange-600`; valores `text-sm md:text-lg font-bold`; sem `MetricIconBadge`.
3. Tabs `text-xs md:text-sm` e ícones `h-3 w-3 md:h-4 md:w-4` (duas espessuras por breakpoint).
4. Três linguagens de seção em abas irmãs: `HistoricoTab` (Card completo), `DocumentosTab` (`section` + `Separator`), `ContactoTab` (Accordion + Card).
5. `DocumentosTab` com ícone `text-primary` inline.
6. Sem `pb-*`.

### Padronizar
- Perfil: `PageContainer variant="default"` + `pb-10`.
- `ClientMetricsGrid` → `MetricCard`/`MetricIconBadge` de Finanças; cores literais → `--success`/`--warning`/`foreground`; preservar `Math.max(0, …)`.
- Padrão único de seção nas 3 abas: `h3 text-[13px] font-semibold` + `p text-xs muted`.
- Tabs `text-xs` fixo, ícone `h-3.5 w-3.5`.
- Lista: `PageContainer variant="wide"` + `PageHeader title="Clientes"` + `pb-10`.

### Manter
`useClientDetails`, métricas, `InlineEditField`, `PhoneInputSmart`, `AddressFieldsBlock`, dedupe, `FamilyMiniCard`.

---

## 4. PRECIFICAÇÃO (`src/pages/Precificacao.tsx` + `components/precificacao/*`)

Maior desvio das seis.

1. `PricingHeader.tsx` — h1 `text-xl md:text-2xl font-bold`; avatar `bg-gradient-to-br from-primary/20`; stepper com cores proibidas: `bg-blue-100 text-blue-700`, `bg-green-100`, `bg-purple-100` (linhas 23-33).
2. `EtapaColapsavel.tsx:29` — `bg-primary/40 hover:bg-primary/50 border-primary/30`: 40% de grafite como fundo de accordion, superfície inexistente no resto do produto, derruba o contraste da descrição.
3. Número em `w-8 h-8 rounded-full bg-muted font-bold` — badge concorrente ao `MetricIconBadge`.
4. Ordem visual ≠ numérica: render é Custos → Equipamentos → Calculadora → Metas (`Precificacao.tsx:76-89`); o stepper diz Custos → Metas → Calcular.
5. `text-green-600` de status salvo (`EtapaColapsavel:41`) → `--success`.
6. Container `max-w-7xl p-4 md:p-6 lg:p-8 pb-40 lg:pb-8` fora de escala.
7. `ResumoFinanceiroSticky` — sticky exclusivo, **justificável**, fica.
8. `EstruturaCustosFixos.tsx` (982 linhas) exige segunda passagem.

### Padronizar
- `PricingHeader` → `PageHeader`; stepper em neutros (ativo `bg-foreground/5 border-border`, concluído dourado fosco) e reordenado conforme o render real.
- `EtapaColapsavel` → `bg-card/60 border-border/20 hover:bg-muted/40`, número em badge quadrado dourado fosco, título `text-[13px]`, descrição `text-xs`.
- `text-green-600` → `text-success`.
- `PageContainer variant="wide"`, `pb-32 lg:pb-10`.
- Segunda passagem em `EstruturaCustosFixos`, `CalculadoraServicos`, `EtapaEquipamentos`, `EtapaMetas`, `MetasIndicadores`, `FeedbackContextual`, `SimpleProductSelector`, `SalvarPacoteModal`.

### Manter
Matemática (`custoHora`, `metaFaturamentoAnual`), `PricingProvider`, `setInterval` de validação, persistência, sidebar sticky.

---

## 5. CONFIGURAÇÕES (`src/pages/Configuracoes.tsx`)

Já usa `PageContainer variant="wide"` + `PageHeader`. Desvios:

1. `ScrollArea h-[calc(100vh-120px)]` (linha 26) — Radix esconde barra e mata momentum no iOS; padrão é scroll nativo.
2. `Card` + `CardContent p-6` (linha 45) — caixa dentro do container; Finanças e Integrações não têm.
3. `TabsList` underline transparente vs. `grid grid-cols-4` de Integrações — **duas linguagens de tabs**.
4. Ícones de tab sem consistência com o perfil do cliente.
5. Sem `pb-*`.
6. `variant="wide"` enquanto Integrações usa `default`.

### Padronizar
- Um único padrão de tabs (proposta: underline transparente, o mais "Silent Luxury") em Configurações, Integrações e perfil do cliente.
- Remover o wrapper `Card`/`CardContent p-6`.
- Scroll nativo + `pb-10`.
- `variant="default"` (79rem) nas duas páginas.
- Sub-abas (`Categorias`, `Pacotes`, `Produtos`, `FluxoTrabalho`, `PrecificacaoFotos`, `FormulariosConfig`, `ContratosConfig`) em onda separada.

---

## 6. INTEGRAÇÕES (`src/pages/Integracoes.tsx` + `preferencias/IntegracoesTab.tsx`)

1. `TabsList grid grid-cols-4 max-w-2xl` — linguagem divergente; em ~570px sobram só ícones sem tooltip.
2. `TabsContent mt-6` manual em cada aba.
3. `PaymentSettings` é o benchmark bom; Assinatura (`max-w-xl` solto), Calendar e Assistente têm densidades diferentes.
4. `ScrollArea h-screen` (`Integracoes.tsx:9`) dentro de shell com header ⇒ ~64px de scroll fantasma.
5. Crown de recurso Pro em `text-primary` (grafite) — caso de uso reservado ao dourado.

### Padronizar
- Mesma `TabsList` de Configurações (com scroll horizontal no mobile).
- `mt-5` compartilhado em vez de `mt-6` por aba.
- Assinatura/Calendar/Assistente adotam a densidade de card de `PaymentSettings` (sem tocar em lógica de conexão).
- Scroll nativo + `pb-10`.
- Crown → `text-accent-gold`.

---

## Riscos de regressão

| Risco | Onde | Mitigação |
| --- | --- | --- |
| Kanban perde altura/scroll | Tarefas | não alterar `h-[calc(100vh-4rem)]` nem `flex-shrink-0` |
| Modal com footer cortado no iOS | Agenda | `DIALOG_SHELL` + `DIALOG_BODY` (`min-h-0 flex-1`) |
| Foco perdido em edição inline | Perfil do cliente | não tocar em `InlineEditField`/`PhoneInputSmart` |
| Cálculo quebrado | Precificação | mudanças só em JSX de apresentação |
| Radix ScrollArea → nativo | Config/Integrações | wrapper precisa de `min-h-0` no pai flex |
| Perda de identidade de status | Tarefas | preservar `--card-color` e o `::before` |

## Plano por ondas

- **Onda 0 — Fundação · ✅ CONCLUÍDA**
  - `.task-card` / `.task-card-placeholder` em `src/pages/Tarefas.css` (superfície sólida, sem `backdrop-filter`, com faixa `--card-color`).
  - `src/lib/dialogTokens.ts`: `dialogSize('sm'|'md'|'lg')`, `DIALOG_SHELL`, `DIALOG_BODY`, `DIALOG_FOOTER`, `DIALOG_TITLE_CLS`, `DIALOG_DESCRIPTION_CLS`.
  - Tokens confirmados: `--success` (light `152 40% 34%` / dark `152 38% 52%`), `--accent-gold` (`39 35% 60%` / `40 45% 66%`), `--shadow-1/2`. Utilitários Tailwind `text-success`, `text-accent-gold`, `bg-accent-gold-soft` já existem.
  - **Zero impacto visual** — nada consome as novas classes ainda.
- **Onda 1 — Tarefas:** aplicar `.task-card` (kanban + lista), unificar `TaskCard`/`CleanTaskCard`, `glass-btn-primary` → `Button`, container + header. Colunas kanban intocadas.
- **Onda 2 — Agenda · ✅ CONCLUÍDA:** container/header, remover glass externo, aplicar `dialogTokens` nos 11 modais, `pb-10`.
- **Onda 3 — Configurações + Integrações:** tabs unificadas, remover Card wrapper, 79rem, scroll nativo, Crown dourado, densidade alinhada a `PaymentSettings`.
- **Onda 4 — Clientes + perfil:** container/header, `ClientMetricsGrid` → MetricCard dourado, seção única nas 3 abas, tabs na escala, `pb-10`.
- **Onda 5 — Precificação:** `PricingHeader` → `PageHeader` + stepper neutro reordenado, `EtapaColapsavel` redesenhado, container/pb.
- **Onda 6 — Segunda passagem:** sub-abas de Configurações e internos de Precificação (tokens, escala, ícones).
- **Onda 7 — QA visual:** light/dark, 375/570/768/1280/1600px, iOS Safari, foco em contraste de textos secundários.


## Onda 6 — Densidade interna e micro-superfícies (Agenda) · ✅ CONCLUÍDA

Tokens novos em `src/lib/dialogTokens.ts`: `FIELD_LABEL`, `FIELD_GROUP`, `FORM_SECTION`,
`SECTION_SURFACE`, `SECTION_TITLE`, `DROPDOWN_PANEL`, `DROPDOWN_ITEM`.

- **AppointmentForm**: root/form `space-y-5` → `space-y-4`; blocos Cliente / Pacote / Valor /
  Status / colapsáveis em `SECTION_SURFACE`; labels em `FIELD_LABEL`; status sem amber/green
  hardcoded (agora `lunar-warning` / `lunar-success`); botões de status `h-10 text-xs`.
- **AppointmentDetails**: tokens `lunar-surface`/`lunar-border`/`lunar-text`/`lunar-muted`
  substituídos por semânticos; blocos `p-4` → `p-3`; títulos em `SECTION_TITLE`; ícones de
  seção em `text-accent-gold`; título do header em `text-[15px]`; inputs inline `h-8`.
- **AvailabilityConfigModal**: corpo `space-y-6` → `space-y-4`; labels em `FIELD_LABEL`;
  segmented control `py-1.5 text-xs`; opções de rádio `text-[13px]`.
- **Comboboxes (Client/Package/Product)**: painel e item unificados via `DROPDOWN_PANEL` /
  `DROPDOWN_ITEM`; z-index único `z-[70]` (era `9999` vs `50`); `text-green-600` → `text-lunar-success`;
  favorito em `accent-gold`.
- **TimeSlotOptionsMenu**: itens `h-8 text-xs`; ícones em `lunar-success` / `primary` / `destructive`.
- **DayPreviewPopover**: bordas `/40` → `/20`.


## Onda 3 — Configurações + Integrações · ✅ CONCLUÍDA

Novo `src/components/layout/PageTabs.tsx`: `PAGE_TABS_LIST`, `PAGE_TABS_TRIGGER`,
`PAGE_TABS_CONTENT`, `PAGE_SCROLL_SHELL`. Utilitário `.no-scrollbar` em `src/index.css`.

- **Configurações**: `ScrollArea h-[calc(100vh-120px)]` removida (o `<main>` do Layout já é o
  scroller nativo); wrapper `Card`/`CardContent p-6` removido; `variant="wide"` → `default`
  (79rem); 7 abas migradas para `PAGE_TABS_*` com `title`; `TabsContent` em `mt-5`; `pb-10`.
- **Integrações**: `min-h-screen` + `ScrollArea h-screen` removidos (fim do scroll fantasma);
  `TabsList grid grid-cols-4 max-w-2xl` → `PAGE_TABS_LIST` (mesma linguagem de Configurações,
  com scroll horizontal no mobile); `mt-6` por aba → `PAGE_TABS_CONTENT`; Crown Pro e ícone
  `Bot` em `text-accent-gold`; painéis `max-w-xl` → `max-w-2xl`; card do Assistente na
  densidade de `PaymentSettings` (`CardHeader pb-3`, `CardContent pt-0 space-y-3`,
  título `text-sm font-semibold`, texto de apoio `text-xs`).
- Nenhuma alteração em hooks, queries, OAuth do Google, gating Pro ou tokens MCP.

## Onda 4 — Clientes + Perfil (concluída)

- Novo `src/components/clientes/clienteTokens.ts` (superfícies sólidas, badges de status e paleta financeira semântica).
- `Clientes.tsx`: `ScrollArea`/`max-w-7xl` removidos → `PageContainer` (79rem) + `PageHeader`; toggle de visualização sem `lunar-border`; tabela e cards com bordas `/20`, tipografia `text-[15px]`, ações neutras (destrutivo só no hover); paginação e empty state padronizados; modal de cliente com `dialogSize('md')`, `DIALOG_SHELL/BODY/FOOTER` e `FIELD_LABEL`.
- `ClienteDetalhe.tsx`: `PageContainer` + `PageTabs`; skeletons de carregamento; estado "não encontrado" padronizado.
- `ClientHeader`: linha única, nome `text-[17px]`, ações com ícone dourado.
- `ClientMetricsGrid`: migrado para `MetricIconBadge` (gold-soft) + valores `text-[20px]`.
- `HistoricoTab`/`DocumentosTab`: `SECTION_SURFACE`/`SECTION_TITLE` no lugar de `Card` legado e `Separator`.
- `ContactoTab`: header sólido (sem gradiente), accordions `border-border/20 bg-card/60`, ícones de seção em badge dourado.
- Cores cruas eliminadas em `FamilyMiniCard` e `PhoneInputSmart`.
- Código morto removido: `cliente-detalhe/forms/*`, `useClientForm`, `useClientValidation`.
