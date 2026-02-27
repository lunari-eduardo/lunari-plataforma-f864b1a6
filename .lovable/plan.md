

# Fix: Trial de 30 dias para novos usuarios do Lunari Studio

## Diagnostico

**Causa raiz**: O trigger `handle_new_user_profile` (compartilhado com Gallery) foi atualizado pelo projeto Gallery e **removeu a criacao do trial**. O codigo atual diz "Studio trial is handled by Lunari Studio project separately" mas nunca foi implementado. Resultado: novos usuarios caem direto em "Acesso Restrito" (`no_subscription`).

**Estado atual do trigger** (verificado via `pg_proc`):
- Cria `profiles` -- OK
- Cria `photographer_accounts` com 500 credits + 0.5GB -- OK
- **NAO cria trial** -- PROBLEMA
- Tabela `subscriptions` esta completamente vazia (0 registros, 21 usuarios)

**Separacao Gallery vs Studio**: O trigger roda no INSERT de `auth.users` (compartilhado). Nao ha como saber se o signup veio do Gallery ou Studio no trigger. Solucao: iniciar o trial no onboarding do Studio (que so existe aqui).

## Implementacao

### 1. Migration SQL -- Adicionar coluna + RPC + atualizar get_access_state

**Adicionar colunas em `profiles`:**
- `studio_trial_started_at TIMESTAMPTZ DEFAULT NULL`
- `studio_trial_ends_at TIMESTAMPTZ DEFAULT NULL`

**Criar RPC `start_studio_trial()`:**
- Verifica se `studio_trial_ends_at` ja esta preenchido (idempotente)
- Verifica se usuario ja tem assinatura ativa em `subscriptions_asaas`
- Verifica se email esta em `allowed_emails`
- Se nenhuma condicao acima: seta `studio_trial_started_at = now()`, `studio_trial_ends_at = now() + 30 days`
- Retorna JSON com resultado

**Atualizar `get_access_state()`:**
- Apos checar Asaas (step 4), antes de retornar `no_subscription`:
- Ler `studio_trial_started_at` e `studio_trial_ends_at` do `profiles`
- Se `studio_trial_ends_at > now()`: retornar `status: 'ok'`, `isTrial: true`, `planCode: 'combo_completo'`, `hasGaleryAccess: true`, `daysRemaining` calculado
- Se `studio_trial_ends_at <= now()` (expirado): retornar `status: 'trial_expired'`
- Remover a checagem da tabela `subscriptions` legada (step 5) -- nao mais necessaria

**Backfill usuarios existentes:**
- Para usuarios que ja completaram onboarding (`is_onboarding_complete = true`) e nao tem assinatura Asaas nem estao em `allowed_emails`: iniciar trial retroativamente baseado no `created_at` do profile

### 2. Atualizar `src/pages/Onboarding.tsx` -- Iniciar trial ao completar onboarding

Na funcao `handleComplete`, apos salvar o profile com sucesso:
- Chamar `supabase.rpc('start_studio_trial')`
- Nao bloquear navegacao se falhar (trial pode ser iniciado em background)

### 3. Atualizar `src/integrations/supabase/types.ts`

- Adicionar `studio_trial_started_at` e `studio_trial_ends_at` nas tipagens de `profiles`
- Adicionar `start_studio_trial` na lista de Functions

## Regras de negocio garantidas

| Regra | Como |
|-------|------|
| 30 dias gratis no Studio com acesso total | `planCode: 'combo_completo'` durante trial |
| Limites de creditos/storage mantidos | photographer_accounts ja tem 500 credits + 0.5GB (trigger existente) |
| Gallery signup NAO inicia trial Studio | Trial so e iniciado via RPC chamado no onboarding do Studio |
| Gallery ativada para trial | `hasGaleryAccess: true` durante trial |
| Trial nao sobrepoe assinatura paga | RPC verifica `subscriptions_asaas` antes de criar trial |

## Arquivos

| Arquivo | Acao |
|---------|------|
| Nova migration SQL | Coluna profiles, RPC start_studio_trial, get_access_state atualizado, backfill |
| `src/pages/Onboarding.tsx` | Chamar `start_studio_trial` apos completar onboarding |
| `src/integrations/supabase/types.ts` | Adicionar tipagens novas |

