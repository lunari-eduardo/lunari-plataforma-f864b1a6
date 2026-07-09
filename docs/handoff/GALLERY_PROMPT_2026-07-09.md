# Handoff → Lunari Gallery — Alinhamento com gate de pré-seleção

**Data:** 2026-07-09  
**Origem:** Lunari Gestão (projeto Supabase `tlnjspsywycbudhewsfv`)  
**Destino:** Lunari Gallery (mesmo banco compartilhado)

## Contexto

O Gestão passou a aplicar um **gate de pré-seleção** único nas duas RPCs
compartilhadas para eliminar divergências entre card do Workflow, modal de
pagamentos, CRM e o próprio Gallery. Este documento descreve o novo contrato e
os pontos que o Gallery precisa revisar.

## O que mudou no banco compartilhado

### 1. `workflow_session_financials(uuid)` — RPC principal do Gestão

Enquanto `galerias.status ∈ ('rascunho','enviado','selecao_iniciada')` **e não
houver cobrança paga** vinculada (`cobrancas.finalidade IN
('fotos_extras','sessao_e_extras')` com `status IN ('pago','pago_manual')`), a
RPC retorna:

- `qtd_fotos_extra = 0`
- `qtd_extras_galeria = 0`
- `valor_extras_bruto = 0`
- `valor_extras_com_desconto = 0`
- `extras_liquido = 0`
- `extras_pago = 0`
- `extras_pendente = 0`

Ou seja, o Gestão **ignora** `fotos_selecionadas`/`total_fotos_extras_vendidas`
até a galeria sair da pré-seleção. Base + adicional + produtos − desconto
continuam sendo calculados normalmente.

### 2. `calculate_gallery_extra_payment(uuid)` — RPC usada pelo Gallery

Mesmo gate. Quando em pré-seleção sem cobrança paga, devolve:

```json
{
  "success": true,
  "extras_necessarias": 0,
  "extras_pagas": 0,
  "extras_a_cobrar": 0,
  "valor_pago": 0,
  "valor_total_ideal": 0,
  "valor_a_cobrar": 0,
  "is_fully_paid": true,
  "rules_source": "pre_selecao_gate",
  "pre_selecao": true
}
```

Novo campo booleano **`pre_selecao`**: `true` significa "cliente ainda está
selecionando; não gerar cobrança". Quando `false` (ou ausente em respostas
antigas), o comportamento é o de sempre.

### 3. `sync_gallery_extras_to_session()` — trigger

Passou a respeitar `clientes_sessoes.extras_overridden = true`. Se a sessão
tiver override manual do fotógrafo, o trigger **não sobrescreve**
`qtd_fotos_extra`, `valor_foto_extra` nem `valor_total_foto_extra`. Antes,
qualquer update na galeria apagava o ajuste manual silenciosamente.

## O que o Gallery precisa fazer

### A. Consumir `pre_selecao` no cálculo de cobrança

Todo lugar que chama `calculate_gallery_extra_payment` para decidir se mostra
CTA "Pagar extras", link de checkout ou valor a cobrar deve:

```ts
if (result.pre_selecao === true) {
  // Ainda em seleção. Não exibir botão de pagar / link de cobrança.
  // Continue mostrando "X fotos selecionadas" apenas como feedback visual.
  return;
}
```

Isso alinha o Gallery com o que o card do fotógrafo mostra: extras só existem
para fins financeiros depois da finalização da seleção.

### B. Manter `confirm-selection` como única porta de saída

O endpoint `supabase/functions/confirm-selection/index.ts` (Gallery) hoje faz
UPDATE direto em `clientes_sessoes` (`qtd_fotos_extra`,
`valor_total_foto_extra`, `valor_foto_extra`). Isso continua funcionando
porque o trigger `sync_gallery_extras_to_session` também sincroniza pelo lado
do `galerias.total_fotos_extras_vendidas` — mas os dois caminhos podem
competir. Recomendações:

1. **Preferir** deixar o UPDATE em `galerias` (status → `selecao_completa`,
   `total_fotos_extras_vendidas`, `valor_total_vendido`) disparar o trigger,
   em vez de escrever direto na sessão.
2. Se manter o write direto, garantir que ele **só** rode ao confirmar
   seleção (nunca antes) e que **respeite** `extras_overridden` — se a sessão
   tiver `extras_overridden=true`, não sobrescrever.

### C. Não escrever `qtd_fotos_extra`/`valor_foto_extra` fora do
`confirm-selection`

Nenhum outro fluxo do Gallery deve escrever nesses campos da sessão. Confirmei
no grep atual que só o `confirm-selection` faz isso — mantenha assim.

### D. Status da galeria — vocabulário

O gate depende exatamente destes valores em `galerias.status`:

- Pré-seleção (extras ocultos): `rascunho`, `enviado`, `selecao_iniciada`
- Pós-seleção (extras contam): `selecao_completa`, `finalizada`,
  `entregue`, `pago` (qualquer valor fora do primeiro grupo)

Se o Gallery estiver usando outra string (ex.: `em_selecao`, `revisao`),
avise para atualizarmos o gate no Gestão. Não fazer aliasing local no cliente.

### E. `pre_selecao` no display do Gallery é opcional

Se quiser, o Gallery pode mostrar para o cliente algo como "Sua seleção
ainda está aberta — o pagamento é liberado quando você finalizar", usando o
mesmo flag. Não é obrigatório para o funcionamento correto.

## Como testar do lado Gallery

1. Criar galeria em `rascunho`, cliente seleciona 5 extras.
2. Chamar `calculate_gallery_extra_payment(gallery_id)`.
3. Esperado: `pre_selecao=true`, `valor_a_cobrar=0`. CTA de pagamento não
   deve aparecer.
4. Confirmar seleção → galeria vira `selecao_completa`.
5. Chamar de novo: `pre_selecao=false`, `valor_a_cobrar` com o valor real
   aplicando desconto progressivo e excedente da sessão.

## Contatos e rollback

- Migração aplicada: `20260709xxxxxx_extras_pre_selecao_gate.sql` (Gestão).
- Rollback: reverter as três funções (`workflow_session_financials`,
  `calculate_gallery_extra_payment`, `sync_gallery_extras_to_session`) para a
  versão anterior. Nenhuma tabela mudou de schema.
