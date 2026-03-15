

# Sistema de Ajuda e Tutoriais do Lunari — Implementado ✅

## Arquitetura

```text
blog_posts (tabela existente + novas colunas)
  + type: 'blog' | 'help'
  + route_reference: '/app/workflow', '/app/agenda', etc.
  + display_order: ordenação dos artigos de ajuda

Admin → Cria artigo tipo "Ajuda" → Seleciona rota de referência
Usuário → Vê botão "?" flutuante → Clica → Abre artigo de ajuda da página
```

## Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| Supabase migration | ✅ ADD colunas type, route_reference, display_order |
| `src/hooks/useHelpArticles.ts` | ✅ Criado — queries de ajuda |
| `src/components/help/HelpFloatingButton.tsx` | ✅ Criado — botão flutuante contextual |
| `src/pages/CentroAjuda.tsx` | ✅ Criado — listagem de artigos `/app/ajuda` |
| `src/pages/ArtigoAjuda.tsx` | ✅ Criado — visualização de artigo `/app/ajuda/:slug` |
| `src/components/blog/blocks/VideoBlock.tsx` | ✅ Criado — bloco de vídeo/YouTube/GIF |
| `src/components/blog/BlockEditor.tsx` | ✅ Modificado — novo tipo `video` |
| `src/pages/AdminConteudoNovo.tsx` | ✅ Modificado — seletor tipo + rota |
| `src/pages/AdminConteudoEditar.tsx` | ✅ Modificado — seletor tipo + rota |
| `src/pages/AdminConteudos.tsx` | ✅ Modificado — filtro blog/ajuda |
| `src/components/layout/Layout.tsx` | ✅ Modificado — HelpFloatingButton |
| `src/App.tsx` | ✅ Modificado — rotas /app/ajuda |

## Funcionalidades

- **Botão flutuante**: Translúcido (opacity 30%), canto inferior direito, detecta rota atual e leva ao artigo correspondente
- **Centro de Ajuda**: `/app/ajuda` com cards de todos os artigos publicados
- **Artigo de Ajuda**: `/app/ajuda/:slug` com sidebar de navegação, tipografia Inter
- **Bloco de Vídeo**: Suporta YouTube, Vimeo, MP4, WebM, GIF no BlockEditor
- **Admin**: Seletor de tipo (Blog/Ajuda), dropdown de rotas do sistema, ordem de exibição
- **Filtros admin**: Filtro por tipo (Blog/Ajuda) e status na lista de conteúdos
