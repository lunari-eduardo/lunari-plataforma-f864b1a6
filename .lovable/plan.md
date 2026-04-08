

# Fix: Erro ao registrar venda avulsa

## Causa raiz

A coluna `status_financeiro` em `clientes_sessoes` é uma **coluna gerada** (GENERATED ALWAYS) — calculada automaticamente pelo banco com base em `valor_pago` e `valor_total`. O hook `useVendaAvulsa.ts` tenta inserir um valor explícito nessa coluna (linha 50), o que causa o erro 400 do Postgres: `cannot insert a non-DEFAULT value into column "status_financeiro"`.

## Correção

Remover `status_financeiro` do objeto de INSERT no `useVendaAvulsa.ts` (linha 50). O banco já calcula o valor correto automaticamente:
- Se `valor_pago >= valor_total` → `'pago'`
- Se `valor_pago > 0` → `'parcial'`
- Senão → `'pendente'`

Como o hook já define `valor_pago` corretamente (igual a `valorTotal` quando pagamento imediato, ou 0 quando não), o `status_financeiro` será preenchido automaticamente com o valor certo.

## Arquivo modificado

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useVendaAvulsa.ts` | Remover linha `status_financeiro` do INSERT |

## Impacto
- 1 linha removida
- Sem efeitos colaterais — o valor já era redundante com a coluna gerada

