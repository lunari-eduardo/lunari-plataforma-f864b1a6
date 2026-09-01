# Arquitetura Financeira Lunari — Asaas, recebíveis e antecipação

Documento de diagnóstico + correção. Baseado em leitura do código real e em consultas ao banco de produção (dados reais citados abaixo).

---

## 1. Diagnóstico atual

### 1.1 Entidades que existem hoje

| Tabela | Papel real hoje |
|---|---|
| `clientes_sessoes` | Venda (fonte comercial do Workflow). `valor_total` recalculado por trigger; `valor_pago` recomputado por trigger a partir de `clientes_transacoes` |
| `cobrancas` | Cobrança/checkout. Já possui `valor_principal`, `valor_cobrado_cliente`, `taxa_processamento_real`, `taxa_antecipacao_real`, `valor_liquido_creditado`, `data_credito`, `data_credito_real`, `fee_policy_snapshot`, `source_event_id` |
| `cobranca_parcelas` | Parcela. Possui os mesmos campos "reais" + `taxa_gateway`, `taxa_antecipacao`, `antecipado`, `data_vencimento`, `data_pagamento`, `data_credito` |
| `clientes_transacoes` | Pagamento (alimenta `valor_pago` da sessão via trigger `recompute_paid_amount`) |
| `gateway_cash_movements` | Caixa do gateway: `movement_type` (`credit`/`fee`), `amount`, `movement_date`, `anticipation_id` |
| `gateway_anticipations` | Antecipação: `provider_anticipation_id`, `fee`, `net_value`, `status`, `request_date`, `credit_date` — **0 linhas** |
| `gateway_events` | Idempotência (`provider`, `provider_event_id`) — 16 linhas |
| `webhook_logs` | Auditoria bruta — 501 linhas Asaas |

**A modelagem já está quase toda criada. O problema não é falta de tabela: é que o webhook não preenche os campos certos e o extrato lê o campo errado.**

### 1.2 Fluxo atual (real)

```
checkout (gross-up local em src/lib/anticipationUtils.ts)
   -> cobrancas.valor = valor cobrado do cliente (inflado)
   -> Asaas payment
   -> webhook PAYMENT_CONFIRMED / PAYMENT_RECEIVED
        -> cobranca_parcelas (valor_bruto = cobranca.valor/parcelas; valor_liquido = payment.netValue)
        -> cobrancas.status/valor_liquido (netValue x nº parcelas — extrapolação)
        -> gateway_cash_movements: credit = payment.value ; fee = -(value - netValue)
   -> extrato_unificado (6 branches em UNION ALL)
```

---

## 2. Bugs confirmados (com evidência de produção)

**B1 — `gateway_cash_movements.credit` usa `payment.value` (valor inflado).**
`asaas-webhook/index.ts:610-620`: `amount: txTotal` onde `txTotal = payment.value`. Contradiz a regra do próprio arquivo (`index.ts:331`: *"valor_bruto ... NUNCA payment.value"*).
Evidência: cobrança `e42adfc3`, `valor_principal = 100`; movimento `payment_pay_9hezbtoqoteu63qo_credit` com `amount = 53.42` e `fee = -2.10`. No extrato, `53.42` entra classificado como **"Receita de Serviços"** (branch de `gateway_cash_movements`, linhas 149/153 da view).

**B2 — `valor_liquido` maior que a venda.** Mesma cobrança: `valor = 100`, `valor_liquido = 102.64`. Duas origens somadas: (a) `index.ts:573-577` faz `netValue × total_parcelas` (extrapolação de uma parcela para todas); (b) o trigger `reconcile_cobranca_from_parcelas()` (AFTER INSERT/UPDATE em `cobranca_parcelas`) **também** grava `cobrancas.valor_liquido` e `status`, como somatório das parcelas. São **dois escritores concorrentes** para a mesma coluna, sem coordenação. Cada parcela tem `valor_bruto = 50` e `valor_liquido = 51.32` — líquido > bruto, matematicamente impossível.

**B3 — Colunas "reais" existem mas nunca são escritas.** Em 100% das linhas de `cobrancas` e `cobranca_parcelas`: `taxa_processamento_real = 0`, `taxa_antecipacao_real = 0`, `valor_liquido_creditado = 0`, `valor_cobrado_cliente = NULL`. O webhook não referencia nenhuma delas. Os R$ 53,42 efetivamente cobrados **não estão gravados em lugar nenhum** — só sobrevivem como `amount` de um movimento de caixa.

**B4 — Taxa de antecipação calculada por diferença.** `index.ts:493-502`:
```ts
taxaAntecipacao = Math.max(0, round((existingParcela.valor_liquido - valorLiquido) * 100) / 100);
```
Se `PAYMENT_ANTICIPATED` chegar antes de CONFIRMED/RECEIVED, `existingParcela` é nulo e a taxa vira `0` silenciosamente, sem backfill posterior.

**B5 — Eventos `RECEIVABLE_ANTICIPATION_*` nunca chegaram.** O handler existe (`index.ts:698-790`) e lê corretamente `anticipation.id/fee/netValue`, mas `asaas_webhook_events` só registra `PAYMENT_CONFIRMED` (105) e `PAYMENT_RECEIVED` (9), e `gateway_anticipations` tem **0 linhas**. Ou os eventos não estão assinados no painel Asaas, ou nunca houve antecipação. Precisa ser verificado contra a conta.

**B6 — Datas misturadas.** `movement_date` = `payment.creditDate` (`index.ts:617`). Parcela `pay_w13bwj2bb2xbr1fc`: `data_vencimento = 2026-10-01`, `movement_date = 2026-11-03`. O extrato exibe `movement_date` como a data da linha → a parcela aparece em novembro. Além disso `cobrancas.data_pagamento` e `data_credito_real` recebem `new Date()` (hora do webhook), não a data do Asaas (`index.ts:559,566`).

**B7 — Toggle de antecipação é apenas preferência local.** Confirmado: grava em `usuarios_integracoes.dados_extras.{ireiAntecipar, repassarTaxaAntecipacao}` via `.update()` direto (`useIntegracoes.ts:556-570`). `creditCardAutomaticEnabled` tem **zero ocorrências no repositório**. A função `gestao-asaas-anticipation` chama `/v3/anticipations/simulate` e `/v3/anticipations`, mas **nunca é invocada pelo frontend** (dead code registrado em `config.toml:108`). O toggle só alimenta gross-up local em `anticipationUtils.ts`.

**B8 — Workflow: extras 6 vs 0.** `WorkflowCardCollapsed.tsx:365-367` tem fallback `fin.qtdExtras > 0 ? fin.qtdExtras : session.qtdFotosExtra`; `WorkflowCardExpanded.tsx:183-187` sincroniza com `fin.qtdExtras || 0` **sem fallback**, e o total (linha 425) usa `fin.extrasLiquido` direto. Além disso os hooks `useGalleryExtraCalc` + `useSessionFinancialsWithExtras` estão **duplicados** (linhas 79-88 e 160-169). Dados no banco estão corretos (`qtd_fotos_extra = 6`, `galerias.valor_extras = 138`) → é bug de leitura/RPC, não de dado.

---

## 3. Problemas adicionais encontrados

**N1 — Dupla contagem estrutural no `extrato_unificado`.** A view tem 6 branches. O branch 1 (`clientes_transacoes`, tipo `pagamento`) e o branch 4 (`gateway_cash_movements`, `credit`) **representam o mesmo dinheiro**. A única separação é o flag textual `dados_extras->>'migrado_para_gateway' = 'true'`. Qualquer transação sem esse flag conta duas vezes.

**N2 — Branch de taxa duplicado.** Branch 3 já emite "Taxa Gateway / Antecipação" (`ct.valor - ct.valor_liquido`) e o branch 4 emite `movement_type='fee'`. Mesmo risco.

**N3 — Conflito de chaves em `cobranca_parcelas`.** Existem dois uniques: `(cobranca_id, numero_parcela)` e `(asaas_payment_id)`. O upsert usa apenas o primeiro (`index.ts:373`). Quando `installmentNumber` vem ausente e cai no default `1` (`index.ts:355`), o upsert tenta gravar um `asaas_payment_id` diferente na parcela 1 e **viola o segundo unique**, falhando a parcela inteira.

**N4 — Sem guarda de ordem.** Nenhuma comparação de status/timestamp antes do write. `PAYMENT_CONFIRMED` chegando depois de `PAYMENT_REFUNDED` reverte `cobrancas.status` de `estornado` para `pago` (`index.ts:543-556`).

**N5 — `SUBSCRIPTION_RENEWED` sem idempotência.** `index.ts:843-885` chama a RPC `renew_subscription_credits` fora do `checkAndLogEvent` → redelivery duplica créditos.

**N6 — Eventos ignorados retornam 200.** `PAYMENT_PARTIALLY_REFUNDED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS`, `PAYMENT_CREATED` estão assinados (`asaas-helpers.ts:315-327`) mas caem no `return {received:true}` final — o Asaas nunca reenvia.

**N7 — Idempotência de base está OK.** Os índices `idx_gateway_events_dedup`, `idx_gateway_cash_movements_dedup` e `idx_gateway_anticipations_dedup` existem. O problema não é dedup de evento, é semântica de valor.

**N8 — Métrica `caixa_recebido` inflada.** A RPC `workflow_month_metrics` calcula `caixa_recebido = Σ clientes_transacoes.valor + Σ gateway_cash_movements.amount (credit/refund/chargeback)`. Como o `credit` é o valor bruto inflado (B1), a métrica de caixa mostra R$ 53,42 onde entraram R$ 51,32. As métricas comerciais (`previsto`, `receita`, `pendente`) estão corretas — leem só `valor_total`/`valor_pago`. **O Workflow comercial não está contaminado; só o "caixa" está.**

**N9 — `cobrancas.session_id` não é FK.** É um `TEXT` solto resolvido em runtime por `WHERE session_id = X OR id::text = X`, com fallback via `galerias`. Isso torna a reconciliação sessão↔cobrança dependente de string matching, sem integridade referencial.

**N10 — Sem coluna de política de repasse.** Os flags `repassarTaxasProcessamento`/`repassarTaxaAntecipacao` só existem dentro de `clientes_transacoes.dados_extras` (caminho legado). Para pagamentos Asaas não há registro de qual política estava vigente no momento do checkout — `fee_policy_snapshot` existe em `cobrancas` mas nunca é preenchido.

---

## 4. Modelo financeiro recomendado

Cinco conceitos, nunca misturados:

```
VENDA (clientes_sessoes.valor_total)            -> métrica do Workflow. Nunca tocada por gateway.
  └─ COBRANÇA (cobrancas)
       valor_principal          = receita do serviço      50,00
       valor_repassado_cliente  = acréscimo repassado       3,42   [NOVO]
       valor_cobrado_cliente    = principal + repasse      53,42
       └─ PARCELA (cobranca_parcelas)  [mesmos 3 campos, rateados]
            ├─ PAGAMENTO   data_pagamento, valor_cobrado_cliente
            ├─ RECEBÍVEL   data_credito (prevista), data_credito_real
            ├─ ANTECIPAÇÃO gateway_anticipations (1:N por parcela)
            └─ TAXAS       taxa_processamento_real 2,10 | taxa_antecipacao_real (do Asaas)
                 => valor_liquido_creditado = 51,32
```

Invariante obrigatória, validada por CHECK/trigger:

```
valor_cobrado_cliente
  - taxa_processamento_real
  - taxa_antecipacao_real
  = valor_liquido_creditado
```

E a decomposição do crédito:
`51,32 = 50,00 (receita de serviço) + 1,32 (recuperação parcial do repasse)`.
Os R$ 1,32 **não somem e não viram receita da sessão**: viram uma linha própria no extrato, natureza `recuperacao_taxa`, categoria a ser confirmada com contador. Nada é escondido, nada infla o Workflow.

**Campos novos necessários** (em `cobrancas` e `cobranca_parcelas`):
- `valor_repassado_cliente numeric default 0`
- `data_pagamento_gateway timestamptz` (data real do Asaas, separada do carimbo de webhook)
- `fee_policy_snapshot` — já existe, passar a preencher com a política vigente no checkout

**Novo em `gateway_cash_movements`:** `movement_type` passa a admitir `credit`, `fee`, `anticipation_fee`, `refund`, `chargeback`, `anticipation_reversal`; e coluna `competence_date` (data da venda) separada de `movement_date` (data do caixa).

---

## 5. Arquitetura Asaas

1. **Antecipação automática**: o toggle existente (`dados_extras.ireiAntecipar`) passa a ser o único, mas ganha efeito real — ao salvar, chama uma edge function que executa `PUT /v3/anticipations/configurations` com `creditCardAutomaticEnabled`. Depois lê `GET` da mesma rota e grava o estado real em `dados_extras.asaasAnticipationSync = { enabled, syncedAt, eligible, error }`. Se o Asaas recusar (elegibilidade), a UI mostra o estado real, sem mentir.
2. **Antecipação manual**: reaproveitar `gestao-asaas-anticipation` (hoje morto), ligando-a a um botão por parcela; `simulate` antes de `request`.
3. **Webhooks**: assinar e tratar `RECEIVABLE_ANTICIPATION_SCHEDULED/AUTHORIZED/CREDITED/DENIED/CANCELLED/DEBITED`. A taxa **sempre** vem de `anticipation.fee`; o cálculo por diferença é removido.
4. **Reconciliação**: job diário lendo `GET /v3/payments?status=RECEIVED` e `GET /v3/anticipations` das últimas 30 dias, comparando com `cobranca_parcelas` e corrigindo divergências (fonte da verdade = Asaas para taxa/crédito; Lunari para `valor_principal`).

---

## 6. Idempotência

- Todo handler (inclusive assinaturas e `SUBSCRIPTION_RENEWED`) passa por `checkAndLogEvent` antes de qualquer efeito colateral.
- Chave: `body.id` do Asaas. Quando ausente, `${event}_${payment.id}_${payment.status}`.
- `gateway_cash_movements`: `provider_transaction_id` determinístico já resolve duplicidade — mas passa a incluir o tipo de origem (`payment_X_credit`, `antecip_Y_fee`) para que CONFIRMED e RECEIVED não sobrescrevam um ao outro com valores diferentes.
- Guarda de ordem: função `payment_status_rank()` — um write só ocorre se o rank do novo status ≥ rank do atual (`pendente < confirmado < recebido < antecipado`; `estornado`/`chargeback` são terminais).
- `cobranca_parcelas`: upsert passa a usar `onConflict: asaas_payment_id` (chave natural do Asaas), eliminando N3.

---

## 7. Migração dos dados atuais

Nada é apagado. Migração em 3 passos, com tabela de backup `backup_financeiro_YYYYMMDD`:

1. **Backfill de `valor_cobrado_cliente`**: para cada parcela, `= valor_liquido + taxa_gateway` quando disponível, senão o `amount` do movimento `credit` correspondente (é exatamente o `payment.value` original — o dado não foi perdido).
2. **Recálculo de taxas reais**: `taxa_processamento_real = valor_cobrado_cliente - valor_liquido_creditado`, com `valor_liquido_creditado = valor_liquido` atual (que é o `netValue` verdadeiro do Asaas).
3. **Correção de `cobrancas.valor_liquido`**: substituir a extrapolação por `SUM(cobranca_parcelas.valor_liquido_creditado)`.
4. **Movimentos**: `amount` do `credit` passa a ser recalculado como `valor_liquido_creditado` + linha separada de repasse; movimentos antigos ganham `legacy = true` para auditoria.

---

## 8. Plano de implementação por fases

**Fase 1 — Banco (migração, sem código)**
Colunas novas, CHECK da invariante, `competence_date`, índice `asaas_payment_id` como conflict target, função `payment_status_rank`.

**Fase 2 — Webhook (núcleo)**
Reescrever a persistência de valores: `valor_principal`/`valor_repassado_cliente`/`valor_cobrado_cliente`/`taxa_processamento_real`/`valor_liquido_creditado`; remover cálculo de taxa por diferença; separar datas; guarda de ordem; idempotência em todos os handlers; tratar eventos hoje ignorados. **Eliminar o escritor duplo de `cobrancas.valor_liquido`**: o webhook deixa de escrever essa coluna e o trigger `reconcile_cobranca_from_parcelas()` passa a ser a única fonte, somando `valor_liquido_creditado` das parcelas.

**Fase 3 — Antecipação real**
Edge function de sincronização de `creditCardAutomaticEnabled`; handlers `RECEIVABLE_ANTICIPATION_*` gravando `gateway_anticipations` + `anticipation_fee` em `gateway_cash_movements`; reversão em `CANCELLED`/`DEBITED`.

**Fase 4 — Extrato e views**
Reescrever `extrato_unificado`: uma única fonte de caixa (`gateway_cash_movements`), removendo os branches 1 e 3 para pagamentos de gateway; nova natureza `recuperacao_taxa`; `data` = vencimento/competência e `movement_date` exposto como "crédito previsto/real". Corrigir `workflow_month_metrics.caixa_recebido` para somar crédito **líquido** em vez de bruto (N8).

**Fase 5 — Workflow**
Corrigir `WorkflowCardExpanded` (fallback igual ao collapsed, remover hooks duplicados). Garantir que métricas comerciais leiam **apenas** `clientes_sessoes.valor_total`.

**Fase 6 — Reconciliação**
Job diário Asaas ↔ Lunari com relatório de divergências.

---

## 9. Plano de testes

Casos A (PIX), B (cartão sem repasse), C (cartão com repasse — o caso R$ 50/53,42/51,32), D (6x sem antecipação), E (6x com antecipação automática), F (antecipação posterior), G (antecipação parcial), H (cancelamento/estorno de antecipação).

Para cada caso: fixture de payload Asaas → executar webhook → asserção sobre `cobrancas`, `cobranca_parcelas`, `gateway_anticipations`, `gateway_cash_movements` e `extrato_unificado`. Cada payload é reenviado 3x para provar idempotência, e reenviado fora de ordem para provar a guarda de rank.

---

## 10. Critérios de aceitação

1. Para o caso real: Workflow mostra venda **R$ 50,00**; extrato mostra crédito **R$ 51,32** decomposto em 50,00 + 1,32; taxa **R$ 2,10** como despesa; nenhum valor órfão.
2. `valor_cobrado_cliente - taxas = valor_liquido_creditado` em 100% das linhas (query de auditoria retorna zero divergências).
3. `valor_liquido` nunca maior que `valor_cobrado_cliente`.
4. Nenhum evento reenviado 3x altera saldo.
5. Toggle de antecipação reflete o estado real da conta Asaas (leitura de volta da API).
6. Taxa de antecipação sempre originada de `anticipation.fee`; zero cálculo local.
7. Card do Workflow: extras iguais em colapsado e expandido.
