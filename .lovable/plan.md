

# Checkout Transparente Asaas — Página Pública Interna

## Problema

O botão "Gerar Link de Checkout" está gerando um link externo do Asaas (`sandbox.asaas.com/i/...`) em vez de criar um checkout transparente dentro do sistema Lunari, como já é feito no projeto Gallery.

O Gallery já possui um componente `AsaasCheckout` completo (606 linhas) que processa PIX e Cartão de Crédito diretamente via API, com cálculo de taxas, antecipação e polling de status — tudo sem sair do sistema.

## Solução

Criar uma rota pública `/checkout/:cobrancaId` que renderiza uma página de checkout transparente branded (com logo do fotógrafo), reutilizando a lógica já existente no `AsaasCheckoutSection` deste projeto. O "Gerar Link" criará a cobrança no banco (status `pendente`, sem chamar Asaas ainda) e gerará a URL interna. O pagamento real acontece quando o cliente abre a página e escolhe PIX ou Cartão.

## Fluxo Corrigido

```text
ChargeModal → Asaas → "Gerar Link de Checkout"
  1. Cria registro na tabela cobrancas (status: pendente, sem payment no Asaas ainda)
  2. Gera URL: https://app.lunarihub.com/checkout/{cobrancaId}
  3. Mostra link com botões "Copiar" e "Enviar WhatsApp"

Cliente abre o link:
  /checkout/:cobrancaId (rota pública, sem auth)
  1. Busca dados da cobrança via Edge Function pública
  2. Busca logo/nome do fotógrafo via profiles
  3. Renderiza checkout transparente (PIX + Cartão)
  4. Ao pagar, chama gestao-asaas-create-payment com dados do cartão/PIX
  5. Polling de status para PIX / confirmação instantânea para cartão
```

## Arquivos

### 1. `src/pages/PublicCheckout.tsx` — CRIAR
Página pública de checkout transparente. Sem autenticação necessária.
- Busca dados da cobrança e do fotógrafo via nova Edge Function `checkout-get-data`
- Renderiza logo do fotógrafo, valor, descrição
- Tabs PIX / Cartão com formulário inline (adaptado do `AsaasCheckoutSection` existente)
- Cálculo de taxas e parcelas igual ao Gallery (`asaas-fetch-fees` + `calcularAntecipacao`)
- Polling de status PIX, confirmação instantânea de cartão
- Tela de sucesso após pagamento confirmado

### 2. `src/App.tsx` — MODIFICAR
Adicionar rota pública:
```tsx
<Route path="/checkout/:cobrancaId" element={<PublicCheckout />} />
```

### 3. `supabase/functions/checkout-get-data/index.ts` — CRIAR
Edge Function pública (verify_jwt = false) que retorna os dados necessários para o checkout:
- Busca cobrança por ID (valida que existe e está pendente)
- Busca perfil do fotógrafo (nome, logo)
- Busca configurações Asaas do fotógrafo (métodos habilitados, maxParcelas, absorverTaxa)
- Busca taxas da API Asaas (`/v3/myAccount/fees`) — mesma lógica do `asaas-fetch-fees` do Gallery
- Retorna tudo em uma única chamada (evita múltiplas requisições do frontend)

### 4. `supabase/functions/checkout-process-payment/index.ts` — CRIAR
Edge Function pública (verify_jwt = false) que processa o pagamento:
- Recebe `cobrancaId` + dados de pagamento (billingType, creditCard, etc.)
- Valida que a cobrança existe e está pendente
- Busca integração Asaas do fotógrafo (dono da cobrança)
- Cria/busca customer no Asaas
- Calcula taxas server-side (mesma lógica do `gestao-asaas-create-payment`)
- Cria payment na API Asaas
- Atualiza cobrança no banco (status, mp_payment_id, qr_code, etc.)
- Retorna resultado (QR code para PIX, status para cartão)

### 5. `src/components/cobranca/ChargeModal.tsx` — MODIFICAR
O `handleAsaasGenerateLink` deixa de chamar `gestao-asaas-create-payment` com `billingType: UNDEFINED`. Em vez disso:
1. Insere cobrança no banco diretamente (via Supabase client, sem Asaas)
2. Gera URL interna: `${window.location.origin}/checkout/${cobrancaId}`
3. Seta `currentCharge.paymentLink` com essa URL
4. Transiciona para `ChargeLinkSection` (já existente)

### 6. `supabase/config.toml` — MODIFICAR
Adicionar as duas novas funções com `verify_jwt = false`.

## Segurança

- `checkout-get-data`: Somente leitura, retorna apenas dados públicos (nome, logo, valor). Não expõe API keys.
- `checkout-process-payment`: Valida cobrança existe e está pendente antes de processar. Usa Service Role internamente para acessar integração do fotógrafo. Dados sensíveis (API key Asaas) nunca chegam ao frontend.
- A cobrança só pode ser paga uma vez (validação de status `pendente`).

## Componentes reutilizados
- `calcularAntecipacao` de `src/lib/anticipationUtils.ts` (já existe)
- Lógica de masks e validação do `AsaasCheckoutSection` (copiar para `PublicCheckout`)
- `ChargeLinkSection` para exibir o link gerado (já existe)

