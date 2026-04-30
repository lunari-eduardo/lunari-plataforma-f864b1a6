## Objetivo

Quatro ajustes pontuais: limpar UI do Workflow, padronizar a cor da aba do PWA (cinza médio neutro) e travar o título da aba sempre como "Lunari Studio".

---

## 1. Workflow — Remover bloco "Adicionar Sessão Rápida"

**Arquivo:** `src/pages/Workflow.tsx`

- Remover o import do `QuickSessionAdd` (linha 4).
- Remover o JSX `<QuickSessionAdd ... />` (linha 1122).
- Remover o callback `handleQuickSessionAdd` (linhas ~906–941) e qualquer dependência exclusiva dele que fique órfã (`createManualSession` se não for usada em outro lugar — verificar antes de remover do destructuring).
- Manter o componente `src/components/workflow/QuickSessionAdd.tsx` no projeto (não excluir agora, evitamos quebrar imports residuais e podemos reusar futuramente).

## 2. Workflow — Remover seletor de colunas

**Arquivo:** `src/pages/Workflow.tsx`

- Remover o import do `ColumnSettings` (linha 5).
- Remover o JSX `<ColumnSettings ... />` (linhas 1154–1160).
- Manter o estado `visibleColumns` (a tabela ainda lê dele para decidir o que exibir) com o default já existente — apenas o controle visual é removido.

## 3. PWA — Cor da aba neutra (cinza médio)

Trocar o `theme_color` lilás (`#9b87f5`) por um cinza médio neutro que funcione bem em light e dark. Escolha: **`#6B7280`** (Tailwind `gray-500`) — equilibrado, sem viés quente/frio.

**Arquivos:**
- `index.html` (linha 26): `<meta name="theme-color" content="#6B7280" />`
- `vite.config.ts` (linha 25): `theme_color: '#6B7280'` no manifest do `VitePWA`.

Observação: o `apple-mobile-web-app-status-bar-style` continua `black-translucent` (já neutro). O usuário precisará reinstalar o PWA para ver a mudança no app instalado (manifest é cacheado no install).

## 4. Título da aba sempre "Lunari Studio"

**Arquivos a alterar:**

- `index.html` linha 15: `<title>Lunari Studio</title>`
- `index.html` linha 30: `apple-mobile-web-app-title` → `"Lunari Studio"`
- `index.html` linhas 57–58 (og:title / twitter:title): manter descrição rica para SEO/compartilhamento (não afeta aba) — **não alterar**, pois servem para previews sociais, não para a tab.
- `vite.config.ts`: `name: 'Lunari Studio'`, `short_name: 'Lunari Studio'`.

**Remover sobrescritas dinâmicas de `document.title`:**
- `src/components/seo/SEOHead.tsx` (linhas 25 e 84): remover as atribuições a `document.title` (manter o resto do componente para meta description/OG, que continuam úteis para SEO mas não mexem na aba).
- `src/pages/Tarefas.tsx` (linha 73): remover o `useEffect` que seta `document.title = 'Tarefas | Lunari'`.
- `src/pages/AnaliseVendas.tsx` (linha 15): remover a atribuição a `document.title`.
- `src/pages/Index.tsx` (linha 20): remover a atribuição a `document.title`.
- `src/pages/FeedTest.tsx` (linha 34): remover a atribuição (rota de teste, mas mantém consistência).

Resultado: o `<title>` do `index.html` permanece intocado durante a navegação SPA, garantindo "Lunari Studio" sempre.

---

## Resumo dos arquivos editados

- `index.html` — title, theme-color, apple title
- `vite.config.ts` — manifest name/short_name/theme_color
- `src/pages/Workflow.tsx` — remove QuickSessionAdd e ColumnSettings
- `src/components/seo/SEOHead.tsx` — remove document.title
- `src/pages/Tarefas.tsx`, `src/pages/AnaliseVendas.tsx`, `src/pages/Index.tsx`, `src/pages/FeedTest.tsx` — remove document.title