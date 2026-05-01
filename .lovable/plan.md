## Diagnóstico (causa raiz)

A duplicação está confirmada no banco: **12 usuários afetados, 300 itens marcados como `is_default=true`** (deveriam ser 20 por usuário = 240). Cada item padrão aparece exatamente 2x (e em alguns casos 3x).

**Por que aconteceu:**
1. `SupabaseFinancialItemsAdapter.initializeDefaultItems()` é chamado dentro de `getAllItems()` e usa um check "se existe ao menos 1, não insere". Quando o app monta vários hooks de finanças em paralelo (Lançamentos + Dashboard + Configurações), **duas chamadas a `getAllItems()` rodam ao mesmo tempo**, ambas veem a tabela vazia e ambas fazem o `INSERT` dos 20 itens — gerando 40 linhas.
2. Não existe **constraint de unicidade** em `fin_items_master(user_id, nome, grupo_principal)`, então o banco aceita as duplicatas silenciosamente.
3. O campo `is_default` existe mas não é usado para bloquear exclusão definitiva — hoje o `deleteItem` só faz soft delete (`ativo=false`), o que impede o usuário de remover de vez.

**Verificação adicional:** das 60 linhas extras, apenas 8 têm transações vinculadas (`fin_transactions.item_id`). As 52 restantes podem ser removidas sem qualquer impacto financeiro.

## Plano de correção

### 1. Migration de banco (estrutural + limpeza)

**a) Limpar duplicatas existentes preservando integridade financeira:**
- Para cada grupo `(user_id, nome, grupo_principal)` com `is_default=true`, manter o registro **mais antigo** (menor `created_at`).
- Para os "extras" (rn ≥ 2):
  - Se houver transações vinculadas em `fin_transactions.item_id`, fazer **UPDATE** apontando essas transações para o item canônico (rn=1) — preserva todo o histórico financeiro.
  - Em seguida, **DELETE** dos extras.

**b) Constraint de unicidade** em `fin_items_master`:
```sql
CREATE UNIQUE INDEX fin_items_master_user_nome_grupo_uniq
  ON fin_items_master (user_id, lower(nome), grupo_principal);
```
Isso impede para sempre que o mesmo nome+grupo seja inserido duas vezes para o mesmo usuário (race condition fica naturalmente bloqueada — o segundo INSERT falha em vez de duplicar).

### 2. Adapter (`src/adapters/SupabaseFinancialItemsAdapter.ts`)

**a) Hard delete em vez de soft delete:** trocar `deleteItem()` para fazer `DELETE FROM fin_items_master WHERE id = ?`. Se o item tiver transações vinculadas, capturar o erro de FK e retornar mensagem clara ao usuário ("Item possui lançamentos. Arquive em vez de excluir."). Adicionar método separado `archiveItem()` que mantém o comportamento atual (`ativo=false`) para esses casos.

**b) Inicialização à prova de race condition:**
- Promover `initializeDefaultItems()` a singleton por sessão: usar uma `Promise` cacheada por `userId` para que chamadas paralelas aguardem a mesma execução.
- Tratar erro de unique constraint (código `23505`) como sucesso silencioso (idempotente).
- Usar `INSERT ... ON CONFLICT DO NOTHING` para garantir idempotência mesmo se o cache falhar.

### 3. UI (`src/components/financas/ConfiguracoesFinanceirasTab.tsx` e itens relacionados)

- Confirmar que cada item padrão tem botão de exclusão **funcional e definitivo** (mesmo com `is_default=true` — o usuário deve poder remover qualquer item que não usa).
- Diálogo de confirmação ao excluir item padrão: "Esta categoria padrão será removida permanentemente. Você poderá adicionar manualmente depois se quiser."
- Se houver lançamentos vinculados, oferecer duas opções no diálogo:
  - "Arquivar" (oculta da lista, preserva histórico)
  - "Cancelar"

### 4. Hook `useFinancialItemsManagement`

Atualizar `handleRemoverItem` para tratar a nova mensagem de erro (item com transações) e direcionar o usuário ao diálogo de arquivar.

## Arquivos a alterar

- **Nova migration SQL:** dedupe + unique index
- `src/adapters/SupabaseFinancialItemsAdapter.ts` — singleton de init, hard delete, archive separado
- `src/components/financas/ConfiguracoesFinanceirasTab.tsx` (e `FinancialItems*`) — diálogo de confirmação e fluxo de arquivar
- `src/hooks/useFinancialItemsManagement.ts` — tratamento de erro

## Resultado esperado

```text
Antes:                          Depois:
Despesas (31)                   Despesas (15)
  Adobe                           Adobe
  Água                            Água
  Água    ← duplicada             Aluguel
  Aluguel                         Assinatura
  Aluguel ← duplicada             Canva
  ...                             ...
```

- Lista limpa, sem duplicatas, em todos os usuários afetados.
- Banco impede novas duplicações via constraint.
- Usuário pode excluir definitivamente qualquer item (padrão ou não).
- Histórico financeiro 100% preservado (transações religadas ao item canônico antes de remover duplicatas).
