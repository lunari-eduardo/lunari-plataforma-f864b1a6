

# Migração Stripe → Asaas (Concluída)

## Implementado

### Edge Functions Asaas (7 funções)
- `asaas-create-customer` — Cria customer no Asaas, salva em photographer_accounts
- `asaas-create-subscription` — Planos Studio mensais (starter/pro/combos)
- `asaas-create-payment` — Planos anuais (pagamento avulso parcelado)
- `asaas-upgrade-subscription` — Prorata combinado, cancela antigas, cria nova
- `asaas-downgrade-subscription` — Agenda downgrade para próxima renovação
- `asaas-cancel-subscription` — Cancel + reactivate
- `asaas-webhook` — Processa eventos, aplica downgrades pendentes

### Banco de Dados
- `get_access_state()` atualizada: lê de `subscriptions_asaas` com fallback para trial em `subscriptions`
- Prioridade: Admin > Authorized > VIP > Asaas Active > Trial > No Sub
- `unified_plans` já populada com studio_starter, studio_pro, combos

### Frontend
- `EscolherPlano.tsx` — Checkout transparente com formulário de cartão inline
- `MinhaAssinatura.tsx` — Gerenciamento via Asaas (cancelar/reativar)
- `LandingPricing.tsx` — Preços atualizados (Starter R$14,90 / Pro R$35,90)
- `useAccessControl.ts` — Suporte a planCode com combo/studio patterns

### Removido
- Edge Functions Stripe (stripe-create-checkout, stripe-webhook, stripe-manage-subscription)
- Sync com Stripe em MinhaConta.tsx

### Secrets configurados
- ASAAS_API_KEY
- ASAAS_ENV
