## Problema

Ao clicar em **Salvar** em *Integrações Financeiras*, o navegador acusa:

- `Access to fetch ... has been blocked by CORS policy: Response to preflight request doesn't pass access control check: It does not have HTTP ok status.`
- `POST .../admin-platform-integration-upsert net::ERR_FAILED`
- Toast: *Failed to send a request to the Edge Function*

## Causa raiz

A função `admin-platform-integration-upsert` (e a irmã `admin-platform-integration-test`) **não está respondendo** — não há nenhum log dela no Supabase. O CORS em si está implementado corretamente no código; o preflight falha porque a função nunca foi deployada (ou falhou no boot silenciosamente). Além disso, nenhuma das duas tem entrada em `supabase/config.toml`, o que pode causar comportamento inconsistente entre deploys.

## Plano de correção

1. **Registrar as funções em `supabase/config.toml`** mantendo `verify_jwt = true` (são funções administrativas; a validação do `Authorization` + checagem `has_role('admin')` continuam no código):
   ```toml
   [functions.admin-platform-integration-upsert]
   verify_jwt = true

   [functions.admin-platform-integration-test]
   verify_jwt = true
   ```

2. **Forçar o deploy** das duas funções via `supabase--deploy_edge_functions` para garantir que o binário esteja publicado e responda ao preflight.

3. **Validar pós-deploy**:
   - `supabase--curl_edge_functions` em `OPTIONS` para confirmar `200` + headers CORS.
   - `supabase--curl_edge_functions` em `POST` com a sessão do preview para confirmar upsert/teste reais.
   - Conferir `supabase--edge_function_logs` para confirmar boot sem erros.

4. **Não alterar nada na camada de isolamento financeiro** (Layer 1 fotógrafos × Layer 2 plataforma) — o problema é apenas de disponibilidade da função, não de lógica.

## Fora do escopo

- Mudanças na UI de `PlatformIntegrationsTab`.
- Alterações nas funções `asaas-*` ou em `_shared/platform-asaas.ts`.
- Migrations ou RLS de `platform_integrations`.
