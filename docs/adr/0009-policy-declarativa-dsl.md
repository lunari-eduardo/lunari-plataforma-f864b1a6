# ADR-009: Policy Engine declarativo com DSL mínima

**Status:** Accepted — 2026-07-26

## Problema
Hoje autorização vive em 4 lugares: `has_role` (DB), `permissions` em Capability, `approvalRegistry` (assistant), `needsApproval` (define). Mudar uma regra exige tocar em N lugares e é fácil de esquecer.

## Alternativas consideradas
1. **Manter dispersa** — dívida cresce; risco de segurança.
2. **DSL rica** (OPA/Rego, Casbin) — poderoso mas overengineering para o volume de policies do Lunari.
3. **DSL mínima com 4 verbos**: `allow`, `require_approval`, `deny`, `audit`.

## Decisão
Policy Engine declarativa com DSL mínima. Predicados avaliam `(user, actor, capability, input, context)`. Definições versionadas no repo (`policies/*.ts`). Fotógrafo pode declarar **overrides** simples via UI (ex.: "MCP client X só pode ler"). Kernel avalia Policy em todo `execute`. Automation avalia antes de disparar.

## Consequências (+)
- Uma única fonte para "quem pode o quê".
- Fácil auditar; fácil testar (predicados puros).
- Fotógrafo tem controle granular sem tocar em código.

## Consequências (–)
- DSL cresce ao longo do tempo — precisa disciplina para não virar Rego.
- Overrides do fotógrafo precisam UI cuidadosa para não gerar policies contraditórias.

## Impacto futuro
Base para compliance (LGPD, futuros SOC2/HIPAA se relevante). Base para "Modo Substituto" e para MCP tokens com escopos.
