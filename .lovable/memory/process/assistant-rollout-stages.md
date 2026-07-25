---
name: Assistente Lu — rollout escalonado
description: A Lu é liberada em 3 estágios (admin → beta → geral) via app_settings; nunca gate por email/env hardcoded
type: constraint
---
A assistente Lu **nunca** é liberada por email hardcoded, variável de ambiente ou gate por capability individual. O único ponto de controle é `public.app_settings.assistant_rollout_stage` (valores: `admin` | `beta` | `geral`), validado pela RPC `public.assistant_access_allowed(_uid)` (fail-closed).

Regras:
- Estágio inicial: `admin`. Trocas só via painel admin `/assistente`.
- Toda edge function do assistente (`assistant-chat`, `assistant-transcribe`, `assistant-forms-generate`, `assistant-contracts-generate`) chama `assertAssistantAccess` de `supabase/functions/_shared/assistant-guard.ts` logo após obter `userId` do JWT.
- Client-side: `useAssistantAccess()` esconde o launcher; nunca é a única barreira (defesa em profundidade).
- Beta autorizados vivem em `public.assistant_beta_access` (PK user_id → auth.users).
- Toda nova capability nasce disponível apenas no estágio ativo. Restrição fina por plano/quota é do futuro "plano de oferta de IA" e evoluirá dentro da RPC, sem gates paralelos.
- Tentativas bloqueadas viram linha em `assistant_invocations` com `output_status='blocked_by_rollout'` para medir demanda.

**Why:** Facilita fase beta sem redeploy; centraliza controle; evita drift entre backend/frontend/capability.
