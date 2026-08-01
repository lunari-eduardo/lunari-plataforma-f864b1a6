# Métricas comerciais x financeiras + buraco de fotos extras em Janeiro

Dois problemas independentes, investigados no código e no banco.

---

## Parte 1 — Ticket Médio misturando caixa com comercial

### Diagnóstico

Em `src/domain/sales/SalesRepository.ts`, **todas** as métricas de vendas usam `session.amountPaid` (`valor_pago`, caixa):

- `totalRevenue` = soma de `amountPaid`
- `averageTicket` = `totalRevenue / totalSessions` → receita recebida ÷ sessões agendadas
- `calculateMonthlyData`, `calculateCategoryData`, `calculatePackageData`, `calculateOriginData` → todos somam `amountPaid`

O único indicador comercial existente é `expectedRevenue` (soma de `valor_total`, que já inclui extras e desconto), usado apenas em um card.

Resultado: no dia 1 do mês, 40 sessões fechadas com R$ 700 recebidos produzem ticket médio de R$ 17,50 — número sem significado comercial.

### Correção

Separar as duas famílias de métricas na camada de domínio:

**Comercial (valor contratado — `session.total`, que já soma pacote + extras + adicional − desconto)**
- `contractedRevenue` (novo) = soma de `total`
- `averageTicket` = `contractedRevenue / totalSessions`
- Quebras por categoria / pacote / origem passam a usar valor contratado
- Série mensal ganha `contractedRevenue` e `averageTicket` recalculado sobre ela

**Financeiro (caixa — `amountPaid`)**
- `totalRevenue` (recebido) permanece como está
- `pendingRevenue` = contratado − recebido
- Progresso de meta continua sobre o recebido

### Arquivos

| Arquivo | Mudança |
|---|---|
| `src/domain/sales/sales-domain.ts` | novos campos `contractedRevenue`, `averageTicketReceived`; `SalesMonthlyData.contractedRevenue`; `SalesCategoryData/PackageData/OriginData` ganham `contractedRevenue` |
| `src/domain/sales/SalesRepository.ts` | `calculateMetrics` calcula ticket sobre contratado; `calculateMonthlyData` e as três quebras somam `total` além de `amountPaid` |
| `src/domain/sales/comparisonUtils.ts` | comparativo YoY passa a comparar também o contratado |
| `src/components/analise-vendas/SalesMetricsCards.tsx` | rótulos explícitos: "Receita recebida" (caixa) x "Valor contratado" (comercial); Ticket Médio marcado como comercial, com o ticket de caixa em subtítulo |
| `src/components/analise-vendas/SalesChartsGrid.tsx` | gráficos de categoria/pacote/origem passam a plotar valor contratado |
| `src/hooks/useSalesAnalyticsRefactored.ts` | repassa os novos campos |

O módulo Financeiro (`src/modules/finance/**`) **não é tocado** — continua 100% em regime de caixa.

---

## Parte 2 — Janeiro/2026 sem fotos extras

### Diagnóstico (dados reais consultados)

Extras por mês em `clientes_sessoes`:

```text
2025-11  266 fotos   R$ 6.379
2025-12  256 fotos   R$ 6.293
2026-01    0 fotos   R$     0   <-- buraco
2026-02   56 fotos   R$ 1.322
2026-03  140 fotos   R$ 3.206
```

Causas encontradas:

1. **A galeria só começou a operar em fevereiro/2026.** A tabela `galerias` não tem nenhum registro anterior a `2026-02`. É a galeria que grava `total_fotos_extras_vendidas` e alimenta `qtd_fotos_extra` na sessão.
2. **Nov/Dez de 2025 são dados históricos importados**, com extras preenchidos manualmente na importação — por isso "existem".
3. **Janeiro foi operado no app antes da galeria**: as vendas de extras entraram como "Pagamento rápido" solto. As sessões de janeiro têm `valor_pago > valor_total` (ex.: pago 155 / total 130; pago 855 / total 330; pago 525 / total 410), mas `qtd_fotos_extra = 0` e `valor_total_foto_extra = 0`.
4. Não há em janeiro nenhuma cobrança com `finalidade = 'fotos_extras'` nem transação descrita como extra — o vínculo simplesmente não foi criado.

Ou seja: **não é bug de exibição nem de filtro de data.** É ausência de dado de origem — o extra existe em dinheiro, mas nunca foi registrado como extra.

### Correção proposta

**A. Backfill de janeiro (script SQL de migração, reversível)**

Para cada sessão com `data_sessao` em jan/2026 onde `valor_pago > valor_total` e `valor_foto_extra > 0`:

```text
excedente = valor_pago - valor_total
qtd       = round(excedente / valor_foto_extra)
```

- Grava `qtd_fotos_extra`, `valor_total_foto_extra = excedente` e marca `detalhes.extras_backfill = true` (auditável / desfazível).
- Só aplica quando o excedente é múltiplo do valor unitário com tolerância de R$ 1,00; os casos ambíguos entram num relatório para revisão manual, sem chute.
- Recalcula `valor_total` das sessões afetadas via os triggers já existentes.

Prévia dos casos ambíguos é entregue antes de qualquer escrita.

**B. Fechar o buraco para o futuro (evitar novo janeiro)**

- No registro de pagamento manual/rápido do Workflow, quando o valor recebido ultrapassar o pendente da sessão, o excedente já é tratado como crédito/extra — passa a **exigir escopo** (`sessão` / `fotos extras`) em vez de gravar só o pagamento. O modal `ManualPaymentModal` já tem o conceito de escopo; o input rápido do card não.
- Quando o escopo for "fotos extras", incrementa `qtd_fotos_extra` e `valor_total_foto_extra` na sessão, mantendo a métrica coerente independentemente da galeria.

**C. Sinalização na UI**

Meses sem nenhum registro de extras mostram "sem registro no período" nos cards/gráficos de produção, em vez de `R$ 0,00` — evita ler ausência de dado como resultado zero.

### Arquivos

| Arquivo | Mudança |
|---|---|
| migração SQL | backfill de jan/2026 + coluna de auditoria em `detalhes` |
| `src/components/workflow/...` (input rápido de pagamento) | escopo obrigatório quando há excedente |
| `src/hooks/useSessionPayments.ts` | grava extras quando escopo = fotos extras |
| `src/components/analise-vendas/ProductionMetricsCards.tsx` | estado "sem registro" |

---

## Ordem de execução

1. Parte 1 (comercial x caixa) — só frontend/domínio, sem risco de dados.
2. Parte 2B + 2C — impede novo buraco.
3. Parte 2A — backfill, com prévia dos números antes de aplicar.
