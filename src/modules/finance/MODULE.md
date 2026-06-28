# Módulo: finance

Esqueleto criado na Onda 0. Implementação real começa na Onda 1.

## 6 critérios (PRODUCT_GUIDE.md)

1. **Em qual etapa do fluxo Lead→Pós-venda este módulo atua?**
   Pós-venda + bastidores: registra todo dinheiro que entra (receitas operacionais e não-operacionais) e sai (despesas fixas, variáveis, investimento) do estúdio, além de metas mensais e visão consolidada (extrato + dashboard).

2. **Quem é o ator principal?**
   Fotógrafo/dono do estúdio. A Lu opera por delegação para registrar lançamentos, criar subcategorias, definir metas e ler dashboard/extrato.

3. **Quais entidades este módulo possui de verdade?**
   `fin_transactions`, `financial_items` (subcategorias), `metas_personalizadas`. **Lê** de `extrato_unificado` (view) e `fin_credit_cards`. **Não possui** `cobrancas`, `cobranca_parcelas`, `clientes_transacoes` — esses são de Billing/CRM.

4. **De quais módulos depende?**
   `shared/capability`, `shared/event-bus`, `integrations/supabase`. Lê eventos `billing.charge.paid` (futuro) para atualizar visão.

5. **Quais eventos publica?**
   `finance.transaction.created/updated/deleted/paid/reopened`, `finance.item.created`, `finance.goal.upserted`.

6. **Qual é o contrato com a IA (Lu)?**
   12 capabilities prefixo `finance.` (5 lançamentos + 2 itens + 3 metas + 2 extrato + 1 dashboard). Snapshot `buildFinancePageSnapshot(v1)` com items, kpis, goalsProgress, extratoSummary, formasPagamento, visibleTransactionIds. `REQUIRES_APPROVAL`: `finance.transaction.delete`.

## Status
- Onda 0 (esqueleto + hotfix Realtime `useCobranca`) ✅
- Ondas 1-7 — ver `.lovable/plan-finance.md`.
