

# Refatorar Modal de Venda Avulsa

## Mudanças

### 1. Cliente: trocar Select por `ClientSearchCombobox`
Substituir o dropdown Select atual pelo componente `ClientSearchCombobox` (já existente em `src/components/agenda/ClientSearchCombobox.tsx`), que permite digitar e pesquisar por nome, email ou telefone.

### 2. Pacote e Produtos: duas colunas com combobox
- Remover campo "Categoria" (pacote já possui categoria vinculada)
- Substituir input texto de "Pacote" pelo `PackageSearchCombobox` (já existente em `src/components/agenda/PackageSearchCombobox.tsx`), que busca pacotes cadastrados e retorna `valor_base`
- Adicionar coluna "Produtos" com `SimpleProductSelector` (já existente em `src/components/precificacao/SimpleProductSelector.tsx`), permitindo adicionar múltiplos produtos com valor de venda
- Layout em `grid-cols-2`: Pacote à esquerda, Produtos à direita
- Ao selecionar pacote ou produtos, o valor total é preenchido automaticamente (soma do valor_base do pacote + valorVenda dos produtos), mas permanece editável
- Produtos selecionados aparecem como chips removíveis abaixo do seletor

### 3. Valor Total: auto-cálculo
- `valorTotal = (pacote?.valor_base || 0) + soma(produtos.valorVenda * quantidade)`
- Usuário pode editar manualmente após auto-preenchimento
- Categoria é derivada do pacote selecionado (para salvar em `clientes_sessoes.categoria`)

### 4. Hook `useVendaAvulsa`: ajustar input
- Remover campo `categoria` obrigatório do input — derivar do pacote ou usar "Venda Avulsa" como fallback
- Adicionar campo `produtos` opcional ao input para registro

### 5. Validação
- Obrigatório: Cliente + (Pacote OU Produto OU valor manual > 0)
- Categoria não é mais exibida — vem do pacote ou fallback "Venda Avulsa"

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/financas/ModalVendaAvulsa.tsx` | Refatorar com ClientSearchCombobox, PackageSearchCombobox, SimpleProductSelector em 2 colunas; remover Categoria |
| `src/hooks/useVendaAvulsa.ts` | Tornar `categoria` opcional com fallback; adicionar campo `produtos` |

