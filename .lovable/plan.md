

# Fix: Erro 409 ao excluir sessão do Workflow

## Causa raiz

Existem **duas foreign keys duplicadas** na coluna `session_id` da tabela `clientes_transacoes` apontando para `clientes_sessoes(session_id)`:

| FK | Regra |
|----|-------|
| `clientes_transacoes_session_id_fkey` | **RESTRICT** (padrão) — **bloqueia DELETE** |
| `fk_transacoes_session_id` | `ON DELETE SET NULL` (correto) |

A FK com RESTRICT impede qualquer exclusão de sessão que tenha transações vinculadas, gerando o erro **409 Conflict**.

## Correção

### Migration SQL (única alteração necessária)

Remover a foreign key duplicada restritiva:

```sql
ALTER TABLE public.clientes_transacoes
  DROP CONSTRAINT clientes_transacoes_session_id_fkey;
```

A FK `fk_transacoes_session_id` já faz `ON DELETE SET NULL`, que é o comportamento correto — ao excluir uma sessão, as transações ficam órfãs (preservando o histórico financeiro).

### Código (`Workflow.tsx`)

O `handleDeleteSession` nos casos `refund` e `remove` faz `.delete()` direto sem primeiro desvincular transações. Com a FK corrigida isso funcionará automaticamente via `SET NULL`. Porém, para robustez, adicionar tratamento para desvincular transações **antes** do delete nos casos `refund` e `remove`:

```typescript
// Antes do delete, set session_id = null nas transações
await supabase
  .from('clientes_transacoes')
  .update({ session_id: null })
  .eq('session_id', sessionTextId);
```

Isso garante compatibilidade mesmo que a FK mude no futuro.

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | `DROP CONSTRAINT clientes_transacoes_session_id_fkey` |
| `src/pages/Workflow.tsx` | Desvincular transações antes do delete (defensivo) |

