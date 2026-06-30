# Paridade de capabilities `finance.transaction.*` vs. hooks/modais legados

Auditoria realizada na Onda 5b.1 antes de migrar `useNovoFinancas`, `useFinancialTransactionsSupabase`, `useExtratoSupabase` para usarem as capabilities.

Fontes auditadas:

- Capabilities: `src/modules/finance/application/commands/{create,update,delete,markTransactionPaid,markTransactionPending}Transaction.ts`
- Repos: `src/modules/finance/infrastructure/supabase/transactionsRepo.ts`
- Adapter legado: `src/adapters/SupabaseFinancialTransactionsAdapter.ts`
- Hooks legados: `src/hooks/useFinancialTransactionsSupabase.ts`, `src/hooks/useNovoFinancas.ts`
- Modais: `ModalNovoLancamentoRefatorado.tsx`, `NovaTransacaoModal.tsx`, `EditTransactionModal.tsx`, `ModalVendaAvulsa.tsx`

---

## 1. `finance.transaction.create`

### Cobertura dos modos

| Modo | Modal/Caller atual | Capability | Status |
|---|---|---|---|
| `unico` | `ModalNovoLancamentoRefatorado` sem opções marcadas; `NovaTransacaoModal` (recorrência `unica`) | `createSingle` | ✅ paridade |
| `parcelado` | `NovaTransacaoModal` quando `tipoRecorrencia='parcelada'` | `createParcelado` | ✅ paridade |
| `recorrente` | `ModalNovoLancamentoRefatorado` quando `despesaRecorrente=true` | `createRecorrente` | ✅ paridade |
| `cartao` | `ModalNovoLancamentoRefatorado` quando `cartaoCredito=true` | `createCartao` | ✅ paridade |

### Divergências encontradas (precisam ajuste antes da facade)

1. **Status inicial de lançamento único vencendo hoje/atrás.**
   - Legacy `useFinancialTransactionsSupabase.criarTransacaoMutation`: define `status: data_vencimento <= hoje ? 'Faturado' : 'Agendado'` no momento do insert.
   - Capability `createSingle` via `mapCreatePayload`: força `status: "Agendado"`. Cron diário (`fin_promote_overdue_to_faturado`) reconcilia mais tarde, mas o paint imediato após criação mostra "Agendado" para algo vencido — regressão visível.
   - **Ajuste**: `mapCreatePayload` deve calcular `status: dataVencimento <= getCurrentDateString() ? 'Faturado' : 'Agendado'`. Idem `createParcelado`/`createRecorrente`/`createCartao` já fazem isso dentro do adapter — single é o único fora do padrão.

2. **Default de `isValorFixo` em recorrente.**
   - Legacy `useNovoFinancas.createTransactionEngine` força `isValorFixo: isValorFixo || false` (default `false`).
   - Modal sempre envia `true` por padrão (`formData.valorFixo: true`).
   - Capability `createRecorrente`: `input.isValorFixo ?? true` (default `true`).
   - **Decisão**: manter default `true` na capability (alinhado com a UI). O bug latente do hook legado de aceitar `false` quando nada é passado some na migração.

3. **`formaPagamento` em parcelado.**
   - Capability `createParcelado` repassa `formaPagamento ?? null` para o repo, mas o repo `supabaseTransactionsRepo.createParcelado` NÃO propaga para o adapter (linhas 68–77). Resultado: `formaPagamento` aceito pelo schema mas silenciosamente descartado.
   - **Ajuste**: ou (a) propagar para o adapter (exigiria estender `createParceledTransactions` para gravar `forma_pagamento` em cada parcela), ou (b) remover do input de parcelado/recorrente/cartão para evitar contrato mentiroso.
   - **Decisão**: opção (a). Pequeno ajuste no adapter (`createParceledTransactions`, `createRecurringYearlyTransactions`, `createCreditCardTransactions`) aceita `formaPagamento` opcional e grava em cada parcela. Mantém superfície honesta para a Lu.

4. **`dataCompetencia` em parcelado/recorrente/cartão.**
   - Capability aceita `dataCompetencia` no nível do input, mas só passa para `createSingle`. Outros modos ignoram.
   - **Decisão**: aceitar no input geral mas **documentar no schema** (`.describe()`) que só single usa. Adicionar `superRefine` rejeitando `dataCompetencia` quando `modo !== 'unico'`. Evita falsa promessa para a Lu.

5. **`parcelaTotal` mínimo em cartão.**
   - Hoje schema exige `parcelaTotal >= 2` em `parcelado`, mas no `cartao` é opcional e default 1 (à vista). Capability já trata. **OK.**

### Não-divergências confirmadas (não precisam ajuste)

- **Equipment-scan side-effect** (`checkIfEquipmentAndNotify`): hoje vive no `onSuccess` do mutation legado. Será movido para um listener de `eventBus.on('finance.transaction.created')` na Onda 7.2; até lá a facade do hook chama a capability e mantém o `checkIfEquipmentAndNotify` no próprio `useFinancialTransactionsSupabase.onSuccess`.
- **Invalidate `['extrato-unificado']`**: a `FinanceRealtimeBridge` já debounce-invalida. Facade mantém invalidação manual sincrônica para paint imediato.
- **`recurring_blueprint_id`** e `parent_id` sintéticos: produzidos dentro do adapter; capability não precisa expor.

---

## 2. `finance.transaction.update`

### Divergências

1. **Mudança de `status` via update.**
   - Legacy `useFinancialTransactionsSupabase.atualizarTransacaoMutation` aceita `updates.status` e envia direto pro adapter (caminho usado quando editor inline marca "Faturado").
   - Capability `updateTransaction` NÃO aceita `status` (correto: status é derivado).
   - **Ajuste na facade (não na capability)**: o wrapper `atualizarTransacao` no hook legado deve rotear:
     - `status === 'Pago'` → `finance.transaction.markPaid`
     - `status === 'Faturado'` → `finance.transaction.markPending`
     - `status === 'Agendado'` → **não suportado** (não há capability para isso; legacy quase nunca usa esse caminho — só em ajustes manuais raros). Documentar como limitação e remover o caso do facade.

2. **`dataCompetencia` nullable.**
   - Schema atual: `z.string().regex(...).optional()` — não aceita `null`. Modal pode limpar o campo enviando `null`.
   - **Ajuste**: `.nullable().optional()`. Repo já trata `null` corretamente.

### Não-divergências
- `valor`, `dataVencimento`, `observacoes`, `formaPagamento` — capability cobre.

---

## 3. `finance.transaction.delete`

### Risco crítico: aprovação humana

- Capability declarada como `REQUIRES_APPROVAL` (`finance.transaction.delete` na Onda 6).
- Legacy hook deleta direto após clique do usuário (já confirmou na UI com modal próprio).
- **Decisão**: a regra `REQUIRES_APPROVAL` aplica-se apenas a `source='ai'`. Para `source='user'` ou `source='automation'` a capability executa direto. Confirmar via leitura de `src/shared/capability/policies.ts` antes da migração da facade; se a policy atual não distinguir source, ajustar para distinguir (mantendo aprovação obrigatória só para Lu).
- **Bloqueador para 5b**: validar a policy antes de migrar `removerTransacao` no facade. Se não houver suporte hoje, criar `requiresApprovalWhen: (ctx) => ctx.source === 'ai'`.

---

## 4. `finance.transaction.markPaid` / `.markPending`

- Capabilities OK; aceitam `id` + `source`.
- Legacy `marcarComoPagoMutation` não persiste `dataPagamento`. Capability aceita opcional → manter compat enviando `undefined`.
- **Sem ajuste necessário.**

---

## 5. `useVendaAvulsa` → **fora do escopo da migração**

Auditado e confirmado: `useVendaAvulsa.criarVendaAvulsa` NÃO insere em `fin_transactions`. Insere em:

- `clientes_sessoes` (com `tipo_registro='venda_avulsa'`)
- `clientes_transacoes` (pagamento da sessão)

Isso é Billing/CRM, não Finance. As transações financeiras correspondentes aparecem no extrato via `extrato_unificado` (origem `workflow`/`gallery`), não via `fin_transactions`.

**Conclusão**: `ModalVendaAvulsa` continua intocado nas Ondas 5b e 5c. Sai inclusive do plano de unificação no `TransactionModal` — são entidades distintas.

---

## 6. Ajustes mínimos para destravar 5b.2

Ordem dos commits sugerida (todos pequenos, sem mudança de UI):

1. **`createTransaction.ts`** — adicionar cálculo de status inicial para single (`Faturado` se `dataVencimento <= hoje`). 6 linhas.
2. **`createTransaction.ts`** — `superRefine` rejeitando `dataCompetencia` quando `modo !== 'unico'`. 5 linhas.
3. **`updateTransaction.ts`** — `dataCompetencia` `.nullable().optional()`. 1 linha.
4. **`transactionsRepo.ts` + `SupabaseFinancialTransactionsAdapter.ts`** — propagar `forma_pagamento` em parcelado/recorrente/cartão. ~15 linhas no adapter (campo opcional no INSERT) + 3 linhas em cada wrapper do repo.
5. **`policies.ts`** — confirmar/implementar `requiresApprovalWhen: source==='ai'` para `finance.transaction.delete`. A inspeccionar antes de tocar.

### Não-mudanças confirmadas

- `createParcelado`/`createRecorrente`/`createCartao`: assinatura e comportamento mantidos.
- Equipment scan: permanece no facade até Onda 7.2 migrar para evento.
- Realtime: nada muda.

---

## 7. Checklist de prontidão para 5b.2 (facade `useNovoFinancas`)

- [ ] Itens 1–4 acima aplicados na capability.
- [ ] Item 5 (policy) validado em `src/shared/capability/policies.ts`.
- [ ] Teste manual: criar 1 lançamento vencido hoje → aparece "Faturado" imediatamente.
- [ ] Teste manual: criar 1 parcelado em 3x com `formaPagamento='pix'` → cada parcela tem `forma_pagamento='pix'` no DB.
- [ ] Teste manual: Lu tenta `finance.transaction.delete` → exige aprovação. Usuário deleta pela UI → não exige.

Quando todos checados, segue para a Onda 5b.2.
