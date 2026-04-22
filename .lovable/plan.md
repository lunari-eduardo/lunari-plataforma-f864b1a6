
# Plano: corrigir filtro de pagamento no Workflow e simplificar a UX

## Diagnóstico confirmado

Hoje o filtro falha por 3 motivos combinados:

1. **Cálculo de status financeiro está incorreto no frontend**
   - Em `src/pages/Workflow.tsx`, `getFinancialStatus()` usa `Number(session.valorPacote)`, `Number(session.valorTotalFotoExtra)`, `Number(session.valorTotalProduto)`, `Number(session.valorAdicional)` e `Number(session.desconto)`.
   - Esses campos em `SessionData` chegam formatados como string (`"R$ 230,00"`), então `Number("R$ 230,00")` vira `NaN`, e o total acaba sendo tratado como `0`.

2. **Com isso, sessões pagas viram “parciais” ou “pendentes”**
   - Regra atual:
     - `pago` só quando `total > 0 && pago >= total`
     - `parcial` quando `pago > 0`
     - `pendente` caso contrário
   - Como o `total` frequentemente vira `0` por erro de parse:
     - sessões totalmente pagas deixam de cair em `pago`
     - várias acabam indo para `parcial`
     - sessões com saldo real em aberto ficam mal classificadas

3. **O filtro “parcial” fragmenta desnecessariamente o que o usuário entende como “pendente”**
   - Pelo seu fluxo, o comportamento ideal é binário:
     - **Pagas** = saldo pendente `<= 0`
     - **Pendentes** = qualquer sessão com saldo pendente `> 0`
   - Ou seja, “parcial” não agrega valor operacional e hoje ainda esconde sessões que deveriam aparecer em “pendentes”.

Isso explica exatamente os prints:
- **Pagas** não encontra sessões que visualmente estão com pendente `R$ 0,00`
- **Parciais** mostra sessões que não deveriam existir nessa categoria
- **Pendentes** traz menos itens do que o esperado, porque parte deles foi desviada para “parcial”

---

## Comportamento ideal

### Regra funcional
O filtro deve usar a **fonte de verdade do banco**, não strings formatadas da UI:

- **Pago**: sessão com `status_financeiro = 'pago'` ou `valor_total - valor_pago <= 0`
- **Pendente**: qualquer outro caso com saldo em aberto (`status_financeiro != 'pago'`)

### Regra de produto/UX
O dropdown deve ficar simples:

- **Todas**
- **Pagas**
- **Pendentes**

Remover completamente:
- **Parciais**
- **Ordenar: Pago primeiro / Pendente primeiro**
- toda lógica de `sortField = 'situacao'`

---

## Correção técnica proposta

### 1. Parar de calcular o filtro a partir de `SessionData` formatado
Em vez de usar `session.valorPacote`, `session.valorPago` etc. em formato `"R$..."`, o filtro deve se basear nos dados crus de `workflowSessions`:

- `valor_total`
- `valor_pago`
- `status_financeiro`

A solução mais robusta é:

- criar um helper único em `Workflow.tsx`, algo como:
  - `getPaymentFilterStatus(sessionRaw: WorkflowSession): 'pago' | 'pendente'`
- regra:
  - se `session.status_financeiro === 'pago'` → `pago`
  - senão → `pendente`

Fallback seguro:
- se `status_financeiro` vier ausente, usar `Number(session.valor_total) - Number(session.valor_pago)`.

### 2. Filtrar a lista usando os dados brutos, e só depois converter para UI
Fluxo ideal no `Workflow.tsx`:

1. começa com `workflowSessions` do mês atual
2. aplica filtro de categoria / busca / pagamento nos dados crus
3. depois converte o resultado com `convertSessionToData()`
4. só então renderiza a tabela/cards

Isso elimina divergência entre:
- o que o filtro decide
- o que a UI mostra no campo “Pendente”

### 3. Remover “parcial” do tipo e da interface
Atualizar:
- `src/components/workflow/WorkflowFilters.tsx`
- `src/pages/Workflow.tsx`

De:
- `'todos' | 'pago' | 'parcial' | 'pendente'`

Para:
- `'todos' | 'pago' | 'pendente'`

### 4. Remover ordenação por situação
Apagar:
- seção “Ordenar” do dropdown
- `onSortChange('situacao', ...)`
- branch `headerKey === 'situacao'` em `getSortValue()`
- qualquer destaque visual dependente de `sortField === 'situacao'`

### 5. Sanear estado persistido antigo
Como o filtro e a ordenação ficam persistidos em `localStorage`, precisa haver normalização ao carregar:

- se `situacaoFilter === 'parcial'`, converter para `'pendente'`
- se `sortField === 'situacao'`, limpar para `''`

Sem isso, o usuário pode continuar preso em um estado invisível herdado da versão antiga.

---

## Melhoria de usabilidade

### Dropdown simplificado
Em `WorkflowFilters.tsx`:

- manter botão `Situação`
- ao abrir, mostrar só:
  - Todas
  - Pagas
  - Pendentes

### Rótulo ativo claro
Exemplos:
- `Situação: Pagas`
- `Situação: Pendentes`

### Empty state coerente
Em `Workflow.tsx`, ajustar mensagem para a nova semântica:
- `Nenhuma sessão paga em Abril 2026`
- `Nenhuma sessão pendente em Abril 2026`

Sem mencionar “parcial”.

### Opcional de UX forte
Se couber sem poluir:
- mostrar contagem no menu:
  - `Pagas (18)`
  - `Pendentes (24)`
Isso aumenta confiança no filtro e facilita conferência visual.

---

## Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `src/pages/Workflow.tsx` | Refatorar filtro para usar `workflowSessions`/`status_financeiro`; remover suporte a `parcial`; remover ordenação por situação; sanear estado persistido antigo; ajustar empty state |
| `src/components/workflow/WorkflowFilters.tsx` | Simplificar dropdown para `Todas / Pagas / Pendentes`; remover seção de ordenação; remover `parcial` do tipo e labels |
| `src/types/workflow.ts` | Só se necessário para alinhar tipos auxiliares de filtro; `SessionData` não precisa carregar regra financeira para o filtro se ele passar a usar o dado cru |

---

## Resultado esperado

Depois da correção:

- sessões com **pendente `R$ 0,00`** aparecem corretamente em **Pagas**
- sessões com **qualquer saldo em aberto** aparecem em **Pendentes**
- não existe mais categoria confusa de **Parciais**
- o dropdown fica mais simples e previsível
- não existe mais ordenação “Pago primeiro / Pendente primeiro”
- abril/2026 deve bater visualmente com a coluna “Pendente” da própria lista
