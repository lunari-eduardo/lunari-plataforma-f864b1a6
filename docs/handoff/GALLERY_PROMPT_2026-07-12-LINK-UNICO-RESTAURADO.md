# Handoff → Gallery: "Cobrar tudo" volta ao link único (`sessao_e_extras`)

Data: 2026-07-12
Origem: Gestão (Lunari Hub)

## Contexto
Na iteração de 2026-07-11 desligamos temporariamente o botão "Cobrar tudo"
com finalidade `sessao_e_extras` no Gestão e forçamos 2 links sequenciais
(sessão via Gestão → extras via `gallery-create-payment`). O usuário
reportou UX ruim: dois modais em fila, dois envios de link.

## O que mudou agora (Gestão)
1. `_shared/cobrancaBinding.ts`: `allowedFinalidades` default volta a
   incluir `sessao_e_extras`. `fotos_extras` PURA continua fora da
   whitelist do Gestão.
2. `useCobranca.ts`: guardas de client-side agora bloqueiam apenas
   `fotos_extras`; permitem `sessao_e_extras`.
3. `WorkflowCardExpanded` + `SessionPaymentsManager`: revertidos para
   abrir `CombinedChargeModal` (single link). Rótulo do dropdown passou
   de "· 2 links" para "· 1 link único".
4. `createPixManualCharge` agora propaga `galeria_id`,
   `valor_sessao_componente`, `valor_extras_componente`,
   `snapshot_fotos_incluidas` e `qtd_fotos` quando finalidade é
   combinada.

## O que NÃO mudou (contrato firme)
- Cobrança isolada de fotos extras (`finalidade = 'fotos_extras'`) segue
  EXCLUSIVA do Gallery (`gallery-create-payment`). Nenhuma edge do
  Gestão pode criá-la.
- Cálculo do componente de extras continua vindo da RPC canônica
  `calculate_gallery_extra_payment`. Os guards
  (`assertExtraPaymentWithinIdeal`) já validam o
  `valor_extras_componente` das cobranças combinadas.
- Webhook de pagamento (`sessao_e_extras`) já dispara
  `finalize_gallery_payment` — Gallery só precisa continuar assinando
  `cobrancas` e reagindo ao status `pago` como já faz.

## Ação necessária no Gallery
Nenhuma alteração de código obrigatória. Confirmar que:
1. Assinatura Realtime de `cobrancas` para a galeria continua reagindo a
   cobranças com `finalidade IN ('fotos_extras','sessao_e_extras')`.
2. UI da galeria (badge "Pago"/"Pendente") lê os campos calculados
   pelos triggers pós-pagamento (`valor_pago`, `status_pagamento`) — que
   o Gestão continua atualizando via triggers de DB.

Se algum ponto do Gallery ainda depender de `finalidade = 'fotos_extras'`
para sinalizar "cobrança encerrada", trate `sessao_e_extras` como
equivalente para fins de status da galeria.
