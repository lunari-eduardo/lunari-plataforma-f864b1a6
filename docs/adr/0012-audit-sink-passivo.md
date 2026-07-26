# ADR-012: Audit como Sink port passivo, não engine

**Status:** Accepted — 2026-07-26

## Problema
Blueprint v1 mencionava "Audit Engine". Isso sobrepõe responsabilidade: se Audit é engine, ele interpreta? Decide? Recomenda? Não — ele só registra.

## Alternativas consideradas
1. **Audit Engine** — força engine que só faz `insert` — desperdício conceitual.
2. **Audit como Sink port passivo** — Kernel chama; sink escreve; fim.
3. **Sem audit centralizado** — cada Capability audita como quiser — caos.

## Decisão
Audit é **port de infraestrutura** (`AuditSink.record(entry)`). Kernel invoca automaticamente após cada `execute` conforme `audit: "always" | "on-success" | "never"` da Capability. Sink escreve em `capability_invocations` (Postgres). Nunca interpreta, nunca decide, nunca notifica. Notificações e insights sobre uso são derivados por Observation/Intelligence lendo essa tabela.

## Consequências (+)
- Zero acoplamento entre Audit e regras de negócio.
- Trocar sink (para S3, Datadog, etc.) = trocar 1 impl.
- Testabilidade máxima (sink mockável).

## Consequências (–)
- Volume de escrita alto se muitas Capabilities forem `always` — mitigado por `on-success` como padrão para queries.

## Impacto futuro
Base para observabilidade completa da plataforma: quem executou o quê, quando, com qual input, qual resultado. Sem isso, debug de produção fica impossível.
