# Atualização dos endpoints InfinitePay Checkout

A InfinitePay desativará as URLs antigas em 01/06/2026. Precisamos trocar o domínio base nos pontos onde o backend chama a API de criação de links.

## Auditoria do projeto

Busquei `api.infinitepay.io`, `checkout.infinitepay.io`, `/invoices/public` e `payment_check` em todo o código (`src/` e `supabase/`). Resultado:

**Endpoint de criação de link (3 ocorrências — todas em edge functions):**
- `supabase/functions/infinitepay-create-link/index.ts:21` — `INFINITEPAY_API_URL` (contrato compartilhado Gallery + Gestão)
- `supabase/functions/gestao-infinitepay-create-link/index.ts:13` — `INFINITEPAY_API_URL` (exclusivo Gestão)
- `supabase/functions/gallery-create-payment/index.ts:192` — `fetch(...)` inline

**Endpoint `payment_check`:** nenhuma ocorrência no projeto. Não usamos esse endpoint hoje, então não há troca a fazer. (As ocorrências de `paymentCheck` encontradas são do Asaas, não da InfinitePay.)

**Frontend / services / hooks:** nenhuma URL da InfinitePay hardcoded. Tudo passa pelas edge functions acima.

**Variáveis de ambiente / secrets:** o domínio não está em `.env` nem em secrets — está literal nos 3 arquivos.

**Webhook (`infinitepay-webhook`):** apenas recebe callbacks, não chama a API. Sem alteração.

## Mudança

Substituir nos 3 arquivos:

```
https://api.infinitepay.io/invoices/public/checkout/links
→ https://api.checkout.infinitepay.io/links
```

Payload, headers, tratamento de resposta (`checkout_url`/`url`/`link`), `order_nsu`, `webhook_url` e fluxo de cobrança permanecem idênticos. Compatibilidade com galerias/sessões existentes é preservada — só o host muda.

## Validação pós-deploy

1. Deploy automático das 3 edge functions.
2. Teste manual: criar um link de cobrança via Gestão (rota de cobrança InfinitePay) → conferir log `[gestao-infinitepay-create-link] Success! Checkout URL: ...` e abrir o checkout.
3. Teste fluxo Gallery: gerar pagamento em uma sessão de seleção via Gallery → conferir log `[gallery-create-payment]` e `[infinitepay-create-link]`.
4. Conferir recepção do webhook (`infinitepay-webhook`) marcando a cobrança como paga após o pagamento de teste.
5. Se a nova API responder erro inesperado, inspecionar logs em Supabase Functions e ajustar parsing se necessário (não esperado — contrato é o mesmo).

## Fora de escopo

- Nenhuma alteração de UI, hooks, types ou DB.
- Nenhuma alteração no webhook ou em `payment_check` (não usamos).
