
# Diagnóstico: Webhook Mercado Pago Não Recebe Notificações

## Resumo do Problema

Você fez um pagamento teste de R$5,00 via checkout PIX do Mercado Pago, mas:
- O status da cobrança permaneceu "pendente" no banco
- O pagamento não foi confirmado no checkout nem no workflow
- **Nenhum log aparece no webhook** (zero chamadas recebidas)

## Evidências Encontradas

### 1. Cobrança no Banco (status incorreto)

| Campo | Valor |
|-------|-------|
| id | 044097b2-8a7a-4504-a822-3a8adcc27e9c |
| valor | R$ 5,00 |
| mp_preference_id | 3078306387-b434e3e8-d66e-4019-b540-1f32af0db3e2 |
| mp_payment_id | NULL (deveria ter sido preenchido pelo webhook) |
| status | **pendente** (deveria ser "pago") |
| session_id | workflow-1769982471122-5ax1uk7z2ke |

### 2. Logs do Webhook

```text
Resultado: ZERO logs encontrados
```

Isso significa que o Mercado Pago **nunca chamou** a Edge Function `mercadopago-webhook`.

### 3. Código da Preference (mercadopago-create-link)

```typescript
const preferenceData = {
  items: [...],
  payer: {...},
  external_reference: `${user.id}|${clienteIdFinal}|${textSessionId || 'avulso'}`,
  payment_methods: {...},
  expires: true,
  // ❌ FALTA: notification_url
};
```

**O campo `notification_url` não está sendo enviado na criação da preference!**

---

## Causa Raiz

O Mercado Pago oferece **duas formas** de receber notificações:

1. **Webhook Geral (Dashboard)**: Configurado no painel do MP, recebe TODAS as notificações da conta
2. **notification_url por Preference**: URL específica enviada em cada cobrança

### Problema Atual

- A Edge Function `mercadopago-create-link` **não envia** `notification_url` na preference
- O webhook do Mercado Pago **não está configurado** no painel do aplicativo OAuth
- Resultado: Mercado Pago não sabe para onde enviar as notificações

### Comparação: InfinitePay vs Mercado Pago

| Provedor | Webhook Configurado | Funciona? |
|----------|---------------------|-----------|
| **InfinitePay** | Sim - `webhook_url` enviado em cada chamada | ✅ Funciona |
| **Mercado Pago** | Não - `notification_url` ausente | ❌ Não funciona |

---

## Solução Proposta

Adicionar `notification_url` na criação de preferences do Mercado Pago:

```typescript
// Em mercadopago-create-link/index.ts
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

const preferenceData = {
  items: [...],
  payer: {...},
  external_reference: `${user.id}|${clienteIdFinal}|${textSessionId || 'avulso'}`,
  notification_url: webhookUrl,  // <-- ADICIONAR
  payment_methods: {...},
  expires: true,
  ...
};
```

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/mercadopago-create-link/index.ts` | Adicionar `notification_url` na preference |
| `supabase/functions/gallery-create-payment/index.ts` | Adicionar `notification_url` na seção Mercado Pago |

---

## Mudanças Técnicas

### 1. mercadopago-create-link/index.ts

**Antes (linha 141-162):**
```typescript
const preferenceData = {
  items: [{...}],
  payer: {...},
  external_reference: `${user.id}|${clienteIdFinal}|${textSessionId || 'avulso'}`,
  payment_methods: {
    installments: maxParcelas,
    excluded_payment_types: excludedTypes,
  },
  expires: true,
  expiration_date_from: new Date().toISOString(),
  expiration_date_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};
```

**Depois:**
```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

const preferenceData = {
  items: [{...}],
  payer: {...},
  external_reference: `${user.id}|${clienteIdFinal}|${textSessionId || 'avulso'}`,
  notification_url: webhookUrl,  // <-- NOVO
  payment_methods: {
    installments: maxParcelas,
    excluded_payment_types: excludedTypes,
  },
  expires: true,
  expiration_date_from: new Date().toISOString(),
  expiration_date_to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};
```

### 2. gallery-create-payment/index.ts

**Antes (linha 234-255):**
```typescript
const preferenceData = {
  items: [{...}],
  payer: {...},
  external_reference: `${photographerId}|${clienteId}|${finalSessionId || "avulso"}`,
  payment_methods: {...},
  expires: true,
  ...
};
```

**Depois:**
```typescript
const webhookUrl = `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

const preferenceData = {
  items: [{...}],
  payer: {...},
  external_reference: `${photographerId}|${clienteId}|${finalSessionId || "avulso"}`,
  notification_url: webhookUrl,  // <-- NOVO
  payment_methods: {...},
  expires: true,
  ...
};
```

---

## Fluxo Corrigido

```text
1. Usuario gera link Mercado Pago (ChargeModal)
2. mercadopago-create-link envia preference COM notification_url
3. Cliente paga via PIX no checkout
4. Mercado Pago envia POST para notification_url
5. mercadopago-webhook recebe e processa:
   - Atualiza cobranca.status = 'pago'
   - Cria clientes_transacoes
   - Atualiza clientes_sessoes.valor_pago
6. Frontend reflete o pagamento automaticamente
```

---

## Verificação Pós-Implementação

Após o deploy, ao fazer um novo pagamento teste:

1. Verificar logs do webhook:
   ```
   [mercadopago-webhook] Received: {"type":"payment","data":{"id":"..."}}
   [mercadopago-webhook] Cobrança encontrada por preference_id: xxx
   [mercadopago-webhook] Cobrança atualizada para status: pago
   ```

2. Verificar banco:
   ```sql
   SELECT status, mp_payment_id FROM cobrancas WHERE valor = 5 ORDER BY created_at DESC LIMIT 1;
   -- Esperado: status='pago', mp_payment_id preenchido
   ```

---

## Resumo

| Problema | Causa | Solução |
|----------|-------|---------|
| Webhook não recebe notificações | `notification_url` ausente na preference | Adicionar URL do webhook em cada preference |
| Cobrança permanece pendente | Mercado Pago não sabe onde notificar | Mesmo que acima |
| valor_pago não atualiza | Transação não criada (webhook não executou) | Mesmo que acima |
