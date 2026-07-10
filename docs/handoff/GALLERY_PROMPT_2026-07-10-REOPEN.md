# Gallery → Gestão · Reabertura de seleção após pagamento parcial

## Contexto
Após o cliente finalizar a seleção (`status = 'selecao_completa'`) e pagar parte
das fotos extras, é possível reabrir a galeria e selecionar novas fotos. Hoje o
Gallery atualiza `galerias.fotos_selecionadas` corretamente, mas **não emite
sinal explícito** de que houve reseleção; o Gestão só reagia à transição de
status (rascunho/enviado/selecao_iniciada → selecao_completa).

## O que foi feito no Gestão (já em produção)
1. `workflow_session_financials` passa a usar
   `MAX(total_fotos_extras_vendidas, fotos_selecionadas − fotos_incluidas)`
   quando `status = 'selecao_completa'`. Isso já corrige o card, o modal
   de pagamento e o CRM.
2. Trigger `sync_gallery_extras_to_session` passou a reagir também a mudanças
   em `fotos_selecionadas` / `fotos_incluidas` com a galeria já em
   `selecao_completa` (não só na transição). Continua respeitando
   `extras_overridden = true`.

## O que precisamos do Gallery
Nada obrigatório para o Gestão funcionar, mas para consistência:

1. **Sempre atualizar `galerias.fotos_selecionadas`** ao adicionar/remover fotos
   selecionadas, mesmo quando a galeria já está finalizada. (Já é feito, apenas
   confirmar.)
2. **Não zerar `total_fotos_extras_vendidas`** ao reabrir seleção. Esse campo
   deve refletir apenas o que já foi pago/vendido; a quantidade "pendente" é
   derivada de `fotos_selecionadas − fotos_incluidas`.
3. Ao criar cobrança nova para as extras adicionais, usar `finalidade =
   'fotos_extras'` e vincular à mesma `galeria_id`.

Nenhuma mudança de contrato adicional é necessária. Se detectarem regressão
onde `fotos_selecionadas` volta a decrescer ao reabrir, avisar.
