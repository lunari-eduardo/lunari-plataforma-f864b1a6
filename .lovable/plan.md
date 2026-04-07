

# Auditoria de Segurança — Pagamentos e Sistema

## Resumo da análise

Analisei todas as tabelas, políticas RLS, views e edge functions relacionadas a pagamentos. Abaixo classifico cada achado do scan de segurança como **risco real** ou **alarme falso**, com recomendações.

---

## Achados REAIS que precisam de correção

### 1. ERRO CRÍTICO — `credit_purchases`: política UPDATE pública (RISCO REAL)

A política `"System can update pending purchases"` permite que **qualquer pessoa** (anon ou autenticado) atualize compras com `status = 'pending'`, com `WITH CHECK(true)`. Isso significa que um atacante pode:
- Alterar `status` de `pending` → `paid` sem pagar
- Mudar `credits_amount` para ganhar créditos extras
- Redirecionar a compra mudando `user_id`

**Correção**: Remover essa política. As atualizações de `credit_purchases` já são feitas via Edge Function (`asaas-create-payment`) usando `adminClient` (service_role), que **ignora RLS**. A política pública é desnecessária.

### 2. ERRO — `extrato_unificado` sem `security_invoker` (RISCO REAL)

A view `extrato_unificado` **não tem** `security_invoker=on` (as outras views como `faturamento_por_cidade` já têm). Isso significa que a view executa com permissões do **criador** (postgres), ignorando RLS das tabelas base. Um usuário poderia potencialmente ver transações de outros usuários se o frontend não filtrasse por `user_id`.

**Nota**: O frontend já filtra por `user_id`, mas isso é defesa em camada superficial. A view deve respeitar RLS nativamente.

**Correção**: Recriar a view com `WITH (security_invoker=on)`.

### 3. AVISO — `subscriptions_asaas`: política UPDATE pública (RISCO MODERADO)

A política `"Service can update any subscription"` com `USING(true)` e `WITH CHECK(true)` para o papel `public` permite que qualquer pessoa atualize qualquer assinatura. As atualizações legítimas vêm de Edge Functions com `adminClient` (service_role), que já ignora RLS.

**Correção**: Remover essa política. Edge Functions usam service_role e não precisam dela.

### 4. AVISO — `asaas_webhook_events`: RLS desabilitado (RISCO BAIXO)

Tabela usada para receber webhooks do Asaas. RLS está **desativado**. Como é acessada apenas por Edge Functions com service_role, o risco prático é baixo, mas a boa prática é habilitar RLS e criar uma policy para service_role ou nenhuma policy (bloqueia acesso anon/autenticado pelo PostgREST).

**Correção**: Habilitar RLS sem policies — bloqueia acesso via API pública enquanto Edge Functions com service_role continuam funcionando.

---

## Achados que são ALARMES FALSOS (não corrigir)

### 5. `formulario_respostas` INSERT com `WITH CHECK(true)` — ALARME FALSO PARCIAL

Formulários públicos precisam aceitar respostas de anônimos (clientes respondendo questionários do fotógrafo). O `WITH CHECK(true)` é **necessário** para essa funcionalidade. A sugestão de validar `formulario_id` é uma melhoria, mas não é uma vulnerabilidade de pagamentos.

**Decisão**: Não alterar agora — funcionalidade pública legítima.

### 6. Views `faturamento_por_*` como SECURITY DEFINER — ALARME FALSO

O linter reporta "Security Definer View", mas ao verificar, essas views já têm `security_invoker=true`. O alerta pode se referir à `extrato_unificado` que realmente não tem (coberto no item 2).

### 7. Functions sem `search_path` — RISCO TEÓRICO BAIXO

11 funções sem `SET search_path`. Em teoria, um atacante com permissão de criar schemas poderia interceptar chamadas. Na prática, apenas o owner do banco pode criar schemas. Não é risco para pagamentos.

### 8. Vulnerabilidades em `html2pdf.js` e `xlsx` — NÃO AFETAM PAGAMENTOS

São bibliotecas de geração de PDF e planilhas usadas para exportação de dados. As vulnerabilidades (XSS, path traversal) requerem que o atacante injete conteúdo malicioso nos dados exportados. Risco baixo e não relacionado a pagamentos.

---

## Tabelas de pagamento seguras (confirmado)

| Tabela | RLS | Políticas | Status |
|--------|-----|-----------|--------|
| `clientes_transacoes` | Ativo | `auth.uid() = user_id` (ALL) | OK |
| `cobrancas` | Ativo | `auth.uid() = user_id` (ALL) | OK |
| `usuarios_integracoes` | Ativo | `auth.uid() = user_id` (ALL) | OK |

---

## Plano de correção (4 ações)

### Migration SQL

```sql
-- 1. Remover política perigosa de credit_purchases
DROP POLICY IF EXISTS "System can update pending purchases" ON credit_purchases;

-- 2. Remover política perigosa de subscriptions_asaas
DROP POLICY IF EXISTS "Service can update any subscription" ON subscriptions_asaas;

-- 3. Habilitar RLS em asaas_webhook_events (bloqueia acesso via API)
ALTER TABLE asaas_webhook_events ENABLE ROW LEVEL SECURITY;

-- 4. Recriar extrato_unificado com security_invoker
DROP VIEW IF EXISTS extrato_unificado;
CREATE VIEW extrato_unificado WITH (security_invoker=on) AS
  ... (mesma definição atual) ...;
```

### Por que nenhuma funcionalidade é afetada

- **Edge Functions** (webhooks Asaas, criação de pagamento) usam `adminClient` com **service_role**, que **ignora RLS completamente**. Remover políticas públicas não afeta nenhum fluxo.
- **Frontend** acessa `credit_purchases` apenas via SELECT (visualizar compras próprias) — política `"Users can view their own purchases"` permanece.
- **Admin** acessa via `"Admins can manage all purchases"` com `has_role()` — permanece.
- **`extrato_unificado`** já é filtrado por `user_id` no frontend — adicionar `security_invoker` apenas reforça essa proteção no banco.

### Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | 4 alterações de segurança (nenhuma mudança de funcionalidade) |

Nenhum arquivo TypeScript precisa ser alterado.

