# Correção: sinal manual não é salvo ao confirmar agendamento

## O que foi confirmado no banco (dados reais)

Agendamentos com `paid_amount = 100` e **nenhuma** transação de entrada:

| Agendamento | paid_amount | sessão criada | valor_pago | transações |
|---|---|---|---|---|
| 86d531ef (02/09 01:47) | 100 | sim | 0 | 0 |
| 094f24ed (01/09 14:23) | 100 | sim | 0 | 0 |
| 0d7d73e6 (31/08 17:58) | 100 | sim | 0 | 0 |
| 5f15ef27 (31/08 22:08) | 100 | sim | **100** | 1 |

O único caso correto (5f15ef27) é exatamente o fluxo "criar já confirmado com sinal". Nos demais o valor foi gravado em `appointments.paid_amount`, a sessão do Workflow foi criada, mas a linha em `clientes_transacoes` (descrição "Entrada do agendamento") nunca existiu — e é ela que alimenta `clientes_sessoes.valor_pago` via trigger. Também existe uma transação órfã com `session_id` nulo (sintoma do mesmo problema).

## Onde está o problema

1. **Trigger de banco cria a sessão com pagamento zerado**
   `ensure_workflow_session_on_confirm` (dispara em `AFTER INSERT OR UPDATE OF status, paid_amount ON appointments`) insere a sessão com `valor_pago = 0` fixo e **nunca** cria transação a partir de `NEW.paid_amount`. Ele só usa o sinal para inflar `valor_total`. Ou seja: o banco confirma o agendamento no Workflow sem levar o dinheiro junto.

2. **A criação da transação está só no frontend, duplicada em 4 lugares e com ordens diferentes**
   - `appointments.supabase.ts` `create()` → cria sessão e **depois** sincroniza o sinal (é por isso que esse fluxo funciona).
   - `appointments.supabase.ts` `update()` (linhas 498‑512) → sincroniza o sinal **antes** de `handleConfirmedSideEffects`, dependendo de a sessão já existir naquele instante.
   - `WorkflowSupabaseService._createSessionInternal` (sessão nova e sessão existente) e `hydrateStubSession` → mais três chamadas concorrentes com valores possivelmente defasados.

3. **Toda falha é silenciosa**
   `syncAppointmentDepositTransaction` (linhas 71‑142) faz `return` em qualquer erro de busca e apenas `console.error` em erro de insert/update. Existe FK `fk_transacoes_session_id → clientes_sessoes(session_id)`: se a sessão ainda não existe no momento do insert, o banco rejeita e o usuário não recebe nenhum aviso — o painel fecha como se tivesse salvo.

4. **Regra de apagar quando zero**
   Na mesma função, `paidAmount === 0` **deleta** a transação de entrada. Como várias chamadas concorrentes usam leituras diferentes de `paid_amount` (memória, `currAppt`, `hydratedData`), uma chamada defasada com 0 apaga o sinal recém-criado, sem log de auditoria.

5. **O painel bloqueia a correção manual**
   `SessionPanel.isConfirmedWithDeposit` (linhas 301‑307) desabilita o campo "Registro de entrada manual" assim que o agendamento está confirmado e tem sessão no Workflow. Depois da falha, o usuário não consegue reinserir o valor pela Agenda — que é a experiência relatada.

## Como resolver

### Fase 1 — Tornar o banco a fonte de verdade (migração)
- Nova função `public.sync_appointment_deposit_transaction()` + trigger em `appointments` `AFTER INSERT OR UPDATE OF paid_amount, status, session_id`, nomeado para executar **depois** de `trg_ensure_workflow_session_on_confirm` (ordem alfabética de trigger), garantindo que a sessão já exista:
  - só age quando `status = 'confirmado'`, `session_id` e `cliente_id` presentes;
  - `paid_amount > 0`: insere ou atualiza a transação única (`tipo='pagamento'`, `descricao='Entrada do agendamento'`, `cobranca_id IS NULL`) daquele `session_id`;
  - `paid_amount = 0` **e** o valor anterior era maior que zero: remove a transação (nunca apagar por leitura defasada);
  - índice único parcial em `clientes_transacoes (session_id)` para essa descrição com `cobranca_id IS NULL`, tornando a operação idempotente.
- Ajustar `ensure_workflow_session_on_confirm` para não gravar `valor_pago = 0` fixo: ao final, chamar `recompute_session_paid(NEW.session_id)`.
- Backfill: para todo `appointments` confirmado com `paid_amount > 0` sem transação de entrada, criar a transação e recomputar `valor_pago` (corrige os 3 agendamentos acima). Ligar a transação órfã com `session_id` nulo ou removê-la.

### Fase 2 — Simplificar o frontend
- Remover as chamadas de `syncAppointmentDepositTransaction` de `WorkflowSupabaseService` (3 pontos) e de `appointments.supabase.ts` `create()`/`update()`. O banco passa a ser o único responsável.
- Manter a função apenas como utilitário legado ou excluí-la; se mantida, trocar os `console.error` silenciosos por erro propagado.
- Em `update()`, propagar falha ao usuário: se o `UPDATE` do agendamento falhar, exibir toast de erro (hoje só o `throw` do supabase é tratado).

### Fase 3 — Painel de agendamento
- `isConfirmedWithDeposit`: manter o bloqueio apenas quando existir cobrança paga por link (`pagoCobrancas.length > 0`) ou quando o valor já estiver registrado (`valor_pago > 0` na sessão). Com sessão criada mas sem pagamento algum, o campo deve continuar editável para permitir o registro/correção.
- Após salvar, invalidar/refetch da sessão para o card do Workflow refletir "Pago" imediatamente (hoje o evento `workflow-cache-silent-refresh` é disparado antes de a transação existir).

### Fase 4 — Verificação
Reproduzir os três fluxos e conferir no banco `clientes_transacoes` + `clientes_sessoes.valor_pago`:
1. pendente salvo → reabrir → sinal + confirmar → salvar;
2. pendente salvo já com sinal → editar para confirmado;
3. confirmado com sinal na primeira gravação (regressão);
4. alterar o sinal de 100 para 150 e depois para 0.

## Observação fora do escopo
O build atual está quebrando por erros de TypeScript pré-existentes (`ChargeModal`/`allowChangeValor`, `PublicCheckout.mpPublicKey`, status de cobrança). Precisam ser corrigidos para o preview compilar — posso incluir na mesma execução se você quiser.
