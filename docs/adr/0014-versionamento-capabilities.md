# ADR-014: Versionamento semver de Capabilities

**Status:** Accepted — 2026-07-26

## Problema
Capabilities são contratos públicos consumidos por Web, Lu, MCP, API, Automation. Mudar input/output silenciosamente quebra clientes externos (especialmente MCP tokens em uso e integrações via API pública futura).

## Alternativas consideradas
1. **Sem versionamento** — quebra clientes; impossível de recuperar.
2. **Versionamento manual por caso** — inconsistente.
3. **Semver obrigatório** com V1/V2 coexistindo ≥ 6 meses.

## Decisão
Toda Capability tem versão semver embutida no ID (`workflow.updateSession.v1`). Mudança **patch**: bug fix sem alterar contrato. **Minor**: adição de campo opcional. **Major**: qualquer alteração incompatível → cria `workflow.updateSession.v2`; v1 fica deprecated por ≥ 6 meses; após, remoção via ADR.

Kernel expõe ambas as versões simultaneamente. Clientes escolhem via ID. MCP catálogo indica versões disponíveis.

## Consequências (+)
- Break nunca surpreende cliente externo.
- Migração de consumidores é gradual e mensurável.
- API pública (Onda 15) fica trivial — mesmo modelo.

## Consequências (–)
- Custo de manter 2 versões por 6 meses.
- Necessidade de disciplina: "isso é minor ou major?".

## Impacto futuro
Fundamental para plataforma de longa vida. Sem semver, cada mudança vira decisão política.
