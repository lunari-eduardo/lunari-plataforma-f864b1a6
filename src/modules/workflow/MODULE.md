# Módulo Workflow

Reage e opera o fluxo oficial Lead → Pós-venda.

## Eventos
- `workflow.payment_attached` — derivado de `billing.charge_created` quando há `sessionId`.
- `workflow.card_advanced` — emitido por `workflow.advanceCard` quando o status do card muda.

## Capabilities
- **Command** `workflow.advanceCard` — move um card para uma etapa
  (`clientes_sessoes.status`). Valida ownership, é idempotente por
  `(sessionId, toStatus)` e emite `workflow.card_advanced`.
- **Query** `workflow.getCardBySession` — retorna o estado canônico do
  card pelo `sessionId`.

## Bridges (presentation)
- `WorkflowEventBridge` — assina `billing.charge_created`, invalida o
  cache financeiro do TanStack Query e re-emite
  `workflow.payment_attached` quando há `sessionId`.

Hooks legados (`useWorkflowRealtime`, etc.) continuam funcionando; as
capabilities oferecem a superfície única consumida por Web/Mobile/IA
para operações pontuais e auditadas.
