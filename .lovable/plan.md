
# Plano Concluído: Créditos no Admin + Sistema de Cupons

## Implementado

1. **Tabela `coupons`** criada com RLS (admins gerenciam, usuários leem ativos)
2. **AdminPlanos.tsx** atualizado com:
   - Seção "Créditos Select" (edição inline de `gallery_credit_packages`)
   - Seção "Cupons de Desconto" (CRUD completo)
3. **`useCouponValidation.ts`** hook criado para validação client-side
4. **Edge Function `asaas-create-subscription`** atualizada para aceitar `couponCode`, validar e aplicar desconto

## Para o Gallery

Enviar instruções para:
- Criar `useCouponValidation` (mesma lógica)
- Ler `gallery_credit_packages` do banco
- Adicionar campo de cupom no checkout
