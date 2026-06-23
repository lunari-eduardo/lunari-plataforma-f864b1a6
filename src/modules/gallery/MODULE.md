# Módulo Gallery

Camada de gestão (front-office) das galerias dentro do Lunari. Compartilha
banco com o projeto `lunari_gallery` (visualização do cliente final).

## Capabilities

| ID                     | Tipo   | Descrição                                                       |
| ---------------------- | ------ | --------------------------------------------------------------- |
| `gallery.checkAccess`  | query  | Fonte única de autorização (admin, assinatura, allowed_emails). |

## Dependências server-side

- Função `public.user_has_gallery_access(_user_id uuid)` (SECURITY DEFINER).

## Princípios

- Nunca decidir acesso a partir de localStorage/plan local — sempre RPC.
- UI consome a capability via `useCapabilityQuery` para cache e revalidação.
