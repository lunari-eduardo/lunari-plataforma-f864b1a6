

# Modais Brancos no Light Mode

## Problema
Todos os modais usam `bg-gray-50/90` no light mode, resultando em fundo cinza. O usuário quer branco puro.

## Mudança
Trocar `bg-gray-50/90` por `bg-white` em 3 arquivos:

| Arquivo | Mudança |
|---------|---------|
| `src/components/ui/dialog.tsx` | `bg-gray-50/90` → `bg-white` |
| `src/components/ui/alert-dialog.tsx` | `bg-gray-50/90` → `bg-white` |
| `src/components/ui/popover.tsx` | `bg-gray-50/90` → `bg-white` |

Dark mode permanece `dark:bg-neutral-950/85`.

