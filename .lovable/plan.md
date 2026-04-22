

# Plano: Filtro "Situação" funcional (filtro + ordenação)

## Diagnóstico

### O que existe hoje
O dropdown **Situação** no Workflow só tem **2 opções de ordenação**: "Pago primeiro" e "Pendente primeiro". Não há **filtro** real — todas as sessões continuam aparecendo, apenas a ordem muda. Como em vários meses todas as sessões já estão "Pagas" (R$ 0,00 pendente), o usuário não vê diferença visual ao trocar entre as opções e percebe como "filtro que não funciona".

### Comportamento ideal (e padrão em apps modernos)
"Situação" deveria ser **filtro** (tipo "Categoria") com opção opcional de ordenação. O usuário quer rapidamente:
- Ver **só sessões pendentes** ou **só pagas** ou **só parciais**.
- Eventualmente ordenar por situação.

### Bugs colaterais identificados
1. **Ordenação parcial confusa**: hoje a classificação interna é `pago=1, parcial=2, pendente=3`. "Pago primeiro" mostra: pagos → parciais → pendentes (OK). "Pendente primeiro" mostra: pendentes → parciais → pagos (OK). Não há bug aqui após releitura.
2. **Indicador visual ausente**: o botão "Situação" não mostra qual filtro está ativo (ex: "Situação: Pendentes" como faz "Categoria: Família").

## Mudanças

### 1. Transformar "Situação" em filtro + ordenação combinados

`WorkflowFilters.tsx`:
- Adicionar props: `situacaoFilter: 'todos' | 'pago' | 'parcial' | 'pendente'` e `onSituacaoFilterChange`.
- Reestruturar dropdown "Situação" em 2 grupos:
  - **Filtrar** (separador "Mostrar"):
    - Todas (default)
    - Pagas
    - Parciais
    - Pendentes
  - **Ordenar por situação** (separador "Ordenar"):
    - Pago primeiro
    - Pendente primeiro
- Botão exibe `Situação: Pendentes` quando filtro ativo (visual claro). Cor/destaque ativa quando há filtro **ou** ordenação por situação ativa.

### 2. Aplicar o filtro real

`Workflow.tsx`:
- Adicionar state `situacaoFilter` (default `'todos'`).
- Calcular helper `getFinancialStatus(session)` reutilizando a lógica já existente no `getSortValue` (extrai para função pura para reuso).
- Adicionar etapa de filtro em `filteredSessions` (ou criar `filteredSessionsBySituacao`):
  ```ts
  const filteredBySituacao = situacaoFilter === 'todos'
    ? filteredSessions
    : filteredSessions.filter(s => getFinancialStatus(s) === situacaoFilter);
  ```
- Sort continua igual sobre o resultado.
- Passar `situacaoFilter` ao `<WorkflowFilters />` e expor no botão "Limpar".

### 3. Persistência (opcional, segue padrão de outros filtros)
Não persistir entre páginas/sessions (filtros do mês são voláteis no Workflow atual). Reset ao trocar de mês: **manter estável** (consistente com como `categoryFilter` se comporta hoje).

## Anti-bugs

1. **Função única `getFinancialStatus`**: extrair a regra `pago / parcial / pendente` em um helper compartilhado entre filtro e ordenação para evitar divergência (mesma regra do `getSortValue` linha 580-588).
2. **Empty state coerente**: se filtro de situação resultar em 0 sessões mostrar mensagem específica ("Nenhuma sessão {pendente/paga/parcial} em {mês}") ao invés do genérico atual.
3. **"Limpar"**: o botão de limpar já existe mas precisa também resetar `situacaoFilter` para `'todos'`. Atualizar `(sortField || categoryFilter || situacaoFilter !== 'todos')` na condicional.
4. **Chip ativo no botão**: usar mesma lógica visual do `categoryFilter` (cor primary quando ativo + label dinâmico).
5. **Compatibilidade com hidratação**: o helper sempre faz `parseFloat` no formato `"R$ X,YZ"` (formato vindo de `useWorkflowRealtime`). Já testado: regex `[^\d,]` + `,→.` produz número correto.

## Resultado esperado

- Botão "Situação" abre dropdown com 4 filtros (Todas/Pagas/Parciais/Pendentes) **e** 2 ordenações.
- Selecionar "Pendentes" filtra a tabela para mostrar **apenas** sessões com saldo > 0 e nenhum pagamento total.
- Botão mostra `Situação: Pendentes` em destaque primary.
- Limpar redefine tudo (situação + categoria + ordem).

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/workflow/WorkflowFilters.tsx` | Adicionar props de filtro situação; reestruturar dropdown com grupos "Mostrar" e "Ordenar"; label dinâmico no botão; incluir reset no "Limpar" |
| `src/pages/Workflow.tsx` | Novo state `situacaoFilter`; helper puro `getFinancialStatus`; aplicar filtro antes do sort; passar props ao `WorkflowFilters`; ajustar empty state |

