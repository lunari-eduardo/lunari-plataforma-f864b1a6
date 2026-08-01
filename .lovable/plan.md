# Checkout público — fim do "pisca-pisca" e coleta de dados do cliente em todos os provedores

## O que está acontecendo hoje

Fluxo atual do link enviado ao cliente (`/l/{cobrancaId}`):

```text
/l/:id  →  edge payment-link-preview  →  302
                                          ├─ infinitepay → /pay/ip/:id  → (form) → redirect externo InfinitePay
                                          └─ demais      → /checkout/:id (PublicCheckout, só Asaas)
```

Problemas confirmados na varredura:

- **P1 — Tela de redirecionamento feia / piscando.** O cliente passa por 3 telas: 302 do edge, boot do SPA (tema escuro por instante, depois forçado para light no `PublicCheckout`), e só então o checkout. No InfinitePay há ainda uma quarta tela ("redirecionando…" + `setTimeout` de 400 ms) antes do site externo.
- **P2 — Mercado Pago não tem checkout próprio.** Uma cobrança com `provedor = 'mercadopago'` é enviada para `/checkout/:id`, mas `checkout-get-data` só busca integração Asaas e responde `NO_INTEGRATION`. O cliente vê erro; o `init_point` do MP nunca é aberto. Nenhum dado é coletado.
- **P3 — PIX manual não tem checkout próprio.** Mesmo caminho do MP: cai em `/checkout/:id` e falha. Não existe página com QR/copia-e-cola do PIX manual nem coleta de dados.
- **P4 — Coleta de dados só existe no Asaas e no InfinitePay.** O Asaas coleta inline e grava no CRM apenas campos vazios (`checkout-process-payment`); o InfinitePay grava via `pay-infinitepay-finalize`. MP e PIX manual não coletam nem gravam nada.
- **P5 — InfinitePay pula o formulário** quando o CRM já tem nome e telefone, então CPF/CNPJ e e-mail ausentes nunca são preenchidos.

## Objetivo

Uma única experiência de checkout, com a marca do fotógrafo, sem piscar, que sempre pede os dados faltantes (Nome, E-mail, CPF/CNPJ, Telefone) e os grava no CRM — para Asaas, Mercado Pago, InfinitePay e PIX manual.

## Onda 1 — Rota única e fim do pisca

- `payment-link-preview`: humano passa a receber **302 direto para `/checkout/:id` em todos os provedores** (inclusive InfinitePay), eliminando o salto extra. A rota `/pay/ip/:id` continua existindo para links antigos.
- `index.html`: script inline anti-flash que aplica tema light e o fundo do checkout antes do React montar quando o path começa com `/checkout`, `/pay` ou `/l`.
- `PublicCheckout`: skeleton branded (logo/nome do fotógrafo vindos do preview) no lugar do spinner cru, sem troca de fundo entre estados.
- `ShareLinkFallback`: passa a renderizar o mesmo skeleton branded em vez da linha "Redirecionando…".

## Onda 2 — Bloco único de dados do pagador (todos os provedores)

- Novo componente `src/pages/checkout/PayerGate.tsx`: formulário compacto com Nome, E-mail, Telefone e CPF/CNPJ, exibindo **apenas os campos faltantes**, com máscaras e validação já existentes (`payerRequirements.ts`, `validateCpfCnpj`).
- Regras por provedor reaproveitadas de `REQUIRED` em `payerRequirements.ts`, estendidas para MP link e PIX manual (nome + e-mail/telefone; CPF quando o provedor exigir).
- Nova edge `checkout-save-payer`: recebe os campos e chama `enrichClienteIfMissing` (nunca sobrescreve dado existente, nunca toca `whatsapp`). Usada por MP e PIX manual; Asaas e InfinitePay continuam gravando no fluxo que já têm.
- InfinitePay deixa de pular o formulário quando faltar CPF/CNPJ ou e-mail (corrige P5).

## Onda 3 — Checkout multi-provedor

- `checkout-get-data`: deixa de assumir Asaas. Passa a devolver `provedor` e o bloco específico:
  - `asaas` → comportamento atual (taxas, PIX, cartão);
  - `mercadopago` → `init_point` salvo em `cobrancas.mp_payment_link`;
  - `infinitepay` → dados para gerar/recuperar o `checkoutUrl`;
  - `pix_manual` → QR e copia-e-cola já persistidos.
  - Sem integração ativa → erro branded, não tela em branco.
- `PublicCheckout` vira um roteador de provedores: mesma casca visual (logo, valor, descrição, selo de segurança) e, abaixo, o painel do provedor. Para MP e InfinitePay o botão "Pagar" só habilita depois do `PayerGate`, e a ida ao site externo acontece por clique do usuário — sem redirecionamento automático piscando.
- PIX manual ganha painel com QR, copia-e-cola e aviso de confirmação manual.

## Onda 4 — Validação

Para cada provedor (Asaas PIX/cartão, Mercado Pago, InfinitePay, PIX manual): abrir `/l/:id` no celular e no desktop e verificar (a) nenhuma tela intermediária visível, (b) campos faltantes solicitados, (c) `clientes` atualizado só nos campos vazios, (d) pagamento conclui e a cobrança muda para `pago`.

## Detalhes técnicos

- Arquivos tocados: `supabase/functions/payment-link-preview/index.ts`, `supabase/functions/checkout-get-data/index.ts`, nova `supabase/functions/checkout-save-payer/index.ts`, `src/pages/PublicCheckout.tsx` (fatiado em `src/pages/checkout/`), `src/pages/pay/InfinitePayCheckout.tsx`, `src/pages/pay/ShareLinkFallback.tsx`, `index.html`, `src/components/cobranca/payerRequirements.ts`.
- Nenhuma migração de banco; a gravação usa o helper `_shared/enrich-cliente.ts` já existente.
- Todas as edges do checkout continuam públicas (`verify_jwt = false`) e só expõem dados públicos da cobrança e do fotógrafo.
- Sem mudança nos triggers financeiros, na conciliação de webhooks ou na materialização de sessão no Workflow.
