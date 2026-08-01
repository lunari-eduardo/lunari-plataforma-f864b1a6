# Varredura — Cobrança de confirmação do agendamento (Agenda → pagamento → Workflow)

Fluxo esperado:
`Nova sessão (sem status) → salvar como Pendente → modal de cobrança → enviar ao cliente → cliente paga → agendamento vira Confirmado → sessão aparece no Workflow hidratada.`

## Resultado da varredura

O fluxo **funciona parcialmente**. As etapas de gerar link e confirmar o agendamento estão corretas para Asaas, Mercado Pago e InfinitePay. As falhas estão em: (1) quem dispara o modal, (2) o vínculo da sessão quando a cobrança nasce antes da sessão, e (3) a entrada no Workflow sem o app aberto.

### O que está correto hoje
- Provedores disponíveis no modal (`ProviderSelector`): Asaas, Mercado Pago, InfinitePay, PIX manual — com `is_default` respeitado.
- Auto-confirmação por trigger: `tg_cobranca_confirm_appointment` (cobranca → `pago`) e `auto_confirm_appointment_on_payment` (`clientes_sessoes.valor_pago` sobe) promovem `a confirmar → confirmado`.
- Webhooks: `asaas-webhook` (parcelas + `reconcile_cobranca_from_parcelas`), `mercadopago-webhook` e `infinitepay-webhook` marcam a cobrança como `pago` e disparam `ensure_transaction_on_cobranca_paid`.
- Hidratação de stub já existe (`WorkflowSupabaseService.hydrateStubSession`).

### Falhas / lacunas encontradas

**F1 — O switch "Cobrar ao salvar" não cobre o agendamento já pendente.**
O comportamento desejado é o atual em criação (abre o modal só com o switch ligado), mas o switch existe apenas quando `!isEdit`. Ao reabrir um agendamento já pendente, o único caminho é o botão "Gerar cobrança" — e ele só aparece quando não há cobrança ou quando a cobrança já está paga. Faltam: switch/ação disponível também em edição de pendente e reemissão quando a cobrança está expirada/cancelada.

**F2 — No fluxo "cobrar ao salvar" não existe registro em `clientes_sessoes`.**
O stub só é criado em `handleGerarCobranca` (modo edição). Na criação, `findCreatedSessionId` pega o `session_id` do appointment e passa ao `ChargeModal`, mas nenhuma linha em `clientes_sessoes` é criada.
Consequência em cadeia, quando o cliente paga:
- `ensure_transaction_on_cobranca_paid` não acha a sessão → grava a transação com `session_id = NULL` → **pagamento órfão no extrato** (exatamente os registros limpos na sessão anterior).
- `auto_confirm_appointment_on_payment` não roda (não há `valor_pago`); só o trigger da cobrança confirma — ok, mas o valor pago não entra no card.

**F3 — Confirmação por webhook não cria a sessão do Workflow.**
`createSessionFromAppointment` roda **apenas no cliente** (`appointments.supabase.ts → handleConfirmedSideEffects`, disparado por create/update com `status='confirmado'`). Quando o pagamento chega pelo webhook, o `UPDATE` vem do banco: o appointment fica confirmado, mas **nenhuma sessão de Workflow é criada** até alguém abrir/editar o agendamento no app.

**F4 — `pago_manual` não confirma o agendamento.**
`tg_cobranca_confirm_appointment` só testa `NEW.status = 'pago'`. PIX manual confirmado e `confirm-payment-manual` gravam `pago_manual` → agendamento continua pendente.

**F5 — Trigger só cobre `UPDATE OF status`.**
Cobranças criadas já como `pago` (INSERT direto, ex.: confirmação manual imediata) não disparam a confirmação.

**F6 — `handleGerarCobranca` exige `appointment.sessionId`.**
Se o agendamento existir sem `session_id`, o botão abre o modal sem stub e sem vínculo — mesmo efeito do F2.

**F7 — Sem feedback de retorno no painel.**
Não há realtime/poll do status da cobrança dentro do `SessionPanel`; o usuário não vê o agendamento virar Confirmado sem recarregar.

**F8 — Agendamento pendente antigo não tem caminho completo.**
Para um pendente criado antes (ou sem cobrança emitida), o usuário precisa: abrir o painel → gerar link → enviar → e a automação pagamento → confirmação → Workflow deve valer igual. Hoje isso depende de F2/F3/F6 estarem resolvidos; sem stub e sem trigger server-side, o pagamento confirma o agendamento mas não materializa o card.

## Correções propostas (ondas)

**Onda 1 — vínculo da sessão antes de qualquer cobrança (crítico)**
- Extrair um helper único `ensureSessionStub(appointmentId, sessionId, dados)` usado tanto por `handleGerarCobranca` quanto pelo fluxo "cobrar ao salvar", criando o stub (`status: ''`, `detalhes.stub_cobranca = true`) sempre antes de abrir o `ChargeModal`.
- Remover a dependência de `appointment.sessionId`: gerar/gravar `session_id` no appointment quando ausente.

**Onda 2 — banco: confirmar e materializar**
- Ampliar `tg_cobranca_confirm_appointment` para `status IN ('pago','pago_manual')` e para `AFTER INSERT OR UPDATE`.
- Nova função `ensure_workflow_session_on_confirm()` (trigger em `appointments`, `status → confirmado`): cria `clientes_sessoes` a partir do appointment + pacote quando não existir, ou completa o stub (paridade server-side com `hydrateStubSession`). Resolve F3 sem depender do app aberto.
- Fallback em `ensure_transaction_on_cobranca_paid`: se não achar sessão pelo `session_id`, tentar via `appointments.session_id` antes de zerar o vínculo.

**Onda 3 — UX do painel**
- Ao salvar com status "Pendente" (criação ou edição), abrir o `ChargeModal` automaticamente; manter o switch apenas como opt-out ("não cobrar agora").
- Após gerar o link, exibir ação primária "Enviar ao cliente" (WhatsApp) já presente em `ChargeLinkSection`.
- Assinatura realtime em `cobrancas` + `appointments` dentro do `SessionPanel` para o chip de status virar "Confirmado" sozinho e mostrar o atalho "Abrir no Workflow".

**Onda 4 — verificação**
- Matriz de teste por provedor (Asaas PIX/link/parcelado, Mercado Pago PIX/link, InfinitePay link, PIX manual): cobrança criada → sessão stub existe → webhook → cobrança `pago` → transação com `session_id` preenchido → appointment `confirmado` → card no Workflow com pacote e valor pago corretos.

## Detalhes técnicos
- Arquivos: `src/components/agenda/session-panel/SessionPanel.tsx`, `src/modules/agenda/infrastructure/appointments.supabase.ts`, `src/services/WorkflowSupabaseService.ts`, `src/components/cobranca/ChargeModal.tsx`.
- Banco: `tg_cobranca_confirm_appointment`, `auto_confirm_appointment_on_payment`, `ensure_transaction_on_cobranca_paid`, nova trigger em `appointments`.
- Nenhuma alteração nos webhooks é necessária — a correção é no vínculo e nas triggers.
