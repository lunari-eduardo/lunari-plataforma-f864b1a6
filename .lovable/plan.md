

# Integração Asaas como Método de Cobrança de Clientes

## Visão Geral

Adicionar o Asaas como novo provedor de pagamento para cobranças de clientes, com checkout transparente (PIX + Cartão de Crédito + Boleto), reutilizando a lógica existente no Gallery e mantendo compatibilidade com os provedores já configurados (Mercado Pago, InfinitePay, PIX Manual).

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│                    ChargeModal.tsx                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ProviderSelector (adicionar Asaas)                 │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  AsaasCheckoutSection (novo componente)             │    │
│  │  - Tabs PIX / Cartão / Boleto                       │    │
│  │  - Checkout transparente                            │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│     gestao-asaas-create-payment (Edge Function nova)        │
│  - Usa access_token do fotógrafo (JWT auth)                 │
│  - Cria cliente Asaas se não existir                        │
│  - Gera cobrança PIX / Cartão / Boleto                      │
│  - Salva em cobrancas com provedor='asaas'                  │
└─────────────────────────────────────────────────────────────┘
```

## Implementação

### 1. Assets e Tipos

**Logo Asaas** — Copiar logo do Gallery ou adicionar `src/assets/asaas-logo.png`

**Tipos** — Atualizar `src/types/cobranca.ts`:
- Adicionar `'asaas'` ao tipo `ProvedorPagamento`
- Adicionar campos `asaas_payment_id`, `asaas_customer_id` (ou reutilizar campos MP existentes)

### 2. Configuração do Provedor

**PagamentosTab / Integrações** — Adicionar card Asaas com:
- Campo API Key (oculto com toggle)
- Ambiente (Sandbox/Produção)
- Métodos habilitados (PIX, Cartão, Boleto)
- Máximo de parcelas
- Absorver taxa
- Incluir taxa de antecipação
- Buscar taxas reais da API Asaas

**useIntegracoes.ts** — Adicionar:
- `asaasStatus`, `asaasSettings`
- `saveAsaas()`, `updateAsaasSettings()`, `disconnectAsaas()`

### 3. ProviderSelector

Adicionar opção Asaas:
```typescript
// Check for Asaas
const asaas = integrationData.find(i => i.provedor === 'asaas');
if (asaas) {
  const settings = asaas.dados_extras || {};
  const methods: string[] = [];
  if (settings.habilitarPix) methods.push('Pix');
  if (settings.habilitarCartao) methods.push('Cartão');
  if (settings.habilitarBoleto) methods.push('Boleto');
  
  available.push({
    id: 'asaas',
    name: 'Asaas',
    description: methods.join(' + ') || 'Checkout transparente',
    logo: asaasLogo,
    isDefault: settings.is_default === true,
    provedor: 'asaas',
  });
}
```

### 4. AsaasCheckoutSection (novo componente)

Componente inline no ChargeModal para checkout transparente Asaas:
- **Tabs**: PIX | Cartão | Boleto (baseado em métodos habilitados)
- **PIX**: Gera QR code e copia-e-cola
- **Cartão**: Formulário com máscara (nome, CPF, número, validade, CVV, email, telefone, CEP)
- **Boleto**: Gera URL para download

Reutilizar lógica do `AsaasCheckout.tsx` do Gallery (máscaras, validações, cálculo de taxas).

### 5. Edge Function: gestao-asaas-create-payment

Nova função isolada para o Gestão (não compartilhada com Gallery):

```typescript
// Flow:
// 1. Extrai userId do JWT
// 2. Busca integração Asaas do usuário
// 3. Busca/cria cliente Asaas
// 4. Calcula taxas se cliente paga
// 5. Cria cobrança na API Asaas
// 6. Para PIX: busca QR code
// 7. Salva em cobrancas com provedor='asaas'
// 8. Retorna dados para o frontend
```

### 6. useCobranca.ts

Adicionar rota para Asaas:
```typescript
if (provedor === 'asaas') {
  response = await supabase.functions.invoke('gestao-asaas-create-payment', {
    body: {
      clienteId: request.clienteId,
      sessionId: request.sessionId,
      valor: request.valor,
      descricao: request.descricao,
      billingType, // PIX, CREDIT_CARD, BOLETO
      creditCard, // para cartão
      creditCardHolderInfo,
      installmentCount,
    },
  });
}
```

### 7. ChargeModal.tsx

Adicionar condição para exibir `AsaasCheckoutSection`:
```typescript
const showAsaasSection = selectedProvider === 'asaas';

{showAsaasSection && (
  <AsaasCheckoutSection
    valor={valor}
    settings={asaasSettings}
    onPaymentCreated={(result) => {
      setCurrentCharge({
        pixCopiaCola: result.pixCopiaECola,
        qrCodeBase64: result.pixQrCode,
        paymentLink: result.boletoUrl,
        status: result.paid ? 'pago' : 'pendente',
      });
      setCurrentChargeId(result.cobrancaId);
    }}
    loading={creatingCharge}
  />
)}
```

## Arquivos a Criar/Modificar

**Criar:**
- `src/assets/asaas-logo.png` — Logo do Asaas
- `src/components/cobranca/AsaasCheckoutSection.tsx` — Checkout transparente inline
- `src/components/integracoes/AsaasCard.tsx` — Card de configuração
- `supabase/functions/gestao-asaas-create-payment/index.ts` — Edge Function
- `supabase/functions/asaas-fetch-fees/index.ts` — Buscar taxas (se não existir no projeto)

**Modificar:**
- `src/types/cobranca.ts` — Adicionar 'asaas' ao ProvedorPagamento
- `src/hooks/useIntegracoes.ts` — Adicionar gestão Asaas
- `src/hooks/useCobranca.ts` — Adicionar rota asaas
- `src/components/integracoes/PagamentosTab.tsx` — Incluir AsaasCard
- `src/components/cobranca/ProviderSelector.tsx` — Adicionar opção Asaas
- `src/components/cobranca/ChargeModal.tsx` — Renderizar AsaasCheckoutSection

## Detalhes Técnicos

**Cálculo de Taxas:**
Reutilizar lógica do Gallery (`calcularAntecipacao`) para calcular taxas de processamento e antecipação quando cliente paga.

**Webhook:**
O webhook `asaas-webhook` existente já processa pagamentos e atualiza `cobrancas` — verificar se suporta `provedor='asaas'` para cobranças manuais (não apenas assinaturas).

**Configurações em `dados_extras`:**
```json
{
  "environment": "sandbox" | "production",
  "habilitarPix": true,
  "habilitarCartao": true,
  "habilitarBoleto": false,
  "maxParcelas": 12,
  "absorverTaxa": false,
  "incluirTaxaAntecipacao": true,
  "is_default": false
}
```

