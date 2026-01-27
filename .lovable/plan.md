
# Plano de Correção: Webhook InfinitePay Compatível com Gestão e Gallery

## Diagnóstico do Problema

### O que aconteceu

1. **Pagamento de R$ 2,00 foi feito com sucesso** no checkout InfinitePay
2. **O webhook NÃO foi chamado** pelo InfinitePay (sem logs, sem registro em `webhook_logs`)
3. **Status permanece "pendente"** porque só o webhook atualiza para "pago"

### Evidências encontradas

| Dado | Valor |
|------|-------|
| ID da cobrança | `d2c5f4bd-5332-401e-b80b-fe56916792b7` |
| `ip_order_nsu` | `d2c5f4bd-5332-401e-b80b-fe56916792b7` (UUID) |
| `ip_transaction_nsu` | `NULL` (deveria ter valor do webhook) |
| Status | `pendente` |
| Logs do webhook | **Nenhum** para este order_nsu |

### Por que o webhook não foi chamado?

Possíveis causas (ordem de probabilidade):

1. **Pagamento em modo teste/sandbox** - InfinitePay pode não enviar webhooks para pagamentos simulados
2. **Delay do webhook** - InfinitePay às vezes demora para enviar
3. **Falha silenciosa** - A URL do webhook pode ter sido rejeitada pela InfinitePay

### Situação do código atual

O webhook atual está **correto para o Gestão**:
```typescript
// infinitepay-webhook busca por ID (UUID)
.eq("id", order_nsu)  // ✅ Funciona para Gestão que envia UUID
```

Mas **não suporta o Gallery** que envia formato `gallery-*` como NSU.

---

## Solução Proposta

### Atualizar o webhook com busca dual (fallback)

Modificar `infinitepay-webhook` para buscar por duas estratégias:

```typescript
// 1. Primeiro tentar buscar por ID (UUID) - Gestão
let cobranca = null;

// Verificar se order_nsu é um UUID válido
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = uuidRegex.test(order_nsu);

if (isUuid) {
  // Buscar por ID (padrão Gestão)
  const { data, error } = await supabase
    .from("cobrancas")
    .select("*, clientes(nome)")
    .eq("id", order_nsu)
    .eq("provedor", "infinitepay")
    .maybeSingle();
  
  if (data) cobranca = data;
}

// 2. Se não encontrou, buscar por ip_order_nsu (Gallery)
if (!cobranca) {
  const { data, error } = await supabase
    .from("cobrancas")
    .select("*, clientes(nome)")
    .eq("ip_order_nsu", order_nsu)
    .eq("provedor", "infinitepay")
    .maybeSingle();
  
  if (data) cobranca = data;
}

// 3. Se ainda não encontrou, erro
if (!cobranca) {
  console.error("[infinitepay-webhook] Cobranca not found:", order_nsu);
  return new Response(
    JSON.stringify({ error: "Cobranca not found" }),
    { status: 404 }
  );
}
```

### Adicionar logging na tabela webhook_logs

Registrar todos os webhooks recebidos para debugging:

```typescript
// Logo após receber o payload
await supabase.from("webhook_logs").insert({
  provedor: "infinitepay",
  order_nsu: order_nsu,
  payload: payload,
  headers: Object.fromEntries(req.headers.entries()),
  status: "received",
});
```

### Adicionar verificação manual de status (fallback para webhook falho)

No ChargeModal do Gestão, adicionar botão "Verificar Status" que chama a API do InfinitePay diretamente ou força a atualização:

```typescript
// useCobranca.ts - Nova função
const checkPaymentStatus = async (cobrancaId: string): Promise<boolean> => {
  const { data, error } = await supabase.functions.invoke('check-payment-status', {
    body: { cobrancaId, forceUpdate: true }
  });
  
  if (data?.updated) {
    toast.success('Pagamento confirmado!');
    await fetchCobrancas();
    return true;
  }
  return false;
};
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/infinitepay-webhook/index.ts` | Modificar | Adicionar busca dual (id + ip_order_nsu) e logging |
| `src/hooks/useCobranca.ts` | Modificar | Adicionar função `checkPaymentStatus` |
| `src/components/payments/ChargeModal.tsx` | Modificar | Adicionar botão "Verificar Status" |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  WEBHOOK RECEBE PAGAMENTO                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Extrai order_nsu do payload                                             │
│  2. Verifica se é UUID (regex)                                              │
│     ├─ SIM: Busca por .eq("id", order_nsu) (Gestão)                         │
│     └─ NÃO: Busca por .eq("ip_order_nsu", order_nsu) (Gallery)              │
│  3. Se não encontrou por ID, tenta ip_order_nsu como fallback               │
│  4. Atualiza status para "pago"                                             │
│  5. Cria transação em clientes_transacoes                                   │
│  6. Trigger atualiza valor_pago automaticamente                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Solução Imediata (Sem código)

Para corrigir a cobrança de R$ 2,00 que já está pendente, você pode:

1. **Aguardar** - O webhook pode chegar com delay
2. **Verificar manualmente** - Após a correção, usar o botão "Verificar Status"
3. **Atualizar via SQL** (temporário):

```sql
UPDATE cobrancas 
SET status = 'pago', 
    data_pagamento = now(), 
    ip_transaction_nsu = 'manual-confirmation'
WHERE id = 'd2c5f4bd-5332-401e-b80b-fe56916792b7';
```

---

## Por que o Gallery funcionou e o Gestão não?

Analisando os dados:

| Cobrança | `ip_order_nsu` | Webhook recebido? | Status |
|----------|----------------|-------------------|--------|
| Gestão R$2 | `d2c5f4bd...` (UUID) | **NÃO** | pendente |
| Gallery R$5 | `gallery-1769483972062-pj4o1d` | SIM (mas de teste) | pago |
| Gestão antigo R$5 | `92c90a93...` (UUID) | SIM (real) | pago |

O Gallery teve um webhook de **teste simulado** (veja `transaction_nsu: test-transaction-123`). Isso sugere que houve uma simulação manual de webhook, não um pagamento real.

**Conclusão:** O InfinitePay simplesmente não enviou o webhook para seu pagamento de R$2. Isso pode ser:
- Bug no InfinitePay
- Pagamento em modo sandbox
- Problema temporário

A correção do webhook com busca dual garantirá compatibilidade futura com ambos os projetos.
