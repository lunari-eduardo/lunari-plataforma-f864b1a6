# Mapa de Navegação do Codebase Lunari (AI Guidance)

Este documento serve como um guia rápido para IAs e desenvolvedores externos navegarem no ecossistema Lunari.

## 1. Módulos e Arquitetura

O sistema está em transição para uma arquitetura baseada em domínios (`src/modules/`). Funcionalidades legadas residem em `src/features/` e hooks globais em `src/hooks/`.

### Módulos Ativos (Novo Padrão)
- **Financeiro**: `src/modules/finance/` (Domínio, Aplicação, Infra e Apresentação).
- **CRM/Leads**: `src/modules/crm/` (Em migração).

### Módulos Legados
- **Workflow**: `src/services/WorkflowSupabaseService.ts` + `src/hooks/useWorkflow.ts`.
- **Agenda**: `src/hooks/useAgenda.ts`.
- **Galeria (Delivery)**: `src/components/deliver/`.
- **Comercial (Propostas)**: `src/pages/comercial/` + `src/hooks/useMaterialEditor.ts`.

## 2. Mapeamento de Rotas (Pages)

| Rota | Arquivo de Página | Componentes Principais | Tabelas Supabase |
| :--- | :--- | :--- | :--- |
| `/app/financas` | `src/pages/FinancasPage.tsx` | `modules/finance/presentation/` | `financeiro_transacoes`, `financeiro_contas` |
| `/app/comercial/biblioteca` | `BibliotecaComercialPage.tsx` | `MaterialCard.tsx` | `commercial_materials` |
| `/app/comercial/construtor/:id` | `EditorPropostaPage.tsx` | `VisualRenderer.tsx`, `registry.ts` | `material_versions`, `proposal_templates` |
| `/p/:slug` | `PublicProposalViewer.tsx` | `VisualRenderer.tsx` | `commercial_materials`, `material_versions` |
| `/app/agenda` | `src/pages/AgendaPage.tsx` | `FullCalendar` integration | `agenda_eventos` |

## 3. Editor de Propostas (Seção Crítica)

O editor utiliza um motor de blocos V2.
- **Configuração de Blocos**: `src/pages/comercial/blocks/registry.ts`. Define schemas, campos e factories.
- **Renderização**: `src/pages/comercial/components/editor/VisualRenderer.tsx`. Converte `BlockData` em UI.
- **Estado/Undo/Redo**: `src/hooks/useMaterialEditor.ts`.
- **Design/Estilo**: `src/pages/comercial/blocks/design.ts`. Injeção de CSS Variables via Design Tokens.
- **IA**: `src/hooks/useProposalAI.ts`. Define presets de estilo e integra com Workers externos.

## 4. Regras Invioláveis (Constituição)

1. **Capability-first**: Adicione lógica no `registry.ts` ou hooks ANTES da UI.
2. **Sem Success Toasts**: CRUDs não devem mostrar toasts de sucesso (preferência do usuário). Apenas erros.
3. **Máscaras BRL**: Use `useCurrencyInput` para campos monetários.
4. **Triggers Financeiros**: Valores como `status_financeiro` e `valor_pago` são calculados via triggers no PostgreSQL. Nunca envie no payload de escrita.
5. **Storage**: Novos arquivos DEVEM ir para Cloudflare R2 via `useR2Upload`. Nunca use Supabase Storage.

## 5. Receitas Comuns

### Adicionar novo tipo de seção na Proposta:
1. Declare o schema em `src/pages/comercial/blocks/registry.ts`.
2. Adicione o renderer em `src/pages/comercial/components/editor/VisualRenderer.tsx`.
3. Adicione o editor de campos em `PropertiesSidebar.tsx` (se não for schema-driven).

### Alterar Design da Galeria:
- Modifique `GalleryRenderer` em `VisualRenderer.tsx`.
- Ajuste estilos em `src/components/deliver/covers/`.
