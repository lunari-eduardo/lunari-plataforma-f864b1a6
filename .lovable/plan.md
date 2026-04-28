# Plano: Estorno inteligente por gateway

## Objetivo

Diferenciar o comportamento do botão **Estornar pagamento** conforme o gateway de origem, mantendo sempre o estorno interno (movimentação negativa) como fonte de verdade financeira e adicionando, quando o gateway suportar, a opção de disparar o estorno real na conta do fotógrafo.

Regra imutável preservada:
- Pagamento original **nunca é excluído**.
- Estorno é sempre um **novo registro** (`tipo='estorno'`) em `clientes_transacoes`.
- Estornos parciais/totais atualizam o status apenas via soma (lógica já existente).

---

## 1. Detecção do gateway do pagamento

No `SessionPaymentsManager`, ao clicar em estornar, classificar o pagamento em dois grupos usando `payment.origem`:

- **Grupo Manual** (`manual`, `supabase`, `infinitepay`, `pix_manual`): estorno só interno. InfinitePay não possui API de refund em uso e PIX manual é transferência direta — ambos exigem ação fora do sistema.
- **Grupo Automatizável** (`asaas`, `mercadopago`): oferecer opção de estorno automático via API do gateway.

Para pagamentos do grupo automatizável precisamos também do **ID do pagamento no gateway**, que já existe:
- Asaas: `cobranca_parcelas.asaas_payment_id` (parcelas) ou `cobrancas` com `provedor='asaas'`
- Mercado Pago: `cobrancas.mp_payment_id`

A função `refundPayment` receberá um objeto completo do pagamento (não só id/valor) para poder resolver esses identificadores.

---

## 2. UX do modal de estorno (AlertDialog existente)

Substituir o conteúdo atual do `AlertDialog` por duas variantes visuais baseadas no grupo:

### 2a. InfinitePay / PIX manual (manual)

```
[ícone aviso laranja]  Estornar pagamento

O estorno deste pagamento deve ser realizado manualmente
fora do sistema (no app/painel do seu gateway ou transferência
PIX reversa).

Esta ação registra o estorno apenas como controle financeiro
interno — o dinheiro não será devolvido automaticamente ao cliente.

Valor: R$ XX,XX
[input] Motivo (opcional)

[Cancelar]  [Registrar estorno interno]
```

### 2b. Asaas / Mercado Pago (automatizável)

```
[ícone refresh]  Estornar pagamento

Este pagamento foi processado via Asaas (ou Mercado Pago).
Você pode realizar o estorno diretamente na sua conta de
pagamento — o valor será devolvido ao cliente.

Valor: R$ XX,XX
[input] Motivo (opcional)

[checkbox] ☑ Realizar estorno automaticamente no gateway
           (marcado por padrão)

Se desmarcar, apenas o controle interno será registrado;
o estorno real deverá ser feito manualmente no painel do gateway.

[Cancelar]  [Confirmar estorno]
```

Estado interno: `autoRefund: boolean` (default `true` para automatizáveis, `false` para manuais).

---

## 3. Edge Functions novas

Criar duas funções isoladas, cada uma resolvendo credencial multi-tenant via `usuarios_integracoes` (padrão já adotado em `gestao-asaas-create-payment`):

### `gestao-asaas-refund`
- Input: `{ cobrancaId, parcelaId?, valor?, motivo? }`
- Resolve `access_token` Asaas do usuário logado.
- Lê `asaas_payment_id` da parcela (ou cobrança) correspondente.
- Chama `POST https://api.asaas.com/v3/payments/{id}/refund` com body `{ value, description }` (Asaas suporta parcial).
- Retorna `{ success, refundId, status }` ou erro com mensagem do Asaas.

### `gestao-mercadopago-refund`
- Input: `{ cobrancaId, valor?, motivo? }`
- Resolve token MP do usuário (tabela `usuarios_integracoes`, provedor `mercadopago`).
- Chama `POST https://api.mercadopago.com/v1/payments/{mp_payment_id}/refunds` com body `{ amount }` (omitido = total).
- Retorna `{ success, refundId, status }`.

Ambas com JWT obrigatório (não são compartilhadas com Gallery).

---

## 4. Fluxo no frontend (`refundPayment`)

Refatorar `refundPayment` no `useSessionPayments.ts`:

```
refundPayment(payment, { motivo, autoRefund }):
  if (autoRefund && grupoAutomatizavel) {
    resp = invoke edge function (asaas ou mp)
    if (!resp.success) {
      toast.error(resp.error)
      return false    // NÃO registra estorno interno
    }
    motivoFinal = motivo + ' [Estornado no gateway]'
  } else {
    motivoFinal = motivo
  }
  PaymentSupabaseService.refundPayment(...)  // registro interno sempre
```

Regras:
- Falha no gateway **aborta** o estorno (não cria registro interno) — evita descasamento.
- Sucesso no gateway **sempre** cria o registro interno com tag `[Estornado no gateway]` para auditoria.
- Sem auto refund: comportamento atual (apenas interno).

---

## 5. Atualização de status de cobrança (opcional mas recomendado)

Quando o estorno automático for executado com sucesso:
- Atualizar `cobrancas.status` para `cancelado` (total) ou manter `pago` com flag em `dados_extras.refunded_at` (parcial).
- Para Asaas: webhook `PAYMENT_REFUNDED` já existe no projeto? Verificar no `asaas-webhook` — se sim, a atualização virá automática e evita race. Se não, atualizar no retorno da edge function.
- Para MP: webhook `payment.updated` com status `refunded` → adicionar handler em `mercadopago-webhook` (já mapeia `refunded: 'cancelado'`, mas não cria estorno interno — manter assim para evitar duplicação com o registro já criado pelo frontend).

---

## 6. Arquivos a alterar

**Frontend**
- `src/components/payments/SessionPaymentsManager.tsx` — reescrever AlertDialog com duas variantes, adicionar checkbox `autoRefund`, passar `payment` completo para `refundPayment`.
- `src/hooks/useSessionPayments.ts` — assinatura nova `refundPayment(paymentId, { motivo, autoRefund })`, lógica condicional de invocação da edge function.
- `src/services/PaymentSupabaseService.ts` — aceitar `motivo` já formatado (sem mudança estrutural).

**Backend**
- `supabase/functions/gestao-asaas-refund/index.ts` (novo)
- `supabase/functions/gestao-mercadopago-refund/index.ts` (novo)
- `supabase/config.toml` — registrar as duas funções com `verify_jwt = true`.

**Opcional (hardening)**
- `supabase/functions/asaas-webhook/index.ts` — garantir handler para `PAYMENT_REFUNDED` que atualize a cobrança (sem duplicar estorno interno).

---

## 7. Casos de borda tratados

| Cenário | Comportamento |
|---|---|
| Pagamento manual / PIX manual | Modal mostra aviso, grava só estorno interno |
| Pagamento InfinitePay | Mesmo do manual (sem API de refund integrada) |
| Asaas com parcelas, usuário estorna 1 parcela | Envia `asaas_payment_id` da parcela ao endpoint; Asaas faz refund parcial |
| Gateway retorna erro (saldo insuficiente, pagamento já estornado, etc.) | Toast com erro do gateway, nada é gravado |
| Checkbox desmarcado em Asaas/MP | Só registro interno; label adiciona `(estorno manual no gateway)` |
| Estorno parcial (futuro) | Fora do escopo agora; valor = valor total do pagamento selecionado |

---

## Resumo de entregáveis

1. Modal com dois modos e checkbox `Realizar estorno automaticamente`
2. Duas edge functions de refund (Asaas, MP) com resolução multi-tenant
3. Hook `refundPayment` condicional: gateway → interno, só interno se desmarcado, abort em erro
4. Registro interno mantido como fonte única de verdade financeira
5. Textos e UX exatamente conforme especificado pelo usuário