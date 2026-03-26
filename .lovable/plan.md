

# Correção: Origem errada no Extrato + Taxas não registradas em pagamentos Gallery

## Problemas Identificados (com evidências do banco)

### Problema 1: Pagamentos manuais mostram badge "Gallery"

A view `extrato_unificado` faz JOIN com `cobrancas` por `session_id`:
```sql
LEFT JOIN cobrancas cob ON (cob.session_id = ct.session_id AND cob.user_id = ct.user_id AND cob.status = 'pago')
```
Se uma sessão tem QUALQUER cobrança paga com `galeria_id`, TODAS as transações da sessão (incluindo manuais como "Entrada do agendamento") recebem `origem = 'gallery'`.

**Evidência**: As transações `54581ee0` e `d970e0a5` (descrição "Entrada do agendamento") estão ligadas a sessões que também têm cobranças Asaas com `galeria_id`, então o JOIN retorna o provedor e a galeria errados.

### Problema 2: Taxas absorvidas não registradas

Cadeia de falha comprovada:
1. `checkout-process-payment` cria pagamento na conta Asaas do **fotógrafo** (usando `integracao.access_token`)
2. Asaas sandbox confirma instantaneamente
3. Webhook nunca chega (nenhum evento em `asaas_webhook_events` para esses payments)
4. Gallery chama o RPC `finalize_gallery_payment` que muda status direto para `'pago'` **sem** criar `cobranca_parcelas`
5. Trigger `ensure_transaction_on_cobranca_paid` dispara, mas `cobrancas.valor_liquido = NULL` → `taxa_gateway = 0`
6. Nenhuma linha de taxa aparece no extrato

**Evidência banco**: Cobranças `88730b83` e `7f961770` têm `status='pago'`, `parcelas_pagas=0`, `valor_liquido=NULL`, e zero registros em `cobranca_parcelas`.

Agravante: `check-payment-status` usa `ASAAS_API_KEY` da plataforma (env var), mas os pagamentos foram criados na conta Asaas do fotógrafo. A API retorna vazio porque são contas diferentes.

---

## Plano de Correção

### 1. Corrigir origem no `extrato_unificado` — adicionar `cobranca_id` em `clientes_transacoes`

Adicionar coluna `cobranca_id` na tabela `clientes_transacoes` para vincular diretamente qual cobrança gerou aquela transação.

**Migração SQL:**
- `ALTER TABLE clientes_transacoes ADD COLUMN cobranca_id UUID REFERENCES cobrancas(id)`
- Atualizar `ensure_transaction_on_cobranca_paid` para popular `cobranca_id = NEW.id` no INSERT
- Backfill: extrair UUID de cobranças já existentes a partir da `descricao` (formato "cobranca UUID")
- Recriar `extrato_unificado` usando `LEFT JOIN cobrancas cob ON cob.id = ct.cobranca_id` em vez do JOIN por `session_id`

**Resultado**: Pagamentos manuais terão `cobranca_id = NULL` → `galeria_id IS NULL` → `origem = 'workflow'`

### 2. `check-payment-status` usar chave do fotógrafo

Atualizar a função para buscar `access_token` e `dados_extras.environment` de `usuarios_integracoes` do fotógrafo (via `cobranca.user_id`), em vez de usar a variável de ambiente `ASAAS_API_KEY`.

**Arquivo**: `supabase/functions/check-payment-status/index.ts`
- Remover `getAsaasConfig()` global
- Dentro de `handleAsaasInstallmentCheck` e `handleAsaasSinglePaymentCheck`, buscar a integração do fotógrafo:
  ```ts
  const { data: integracao } = await supabase
    .from('usuarios_integracoes')
    .select('access_token, dados_extras')
    .eq('user_id', cobranca.user_id)
    .eq('provedor', 'asaas')
    .eq('status', 'ativo')
    .maybeSingle();
  ```
- Usar `integracao.access_token` como API key e `dados_extras.environment` para determinar a baseUrl

**Resultado**: O polling de status consegue consultar a API Asaas correta, criar `cobranca_parcelas` com `netValue`, e os triggers fazem o resto (registrar taxas).

### 3. `finalize_gallery_payment` — safety net para `valor_liquido`

Atualizar o RPC para, antes de marcar como 'pago', verificar se `cobranca_parcelas` existem. Se existirem, deixar o trigger `reconcile_cobranca_from_parcelas` cuidar do status. Se não, tentar buscar `valor_liquido` via parcelas existentes ou marcar para reconciliação posterior.

**Migração SQL**: Alterar a função `finalize_gallery_payment` para não setar `status = 'pago'` diretamente se a cobrança for Asaas com `mp_payment_id` — nesse caso, delegar ao `check-payment-status` que agora funciona corretamente.

### 4. Deploy e correção retroativa

- Deploy das funções atualizadas: `check-payment-status`
- Migração SQL: adicionar `cobranca_id`, backfill, recriar view, atualizar triggers
- Para as 2 cobranças afetadas (hoje), chamar `check-payment-status` manualmente para criar as parcelas com taxas corretas

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Adicionar `cobranca_id` em `clientes_transacoes`, backfill, recriar `extrato_unificado`, atualizar `ensure_transaction_on_cobranca_paid` |
| Nova migração SQL | Atualizar `finalize_gallery_payment` com safety net |
| `supabase/functions/check-payment-status/index.ts` | Usar chave Asaas do fotógrafo em vez da plataforma |

## Impacto

- Pagamentos manuais param de mostrar badge "Gallery" no extrato
- Taxas absorvidas são registradas corretamente como despesas
- `check-payment-status` funciona para qualquer fotógrafo independente da conta Asaas
- Sem breaking changes — backfill mantém dados históricos

