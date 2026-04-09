

# Botão "Novo Cliente" e desativar autocomplete no modal de Venda Avulsa

## Problemas
1. O modal não oferece opção de cadastrar um novo cliente rapidamente — o usuário precisa sair do fluxo
2. O input de busca de cliente dispara sugestões de preenchimento automático do navegador (autocomplete)

## Solução

### 1. Botão "+" para novo cliente ao lado do combobox
- Adicionar um botão "+" (ícone `UserPlus`) ao lado direito do `ClientSearchCombobox` no modal
- Ao clicar, abrir um mini-formulário inline (ou sub-dialog) com campos: Nome, Telefone, Email
- Ao salvar, usar `adicionarCliente` do `useClientesRealtime` para cadastrar no Supabase
- Após cadastro, selecionar automaticamente o novo cliente no combobox

### 2. Desativar autocomplete do navegador
- Adicionar `autoComplete="off"` no `<Input>` do `ClientSearchCombobox` (e nos outros comboboxes para consistência)
- Isso impede sugestões de email/endereço do navegador ao focar o campo

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/financas/ModalVendaAvulsa.tsx` | Adicionar botão "+" ao lado do combobox; mini-dialog de novo cliente com `useClientesRealtime().adicionarCliente`; auto-selecionar após criar |
| `src/components/agenda/ClientSearchCombobox.tsx` | Adicionar `autoComplete="off"` no Input; aceitar prop `onAddNew` opcional para exibir botão "+" integrado |

## Detalhes da implementação

O `ClientSearchCombobox` receberá uma prop opcional `onAddNew?: () => void`. Quando presente, exibe um botão "+" com ícone `UserPlus` à direita do input (antes do ChevronDown). O modal controla o state do sub-dialog de cadastro.

O sub-dialog terá 3 campos (Nome*, Telefone, Email), botões Cancelar/Salvar, e ao salvar chama `adicionarCliente({ nome, telefone, email })`, retornando o ID para auto-seleção via `onSelect`.

