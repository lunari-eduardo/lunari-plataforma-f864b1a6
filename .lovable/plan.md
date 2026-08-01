# Ocultar Hub de IA, Leads e Assistente para usuários comuns

Hoje `Hub de IA` e `Leads` aparecem no menu de todos os usuários, e `Integrações` tem uma aba "Assistente" duplicando o que já vive no Hub. Objetivo: tudo isso passa a ser visível somente para admin, e a aba Assistente deixa de existir em Integrações (seu conteúdo já está no Hub).

## O que muda

### 1. Menu lateral
- Itens `Leads` e `Hub de IA` só aparecem quando a conta é admin (desktop, tablet e menu "Mais" do mobile).
- Usuário comum não vê nem o ícone nem o atalho.

### 2. Rotas protegidas
- `/app/leads`, `/app/hub` e as telas do assistente (`/app/assistente/mcp`, `/app/assistente/aprovacoes`, `/app/configuracoes/assistente-mcp`) passam a exigir admin.
- Acesso direto pela URL por não-admin cai em "página não encontrada" (mesmo comportamento de rota inexistente, para não revelar o recurso).

### 3. Integrações
- Remoção da aba "Assistente" (gatilho + conteúdo). Integrações fica com Pagamentos, Assinatura e Calendar.
- O card "Assistente Lu · MCP" e seus botões passam a viver no Hub de IA, dentro da aba **Conexões**, acima da lista de tokens — nada de funcionalidade é perdida.

## Detalhes técnicos

- Novo guard `RequireAdmin` (padrão do `RequireAssistantAccess`), usando `useAccessControl().accessState.isAdmin`; enquanto carrega mostra spinner, se não for admin renderiza `NotFound`.
- `PhotographerApp.tsx`: envolver as rotas `leads`, `hub`, `assistente/*` e `configuracoes/assistente-mcp` com `RequireAdmin` (mantendo o `PlanRestrictionGuard` do Leads por dentro).
- `Sidebar.tsx`: `navItems` passa a ser um `useMemo` filtrado por `accessState.isAdmin` via flag `adminOnly` nos itens de Leads e Hub. Como o mobile usa `navItems.slice(0,4)`, a grade continua com 4 itens + "Mais" após a filtragem.
- `IntegracoesTab.tsx`: remover `TabsTrigger`/`TabsContent` de `assistente`, o `useAssistantAccess` e imports órfãos; ajustar `grid-cols` da `TabsList` para 3.
- Novo componente `src/components/hub/HubConexoesAssistente.tsx` com o card MCP movido; renderizado na aba `conexoes` do `Hub.tsx` antes de `<AssistenteMcpTokens />`.
- Sem mudanças de banco, RLS ou Edge Functions: é ocultação de superfície de UI; as permissões reais do assistente continuam regidas por `assistant_access` / grants existentes.
