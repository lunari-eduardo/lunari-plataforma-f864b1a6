# Architecture Decision Records — Lunari

Registro imutável das decisões arquiteturais que fundamentam a Constituição v2.0 e o Blueprint AI-First v2.0.

## Formato
Cada ADR: Problema · Alternativas consideradas · Decisão · Consequências (+) · Consequências (–) · Impacto futuro.

## Estado
Todos os ADRs abaixo estão em status **Accepted** desde 2026-07-26.

## Índice

| # | Título | Domínio |
|---|---|---|
| [001](./0001-kernel-unico.md) | Kernel único como fronteira pública | Kernel |
| [002](./0002-modulos-organizacao-fisica.md) | Módulos como organização física | Estrutura |
| [003](./0003-context-memory-knowledge-disjuntos.md) | Context / Memory / Knowledge disjuntos | Engines |
| [004](./0004-split-observation-intelligence-decision.md) | Split Observation / Intelligence / Decision | Engines |
| [005](./0005-learning-so-propoe.md) | Learning Engine só propõe, jamais aplica | Engines |
| [006](./0006-automation-unica-auto-executora.md) | Automation Engine é a única auto-executora | Engines |
| [007](./0007-ai-gateway-como-port.md) | AI Gateway como Port (não engine) | Ports |
| [008](./0008-mcp-como-transporte.md) | MCP como transporte, sem protagonismo | Interfaces |
| [009](./0009-policy-declarativa-dsl.md) | Policy declarativa com DSL mínima | Engines |
| [010](./0010-event-bus-in-process.md) | Event Bus in-process preparado para persistente | Ports |
| [011](./0011-business-graph-projecao.md) | Business Graph como projeção, não fonte | Engines |
| [012](./0012-audit-sink-passivo.md) | Audit como Sink port passivo | Ports |
| [013](./0013-boundaries-lint-ci.md) | Boundaries via ESLint + tsgo obrigatório em CI | Qualidade |
| [014](./0014-versionamento-capabilities.md) | Versionamento semver de Capabilities | Capabilities |
| [015](./0015-pgvector-primeiro.md) | VectorDb começa em pgvector | Infraestrutura |
| [016](./0016-6-domain-modules.md) | 6 Domain modules substituem 12+ atuais | Domínio |
| [017](./0017-estrangulamento-migracao.md) | Migração por estrangulamento | Processo |
| [018](./0018-interfaces-descartaveis.md) | Interfaces são clientes descartáveis | Interfaces |
| [019](./0019-hub-ia-ui-oficial.md) | Hub de IA é a única UI da plataforma inteligente | UI |
| [020](./0020-approval-ticket-unificado.md) | ApprovalTicket unificado (clique/texto/voz/async) | Segurança |
