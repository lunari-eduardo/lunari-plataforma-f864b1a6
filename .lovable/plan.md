# Fluxo Financeiro — alinhamento, origem/escopo do pagamento e demonstrativo por período

## 1. Alinhar todas as colunas à esquerda

A timeline hoje usa uma grade `grid-cols-[auto_auto_1.4fr_1fr_auto_auto_auto_auto]` sem larguras estáveis, então categoria, meio de pagamento, status e data "flutuam" entre linhas (é o desalinhamento marcado em vermelho nos prints).

Mudanças em `FluxoTimelineRow.tsx` + `FluxoTimeline.tsx`:
- Grade fixa e idêntica em todas as linhas e no cabeçalho:
  `[28px_32px_minmax(0,1.6fr)_minmax(0,1fr)_120px_110px_100px_130px_16px]`
  (seleção, ícone, cliente/descrição, categoria, origem+forma, status, data, valor, chevron).
- Todas as células com `text-left` e `justify-start`; apenas o valor mantém alinhamento à direita dentro de uma coluna de largura fixa (números tabulares continuam alinhados entre si).
- Adicionar uma linha de cabeçalho discreta por grupo de mês (Cliente · Categoria · Pagamento · Status · Data · Valor), usando a mesma grade — resolve a leitura das colunas sem poluir.

## 2. Mostrar origem do pagamento e se é sessão ou extra

Hoje a linha mostra só `meioPagamento` (MANUAL / INFINITEPAY). Falta dizer **de onde veio** e **a que se refere**.

Origem do dado (verificado no banco): a view `extrato_unificado` já traz `origem` (workflow/gallery/financeiro/cartao) e `meio_pagamento`, mas não traz o escopo. O escopo existe em `cobrancas.finalidade`, com os valores reais `sessao`, `fotos_extras`, `sessao_e_extras`, `avulso`.

- Migração: recriar `extrato_unificado` adicionando a coluna `escopo`:
  - `cob.finalidade` quando houver cobrança vinculada;
  - senão, heurística já usada na view (descrição com "foto extra"/"[extras]" ou galeria vinculada) → `fotos_extras`;
  - senão `sessao` para pagamentos de workflow; `NULL` para lançamentos financeiros.
  - Manter todos os `GRANT SELECT` existentes.
- `src/types/extrato.ts`: novos campos `escopo?: 'sessao' | 'fotos_extras' | 'sessao_e_extras' | 'avulso'` em `LinhaExtrato`.
- Mapeamento em `useExtratoSupabase` / `extratoRepo` para popular o campo.
- Na linha: coluna "Pagamento" passa a exibir duas informações empilhadas — forma (`MANUAL`, `INFINITEPAY`, `Cartão`) e um selo discreto de escopo (`Sessão`, `Extras`, `Sessão + Extras`, `Avulso`), com a origem (Workflow/Gallery) já indicada pelo ícone e repetida no detalhe.
- `FluxoDetailSheet`: bloco "Pagamento" com origem, provedor, escopo e vínculo da cobrança.
- Filtro novo em `FluxoFiltersSheet`: Escopo (Todos / Sessão / Extras), aplicado server-side junto com os demais.

## 3. Demonstrativo preso em agosto e sem opção anual

Causa confirmada: `FluxoResumoExpandable` chama `useExtrato()` de novo, criando uma **segunda instância** do hook com seu próprio `periodoFiltro`, que sempre inicia no mês corrente (agosto). O seletor Julho da barra superior altera só a instância da `FluxoFinanceiroView`. Por isso o rodapé mostra "Período: 01/08/2026 a 31/08/2026" enquanto a lista mostra julho.

- `FluxoFinanceiroView` passa `demonstrativo` e `periodo` (e as transações) por props para `FluxoResumoExpandable`; o hook duplicado é removido.
- Seletor de escopo temporal do demonstrativo dentro do bloco expandido: **Mês** (padrão, segue a barra) ou **Ano inteiro** do ano selecionado — no modo ano, o demonstrativo é calculado para `01/01–31/12` sem alterar a listagem da timeline.
- O PDF exportado herda o mesmo período (mês ou ano), corrigindo o cabeçalho do documento.

## 4. Melhorias de usabilidade do fluxo financeiro

Priorizadas por impacto e baixo risco:
- **Cabeçalho de mês com subtotais**: cada grupo mostra entradas/saídas/saldo do mês à direita do título.
- **Contador de resultados** ("128 lançamentos") ao lado da busca, e chips de filtro ativo removíveis com um clique.
- **Selecionar todos** do grupo/mês pelo cabeçalho, mantendo a seleção apenas informativa como hoje.
- **Busca com debounce** (250 ms) para não recalcular a lista a cada tecla.
- **Persistência de preferências** (chip ativo, regime, filtros) por usuário entre sessões.
- **Exportar CSV** da visão filtrada, além do PDF do demonstrativo.
- **Atalho de atraso**: chip "Atrasados" derivado do status Faturado com data vencida (a linha já calcula esse estado).

## Detalhes técnicos

Arquivos afetados:
- `src/modules/finance/presentation/fluxo/FluxoTimelineRow.tsx`, `FluxoTimeline.tsx`, `FluxoFinanceiroView.tsx`, `FluxoResumoExpandable.tsx`, `FluxoFiltersSheet.tsx`, `FluxoDetailSheet.tsx`
- `src/types/extrato.ts`, `src/hooks/useExtratoSupabase.ts`, `src/hooks/useExtrato.ts`, `src/modules/finance/infrastructure/supabase/extratoRepo.ts`, `src/modules/finance/ports/extratoRepo.ts`
- Nova migração recriando a view `extrato_unificado` com `escopo` (view somente leitura; grants preservados)

Sem mudança em regras de cálculo financeiro: totais, estornos e triggers permanecem como estão.
