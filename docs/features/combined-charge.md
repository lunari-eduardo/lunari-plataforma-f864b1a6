# Cobrar tudo (1 link) — sessão + fotos extras

Fluxo de cobrança consolidada que gera **um único link/QR** cobrindo simultaneamente o saldo pendente da sessão e o saldo pendente de fotos extras da galeria vinculada. Ao ser pago, o webhook + triggers de banco dão baixa nos dois saldos de forma atômica, sem duplicar receita.

## Ativação

Feature flag em `src/features/workflow/config.ts`:

```
VITE_FEATURE_COMBINED_CHARGE=true
```

Default `false` (mantém orquestração legada "Opção A" — 2 links em sequência).

## Contrato

- `cobrancas.finalidade = 'sessao_e_extras'`
- `cobrancas.valor_sessao_componente + cobrancas.valor_extras_componente = cobrancas.valor` (±0,01) — validado por CHECK no banco e pelo binding compartilhado nas edge functions.
- `cobrancas.galeria_id` e `cobrancas.qtd_fotos` obrigatórios.

## Camadas

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Banco | `cobrancas` (colunas `valor_sessao_componente`, `valor_extras_componente`) | Guarda o breakdown com CHECK de soma. |
| RPC | `calculate_gallery_extra_payment` | Contabiliza o componente `valor_extras_componente` de cobranças `sessao_e_extras` pagas como "extras pagas". |
| Trigger | `ensure_transaction_on_cobranca_paid` | Rotula a transação como *"Sessão + fotos extras"*. |
| Edge shared | `_shared/cobrancaBinding.ts` | Resolve/valida o binding e cancela cobranças pendentes concorrentes da mesma sessão. |
| Edge providers | `gestao-asaas-create-payment`, `gestao-infinitepay-create-link`, `mercadopago-create-link`, `mercadopago-create-pix` | Aceitam `finalidade='sessao_e_extras'` + componentes. |
| UI | `CombinedChargeModal`, `SessionPaymentsManager`, `ExpandedActions`, `WorkflowCardExpanded` | Botão "Cobrar tudo (1 link)" só aparece quando ambos saldos > 0 e a flag está ativa. |

## Testes recomendados

1. Sessão com R$ 300 pendentes + galeria com R$ 120 pendentes → gerar via Mercado Pago PIX → pagar → conferir:
   - `cobrancas.status='pago'`, componentes preservados.
   - `clientes_transacoes` tem 1 registro (R$ 420) rotulado "Sessão + fotos extras".
   - `calculate_gallery_extra_payment` retorna extras_pagas atualizado; `galerias.status_pagamento='pago'`.
2. Repetir com Asaas e InfinitePay.
3. Tentar gerar uma segunda cobrança pendente na mesma sessão → a primeira `pendente` é cancelada pelo `cancelStalePendingChargesForSession`.
4. Manipular componentes para que a soma ≠ valor → edge rejeita antes do INSERT; ainda que passe, o CHECK do banco impede.

## Rollback

Basta remover a env var (ou setar `false`). Os fluxos legados "Cobrar sessão" e "Cobrar extras" continuam intactos.
