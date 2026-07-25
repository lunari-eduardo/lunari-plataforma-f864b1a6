# Changelog — Constituição Lunari

## v1.1 — 2026-07-25
- `ASSISTANT_GUIDE.md`: nova seção **Rollout e público-alvo**. A Lu é liberada em 3 estágios (admin → beta → geral) controlados por `app_settings.assistant_rollout_stage`. Estágio inicial: **admin**.
- Novas tabelas: `app_settings`, `assistant_beta_access`. Nova RPC `assistant_access_allowed(uid)` (fail-closed).
- Gate obrigatório em todas as edge functions do assistente via `_shared/assistant-guard.ts`.
- Painel admin `/assistente` (subdomínio admin) para trocar estágio e gerenciar beta.


## v1.0 — 2026-06-27
Documento fundador. Quatro arquivos oficiais:
- `CONSTITUTION.md` — 20 princípios permanentes (Art. 6 estendido: Assistente também não pode chamar Edge Functions fora do manifesto; Art. 10 inclui idempotência e side-effects declarados).
- `ARCHITECTURE.md` — estrutura oficial por módulo (`domain/application/ports/infrastructure/presentation/ai/server/docs/tests`), padrão `src/modules/`, TanStack Query + Zustand + realtime como invalidador.
- `PRODUCT_GUIDE.md` — visão, missão, fluxo oficial Lead→Pós-venda, 6 perguntas obrigatórias por feature. Nota sobre Orçamento/Contrato ainda não modularizados.
- `ASSISTANT_GUIDE.md` — nome "Lu" provisório, auditoria obrigatória de invocações da IA, orçamento de execução por turno.

Reorganização de arquivos:
- `docs/ARCHITECTURE.md` → `docs/ARCHITECTURE_TECHNICAL.md` (complementar, detalha implementação de Capability/Ports).
