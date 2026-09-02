# Auditoria e plano de correção — antecipação automática Asaas

## Escopo e conclusão executiva

Auditoria read-only do caso real informado, usando os registros do Supabase, o código vigente, as migrations financeiras e a documentação oficial do Asaas. Nenhuma implementação foi feita.

Caso auditado:
- Cobrança: `e59d45ed-d1f9-4436-b4cf-23d1a2374482`
- Parcela: `52fa5d1b-3493-4611-ba4c-108a38cf4f09`
- Payment Asaas: `pay_yd1k7aer5f15ioep`
- Data de referência do banco: `2026-09-02`

### Diagnóstico confirmado

O problema não está apenas na tela do Fluxo. A antecipação automática foi tratada como se fosse somente uma atualização do payment, mas o crédito antecipado é um evento financeiro distinto.

1. O Asaas enviou `PAYMENT_CONFIRMED` e depois `PAYMENT_ANTICIPATED`. O sistema processou ambos.
2. O `PAYMENT_ANTICIPATED` continuou usando `payment.creditDate = 2026-10-05` como data do movimento. Essa data era a previsão de crédito do payment, não a confirmação contábil do crédito antecipado.
3. O webhook de antecipação automática dedicado não está incluído na lista de eventos configurados por `ensureAsaasWebhookSubscription`: os eventos `RECEIVABLE_ANTICIPATION_*` não aparecem em `ASAAS_WEBHOOK_EVENTS`. Portanto, o caminho que deveria registrar `gateway_anticipations` e a taxa de antecipação não é garantido para a integração automática.
4. No banco, a parcela ficou `antecipado=true` e `status='antecipado'`, mas com `data_credito=2026-10-05` e `data_credito_real=null`. A cobrança pai recebeu `data_credito_real`, mas a parcela — que alimenta o recebível — não.
5. Não existia registro relacionado em `gateway_anticipations`, e os dois movimentos encontrados (`credit` e `fee`) ficaram em `2026-10-05`, sem `anticipation_id`.
6. A view `extrato_unificado` define o status exclusivamente por `movement_date::date > CURRENT_DATE`. Por isso o movimento aparece como `Agendado` e é incluído no mês de outubro, mesmo com o payment confirmado/antecipado em setembro.
7. A reconciliação da cobrança pai não agrega corretamente a taxa de antecipação real. Além disso, o handler de `RECEIVABLE_ANTICIPATION_CREDITED`, quando executado, atualiza a taxa na parcela mas não atualiza consistentemente `valor_liquido_creditado`, o movimento de crédito existente, a data efetiva ou o vínculo `anticipation_id`.
8. Há risco de dupla contagem: o `PAYMENT_ANTICIPATED` pode calcular a diferença entre `value` e `netValue` como taxa de processamento, enquanto o evento `RECEIVABLE_ANTICIPATION_CREDITED` criaria outra taxa de antecipação. São chaves de movimento diferentes.
9. A migration `20260830191500_fix_retroactive_asaas_cash_movements.sql` também usa `data_credito`/`data_pagamento` para criar movimentos históricos; se `data_credito` for estimada, o erro é perpetuado no backfill.
10. O webhook não valida o header/segredo de autenticidade do Asaas. Como está configurado sem JWT de usuário, isso é uma falha de segurança independente e deve ser corrigida antes de ampliar a reconciliação.

A divergência visual de valores também deve ser tratada como dado a reconciliar: a imagem informa bruto de R$ 6,76, taxas de R$ 0,77 e líquido de R$ 5,99, enquanto o registro consultado no banco contém movimentos de R$ 6,76 e -R$ 0,69, sem antecipação vinculada. A implementação não deve escolher um valor por heurística; deve consultar o objeto atual da antecipação/payment no Asaas e registrar a origem de cada valor.

## Fluxo atual e pontos exatos

```text
Asaas payment event
  -> supabase/functions/asaas-webhook/index.ts
     -> findCobranca(externalReference/payment.id)
     -> upsertParcela()
     -> reconcile_cobranca_from_parcelas()
     -> gateway_cash_movements (credit/pass_through/fee)
     -> extrato_unificado
     -> useExtratoSupabase / FluxoFinanceiroView
```

Fluxo que deveria existir para antecipação:

```text
Asaas RECEIVABLE_ANTICIPATION_* 
  -> gateway_events (idempotência por event.id)
  -> gateway_anticipations (uma linha por anticipation.id)
  -> cobranca_parcelas (estado agregado da parcela)
  -> gateway_cash_movements (ajuste do recebível e taxa)
  -> extrato / métricas / Workflow
```

Arquivos relevantes:
- `supabase/functions/asaas-webhook/index.ts`: correlação, `upsertParcela`, payment events e anticipation events.
- `supabase/functions/_shared/asaas-helpers.ts`: lista de eventos configurados no Asaas.
- `supabase/functions/check-payment-status/index.ts`: segundo caminho de sincronização, atualmente sem reconciliação completa de antecipações.
- `supabase/functions/sync-asaas-anticipation/index.ts`: configura antecipação automática; não reconcilia recebíveis já criados.
- `supabase/functions/gestao-asaas-anticipation/index.ts`: solicitação manual; retorna o resultado da API sem persistir a antecipação localmente.
- `supabase/migrations/20260828175838_financeiro_fase1.sql`: tabelas e índices do razão de gateway.
- `supabase/migrations/20260902100000_fase1_schema_e_triggers.sql`: status e agregações das cobranças/parcelas.
- `supabase/migrations/20260902200000_fase4_extrato_e_metricas.sql`: `extrato_unificado` e `workflow_month_metrics`.
- `supabase/migrations/20260902300000_fase5_reconciliacao_historico.sql`: backfill do razão, atualmente dependente de datas potencialmente estimadas.
- `supabase/migrations/20260830191500_fix_retroactive_asaas_cash_movements.sql`: criação retroativa de movimentos.
- `src/hooks/useExtratoSupabase.ts`: consulta/mapeamento da view.
- `src/modules/finance/presentation/fluxo/FluxoTimelineRow.tsx`: rótulo visual do status.
- `src/modules/finance/presentation/fluxo/FluxoDetailSheet.tsx`: detalhe sem status real do gateway, antecipação ou composição de taxas.
- `src/hooks/useWorkflowMetricsRealtime.ts` e RPC `workflow_month_metrics`: métricas agregadas pelo `movement_date`.

## Plano de correção em sete fases

### Fase I — Contrato financeiro e fotografia dos dados

- Definir formalmente as entidades: cobrança comercial, parcela, payment Asaas, antecipação, recebível, crédito efetivo, taxa de processamento, taxa de antecipação e repasse.
- Separar explicitamente:
  - `payment.value`: valor cobrado pelo Asaas;
  - `payment.netValue`: valor líquido do payment conforme o estado consultado;
  - taxa de processamento;
  - `anticipation.value`, `fee` e `netValue`;
  - valor efetivamente creditado na conta.
- Não recalcular taxa de antecipação por diferença genérica quando o Asaas já fornece `fee`.
- Criar uma matriz de estados e datas: confirmado, recebido, antecipado, creditado, cancelado, debitado/chargeback.
- Antes do backfill, capturar snapshot dos registros afetados e dos payloads disponíveis para auditoria.

### Fase II — Contrato oficial do webhook e segurança

- Confirmar na conta Asaas de cada fotógrafo a configuração dos eventos de payment e de receivables/anticipation.
- Incluir os eventos `RECEIVABLE_ANTICIPATION_PENDING`, `SCHEDULED`, `AUTHORIZED`, `CREDITED`, `DENIED`, `CANCELLED`, `DEBITED` e `OVERDUE` conforme suportados pela conta e pelo contrato oficial.
- Validar `asaas-access-token`/segredo configurado no webhook antes de processar qualquer payload; rejeitar chamadas não autenticadas.
- Usar o `body.id` do evento como chave de idempotência primária. O fallback por recurso deve ser apenas compatibilidade controlada, nunca a identidade principal de uma entrega.
- Persistir falhas em `gateway_events.error_log`, manter o evento reprocessável e retornar não-2xx quando o efeito financeiro não for concluído.
- Garantir que a atualização da configuração não remova eventos já necessários para pagamentos, chargebacks e antecipações.

### Fase III — Reimplementação da máquina de estados Asaas

- Extrair um único adaptador de normalização para payment e anticipation, usado pelo webhook e pelo `check-payment-status`.
- Para cada payment event, buscar o payment atual no Asaas quando o payload não trouxer dados completos; não confiar em valores parciais de webhook.
- Tratar `PAYMENT_CONFIRMED` como pagamento confirmado, não como caixa liquidado.
- Tratar `PAYMENT_RECEIVED` como evidência de recebimento quando aplicável.
- Tratar `PAYMENT_ANTICIPATED` como sinal de antecipação do payment, sem usar automaticamente `creditDate` estimada como crédito efetivo.
- Para `RECEIVABLE_ANTICIPATION_CREDITED`, consultar/persistir a antecipação completa e usar a antecipação como origem da taxa de antecipação e do crédito efetivo.
- Suportar eventos fora de ordem e reentrega: `CREDITED` deve funcionar mesmo se `SCHEDULED` não tiver sido recebido.
- Suportar mais de uma antecipação legítima para o mesmo payment sem sobrescrever histórico; o agregado deve ser soma por `anticipation.id`, não last-write-wins.

### Fase IV — Persistência e razão de caixa idempotentes

- Ajustar `cobranca_parcelas` para distinguir previsão (`data_credito`) de liquidação efetiva (`data_credito_real`) e armazenar o valor líquido efetivamente creditado.
- Fazer `reconcile_cobranca_from_parcelas` agregar processamento, antecipação, repasse e líquido sem perder parcelas ou taxas.
- Vincular cada movimento à antecipação quando houver `anticipation_id`.
- Definir uma composição canônica para cada parcela:
  - crédito de receita comercial;
  - repasse de taxa ao cliente, se houver;
  - taxa de processamento;
  - taxa de antecipação;
  - ajustes, estornos ou débitos posteriores.
- Atualizar movimentos existentes quando chega informação mais recente; não apenas inserir outro `fee`.
- Impedir que a mesma taxa seja simultaneamente embutida no fee de processamento e lançada como fee de antecipação.
- Manter chaves idempotentes por evento e por efeito financeiro, com constraints/índices adequados.
- Rever o uso de `valor_liquido_creditado`: ele deve representar o líquido efetivamente creditado após as taxas aplicáveis, não o último `payment.netValue` recebido.

### Fase V — Reconciliação histórica e operacional

- Criar uma rotina server-side de reconciliação por fotógrafo/período, usando:
  - payments do Asaas;
  - listagem de antecipações com paginação;
  - vínculo por `payment`, `installment` e `externalReference`;
  - estado local e eventos já processados.
- Corrigir primeiro o caso âncora e depois todos os pagamentos antecipados afetados.
- Recalcular movimentos a partir do estado canônico, removendo/ajustando registros criados com data estimada.
- Fazer backup lógico dos registros alterados e registrar `source_event_id`/origem da reconciliação.
- Não usar o backfill atual como fonte final sem substituir a dependência cega de `data_credito`.
- Tornar a rotina segura para reexecução e capaz de relatar divergências, sem apagar silenciosamente histórico financeiro.

### Fase VI — Fluxo Financeiro, Workflow e apresentação

- Alterar a fonte de data do caixa para a data efetiva quando existir; manter a data prevista separada para competência/projeção.
- Remover o status derivado exclusivamente de `movement_date > CURRENT_DATE` para movimentos de gateway já confirmados/creditados.
- Definir semanticamente os estados exibidos: confirmado, recebido, antecipado/creditado, previsto, taxa, estorno e débito.
- Expor no detalhe do Fluxo a composição da operação: bruto, processamento, antecipação, líquido e datas prevista/efetiva.
- Diferenciar visualmente crédito, taxa de processamento, taxa de antecipação e repasse; não apresentar todos como uma linha genérica “Agendado”.
- Atualizar `workflow_month_metrics` para considerar caixa efetivo e não deslocar receita/taxa para mês futuro por data prevista.
- Unificar ou formalizar a fronteira entre o hook legado `useExtratoSupabase` e `src/modules/finance/infrastructure/supabase/extratoRepo.ts`, evitando duas regras de mapeamento para a mesma view.
- Garantir invalidação após alterações em parcelas, antecipações e movimentos.

### Fase VII — Testes, observabilidade e liberação controlada

- Testes unitários para normalização de cada evento e para eventos fora de ordem.
- Testes de idempotência com reentrega do mesmo `event.id`.
- Testes de pagamento confirmado seguido de antecipação creditada.
- Testes de antecipação parcial/múltipla para um payment.
- Testes de ausência de webhook de anticipation, validando reconciliação posterior.
- Testes de não duplicação de taxas e de consistência:
  - soma dos movimentos;
  - taxa de processamento;
  - taxa de antecipação;
  - líquido creditado;
  - valor agregado da cobrança;
  - valor da parcela;
  - Fluxo e métricas do Workflow.
- Testes de regressão para `PAYMENT_RECEIVED`, chargeback, estorno, parcelamento, repasse e Gallery.
- Testes de segurança do webhook com token ausente, inválido e válido.
- Criar métricas/alertas para: evento não processado, cobrança sem parcela, parcela antecipada sem anticipation row, movimento futuro com status antecipado e divergência entre Asaas e razão local.
- Liberar primeiro para uma conta de teste/sandbox, depois para o caso real, e somente então executar o backfill amplo.

## Critérios de aceitação

1. O caso `pay_yd1k7aer5f15ioep` aparece no mês da liquidação efetiva, não em outubro por causa de uma previsão.
2. A parcela e a cobrança possuem datas prevista e efetiva coerentes.
3. Existe uma antecipação local vinculada ao identificador da antecipação Asaas quando o provedor a fornece.
4. A taxa de antecipação aparece uma única vez e não é confundida com a taxa de processamento.
5. O líquido local bate com o valor efetivamente creditado informado pelo Asaas após a conciliação.
6. `cobrancas`, `cobranca_parcelas`, `gateway_anticipations`, `gateway_cash_movements`, `extrato_unificado` e `workflow_month_metrics` fecham matematicamente.
7. Reentregar qualquer webhook não altera o resultado financeiro.
8. Eventos fora de ordem não causam downgrade nem perda de dados.
9. O Fluxo exibe status e composição compreensíveis, sem rotular um crédito já liquidado como simples “Agendado”.
10. O webhook rejeita chamadas sem autenticação válida e mantém falhas financeiras reprocessáveis.
11. O mecanismo de reconciliação encontra antecipações mesmo quando o webhook específico não foi recebido.
12. Nenhum backfill altera valores sem snapshot, origem e relatório de divergência.

## Documentação consultada

- `docs/constitution/CONSTITUTION.md`
- `docs/constitution/ARCHITECTURE.md`
- `docs/constitution/PRODUCT_GUIDE.md`
- `docs/constitution/DESIGN_DNA.md`
- `docs/ARCHITECTURE_TECHNICAL.md`
- Asaas — Payment events: https://docs.asaas.com/docs/payment-events
- Asaas — Receivable anticipation events: https://docs.asaas.com/docs/receivable-anticipation-events
- Asaas — Antecipações: https://docs.asaas.com/docs/antecipacoes
- Asaas — Listar antecipações: https://docs.asaas.com/reference/listar-antecipacoes
- Asaas — Recuperar antecipação: https://docs.asaas.com/reference/recuperar-uma-unica-antecipacao
- Asaas — Solicitar antecipação: https://docs.asaas.com/reference/solicitar-antecipacao

**Status:** auditoria concluída; plano pronto; nenhuma implementação aplicada nesta etapa.