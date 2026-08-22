# Plano de Implementação: Fase 4 — Validação e Link Público

A Fase 4 foca em transformar o rascunho do editor em uma peça final compartilhável, garantindo que a tipografia premium do Google Fonts funcione em toda a proposta e que o link público seja gerado e validado corretamente.

## Objetivos
1.  **Tipografia Global**: Implementar a lógica de tipografia em `useMaterialEditor` e `PropertiesSidebar`.
2.  **Validação de Publicação**: Garantir que o processo de "Publicar Versão" congele o design atual.
3.  **Link Público**: Validar a geração de slugs e a visualização pública com o `PublicThemeWrapper`.

## Passos de Implementação

### 1. Tipografia Global no Editor
- **useMaterialEditor.ts**: Adicionar `updateDesignTokens` para gerenciar fontes e cores globais.
- **PropertiesSidebar.tsx**: Conectar o seletor de fontes ao estado global da proposta.
- **blocks/design.ts**: Garantir que as fontes selecionadas sejam injetadas via Google Fonts dinamicamente.

### 2. Fluxo de Link Público
- **EditorPropostaPage.tsx**: Revisar a chamada de `openSlugModal` para garantir que o link seja gerado antes da personalização.
- **PublicProposalViewer.tsx**: Garantir que os `designTokens` (fontes) sejam aplicados corretamente no `PublicThemeWrapper` para o cliente final.

### 3. Ajustes de UI Finais
- Garantir que `EditorialComposition` e outros blocos respeitem as fontes globais injetadas nas CSS variables.
- Verificar o comportamento do "Botão Flutuante do WhatsApp" no modo público.

## Detalhes Técnicos
- Injeção dinâmica de `<link>` no `head` via `ensureFontLoaded`.
- Persistência de `design_tokens` na tabela `material_versions`.
- Mapeamento de slugs únicos na tabela `material_share_links`.

---
*Este plano foca na estabilidade da entrega final para o cliente do fotógrafo.*
