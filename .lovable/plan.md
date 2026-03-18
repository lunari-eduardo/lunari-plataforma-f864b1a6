

# Plano: Visibilidade de Parcelas, Recebimentos e Configurações Asaas

## Problema

O sistema registra a cobrança como "R$100 — Pago" no modal de pagamentos, mas não mostra:
- As 3 parcelas individuais com suas datas de crédito (D+32, D+62, D+92)
- O valor líquido por parcela (após taxas)
- O status de recebimento real (confirmado vs recebido na conta)

Os dados **já existem** em `cobranca_parcelas` (verificado no banco: 3 parcelas com `data_credito` em 20/04, 21/05 e 22/06). O problema é que o frontend nunca consulta essa tabela.

## O que será feito

### 1. Exibir parcelas individuais no histórico de pagamentos

Quando uma cobrança Asaas tem `total_parcelas > 1`, em vez de mostrar uma única linha "R$100 — Pago", mostrar cada parcela separadamente:

```
Parcela 1/3  R$33,33   Confirmado   Crédito: 20/04/2026
             Líquido: R$32,35 (taxa: R$0,98)
Parcela 2/3  R$33,33   Confirmado   Crédito: 21/05/2026
             Líquido: R$32,35 (taxa: R$0,98)
Parcela 3/3  R$33,34   Confirmado   Crédito: 22/06/2026
             Líquido: R$32,35 (taxa: R$0,99)
```

Status de cada parcela:
- **Confirmado** (amarelo): Cliente pagou, dinheiro não disponível ainda (D+32)
- **Recebido** (verde): Dinheiro na conta Asaas
- **Antecipado** (azul): Recebido via antecipação (D+2)

### 2. Buscar `cobranca_parcelas` no `useSessionPayments`

No hook, após buscar cobranças Asaas pagas, também buscar parcelas:

```typescript
// Para cada cobrança Asaas com parcelas, buscar detalhamento
const { data: parcelas } = await supabase
  .from('cobranca_parcelas')
  .select('*')
  .in('cobranca_id', cobrancaIds);
```

Se parcelas existem, gerar uma entrada por parcela no array de pagamentos (em vez de uma entrada por cobrança).

### 3. Atualizar o tipo `SessionPaymentExtended`

Adicionar campos:

```typescript
dataCreditoPrevista?: string;  // Quando o dinheiro estará disponível
statusRecebimento?: 'confirmado' | 'recebido' | 'antecipado' | 'pendente';
```

### 4. Exibir data de crédito no modal

Na coluna "Data / Vencimento", adicionar abaixo da data de pagamento:

```tsx
{payment.dataCreditoPrevista && (
  <div className="text-xs text-muted-foreground">
    💰 Crédito: {formatDateForDisplay(payment.dataCreditoPrevista)}
  </div>
)}
```

### 5. Webhook já funciona corretamente

O webhook já:
- Cria parcelas em `cobranca_parcelas` com `data_credito` do payload Asaas
- Diferencia `PAYMENT_CONFIRMED` (confirmado) vs `PAYMENT_RECEIVED` (recebido) vs `PAYMENT_ANTICIPATED` (antecipado)
- Atualiza status automaticamente via trigger `reconcile_cobranca_from_parcelas`

Não precisa de mudanças no webhook. Tudo é automático via API + webhooks em sandbox.

### 6. Verificação de configurações

A configuração "Absorver taxas" e "Irei antecipar" do painel de integrações são salvas em `usuarios_integracoes.dados_extras`. Verificarei que estão sendo lidas corretamente pelo checkout e pela UI.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useSessionPayments.ts` | Buscar `cobranca_parcelas` e gerar entrada por parcela |
| `src/types/sessionPayments.ts` | Adicionar `dataCreditoPrevista`, `statusRecebimento` |
| `src/components/payments/SessionPaymentsManager.tsx` | Exibir data de crédito e status de recebimento por parcela |

## Fluxo de recebimento (automatizado)

```
Dia 0:  Cliente paga R$100 em 3x cartão
        → Checkout cria cobrança status=pendente
        → Asaas confirma todas as parcelas (PAYMENT_CONFIRMED × 3)
        → Webhook cria 3 parcelas status=confirmado
        → Trigger → cobrança status=pago, valor_liquido=97.05

Dia 32: Asaas libera parcela 1 (PAYMENT_RECEIVED)
        → Webhook atualiza parcela 1 → status=recebido, data_credito_real=hoje

Dia 62: Parcela 2 → recebido
Dia 92: Parcela 3 → recebido
```

Tudo via webhooks, sem intervenção manual. Testável em sandbox (os webhooks PAYMENT_RECEIVED não são enviados automaticamente em sandbox, mas a estrutura está pronta).

