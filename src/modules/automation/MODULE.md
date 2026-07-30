# Módulo Automation — Automation Engine v1 (Onda 12 / ADR-006)

## Propósito
Única engine autorizada a chamar `Kernel.execute` autonomamente. Consome
`decision_proposals` com `status='accepted'` que casam com uma
`automation_rules` habilitada pelo fotógrafo, e dispara a capability
correspondente via Kernel — sempre com `actor.channel="automation"` e
sempre logando em `automation_runs` (auditoria).

## Fluxo
```
decision_proposals (accepted)
   ↓ match por (capability_id, source_kind, severity ≤ rule.severity_max)
automation_rules (enabled = true)
   ↓ Kernel.execute(actor="automation:<rule_id>")
Policy avalia (pode negar / exigir approval)
   ↓
automation_runs (ok | failed | skipped | denied | approval_required)
```

## Capabilities
- `automation.rules.list` — lista regras (leitura).
- `automation.rules.upsert` — cria/edita regra (aprovação humana).
- `automation.rules.delete` — remove regra (aprovação humana).
- `automation.runs.list` — histórico auditável (leitura).
- `automation.tick` — dispara propostas elegíveis (aprovação humana).

## Regras invioláveis
- Kill-switch global: `app_settings.automation_enabled=false` desliga tudo.
  Default: **desligado**.
- Regras iniciam `enabled=false`; fotógrafo ativa manualmente.
- Uma proposta só executa com sucesso UMA vez (unique index em
  `automation_runs(user_id, proposal_id) WHERE status='ok'`).
- Toda tentativa é logada — inclusive `denied` e `approval_required`.
- Policy manda: se a capability alvo exige aprovação, Automation não
  executa e registra `approval_required` (não bypassa Policy).
- Automation não modifica Intelligence, Decision ou Learning — apenas lê.

## Não faz
- Não gera propostas (isso é Decision).
- Não interpreta sinais (isso é Intelligence).
- Não aprende com resultados (isso é Learning — futura Onda).
- Não executa nada sem uma regra explícita do usuário.

## Onda 4 — Scheduler (D2)
Além do tick sob demanda, existe um scheduler server-side:

- `pg_cron` (`automation-scheduler-5min`, */5) → edge function `automation-scheduler`.
- Detectores por tempo (`supabase/functions/automation-scheduler/triggers.ts`):
  `lead.stalled`, `session.no_gallery`, `charge.pending_stale`. Somente leitura.
- Candidatos entram em `automation_queue`; o executor drena com backoff.
- Idempotência: índice único
  `automation_runs(user_id, rule_id, entity_id, window_key)` — janela diária.
- Allowlist não destrutiva do scheduler: `tasks.create`. Qualquer outra
  capability é registrada como `approval_required` (nunca executada).
- `automation_schedule_state` guarda última/próxima execução por usuário.
- Painel: Hub de IA → aba **Automações** (`automation_schedule_overview`).
- Gate de rollout da Lu (`assistant_access_allowed`) também vale aqui.
