# Paridade de capabilities `finance.transaction.*` vs. hooks/modais legados

**Status: Onda 5b.2 concluída** — `useFinancialTransactionsSupabase` (e por consequência `useNovoFinancas`, que apenas o consome) agora delega 100% das mutações para as capabilities `finance.transaction.{create,update,delete,markPaid,markPending}`. A superfície pública dos hooks foi preservada — nenhum modal/caller precisou mudar.


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

### Aprovação humana — investigado e resolvido

- Capability declarada como `needsApproval: true` (boolean).
- Auditoria de `src/shared/capability/define.ts` confirma: `cap.execute()` **não bloqueia** por `needsApproval`. A flag é metadata consumida apenas pelo runner da IA (`ai-adapter`). Chamadas via `useRunCapability()` (UI do usuário) executam direto.
- **Conclusão**: nenhuma mudança necessária. Delete pela UI já passa; Lu vai ler `needsApproval=true` e pedir confirmação.

---

## 4. Permissões — **bloqueador crítico descoberto e corrigido**

`CapabilityRuntimeProvider` (`src/shared/capability/react.tsx`) concedia ao usuário autenticado apenas `financeiro:read|write|delete`. Todas as capabilities `finance.*` exigem `finance:read|write|delete`. Resultado: chamadas não-admin retornariam `FORBIDDEN`.

**Aplicado**: `DEFAULT_USER_PERMISSIONS` agora inclui `finance:read`, `finance:write`, `finance:delete`. Permissões `financeiro:*` mantidas para não quebrar hooks legados que possam usá-las.

---

## 5. `finance.transaction.markPaid` / `.markPending`


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
## 7. Ajustes aplicados nesta entrega (5b.1)

1. ✅ `transactionsRepo.mapCreatePayload`: calcula status inicial (`Faturado` se vencimento ≤ hoje, senão `Agendado`).
2. ✅ `transactionsRepo.mapCreatePayload`: propaga `forma_pagamento` quando enviada.
3. ✅ `createTransaction` (capability): `superRefine` rejeita `dataCompetencia` quando `modo !== 'unico'`.
4. ✅ `updateTransaction` (capability): `dataCompetencia` agora `.nullable().optional()`.
5. ✅ `transactionsRepo` (port + impl) + `SupabaseFinancialTransactionsAdapter`: propagam `formaPagamento` em parcelado, recorrente e cartão. Cartão grava `cartao_credito` como default.
6. ✅ `CapabilityRuntimeProvider` (`react.tsx`): concede `finance:read|write|delete` ao usuário autenticado.

## 8. Checklist de prontidão para 5b.2 (facade `useNovoFinancas`)

- [x] Ajustes 1–6 aplicados.
- [ ] **Teste manual usuário** (precisa autorização):
  - Criar 1 lançamento único vencido hoje → deve nascer "Faturado" no paint imediato.
  - Criar 1 parcelado em 3x com forma de pagamento → ver `forma_pagamento` no banco em todas as parcelas.
  - Criar 1 recorrente "valor fixo" → 12 meses gerados; forma de pagamento (se houver) propagada.
  - Criar 1 compra no cartão em 2x → `forma_pagamento='cartao_credito'` nas 2 parcelas.
  - Deletar pela UI → executa direto sem aprovação.

Quando todos confirmados, segue para a **Onda 5b.2** (migrar `useNovoFinancas` para a capability).


---

## 9. Onda 5b.2 — Migração para facade (concluída)

`useFinancialTransactionsSupabase` foi reescrito para usar capabilities internamente:

- `criarTransacao` → `finance.transaction.create` (helper `toCreateCapabilityInput` resolve `modo` a partir das flags legadas `credit_card_id` / `isParcelado` / `isRecorrente`).
- `atualizarTransacao` → roteia `status` para `markPaid`/`markPending` e demais campos para `finance.transaction.update`. Status `Agendado` é ignorado com warn (sem capability dedicada).
- `removerTransacao` → `finance.transaction.delete`.
- `marcarComoPago` → `finance.transaction.markPaid`.

Side-effects preservados:
- `checkIfEquipmentAndNotify` continua disparando no `onSuccess` do create — agora recebe `ids: string[]` diretamente do output da capability.
- `invalidateQueries(['financial-transactions'])` + `['extrato-unificado']` mantém o paint imediato.
- Toasts de erro mantidos (sucesso continua silencioso — política do projeto).

`useNovoFinancas` **não precisou de mudanças**: ele consome `useFinancialTransactionsSupabase` e herdou a migração automaticamente.

### Checklist de homologação (5b.2)

- [ ] Criar lançamento único vencido hoje → "Faturado" no paint.
- [ ] Criar parcelado 3× → status correto por parcela.
- [ ] Criar recorrente "valor fixo" → 12 meses.
- [ ] Compra no cartão 2× → `forma_pagamento='cartao_credito'`.
- [ ] Editar valor/data/observação inline → persiste.
- [ ] Marcar como pago / reabrir → status muda.
- [ ] Excluir lançamento → some da lista.
- [ ] Auditar evento "finance.transaction.created" no LunariEvents log.
