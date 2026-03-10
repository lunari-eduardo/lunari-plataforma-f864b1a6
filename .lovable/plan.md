

# Fix: Fluxo Asaas "Gerar Link de Checkout" e Limpeza do Sistema

## Problemas Identificados

### 1. "Gerar Link de Checkout" abre formulário antigo (Imagens 7-8)
Ao clicar em "Gerar Link de Checkout", o `asaasMode` muda para `'checkout'`, que renderiza o `AsaasCheckoutSection` completo (formulário inline com tabs PIX/Cartão/Boleto). Isso está errado — esse formulário é para checkout transparente presencial, não para gerar link remoto.

**O correto**: Chamar a Edge Function para criar a cobrança Asaas, obter a URL de pagamento do Asaas (`invoiceUrl`), e mostrar o link com botões "Copiar" e "Enviar via WhatsApp" — igual ao fluxo do Mercado Pago/InfinitePay.

### 2. `AsaasCheckoutSection` (596 linhas) é código morto para o fluxo de link
Toda a lógica de formulário de cartão, PIX inline e boleto na `AsaasCheckoutSection` é usada APENAS pelo modo `checkout` do ChargeModal. Com a correção, esse modo não existirá mais — o botão "Gerar Link" gera URL e pronto.

A `AsaasCheckoutSection` pode ser mantida apenas se houver uso futuro (página pública de checkout). Por ora, removemos a referência no ChargeModal.

### 3. Caixa informativa azul hardcoded no `ChargeLinkSection`
Linhas 136-139 e 175-179: `bg-blue-50 border-blue-200 text-blue-700` — não responde ao dark mode.

## Correções

### `src/components/cobranca/ChargeModal.tsx`
- Remover `asaasMode === 'checkout'` e toda referência ao `AsaasCheckoutSection`
- Remover import de `AsaasCheckoutSection`
- O botão "Gerar Link de Checkout" no `AsaasChargeOptions` agora chama uma nova função `handleAsaasGenerateLink` que:
  1. Invoca `gestao-asaas-create-payment` com `billingType: 'UNDEFINED'` (Asaas gera link de pagamento genérico)
  2. Recebe `invoiceUrl` na resposta
  3. Seta `currentCharge.paymentLink` com essa URL
  4. Muda o `asaasMode` para `'link'` para renderizar o `ChargeLinkSection` (reutilizado)
- Remover estado `asaasMode: 'checkout'` — estados válidos serão: `null`, `'options'`, `'pix'`, `'link'`

### `src/components/cobranca/AsaasChargeOptions.tsx`
- Sem mudanças (já tem os dois botões corretos)

### `src/components/cobranca/ChargeLinkSection.tsx`
- Trocar `bg-blue-50 border-blue-200 text-blue-700` por classes theme-aware: `bg-muted/50 border text-muted-foreground`

### `src/components/cobranca/AsaasCheckoutSection.tsx`
- Manter o arquivo (pode ser útil para página pública de checkout futuro)
- Apenas remover referências dele no ChargeModal

## Fluxo Corrigido

```text
Asaas selecionado → AsaasChargeOptions
  ├─ [PIX QR Code] → Edge Function (billingType: PIX) → AsaasPixModal com QR
  └─ [Gerar Link]  → Edge Function (billingType: UNDEFINED) → ChargeLinkSection
                      com botões: Copiar Link | Enviar WhatsApp
```

## Arquivos Modificados
- `src/components/cobranca/ChargeModal.tsx` — remover checkout inline, adicionar fluxo de link
- `src/components/cobranca/ChargeLinkSection.tsx` — fix dark mode na caixa informativa

