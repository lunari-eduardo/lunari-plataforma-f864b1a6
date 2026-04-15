

# Adicionar botão de excluir sessão no card do Workflow

## Contexto

O prop `onDeleteSession` já é passado até `WorkflowCardCollapsed`, mas nunca é renderizado como botão. A exclusão atual em `Workflow.tsx` faz um delete simples sem opções (preserve/refund/remove). A Agenda já tem o modal `AppointmentDeleteConfirmModal` com tri-state que deve ser replicado.

## Plano

### 1. Adicionar botão de excluir no `WorkflowCardCollapsed.tsx`

- Adicionar ícone `Trash2` como último elemento do grid (nova zona após Galerias)
- Botão aparece com opacidade reduzida, visível no hover do card (`group` + `group-hover:opacity-100`)
- Ao clicar, abre o modal de confirmação de exclusão
- Atualizar grid template para incluir a nova coluna: `grid-cols-[32px_46px_160px_160px_130px_120px_70px_70px_80px_auto_32px]`

### 2. Criar `WorkflowDeleteConfirmModal.tsx`

Reutilizar o mesmo padrão visual do `AppointmentDeleteConfirmModal` mas adaptado para o contexto do workflow:
- Se a sessão tem pagamentos → mostra as 3 opções (preservar como histórico, estornar e excluir, excluir tudo)
- Se não tem pagamentos → confirmação simples de exclusão
- Recebe `sessionData` com: id, nome do cliente, data, tem pagamentos (baseado em `session.pagamentos?.length > 0` ou `session.valorPago > 0`)

### 3. Atualizar `Workflow.tsx` — `handleDeleteSession`

Alterar para aceitar o `DeleteAction` e executar a lógica correspondente:
- **preserve**: Marcar `status = 'historico'` em vez de deletar (soft delete)
- **refund**: Criar transações de estorno via `clientes_transacoes` para cada pagamento, depois deletar a sessão
- **remove**: Delete completo (comportamento atual)

### 4. Atualizar `WorkflowCard.tsx`

Adicionar classe `group` no wrapper div para que o botão de delete responda ao hover do card.

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/components/workflow/WorkflowDeleteConfirmModal.tsx` | Novo — modal de confirmação com tri-state |
| `src/components/workflow/WorkflowCardCollapsed.tsx` | Botão Trash2 na última coluna do grid, estado do modal |
| `src/components/workflow/WorkflowCard.tsx` | Adicionar classe `group` no wrapper |
| `src/pages/Workflow.tsx` | Atualizar `handleDeleteSession` para suportar as 3 ações |

