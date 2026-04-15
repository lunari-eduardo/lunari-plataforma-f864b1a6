

# Fix: "Pago manualmente" na Gallery mostra "Pendente" no Workflow

## Causa raiz

O componente `FotosExtrasPaymentBadge` só reconhece 3 valores: `sem_vendas`, `pendente` e `pago`. Quando a Gallery marca como "pago manualmente", o banco salva `pago_manual` em `status_pagamento_fotos_extra`. Como `pago_manual !== 'pago'`, o badge cai no else e exibe **"Pendente"** — incorretamente.

O trigger `finalize_gallery_payment` e o `sync_gallery_status_to_session` funcionam corretamente — o valor `pago_manual` chega à tabela `clientes_sessoes`. O problema é exclusivamente no frontend.

## Correção

### Arquivo: `src/components/workflow/FotosExtrasPaymentBadge.tsx`

1. Expandir o tipo para incluir `'pago_manual'`
2. Tratar `pago_manual` como pago (badge verde com label "Pago")

```typescript
interface FotosExtrasPaymentBadgeProps {
  status: 'sem_vendas' | 'pendente' | 'pago' | 'pago_manual' | undefined;
}

// Na lógica:
const isPago = status === 'pago' || status === 'pago_manual';
const config = isPago ? { /* verde, "Pago" */ } : { /* laranja, "Pendente" */ };
```

Alteração de 1 arquivo, ~3 linhas.

