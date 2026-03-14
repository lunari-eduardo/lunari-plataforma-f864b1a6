

# Fix: Input Perdendo Foco + Centro de Ajuda com Menu Lateral

## 1. Bug do Input — Causa Raiz

`BlockWrapper` e `BlockTypeSelector` são definidos **dentro** do componente `BlockEditor` (linhas 207-328). A cada keystroke:
1. `updateBlock` → `setBlocks` → re-render de `BlockEditor`
2. React cria **novas definições** de `BlockWrapper` e `BlockTypeSelector`
3. React interpreta como componentes diferentes → **desmonta e remonta** os blocos
4. Input perde foco (o DOM node é destruído e recriado)

**Solução**: Extrair `BlockTypeSelector` e `BlockWrapper` para fora do corpo de `BlockEditor`, passando as funções necessárias via props. Isso mantém referências estáveis entre re-renders.

```text
Antes:  function BlockEditor() { const BlockWrapper = () => ... }  ← recriado a cada render
Depois: function BlockWrapper({ onDelete, onChangeType, ... }) { ... }  ← referência estável
        function BlockEditor() { return <BlockWrapper ... /> }
```

## 2. Centro de Ajuda — Menu Lateral em vez de Cards

Substituir o layout de grid de cards em `CentroAjuda.tsx` por um layout com sidebar de navegação à esquerda e conteúdo do artigo selecionado à direita. Quando há artigos:
- Sidebar fixa com lista de títulos clicáveis
- Ao clicar, navega para `/app/ajuda/:slug` (comportamento atual mantido)
- Em mobile, sidebar vira menu horizontal ou accordion

Alternativa mais simples e consistente com `ArtigoAjuda.tsx`: manter a página de listagem como índice simples (lista vertical, sem cards pesados) com estilo de menu/nav links.

## Arquivos

```text
Arquivo                              Mudança
────────────────────────────────────  ──────────────
src/components/blog/BlockEditor.tsx  Extrair BlockWrapper e BlockTypeSelector para fora do componente
src/pages/CentroAjuda.tsx            Trocar grid de cards por lista simples estilo menu lateral
```

2 arquivos.

