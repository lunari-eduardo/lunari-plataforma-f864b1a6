# ADR-005: Learning Engine só propõe; jamais aplica

**Status:** Accepted — 2026-07-26

## Problema
Sistemas com auto-aprendizado que aplicam mudanças automaticamente são impossíveis de auditar, difíceis de reverter e geram desconfiança. Em domínio de negócio pessoal (fotógrafo), qualquer alteração invisível quebra a confiança na plataforma.

## Alternativas consideradas
1. **Learning aplica automaticamente** com log — quebra confiança, viola Art. 8 da Constituição.
2. **Learning só propõe**; humano aprova via Hub → aplica.
3. **Sem Learning Engine** — perdemos vantagem competitiva de longo prazo.

## Decisão
Learning Engine detecta padrões (correções recorrentes, aceitação/rejeição de recomendações, ajustes repetidos) e emite `learning.proposal.created`. Propostas ficam pendentes na aba **Memória** do Hub. Só após aprovação humana é que Context/Policy/Catalog recebem patch.

## Consequências (+)
- Fotógrafo mantém controle total; auditoria perfeita.
- Compliance-friendly (LGPD, futuros SOC2).
- KPI simples: % de propostas aceitas; se < 10%, Learning está errado — reavalia.

## Consequências (–)
- Perda percebida de "magia" (sistema não se ajusta sozinho).
- Fotógrafos podem ignorar propostas → valor de Learning subutilizado.

## Impacto futuro
Se demanda por auto-aplicação surgir, será via Policy explícita ("aprovar automaticamente proposals de tipo X com confidence > 0.9"), nunca por bypass do fluxo de aprovação.
