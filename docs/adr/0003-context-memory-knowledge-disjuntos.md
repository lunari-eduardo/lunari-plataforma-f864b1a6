# ADR-003: Context / Memory / Knowledge como camadas disjuntas

**Status:** Accepted — 2026-07-26

## Problema
Blueprint v1 tinha "Context" absorvendo preferências aprendidas, histórico de conversas e configurações declaradas. Isso mistura três conceitos com origens, ciclos de vida e níveis de confiança diferentes.

## Alternativas consideradas
1. **Camada única "State"** — simples, mas impossível auditar de onde veio cada fato.
2. **Context + Memory + Knowledge disjuntos**, cada um com contrato próprio.
3. **Cada módulo guarda seu próprio estado** — perpetua fragmentação atual.

## Decisão
Três camadas disjuntas com regras rígidas de não-sobreposição:
- **Context** = fatos **declarados** pelo fotógrafo (fonte: humano; alta confiança; versionado).
- **Memory** = fatos **observados** pelo sistema (fonte: Observation/Learning; confiança variável; TTL).
- **Knowledge** = conteúdo **textual** recuperável semanticamente (fonte: upload/template; sem interpretação).

Se Context e Memory conflitarem, Context vence. Memory pode virar proposta de update no Context via Learning Engine.

## Consequências (+)
- Auditabilidade total: sempre sabemos se um fato foi declarado ou inferido.
- Learning fica seguro: nunca sobrescreve declaração humana.
- Prompts do Lu podem ponderar por confiança (Context alta, Memory conforme score).

## Consequências (–)
- Hub precisa 3 abas em vez de 1.
- Onboarding precisa explicar as 3 camadas.
- Alguma sobrecarga de decidir "onde este fato mora?" — resolvida pelo teste: "o fotógrafo disse isso explicitamente?".

## Impacto futuro
Base para toda personalização do sistema. Sem essa separação, IA vira caixa-preta impossível de auditar. Com ela, cada resposta do Lu é rastreável até origem factual.
