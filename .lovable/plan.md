# Sistema de Ajuda e Tutoriais do Lunari

## Conceito

Reaproveitar a infraestrutura de conteúdo (blog_posts + BlockEditor) para criar um **centro de ajuda contextual**. Cada página do sistema pode ter um artigo de ajuda vinculado. Um botão flutuante translúcido aparece em todas as páginas e leva direto ao artigo correspondente.

## Arquitetura

```text
┌─────────────────────────────────────────────┐
│  blog_posts (tabela existente)              │
│  + coluna: type ('blog' | 'help')           │
│  + coluna: route_reference ('/app/workflow') │
│  + coluna: video_url (opcional)             │
│  + coluna: display_order (int, para ajuda)  │
└─────────────────────────────────────────────┘

Admin cria artigo → escolhe type = "help" → seleciona rota de referência
Usuário na página → vê botão "?" → clica → abre página de ajuda
```

## Plano de Implementação

### 1. Migração Supabase — Novas colunas em `blog_posts`

```sql
ALTER TABLE blog_posts ADD COLUMN type TEXT DEFAULT 'blog';
ALTER TABLE blog_posts ADD COLUMN route_reference TEXT;
ALTER TABLE blog_posts ADD COLUMN display_order INTEGER DEFAULT 0;
```

- `type`: distingue conteúdo de blog vs ajuda
- `route_reference`: rota do sistema (ex: `/app/workflow`, `/app/agenda`)
- `display_order`: ordenação das páginas de ajuda

### 2. BlockEditor — Novo bloco `video`

Adicionar tipo `video` ao `BlockEditor` que aceita URLs do YouTube, Vimeo, ou links diretos de GIF/MP4. Renderiza como `<iframe>` (YouTube/Vimeo) ou `<video>` (MP4/GIF).

### 3. Admin — Formulário de conteúdo adaptado

Modificar `AdminConteudoNovo.tsx` e `AdminConteudoEditar.tsx`:

- Adicionar seletor de tipo: **Blog** ou **Ajuda**
- Quando tipo = "Ajuda", mostrar dropdown com as rotas do sistema (Workflow, Agenda, Clientes, etc.)
- Esconder campos de SEO quando tipo = "Ajuda" (não precisa)

### 4. Admin — Lista separada de artigos de ajuda

Na página `AdminConteudos.tsx`, adicionar tab ou filtro para ver artigos de ajuda separados dos de blog.

### 5. Página pública de ajuda — `/app/ajuda` e `/app/ajuda/:slug`

- `**/app/ajuda**`: Lista todos os artigos de ajuda publicados, agrupados ou em cards
- `**/app/ajuda/:slug**`: Renderiza o artigo com tipografia Inter para títulos e corpo limpo
- Sidebar de navegação com links para outros artigos de ajuda
- Suporte a imagens, vídeos embeddados e GIFs inline

### 6. Botão flutuante de ajuda — `HelpFloatingButton`

Componente global adicionado ao `Layout.tsx`:

- Posição: canto inferior direito, `fixed`, `z-50`
- Visual: ícone `?` ou `HelpCircle`, translúcido (`bg-white/40 backdrop-blur`), `opacity-40 hover:opacity-100`
- Lógica: lê `location.pathname`, busca artigo de ajuda com `route_reference` correspondente
  - Se existe artigo → navega para `/app/ajuda/{slug}`
  - Se não existe → navega para `/app/ajuda` (índice geral)
- Usa um hook `useHelpArticle(pathname)` que faz query leve com cache

### 7. Tipografia dos artigos de ajuda

- Títulos: `font-family: 'Inter'`, `font-weight: 600-700`
- Corpo: `font-family: 'Inter'`, `font-weight: 400`, `leading-relaxed`
- Sem serif. Layout limpo, espaçoso, fundo branco/glass.

## Arquivos

```text
Arquivo                                    Ação
─────────────────────────────────────────  ──────────────
Supabase migration                         ADD colunas type, route_reference, display_order
src/components/blog/blocks/VideoBlock.tsx   NOVO — bloco de vídeo/GIF
src/components/blog/BlockEditor.tsx         ADD tipo video
src/pages/AdminConteudoNovo.tsx             ADD seletor tipo + rota
src/pages/AdminConteudoEditar.tsx           ADD seletor tipo + rota
src/pages/AdminConteudos.tsx                ADD filtro blog/ajuda
src/pages/CentroAjuda.tsx                   NOVO — listagem de artigos
src/pages/ArtigoAjuda.tsx                   NOVO — visualização de artigo
src/hooks/useHelpArticles.ts                NOVO — queries de ajuda
src/components/help/HelpFloatingButton.tsx  NOVO — botão flutuante
src/components/layout/Layout.tsx            ADD HelpFloatingButton
src/App.tsx                                 ADD rotas /app/ajuda
src/hooks/useBlogPosts.ts                   UPDATE types + queries
```

13 arquivos. Reutiliza 100% do BlockEditor e infraestrutura de blog existente.