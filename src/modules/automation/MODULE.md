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
