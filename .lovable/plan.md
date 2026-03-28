

# Diagnóstico: Pagamento Asaas confirmado mas volta para checkout

## Causa Raiz

O fluxo tem uma **falha de confirmação assíncrona** em pagamentos por cartão:

```text
1. Cliente paga via cartão no checkout
2. checkout-process-payment cria pagamento no Asaas
3. Asaas retorna status CONFIRMED (instantâneo em sandbox)
4. Edge Function grava cobrança com status = 'pendente' (correto por design)
5. Frontend mostra "Pagamento aprovado!" (via creditCardStatus === 'CONFIRMED')
6. MAS: cobrança fica 'pendente' no banco → nenhum mecanismo atualiza para 'pago'
```

**Por que não atualiza:**
- O **webhook do Asaas** está configurado na conta da **plataforma**, mas o pagamento foi criado na conta do **fotógrafo** → webhook nunca dispara
- O **polling** (`check-payment-status`) só roda para **PIX**, não para cartão
- O `finalize_gallery_payment` só é chamado pelo **Gallery**, não pelo checkout do Gestão

**Resultado:** ao recarregar a página, `checkout-get-data` vê `status = 'pendente'` e mostra o checkout novamente. No histórico do modal "Cobrar cliente", aparece "Aguardando".

## Solução

### 1. `checkout-process-payment`: criar parcela quando Asaas confirma imediatamente

Após criar o pagamento e receber `CONFIRMED` do Asaas, a Edge Function deve buscar os detalhes do pagamento (`GET /v3/payments/{id}`) para obter `netValue`, e então criar a `cobranca_parcelas` diretamente. Os triggers existentes (`reconcile_cobranca_from_parcelas` → `ensure_transaction_on_cobranca_paid`) fazem o resto automaticamente.

```text
Após paymentData.status === 'CONFIRMED':
  1. GET /v3/payments/{paymentData.id} → obter netValue
  2. INSERT cobranca_parcelas (valor_bruto, valor_liquido, taxa_gateway, status='confirmado')
  3. Trigger reconcile_cobranca_from_parcelas → atualiza cobrança para 'pago'
  4. Trigger ensure_transaction_on_cobranca_paid → cria transação com taxas corretas
  5. Retornar paid: true para o frontend
```

### 2. Frontend: tratar `cobranca.status === 'pago'` no carregamento

`checkout-get-data` já retorna erro quando `status !== 'pendente'`, mas com `code: 'INVALID_STATUS'`. O frontend `PublicCheckout.tsx` deve tratar esse caso mostrando a tela de "Pagamento confirmado" em vez de "Pagamento indisponível".

### 3. Fallback: polling para cartão (safety net)

Caso o fetch do `netValue` falhe ou o Asaas demore a confirmar, adicionar polling de `check-payment-status` também para pagamentos por cartão (similar ao PIX), como rede de segurança.

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/checkout-process-payment/index.ts` | Após CONFIRMED: fetch payment details, criar cobranca_parcelas, retornar paid:true |
| `src/pages/PublicCheckout.tsx` | Tratar status 'pago' no carregamento; adicionar polling para cartão como fallback |

## Impacto

- Pagamento por cartão passa a ser confirmado em tempo real no banco
- Taxas de gateway registradas corretamente desde o momento do pagamento
- Recarregar a página mostra "Pagamento confirmado" em vez do formulário
- Histórico no modal "Cobrar cliente" mostra "Pago" imediatamente

