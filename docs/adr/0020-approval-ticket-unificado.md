# ADR-020: ApprovalTicket unificado (clique, texto, voz, async)

**Status:** Accepted — 2026-07-26

## Problema
Confirmação de ação destrutiva hoje varia por caminho: UI usa modal, Lu pede texto/voz, MCP não confirma nada. Isso quebra Art. 7 da Constituição em algumas superfícies.

## Alternativas consideradas
1. **Confirmação por interface** — inconsistente; MCP pula.
2. **`ApprovalTicket` como entidade persistente**, disparável por qualquer transporte, resolvível por qualquer transporte.
3. **Confirmação síncrona sempre** — quebra fluxos assíncronos (MCP, automações que exigem aprovação).

## Decisão
`ApprovalTicket` é cidadão de primeira classe:
- Tabela `approval_tickets (id, user_id, capability_id, input_payload, requested_by_actor, expires_at, status, decided_by, decided_at, decision_channel)`.
- Kernel + Policy criam ticket quando `require_approval` avalia true.
- Ticket resolvível via: clique na UI, resposta textual no Lu, comando de voz, aprovação assíncrona na aba **Aprovações** do Hub, deep link em notificação.
- Expira em 24h (config por Capability).
- Após aprovado, Capability executa com o input original guardado.

## Consequências (+)
- Confirmação uniforme em todas as interfaces.
- MCP passa a respeitar Art. 7 automaticamente.
- Automações podem exigir aprovação humana sem quebrar fluxo assíncrono.

## Consequências (–)
- Latência entre pedido e execução em fluxos que exigem aprovação (por design).
- UI precisa surfaces boas de "aprovações pendentes" para não empilhar.

## Impacto futuro
Base para compliance, para "Modo Substituto" com salvaguardas e para eventuais aprovações multi-nível (revisor + fotógrafo) em estúdios com equipe.
