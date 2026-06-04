
## Diagnóstico atual (auditoria)

Mapeei todas as edge functions e o caminho das chaves Asaas. Existem **duas camadas já implementadas**, mas **um ponto de cruzamento** precisa ser corrigido.

### Camada 1 — Cobranças dos fotógrafos (isolada por `user_id`)
Todas estas funções leem a chave de `usuarios_integracoes` filtrando por `user_id + provedor='asaas' + status='ativo'`:

- `gestao-asaas-create-payment`
- `gestao-asaas-refund`
- `gestao-asaas-anticipation`
- `checkout-get-data`
- `checkout-process-payment`
- `gallery-create-payment` (via mesmo padrão; compartilhado com Gallery)

A tabela tem RLS `auth.uid() = user_id` e índice/uso por usuário. **Não há possibilidade de uma empresa ler/sobrescrever a chave de outra** pela API pública. ✅

### Camada 2 — Assinaturas Lunari (chave global `ASAAS_API_KEY`)
Usam `Deno.env.get("ASAAS_API_KEY")`:

- `asaas-create-customer`, `asaas-create-subscription`, `asaas-create-payment`
- `asaas-cancel-subscription`, `asaas-upgrade-subscription`, `asaas-downgrade-subscription`
- `asaas-webhook`

Essas funções **nunca** tocam em `usuarios_integracoes`. ✅ Separadas.

### 🚨 Risco identificado — único ponto de cruzamento
`supabase/functions/check-payment-status/index.ts` (linhas 153-161): se o fotógrafo não tiver integração ativa, faz **fallback para `ASAAS_API_KEY` da plataforma** para consultar status da cobrança. Isso significa que:

- Uma cobrança do fotógrafo pode ser consultada (e ter `cobrancas`/`cobranca_parcelas` atualizadas) contra a conta Asaas do **Lunari**, não a dele.
- Risco real: status incorreto/falso-positivo de pagamento, contaminação de dados financeiros e quebra do princípio de isolamento.

### Riscos menores / hardening recomendado
1. `usuarios_integracoes.access_token` é `text` em claro — sem criptografia em repouso (só RLS protege).
2. `is_default` permite múltiplas integrações Asaas por usuário; hoje a query usa `maybeSingle()` sem `order by is_default` — se um usuário tiver duas linhas `ativo`, retorna erro ou linha arbitrária.
3. Webhook do Asaas (`asaas-webhook`) é da camada plataforma — confirmar que não há webhook único compartilhado para fotógrafos (cada fotógrafo usa seu próprio webhook configurado no painel Asaas dele).

---

## Correções de segurança (Etapa 1)

### 1.1 Remover fallback perigoso em `check-payment-status`
Eliminar o uso de `ASAAS_API_KEY` quando o `user_id` da cobrança não tem integração ativa. Comportamento novo:

- Se não houver integração ativa do fotógrafo → retornar `{ skipped: true, reason: 'no_active_integration' }` (status 200, sem consultar Asaas).
- Logar para observabilidade, sem alterar `cobrancas`/`cobranca_parcelas`.

### 1.2 Garantia de seleção determinística da integração
Em **todas** as funções da Camada 1, ajustar a query para:
```ts
.eq('user_id', userId)
.eq('provedor', 'asaas')
.eq('status', 'ativo')
.order('is_default', { ascending: false })
.order('updated_at', { ascending: false })
.limit(1)
.maybeSingle();
```
Evita ambiguidade caso existam duas linhas ativas.

### 1.3 Defesa em profundidade (DB)
Migration adicionando índice único parcial:
```sql
CREATE UNIQUE INDEX uniq_user_provedor_default_ativo
  ON public.usuarios_integracoes(user_id, provedor)
  WHERE status = 'ativo' AND is_default = true;
```
Garante no máximo uma integração default ativa por (user, provedor).

### 1.4 Asserção de propriedade nas funções de cobrança
Em `gestao-asaas-create-payment`, `gestao-asaas-refund`, `gestao-asaas-anticipation`, antes de chamar a API Asaas:
- Verificar que `cobranca.user_id === userId` (usuário autenticado).
- Em refund/anticipation: re-consultar o pagamento na Asaas com a chave do fotógrafo e validar que `payment.customer` pertence à mesma conta antes de operar. Se a API responder 401/404 → abortar com erro explícito (sinal de chave de outra empresa).

### 1.5 Marcação explícita de "uso plataforma"
Renomear, internamente, todas as referências de `ASAAS_API_KEY` em comentários/logs para `PLATFORM_ASAAS_API_KEY` (sem mudar o nome do secret) e adicionar comentário no topo de cada função da Camada 2:
```
// PLATAFORMA LUNARI — usa exclusivamente a chave Asaas do sistema.
// NUNCA usar para cobranças de fotógrafos.
```

---

## Nova área Admin — "Integrações Financeiras" (Etapa 2)

### 2.1 Estrutura
Adicionar nova aba em `src/pages/AdminUsuarios.tsx` (já tem `Tabs` com users/subscriptions/strategy/emails) → nova aba **"Integrações Financeiras"** (`value="platform-integrations"`).

Componente: `src/components/admin/PlatformIntegrationsTab.tsx`.

### 2.2 Card "Asaas — Assinaturas do Lunari"
Campos exibidos:
- **Ambiente** (Sandbox / Produção) — select
- **API Key** — input password (mascarado, mostra últimos 4 dígitos)
- **Status da conexão** — badge (Conectado / Desconectado / Erro)
- **Data da última atualização** — `updated_at`
- **Botão "Testar conexão"** — chama `GET /v3/customers?limit=1` com a chave salva
- **Botão "Salvar"**

### 2.3 Armazenamento
Criar tabela dedicada (somente admins):

```sql
CREATE TABLE public.platform_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,          -- 'asaas'
  scope text NOT NULL,             -- 'subscriptions'
  environment text NOT NULL,       -- 'sandbox' | 'production'
  api_key_encrypted text NOT NULL, -- criptografado via pgsodium ou armazenado em Vault
  last_test_at timestamptz,
  last_test_status text,           -- 'ok' | 'error'
  last_test_message text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider, scope)
);
GRANT SELECT, INSERT, UPDATE ON public.platform_integrations TO authenticated;
GRANT ALL ON public.platform_integrations TO service_role;
ALTER TABLE public.platform_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins manage platform integrations"
  ON public.platform_integrations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

Para nunca expor a chave ao client: o `SELECT` retorna apenas metadados; a leitura da chave em texto plano só acontece **dentro de edge functions** (service role).

### 2.4 Edge functions de suporte
- `admin-platform-integration-upsert` — recebe `{ provider, scope, environment, apiKey }`, valida admin via `has_role`, salva criptografado.
- `admin-platform-integration-test` — valida admin, busca a chave, faz `GET /v3/customers?limit=1`, persiste `last_test_*`.

### 2.5 Refator das funções da Camada 2
Criar helper compartilhado `supabase/functions/_shared/platform-asaas.ts`:
```ts
export async function getPlatformAsaasConfig(adminClient): Promise<{ apiKey, baseUrl }> {
  const { data } = await adminClient
    .from('platform_integrations')
    .select('environment, api_key_encrypted')
    .eq('provider','asaas').eq('scope','subscriptions').maybeSingle();
  if (data) return { apiKey: decrypt(data.api_key_encrypted), baseUrl: data.environment === 'production' ? 'https://api.asaas.com' : 'https://api-sandbox.asaas.com' };
  // fallback transicional
  return { apiKey: Deno.env.get('ASAAS_API_KEY'), baseUrl: ... };
}
```

Todas as funções `asaas-*` (assinaturas) passam a usar esse helper. Durante a transição mantemos o fallback para `ASAAS_API_KEY`; depois que o admin salvar a chave no novo painel, o secret pode ser removido.

### 2.6 Isolamento garantido
- Funções da Camada 1 (`gestao-asaas-*`, `checkout-*`, `gallery-create-payment`) **não importam** `platform-asaas.ts` nem leem `ASAAS_API_KEY`.
- Funções da Camada 2 (`asaas-*` de assinatura) **não consultam** `usuarios_integracoes`.
- Compatibilidade com Gallery preservada — todas as funções `gestao-*` continuam idênticas.

---

## Plano de execução

1. **Migration**: criar `platform_integrations` + índice único em `usuarios_integracoes`.
2. **Correção segurança**: remover fallback em `check-payment-status`; aplicar `order/limit` determinístico nas 6 funções de fotógrafo; adicionar asserção `cobranca.user_id === userId` em create-payment/refund/anticipation.
3. **Helper** `_shared/platform-asaas.ts` + refator das 7 funções `asaas-*` de assinatura.
4. **Edge functions admin**: `admin-platform-integration-upsert`, `admin-platform-integration-test`.
5. **UI**: nova aba "Integrações Financeiras" + `PlatformIntegrationsTab.tsx` com card Asaas.
6. **QA**: testar (a) criação de cobrança por fotógrafo continua usando a chave dele, (b) assinatura Lunari usa a nova chave salva no admin, (c) trocar chave admin não afeta cobranças de fotógrafo, (d) Gallery cria pagamento normalmente.

### Riscos & rollback
- Migration apenas cria estrutura nova; sem alteração destrutiva. Rollback = `DROP TABLE`.
- Refator das funções Camada 2 mantém fallback para `ASAAS_API_KEY` até o admin configurar a nova entrada — sem downtime nas assinaturas.

### O que NÃO vai mudar
- Schema/estrutura de `usuarios_integracoes` (só ganha índice único).
- Fluxos de cobrança dos fotógrafos (apenas hardening de query e asserções).
- Webhook do Asaas plataforma.
- Integração Gallery ↔ Gestão.
