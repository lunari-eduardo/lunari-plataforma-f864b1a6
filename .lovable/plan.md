## Diagnóstico

Investiguei a base e o código. Há **dois problemas conectados**, ambos causados por itens financeiros que foram **arquivados** (`ativo = false`) em vez de excluídos numa correção anterior.

### Problema 1 — "Item Removido" nas despesas

No usuário afetado (`db0ca3d8…`), 12 itens-padrão estão com `ativo = false` (DAS, Adobe, Água, Aluguel, Canva, Internet, Pró-labore, Combustível, Cursos e treinamentos, Fornecedor 1, Marketing, Acervo/Cenário, Fornecedor 1).

As transações dessas categorias **continuam apontando corretamente** para esses itens (0 órfãs no banco), mas:

- `SupabaseFinancialItemsAdapter.getAllItems()` filtra `ativo = true`.
- `useNovoFinancas.ts` (linha 135) faz `itensFinanceiros.find(...)` para resolver o nome — como o item arquivado não está na lista, cai no fallback **"Item Removido" / "Despesa Variável"** (linha 141‑147). Isso também explica por que despesas fixas (Canva, DAS, etc.) aparecem agrupadas como variáveis.

### Problema 2 — Erro 409 ao recriar categoria existente

O índice único `fin_items_master_user_nome_grupo_uniq (user_id, lower(nome), grupo_principal)` cobre **registros ativos e arquivados**.

`SupabaseFinancialItemsAdapter.createItem()` faz `INSERT` puro, sem tratar o caso de já existir um item arquivado com o mesmo nome/grupo. Resultado: PostgREST devolve **409 Conflict** e a UI mostra "Erro ao adicionar item financeiro".

---

## Plano de correção

### 1. Migração de dados — reativar itens arquivados em uso

Para todo item arquivado que ainda tenha transações ou modelos recorrentes vinculados, **reativar** (`ativo = true`). Isso recupera as despesas fixas/variáveis sem mexer em transações, valores ou status.

```sql
UPDATE public.fin_items_master im
SET ativo = true, updated_at = now()
WHERE ativo = false
  AND (
    EXISTS (SELECT 1 FROM public.fin_transactions t WHERE t.item_id = im.id)
    OR EXISTS (SELECT 1 FROM public.fin_recurring_blueprints r WHERE r.item_id = im.id)
  );
```

Itens arquivados **sem uso** continuam arquivados (não atrapalham nada e preservam histórico de intenção do usuário).

### 2. Corrigir `createItem` — reativar em vez de duplicar

Em `src/adapters/SupabaseFinancialItemsAdapter.ts`, no método `createItem`:

1. Procurar item existente do usuário com `lower(nome) = lower(novo_nome)` e mesmo `grupo_principal`.
2. Se existir e estiver **ativo** → erro amigável "Já existe um item com este nome neste grupo" (sem 409 cru).
3. Se existir e estiver **arquivado** → `UPDATE ativo = true` (reativação) e devolver o registro.
4. Caso contrário → `INSERT` normal.

Isso elimina o 409 e respeita o índice único.

### 3. Mensagem de erro mais clara no front

Em `src/hooks/useNovoFinancas.ts` (`adicionarItemFinanceiro`), tratar o erro de duplicidade já mapeado pelo adapter e exibir mensagem específica em vez do genérico "Erro ao adicionar item financeiro".

### 4. (Defensivo) Resolver nome de transações apontando para itens arquivados

Atualmente o fallback "Item Removido" em `useNovoFinancas.ts` aciona sempre que o item não está na lista de ativos. Após a etapa 1 isso some no usuário afetado, mas para evitar regressão futura:

- `getAllItems()` continua devolvendo só ativos (usado para o seletor de novos lançamentos).
- Adicionar um carregamento auxiliar **`getAllItemsIncludingArchived()`** usado **somente para resolver nomes/grupos** das transações já existentes.
- O `find(...)` na linha 135 passa a usar o mapa completo; só cai em "Item Removido" se a transação realmente apontar para um `item_id` inexistente (não é o caso hoje).

### Escopo

- ✅ Migração de reativação de itens em uso (etapa 1).
- ✅ Ajuste no adapter `createItem` (etapa 2).
- ✅ Toast/erro amigável (etapa 3).
- ✅ Fallback robusto para itens arquivados (etapa 4).
- ❌ Não mexer em transações, valores, status, gateways de pagamento ou outras telas.
- ❌ Não alterar índices/constraints do banco.

### Validação após implementação

1. Conferir tela de Lançamentos do usuário: despesas fixas voltam a mostrar Canva/DAS/Água/Internet etc. corretamente classificadas.
2. Em Configurações, tentar adicionar "DAS" como Despesa Fixa novamente:
   - Se já existir ativo → mensagem clara.
   - Se existir arquivado → reativação silenciosa, item aparece na lista.
   - Se não existir → criação normal.
3. Conferir no banco: `SELECT count(*) FROM fin_items_master WHERE ativo=false` cai apenas para itens sem uso.
