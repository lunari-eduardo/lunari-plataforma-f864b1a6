

# Checkout Transparente Asaas — Implementado ✅

## Arquitetura

```text
ChargeModal → Asaas → "Gerar Link de Checkout"
  1. Cria registro na tabela cobrancas (status: pendente, sem chamada ao Asaas)
  2. Gera URL interna: {origin}/checkout/{cobrancaId}
  3. Mostra link com botões "Copiar" e "Enviar WhatsApp"

Cliente abre o link → /checkout/:cobrancaId (rota pública)
  1. checkout-get-data busca: cobrança, perfil do fotógrafo, settings Asaas, taxas reais
  2. Renderiza checkout transparente branded (PIX + Cartão)
  3. checkout-process-payment processa pagamento server-side via Asaas API
  4. Polling automático para PIX / confirmação instantânea para Cartão
```

## Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `src/pages/PublicCheckout.tsx` | ✅ Criado — Checkout transparente público |
| `supabase/functions/checkout-get-data/index.ts` | ✅ Criado — Busca dados da cobrança + taxas |
| `supabase/functions/checkout-process-payment/index.ts` | ✅ Criado — Processa pagamento (PIX/Cartão) |
| `src/components/cobranca/ChargeModal.tsx` | ✅ Modificado — Gera link interno |
| `src/App.tsx` | ✅ Modificado — Rota /checkout/:cobrancaId |
| `supabase/config.toml` | ✅ Modificado — Novas funções registradas |

## Segurança

- Edge Functions públicas (verify_jwt=false) mas validam status da cobrança
- API key do Asaas nunca exposta ao frontend
- Cobrança só pode ser paga uma vez (validação de status 'pendente')
- Service Role usado internamente para acessar dados do fotógrafo
