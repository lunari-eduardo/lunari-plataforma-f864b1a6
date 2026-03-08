

# Fix: Ícone "Início" sempre marcado como ativo

## Problema

O `NavLink` do React Router usa correspondência por **prefixo** por padrão. Como a rota do Dashboard é `"/app"` e todas as outras rotas começam com `"/app/"` (ex: `/app/workflow`, `/app/tarefas`), o item "Início" fica **sempre ativo**.

## Solução

Adicionar a prop `end` ao `NavLink` do item "Início". Isso faz com que o `isActive` só seja `true` quando a URL for **exatamente** `"/app"`.

A forma mais limpa é passar `end` como prop no `NavItem` e aplicá-la ao `NavLink` interno.

## Mudança

**`src/components/layout/Sidebar.tsx`**
- Adicionar prop `end?: boolean` na interface `NavItemProps`
- Passar `end` ao `NavLink` dentro do componente `NavItem`
- Adicionar `end: true` ao item `"/app"` no array `navItems`

Uma mudança de ~4 linhas total.

