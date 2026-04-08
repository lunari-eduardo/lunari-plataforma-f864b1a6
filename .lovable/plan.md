

# Unificar dropdown de Produtos com o estilo do PackageSearchCombobox

## Problema
O seletor de Produtos usa `Popover + Command` (botão trigger), enquanto o de Pacotes usa um `Input` com dropdown manual que permite digitar e pesquisar diretamente. A experiência visual e funcional é inconsistente.

## Solução
Criar um novo componente `ProductSearchCombobox` seguindo exatamente o mesmo padrão do `PackageSearchCombobox`:
- Input de texto com busca em tempo real (digitável)
- Dropdown absoluto com lista filtrada
- Ícone ChevronDown à direita
- Busca normalizada (sem acentos)
- Ao selecionar, exibe nome + valor no input
- Botão X para limpar seleção

## Arquivo: `src/components/agenda/ProductSearchCombobox.tsx` (novo)
- Cópia estrutural do `PackageSearchCombobox`, adaptado para buscar da tabela `produtos`
- Carrega produtos via Supabase (`produtos` table, filtrado por `user_id`)
- Exibe `nome` + `R$ valor_venda` em cada item
- `onSelect(product)` retorna `{ id, nome, custo, valorVenda }` ou `null`
- Busca accent-insensitive via `normalizeText`

## Arquivo: `src/components/financas/ModalVendaAvulsa.tsx`
- Substituir `SimpleProductSelector` por `ProductSearchCombobox`
- Adaptar `handleProdutoSelect` para receber o novo formato de callback
- Manter lógica de chips e multi-seleção igual

## Arquivos

| Arquivo | Ação |
|---------|---------|
| `src/components/agenda/ProductSearchCombobox.tsx` | Novo — mesmo padrão visual do PackageSearchCombobox |
| `src/components/financas/ModalVendaAvulsa.tsx` | Trocar SimpleProductSelector pelo novo componente |

