

# Mover Avatar para Header + Backdrop Blur no Dropdown

## O que muda

1. **Header.tsx** — Adicionar avatar do usuário no lado direito (posição do sino), manter theme toggle entre notificação e avatar. Ordem final: `[Título] ... [Bell] [Theme] [Avatar]`

2. **Backdrop blur no dropdown do avatar** — Quando o dropdown do perfil abrir, adicionar um overlay com `backdrop-filter: blur(8px)` atrás para desfocar o fundo, similar ao padrão do Gallery.

3. **Sidebar.tsx** — Remover o `UserAvatar` do sidebar (atualmente no topo), já que ele será movido para o Header.

## Implementação

### Header.tsx
- Importar `Avatar`, `AvatarImage`, `AvatarFallback`, `DropdownMenu` e hooks (`useUserProfile`, `useAuth`, `useAccessControl`)
- Mover a lógica do `UserAvatar` (dropdown com menu items: Minha Conta, Minha Assinatura, Admin, Sair) do Sidebar para o Header
- Envolver o dropdown com um overlay div que aparece quando o menu está aberto (`onOpenChange`) com classes `fixed inset-0 bg-black/20 backdrop-blur-sm z-40`
- Layout do header: `[title] ... [Bell] [ThemeToggle] [Avatar]`

### Sidebar.tsx
- Remover o componente `UserAvatar` e suas referências
- Remover imports não mais necessários (`Avatar`, `AvatarImage`, `AvatarFallback`, `DropdownMenu*`, `useUserProfile`, `useAuth`, `useAccessControl`, `User`, `CreditCard`, `Shield`, `FileText`, `Package`)
- Manter apenas a navegação no sidebar

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/layout/Header.tsx` | Adicionar avatar + dropdown com backdrop blur |
| `src/components/layout/Sidebar.tsx` | Remover UserAvatar e imports relacionados |

