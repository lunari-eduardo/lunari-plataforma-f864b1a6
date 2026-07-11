# Handoff Gestão → Gallery — Extras exclusivos do Gallery (2026-07-11)

## Contrato canônico (a partir de agora)

**Cobrança de fotos extras de galeria é EXCLUSIVA do Gallery.**

O Gestão NÃO cria mais cobranças com `finalidade IN ('fotos_extras','sessao_e_extras')`
por nenhum caminho (frontend, edge functions ou SQL direto). Toda cobrança de extras
deve vir do Gallery via edge canônica:

```
POST https://tlnjspsywycbudhewsfv.supabase.co/functions/v1/gallery-create-payment
body: { galleryId, provider? }
```

A edge canônica recalcula pela RPC `calculate_gallery_extra_payment` — nunca receber
`valorTotal` nem `extraCount` do cliente.

## O que mudou no Gestão

### Frontend
- `SessionPaymentsManager.tsx`: botão "Cobrar tudo (1 link)" agora sempre roda a
  **Opção A** (sessão → extras em 2 links sequenciais). O 2º link é gerado via
  `ExtraChargeModal`, que já chama `gallery-create-payment`.
- `WorkflowCardExpanded.tsx` e `ExpandedActions.tsx`: `CombinedChargeModal` e
  a flag `FEATURE_COMBINED_CHARGE` foram desligados/removidos do fluxo de UI.
- `useCobranca.ts` (`createLinkCharge` e `createPixManualCharge`): agora rejeitam
  qualquer `finalidade` diferente de `'sessao'` com toast de erro claro.

### Edge Functions (Gestão)
- `_shared/cobrancaBinding.ts` → `resolveCobrancaBinding` ganhou parâmetro
  `allowedFinalidades: CobrancaFinalidade[] = ['sessao']`. Todas as edges do Gestão
  (`gestao-asaas-create-payment`, `gestao-infinitepay-create-link`,
  `mercadopago-create-link`, `mercadopago-create-pix`) usam o default → rejeitam
  `fotos_extras` e `sessao_e_extras` com código `INVALID_FINALIDADE`.
- `gallery-create-payment` (Gallery) **continua sendo o único ponto** que cria
  cobranças com `finalidade='fotos_extras'`.

## O que o Gallery precisa saber / fazer

1. **Nada a alterar no `gallery-create-payment`** — ele já é a fonte da verdade.
2. Se aparecer qualquer chamada externa (integração de terceiros, script manual,
   RPC, edge não-canônica) criando `cobrancas` com `finalidade IN ('fotos_extras',
   'sessao_e_extras')` para `galeria_id NOT NULL`, **considerar drift** e cancelar.
3. Manter a RPC `calculate_gallery_extra_payment` como única fonte para
   `valor_a_cobrar`, `extras_necessarias`, `extras_pagas`. O Gestão passou a
   confiar 100% nela.
4. Para cobrança combinada (sessão + extras num único link), **não implementar**
   sem antes alinharmos um contrato específico: hoje o produto passa a usar
   sempre 2 links independentes (sessão via Gestão, extras via Gallery).

## Estado atual da galeria de teste `4f985e6a-e7ed-4095-a44c-7eb008265054`

```
cobrancas:
- a9c427bc  sessao_e_extras  R$ 4,00  pago      (legado, aceito)
- 902edaee  fotos_extras     R$ 2,00  cancelado
- 7bd3615d  fotos_extras     R$ 2,00  pago      (canônica Gallery)
- f066c894  fotos_extras     R$ 2,00  cancelado
- 9920321a  fotos_extras     R$ 2,00  cancelado

RPC calculate_gallery_extra_payment:
  extras_necessarias=2, extras_pagas=2, valor_a_cobrar=0 → QUITADA ✓
```

Sem ação necessária. Nenhuma cobrança pendente drift para cancelar.

## Migração futura (opcional, discutir depois)

- Adicionar trigger `BEFORE INSERT ON cobrancas` que exige um GUC
  `lunari.trusted_source='gallery-create-payment'` quando
  `finalidade IN ('fotos_extras','sessao_e_extras')`. Isso fecharia o vetor DB
  para 100%. Postergado — hoje o único vetor conhecido (Gestão) já está fechado
  em frontend + edge functions.
