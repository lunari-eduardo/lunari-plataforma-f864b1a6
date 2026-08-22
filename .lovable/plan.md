# Plano de Reconstrução: Editor de Propostas Lunari

## Análise do Estado Atual
O sistema atual utiliza um motor de blocos (V2) com `registry.ts` e `VisualRenderer.tsx`. Embora a arquitetura seja sólida (separação de `content` e `props`, histórico de undo/redo, design tokens), a implementação visual é limitada e rígida, falhando em entregar a experiência "Editorial Premium" desejada.

### Problemas Mapeados
1.  **Layouts Genéricos**: O gerador de IA e os templates manuais usam estruturas de grade e flexbox padrão que não possuem refinamento tipográfico ou espacial.
2.  **Rigidez das Fotos**: A orientação da foto (retrato/paisagem) não influencia o layout do container, causando cortes indesejados ou espaços vazios.
3.  **Grid de Portfólio Limitado**: O componente `Gallery` não suporta auto-layout inteligente baseado no aspecto das imagens nem upload em massa.
4.  **Personalização Restrita**: A escolha de fontes e tokens de design está enterrada em configurações globais, sem feedback visual imediato ou controle por seção.
5.  **Fidelidade ao PDF**: O sistema não consegue replicar composições complexas (como as do `modelo-proposta-lunari-2.pdf`) que exigem sobreposições precisas e quebras de grid não convencionais.

---

## Soluções Propostas

### 1. Novo Bloco: "Composição Editorial Premium"
Criar um motor de renderização inspirado na arquitetura "Seam" (costura), onde elementos tipográficos e fotográficos compartilham uma geometria comum.
- **Detecção de Orientação**: O componente `EditableImage` deve reportar as dimensões da imagem para o bloco pai, ajustando o `aspect-ratio` do container automaticamente.
- **Composição de Título**: Implementar o sistema de "Split Title" onde o texto pode atravessar divisões de cor (flipping color) entre o fundo e a foto.

### 2. Refatoração do Portfólio (Grid Inteligente)
- **Upload Múltiplo**: Atualizar o `AddImageTile` para aceitar múltiplos arquivos, processando o redimensionamento em paralelo.
- **Auto-Masonry Dinâmico**: Implementar um algoritmo que agrupa fotos similares (ex: duas verticais lado a lado) para manter o ritmo visual sem intervenção manual.

### 3. Sistema de Tipografia e Estilo Granular
- **Font Pairings**: Integrar o `ensureFontLoaded` com um seletor visual de pares de fontes (Display + Body) no painel de propriedades.
- **Override por Seção**: Permitir que tokens de design (cores/fontes) sejam sobrescritos em nível de bloco, não apenas globalmente.

### 4. Upgrade do Motor de IA (Briefing Visual)
- **Análise de Referências**: O `useProposalAI` deve enviar metadados de orientação de imagem e esquemas de cores extraídos das fotos para que o Worker gere blocos condizentes.

---

## Plano de Implementação (Etapas)

### Fase 1: Fundação e Assets
- [ ] Criar `docs/AI_CODEBASE_MAP.md` para guiar futuras manutenções.
- [ ] Implementar `lovable-assets` para as fontes e imagens base dos novos modelos.
- [ ] Criar novos presets em `src/hooks/useProposalAI.ts` baseados no PDF de referência.

### Fase 2: Componentes de Composição
- [ ] Criar `src/pages/comercial/blocks/EditorialComposition.tsx`: um bloco versátil que permite sobreposição de texto em fotos com controle de `z-index`.
- [ ] Atualizar `VisualRenderer.tsx` para suportar layouts de "sangria total" (full bleed).

### Fase 3: Experiência do Editor
- [ ] Adicionar suporte a múltiplos arquivos no `uploadImage.ts`.
- [ ] Refatorar `PropertiesSidebar.tsx` para incluir seletores de tipografia e paleta contextual.

### Fase 4: Validação e Link Público
- [ ] Garantir paridade total entre `VisualRenderer` no editor (desktop/mobile) e `PublicProposalViewer`.
- [ ] Otimizar o carregamento de fontes no link público para evitar FOIT (Flash of Invisible Text).

---

## Detalhes Técnicos para IA
- **Localização dos Blocos**: `src/pages/comercial/blocks/`
- **Renderização**: `src/pages/comercial/components/editor/VisualRenderer.tsx`
- **Lógica de Estado**: `src/hooks/useMaterialEditor.ts`
- **Design Tokens**: `src/pages/comercial/blocks/design.ts`
- **Database**: Tabelas `commercial_materials`, `material_versions` e `proposal_templates`.
