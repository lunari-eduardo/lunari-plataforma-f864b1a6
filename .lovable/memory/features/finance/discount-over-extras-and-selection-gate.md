---
name: Discount over extras and pre-selection gate
description: Desconto manual excedente da sessão abate extras; workflow não mostra extras antes de seleção finalizada
type: feature
---
Regras:
- `workflow_session_financials` calcula `v_excedente = max(0, desconto - (base+adicional+produtos))`, limita ao total de extras com desconto progressivo, e expõe `extras_liquido = extras_com_desconto - excedente` e `desconto_aplicado_extras`. `extras_pendente = max(0, extras_liquido - extras_pago)`.
- `calculate_gallery_extra_payment` (usada nas cobranças da galeria) aplica o mesmo excedente da sessão vinculada ao `valor_total_ideal` e `valor_a_cobrar`.
- Trigger `guard_qtd_fotos_extra_pre_selecao` (BEFORE UPDATE em `clientes_sessoes.qtd_fotos_extra`) impede aumento de qtd quando a galeria está em `rascunho|enviado|selecao_iniciada` (a menos que já exista cobrança paga vinculada).
- Edge `gallery-update-session-photos` também gateia: só propaga `qtdFotosExtra` quando `selecaoFinalizada=true` ou status da galeria já saiu do pré-seleção.
- Frontend: hook `useSessionFinancialsWithExtras` retorna `extrasLiquido` e `descontoAplicadoExtras`; a UI mostra pendente de extras baseado em `extras_pendente` (já líquido de desconto).
