

# Diagnóstico: Valores de Taxas Não Aparecem no Modal de Pagamentos

## Descobertas da Investigação

### 1. O Asaas Sandbox FORNECE netValue
Confirmado nos payloads reais do webhook:
```
Parcela 1: value=50, netValue=48.52, creditDate=2026-04-20
Parcela 2: value=50, netValue=48.52, creditDate=2026-05-21
```
Não precisa testar em produção. O sandbox envia todas as informações necessárias.

### 2. A tabela `cobranca_parcelas` está VAZIA
Apesar de os webhooks terem sido recebidos e marcados como `processed: true`, nenhuma parcela foi criada. O upsert está falhando silenciosamente, mas o código marca o evento como processado de qualquer forma.

### 3. Causa provável da falha do upsert
O upsert usa `{ onConflict: "asaas_payment_id" }`, mas na primeira inserção não há conflito. O problema pode ser:
- O supabase-js pode não retornar o erro corretamente sem `.select()` após o upsert
- O `markEventProcessed` roda independente do sucesso do upsert

### 4. O modal mostra R$100 (valor bruto) sem taxas
O `SessionPaymentsManager` exibe `c.valor` (linha 291) da cobrança. Como `valor_liquido` na cobrança é `null` (parcelas não foram criadas, trigger não recalculou), não há informação de taxa para mostrar.

### 5. O valor pendente é calculado corretamente
O trigger `ensure_transaction_on_cobranca_paid` usa `NEW.valor` (bruto = R$100), que é correto para abater do pendente. O que falta é mostrar ao fotógrafo quanto recebeu de líquido.

## Correções Necessárias

### Etapa 1: Corrigir upsert no webhook (asaas-webhook/index.ts)

1. Adicionar `.select()` ao upsert para garantir execução e captura de erro
2. Só marcar evento como `processed` se o upsert teve sucesso
3. Adicionar logs mais detalhados para debug

```typescript
// Em upsertParcela:
const { data, error } = await adminClient
  .from("cobranca_parcelas")
  .upsert(parcelaData, { onConflict: "asaas_payment_id" })
  .select()  // CRUCIAL: garante execução
  .maybeSingle();
```

```typescript
// No bloco principal: só marcar processed se sucesso
if (cobranca) {
  let success = false;
  // ... handle event ...
  success = await upsertParcela(...);
  if (success && payment.id) {
    await markEventProcessed(adminClient, event, payment.id);
  }
}
```

### Etapa 2: Reprocessar eventos existentes

Resetar `processed = false` nos eventos que falharam para que possam ser reprocessados:
```sql
UPDATE asaas_webhook_events SET processed = false WHERE processed = true;
```
Ou criar as parcelas manualmente via SQL com os dados do payload já salvo.

### Etapa 3: Exibir taxas no modal de pagamentos (SessionPaymentsManager)

Quando a cobrança tem `valor_liquido`, mostrar na coluna Valor:
- Valor bruto (o que o cliente pagou) — usado para cálculo de pendente
- Valor líquido (o que o fotógrafo recebeu) — informativo
- Taxa total — informativo

No `useSessionPayments.ts`, ao converter cobranças pagas (linha 289-298):
```typescript
allPayments.push({
  ...
  valor: Number(c.valor) || 0,  // bruto - abate do pendente
  valorLiquido: c.valor_liquido ? Number(c.valor_liquido) : undefined,
  ...
});
```

No `SessionPaymentsManager.tsx`, na coluna Valor:
```tsx
<span className="font-semibold">{formatCurrency(payment.valor)}</span>
{payment.valorLiquido != null && payment.valorLiquido !== payment.valor && (
  <p className="text-xs text-muted-foreground">
    Líquido: {formatCurrency(payment.valorLiquido)}
    {' '}(taxa: {formatCurrency(payment.valor - payment.valorLiquido)})
  </p>
)}
```

### Etapa 4: Suporte a pagamento único (1x) no webhook

Para cobranças sem parcelamento (total_parcelas = 1), o webhook também deve criar uma parcela em `cobranca_parcelas` para manter a consistência. O código atual já faz isso (upsertParcela com numero_parcela=1), só precisa funcionar.

## Arquivos Modificados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/asaas-webhook/index.ts` | Adicionar `.select()` no upsert; condicionar `markEventProcessed` ao sucesso |
| `src/hooks/useSessionPayments.ts` | Passar `valor_liquido` da cobrança para o payment |
| `src/types/sessionPayments.ts` | Adicionar campo `valorLiquido` ao tipo |
| `src/components/payments/SessionPaymentsManager.tsx` | Exibir valor líquido e taxa quando disponível |
| Migration SQL | Reprocessar eventos pendentes |

## Resultado Esperado

```
Modal de Pagamentos:
  R$ 100,00
  Líquido: R$ 97,04 (taxa: R$ 2,96)

Pendente = valor_total - R$ 100,00 (bruto)
```

O valor bruto abate do pendente. O líquido e taxa são informativos.

