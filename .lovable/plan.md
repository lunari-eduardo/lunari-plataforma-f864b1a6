

# Paginação na página CRM (Clientes)

## O que será feito

Adicionar paginação de 20 clientes por página na página CRM, com navegador inferior funcionando tanto na visualização de cards quanto na de lista (tabela).

## Mudanças

### `src/pages/Clientes.tsx`

1. Adicionar estado `currentPage` (reseta ao mudar filtros/ordenação)
2. Criar `clientesPaginados` derivado de `clientesOrdenados` com slice de 20 por página
3. Usar `clientesPaginados` no lugar de `clientesOrdenados` nos dois renders (cards e list)
4. Adicionar componente de paginação após ambas as visualizações (antes do empty state), com:
   - Botões Anterior/Próximo
   - Números de página
   - Indicador "Mostrando X-Y de Z clientes"
5. Resetar `currentPage = 1` quando `clientesFiltrados` mudar (filtro, busca, ordenação)

### Componente de paginação

Usar os componentes `Pagination` já existentes em `src/components/ui/pagination.tsx`. Renderizar apenas quando `clientesFiltrados.length > 20`.

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Clientes.tsx` | Estado de paginação, slice dos dados, componente de navegação inferior |

