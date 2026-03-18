

# Fluxo Completo de Pagamentos Parcelados no Asaas + Diagnóstico do Bug

## Parte 1: Respostas Detalhadas sobre o Asaas

### 1. Como o Asaas cria cobranças parceladas via API

Existem duas formas:

- **Via endpoint `/v3/payments`**: Enviar `installmentCount` + `installmentValue` (ou `totalValue`) junto com os dados de cobrança. Para cartão, inclui dados do cartão. O Asaas cria N cobranças individuais agrupadas por um `installment` ID.
- **Via endpoint `/v3/installments`**: Endpoint dedicado a parcelamentos (2+ parcelas).

Para cobranças avulsas (1x), usar apenas `value` sem os atributos de parcelamento.

Limite: até 21x para Visa/Master em cartão de crédito.

### 2. Diferença entre payment.id e installment.id

- **`payment.id`** (`pay_xxxxx`): Identificador único de cada parcela individual. Cada parcela é uma cobrança independente com seu próprio ciclo de vida (status, vencimento, pagamento).
- **`payment.installment`** (UUID): Identificador do grupo de parcelamento. Todas as parcelas de uma mesma venda compartilham o mesmo `installment` ID. Usar `GET /v3/installments/{id}/payments` para listar todas as parcelas do grupo.

Exemplo: Venda de R$60 em 3x:
```
installment: "abc-123"
├── pay_001 → parcela 1 (R$20, installmentNumber=1)
├── pay_002 → parcela 2 (R$20, installmentNumber=2)  
└── pay_003 → parcela 3 (R$20, installmentNumber=3)
```

### 3. Webhooks disparados para pagamentos parcelados

Cada parcela individual dispara seus próprios webhooks independentemente:

**Cartão de crédito (fluxo normal, sem antecipação):**
```
Parcela 1: PAYMENT_CONFIRMED → (32 dias) → PAYMENT_RECEIVED
Parcela 2: PAYMENT_CONFIRMED → (32 dias) → PAYMENT_RECEIVED
Parcela 3: PAYMENT_CONFIRMED → (32 dias) → PAYMENT_RECEIVED
```

**Com antecipação:**
```
Parcela 1: PAYMENT_CONFIRMED → PAYMENT_ANTICIPATED (2 dias úteis)
```

**Cancelamento/estorno:**
```
PAYMENT_REFUNDED, PAYMENT_CHARGEBACK_REQUESTED, PAYMENT_DELETED
```

Webhooks do Asaas referem-se sempre a cobranças individuais, nunca a parcelamentos ou assinaturas como unidade.

### 4. Diferença entre PAYMENT_CONFIRMED, PAYMENT_RECEIVED e PAYMENT_ANTICIPATED

| Evento | Significado | Dinheiro disponível? | Quando |
|--------|-------------|---------------------|--------|
| **PAYMENT_CONFIRMED** | Pagamento efetuado pelo cliente | NÃO | Imediato (cartão) ou compensação (boleto) |
| **PAYMENT_RECEIVED** | Saldo disponibilizado na conta Asaas | SIM | ~32 dias após confirmação (cartão) |
| **PAYMENT_ANTICIPATED** | Antecipação de recebível creditada | SIM (com desconto) | ~2 dias úteis após solicitação |

Fluxo normal boleto: `CREATED → CONFIRMED → RECEIVED`
Fluxo normal cartão: `CREATED → CONFIRMED → (32d) → RECEIVED`
Fluxo com antecipação: `CREATED → CONFIRMED → ANTICIPATED` (substitui RECEIVED)

### 5. Como funciona o campo netValue em parcelas de cartão

- **`value`**: Valor bruto da parcela (o que o cliente pagou)
- **`netValue`**: Valor líquido que o fotógrafo recebe após desconto de taxas

Exemplo real do sandbox: `value=10, netValue=9.52` → taxa de R$0.48 por parcela.

O `netValue` já está descontado das taxas do gateway (MDR). Em caso de antecipação, o `netValue` sofre desconto adicional da taxa de antecipação.

### 6. Como identificar antecipação de recebíveis via API

- **No webhook de cobrança**: `PAYMENT_ANTICIPATED` + campo `anticipated: true`
- **Webhooks dedicados de antecipação**: `RECEIVABLE_ANTICIPATION_CREDITED`, `RECEIVABLE_ANTICIPATION_DENIED`, etc.
- **Payload da antecipação contém**: `fee` (taxa), `anticipationDays`, `netValue`, `totalValue`
- **Via API**: `GET /v3/anticipations` para listar antecipações

### 7. Solicitar antecipação via API

**SIM**, é possível solicitar antecipação via API:

```
POST /v3/anticipations
{
  "payment": "pay_xxxxx"     // para cobrança avulsa
  // OU
  "installment": "uuid"      // para parcelamento inteiro (cartão)
}
```

Para cartão, pode antecipar o parcelamento completo ou cada parcela individual.
Para boleto, a antecipação é obrigatória por cobrança individual.

A solicitação passa por análise de crédito do Asaas antes de ser aprovada.

### 8. Taxas de antecipação nos webhooks

As taxas de antecipação **aparecem separadas** no webhook de antecipação:

```json
{
  "event": "RECEIVABLE_ANTICIPATION_CREDITED",
  "anticipation": {
    "fee": 5.64,              // taxa de antecipação
    "anticipationDays": 11,
    "netValue": 302.37,       // líquido após TODAS as taxas
    "totalValue": 310,        // valor bruto original
    "value": 308.01           // valor após taxa gateway, antes da antecipação
  }
}
```

Já no webhook `PAYMENT_ANTICIPATED`, o `netValue` da cobrança já vem com a taxa de antecipação descontada. A diferença entre o `netValue` do `PAYMENT_CONFIRMED` e o `netValue` do `PAYMENT_ANTICIPATED` é a taxa de antecipação.

### 9. Parcelas canceladas ou estornadas

- **`PAYMENT_REFUNDED`**: Estorno total ou parcial
- **`PAYMENT_CHARGEBACK_REQUESTED`**: Chargeback do cartão
- **`PAYMENT_DELETED`**: Cobrança removida/cancelada

Quando um parcelamento é cancelado, cada parcela restante recebe `PAYMENT_DELETED` individualmente.

### 10. Reconciliação recomendada pelo Asaas

O Asaas recomenda:
1. Usar webhooks como fonte de verdade (não polling)
2. Implementar idempotência por `payment.id` + `event`
3. Tratar cada parcela como entidade independente
4. Usar `netValue` para valor líquido real
5. Não depender de subscriptions/installments nos webhooks — apenas cobranças individuais

---

## Parte 2: Diagnóstico do Bug (Cobrança R$20 não registrada)

### Evidências

| Dado | Valor |
|------|-------|
| Cobrança R$20 | `aa6425e6`, status=`pendente`, parcelas_pagas=0 |
| installment_id | `2f5cace0-5ee5-4262-bc4c-9403b0ffef41` |
| Webhooks recebidos | 2x `PAYMENT_CONFIRMED` (R$10 cada, netValue=9.52) |
| asaas_webhook_events | `processed: false` |
| cobranca_parcelas | **VAZIA** — nenhuma parcela criada |
| webhook_logs | **VAZIA** — nenhum log de webhook |
| Edge function logs | **Sem logs** |

### Causa raiz

O `webhook_logs` insert no código usa `event_type` como coluna, mas essa coluna **não existe** na tabela `webhook_logs`. Embora o erro seja capturado pelo `.then()`, o fato de não haver logs sugere que o webhook nunca executou, ou seja, **a versão deployada do `asaas-webhook` é antiga**.

Evidência: sem logs no edge function, sem webhook_logs, eventos `processed: false`, parcelas vazias. Tudo indica que o deploy não foi efetivo.

### Problema secundário: `webhook_logs` insert falho

A tabela `webhook_logs` não tem coluna `event_type`. O código tenta inserir com `event_type: event` → erro silencioso. Precisa remover esse campo ou usar o correto.

---

## Parte 3: Plano de Correção e Evolução Arquitetural

### Correção Imediata

1. **Corrigir insert em `webhook_logs`**: Remover `event_type` do insert (coluna não existe)
2. **Redeployar `asaas-webhook`**: Garantir que a versão atual do código seja deployada
3. **Testar com curl**: Após deploy, invocar o webhook com payload simulado para confirmar funcionamento
4. **Reprocessar eventos pendentes**: Os 4 eventos em `asaas_webhook_events` com `processed: false` podem ser reprocessados manualmente via SQL ou re-enviados pelo Asaas

### Modelo de Dados Proposto (evolução)

O usuário sugere 5 camadas: **venda → cobrança → parcela → recebimento → taxa**. O sistema atual tem: cobrança → parcela. Falta separar recebimento e taxa como conceitos distintos.

Porém, para manter a complexidade gerenciável, recomendo **não criar novas tabelas** agora. Em vez disso, enriquecer `cobranca_parcelas` com campos adicionais:

```
cobranca_parcelas (já existe, enriquecer):
├── status: pendente | confirmado | recebido | antecipado | estornado | cancelado
├── valor_bruto (value)
├── taxa_gateway (value - netValue no CONFIRMED)
├── taxa_antecipacao (diferença de net entre CONFIRMED e ANTICIPATED)
├── valor_liquido (netValue final)
├── data_pagamento (clientPaymentDate - quando cliente pagou)
├── data_credito (creditDate - quando dinheiro fica disponível)
├── data_credito_real (preenchido no RECEIVED/ANTICIPATED - quando realmente creditou)
```

O `status` da parcela serve como indicador de recebimento:
- `confirmado` = pago pelo cliente, aguardando D+32
- `recebido` = dinheiro na conta (D+32 completou)
- `antecipado` = dinheiro na conta via antecipação (D+2)

### Tratamento de antecipação

Adicionar handler para webhooks `RECEIVABLE_ANTICIPATION_*`:

```typescript
if (event === "RECEIVABLE_ANTICIPATION_CREDITED") {
  const anticipation = body.anticipation;
  // Atualizar parcela com taxa de antecipação real
  // anticipation.fee é a taxa exata cobrada
}
```

### Exibição para o fotógrafo

No modal financeiro:
- **Valor cobrado**: R$20 (bruto) — abate do pendente do cliente
- **Valor líquido**: R$19.04 (após taxas)
- **Taxa gateway**: R$0.96
- **Taxa antecipação**: R$X.XX (se houver)
- **Data de crédito**: quando o dinheiro estará/esteve disponível

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/asaas-webhook/index.ts` | Remover `event_type` do insert em webhook_logs; adicionar handler para `RECEIVABLE_ANTICIPATION_*` |
| Deploy | Redeployar `asaas-webhook` e testar com curl |
| SQL | Reprocessar eventos pendentes criando parcelas manualmente |

### Sobre o conceito "entrar no financeiro com desconto de taxas"

O sistema atual registra a **transação financeira** (em `clientes_transacoes`) com o valor **bruto** — o que o cliente pagou. Isso é correto para o cálculo de saldo pendente do cliente.

As taxas são informativas para o fotógrafo (quanto ele recebeu de fato). Alterar o valor da transação para líquido criaria divergência entre o que o cliente deve e o que foi registrado.

A abordagem correta é:
1. **Saldo pendente**: calculado sobre valor bruto (o que o cliente deve)
2. **Extrato financeiro do fotógrafo**: mostra bruto, líquido e taxas separados
3. **Relatório fiscal**: usa valor líquido como receita real

Isso não demanda "robustez enorme" — apenas exibir os dados já existentes em `cobranca_parcelas` de forma adequada na UI.

