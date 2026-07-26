# ADR-004: Split Observation / Intelligence / Decision

**Status:** Accepted — 2026-07-26

## Problema
Blueprint v1 tinha "Intelligence Engine" fazendo coleta de sinais, interpretação, correlação, análise e recomendação. Cinco responsabilidades em uma engine = impossível de testar, evoluir ou substituir peça-a-peça.

## Alternativas consideradas
1. **Manter Intelligence monolítica** — testabilidade nula; qualquer melhoria vira refactor grande.
2. **Split em 3 engines**: Observation (coleta), Intelligence (interpretação), Decision (recomendação).
3. **Split em 5 engines** (coleta, agregação, interpretação, correlação, recomendação) — overengineering; nada de valor extra.

## Decisão
Split em 3 engines com contratos disjuntos:
- **Observation**: consome Event Bus, produz projeções crus. Nunca interpreta.
- **Intelligence**: consome projeções + Context + Memory + Knowledge, produz significado (Health Score, resumos, anomalias). Nunca decide ação.
- **Decision**: consome Intelligence + Context + Policy, produz propostas concretas de ação (`Capability + input + rationale`). Nunca executa.

Fluxo: Event → Observation → Intelligence → Decision → (Hub/Lu/Automation).

## Consequências (+)
- Cada engine é testável isoladamente com mocks das vizinhas.
- Algoritmos evoluem sem tocar em coleta.
- Decision pode ser substituído por LLM sem afetar Observation.

## Consequências (–)
- 3 contratos em vez de 1.
- Latência acumulada em cadeia (mitigado por batch).

## Impacto futuro
Permite evolução independente: podemos trocar interpretação heurística por ML em Intelligence sem tocar em Observation. Permite propor Decision alternativa via marketplace no futuro.
