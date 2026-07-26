# ADR-019: Hub de IA é a única UI de gestão da plataforma inteligente

**Status:** Accepted — 2026-07-26

## Problema
Sem UI dedicada, Context / Memory / Knowledge / Automation / Approvals ficam invisíveis. Fotógrafo não consegue gerenciar o que a plataforma "sabe" sobre ele.

## Alternativas consideradas
1. **Espalhar em Configurações** — perde coesão; usuário não descobre.
2. **Hub dedicado** com abas por engine — página única para "conversar com o cérebro do Lunari".
3. **Só via Lu** — invisível para quem não usa o chat.

## Decisão
Rota `/hub` (ou `/inteligencia`) com abas progressivamente reveladas conforme engines nascem:
- **Contexto** (Onda 4) — sempre visível.
- **Atividade** (Onda 5) — audit visual.
- **Conhecimento** (Onda 6, condicional).
- **Hoje** (Onda 10, condicional) — recomendações da Decision.
- **Memória** (Onda 12, condicional) — propostas de Learning.
- **Automações** (Onda 13, condicional) — regras.
- **Conexões** (quando MCP/OAuth apps existirem) — tokens e integrações.
- **Aprovações** (sempre) — ApprovalTickets pendentes.

Aba não aparece se engine não existe.

## Consequências (+)
- Um endereço único para tudo relacionado à inteligência.
- Adoção mensurável (DAU Hub / DAU total).
- Onboarding do Lu passa por aqui.

## Consequências (–)
- Hub precisa design cuidadoso para não virar dashboard poluído.
- Cada onda adiciona uma aba — precisa disciplina de UX.

## Impacto futuro
Base para "Modo Substituto" (fotógrafo desliga UI operacional e vive no Hub).
