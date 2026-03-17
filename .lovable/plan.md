

# Fix: Pagamento Parcelado Registra Apenas Uma Parcela

## Problema Identificado

Quando o cliente paga R$150 em 3x no cartão de crédito:

1. O Asaas cria 1 pagamento "pai" + 3 pagamentos "filhos" (um por parcela)
2. O Asaas dispara `PAYMENT_CONFIRMED` para **cada parcela individualmente**, com o `payment.id` sendo o ID da parcela (diferente do pai)
3. O webhook busca a cobrança por `mp_payment_id = payment.id`, mas a cobrança armazena o ID do pagamento **pai**
4. O campo `payment.installment` no webhook contém o ID do pai — mas o código não o utiliza
5. Resultado: a primeira parcela pode encontrar a cobrança (se o ID coincidir) e registra `valor_liquido = 48.60` (net de UMA parcela de R$50), ou nenhuma parcela encontra

```text
Checkout cria pagamento → Asaas retorna pay_abc (pai)
cobrancas.mp_payment_id = "pay_abc"

Webhook 1: payment.id = "pay_xyz1" (parcela 1), payment.installment = "pay_abc"
  → busca mp_payment_id = "pay_xyz1" → NÃO ENCONTRA (ou encontra errado)

Webhook 2: payment.id = "pay_xyz2" (parcela 2), payment.installment = "pay_abc"
  → mesma coisa
```

## Solução

### 1. Webhook: Buscar cobrança pelo ID pai (`payment.installment`)

No `asaas-webhook`, quando receber `PAYMENT_CONFIRMED`/`PAYMENT_RECEIVED` para pagamento não-subscription:

- Se `payment.installment` existe → usar como chave de busca (é o ID pai)
- Se não existe → usar `payment.id` (pagamento avulso/PIX)
- Marcar como `pago` apenas na **primeira** confirmação (cobrança ainda `pendente`)

### 2. Webhook: Buscar valor líquido total via API Asaas

Para pagamentos parcelados, o `netValue` de cada webhook é apenas de UMA parcela. Para obter o total líquido:

- Chamar `GET /v3/payments?installment={parentId}` na API Asaas
- Somar `netValue` de todas as parcelas retornadas
- Salvar o total em `valor_liquido`

Fallback: se a API falhar, salvar `valor_liquido = null` (o trigger usará `valor` bruto).

### 3. Idempotência

Parcelas subsequentes (webhook 2, 3...) vão tentar atualizar a mesma cobrança que já está `pago`. O filtro `.eq("status", "pendente")` já garante que não será duplicado. Adicionar log informativo.

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/asaas-webhook/index.ts` | Usar `payment.installment` para buscar cobrança; buscar netValue total via API |

## Fluxo Corrigido

```text
1. Checkout cria pagamento 3x → Asaas retorna pay_abc (pai)
   → cobrancas.mp_payment_id = "pay_abc"

2. Webhook parcela 1: payment.installment = "pay_abc"
   → busca mp_payment_id = "pay_abc" ✓
   → chama API: GET /v3/payments?installment=pay_abc
   → soma netValue de 3 parcelas = R$145.32
   → cobrancas: status=pago, valor_liquido=145.32
   → trigger cria transação de R$145.32

3. Webhook parcela 2: payment.installment = "pay_abc"  
   → busca mp_payment_id = "pay_abc" AND status=pendente
   → NÃO encontra (já está pago) → log informativo, sem duplicação ✓
```

