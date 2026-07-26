# ADR-007: AI Gateway como Port (não engine)

**Status:** Accepted — 2026-07-26

## Problema
Onde vive a IA? Se for engine, "onde mora a inteligência" fica ambíguo (Intelligence? AI Engine? Ambas?). Se ficar espalhada (SDK importado por vários lugares), rotação de provider vira refactor grande.

## Alternativas consideradas
1. **AI Engine** como camada de domínio — confunde papéis; mistura infra com regra.
2. **AI Gateway como Port** (infra) — provider é detalhe de implementação; interfaces limpas.
3. **Sem abstração** (importa SDK direto) — trocar Lovable AI Gateway por outro vira caça a imports.

## Decisão
AI Gateway é **Port de infraestrutura** com 4 verbos: `complete`, `stream`, `embed`, `transcribe/synthesize`. Roteamento de modelo por tarefa via config declarativa (`intelligence.summary → gemini-flash`, `assistant.chat → claude-sonnet`). Responsabilidades: prompt assembly (Context + Intelligence + Memory + Knowledge), tool schema (a partir do Kernel manifest), streaming, voz, cache, retry, fallback entre providers. **Nunca** executa Capability nem contém regra de negócio.

## Consequências (+)
- Troca de provider = mudança de config.
- Nenhum SDK vaza para código de negócio.
- Testabilidade: Domain/Engines usam mock trivial de AI Gateway.

## Consequências (–)
- Camada extra entre chamada e provider (latência marginal).
- Config de roteamento vira ponto único de manutenção.

## Impacto futuro
Permite self-hosted, multi-provider e fine-tuned models sem tocar em código de negócio. Também permite política de custo por tarefa (usar modelo barato para classificação, caro para geração).
