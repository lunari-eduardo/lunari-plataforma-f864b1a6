# Módulo Workflow

Reage e opera o fluxo oficial Lead → Pós-venda.

## Eventos
- `workflow.payment_attached` — derivado de `billing.charge_created` quando há `sessionId`.
- `workflow.card_advanced` — emitido por `workflow.advanceCard` quando o status do card muda.

## Capabilities
- **Command** `workflow.advanceCard` — move um card para uma etapa (`clientes_sessoes.status`). Idempotente por `(sessionId, toStatus)`. Emite `workflow.card_advanced`.
- **Command** `workflow.updateFields` — atualização parcial sanitizada de campos. Emite `workflow.card_updated`.
- **Command** `workflow.deleteSession` — remove sessão com cascade auditado. Emite `workflow.card_deleted`.
- **Command** `workflow.addPayment` / `workflow.refundPayment` — pagamento manual e estorno.
- **Command** `workflow.reconcileFotosExtras` / `workflow.syncFromAgenda` — reconciliadores.
- **Query** `workflow.getCardBySession`, `listSessionsByMonth`, `listStatusOptions`, `searchSessions`, `metricsForMonth`, `pendingPayments`, `getSessionFinancials`, `listSessionsByPaymentStatus`, `diagnoseSession`.

### Produtos (fluxo de produção)
Ids `workflow.produto.*` — únicos aptos a mutar `produtos_incluidos` via IA. Todos os commands exigem aprovação humana (`REQUIRES_APPROVAL`).

- **Commands**: `advanceStage`, `retreatStage`, `setStages`, `switchFluxo`, `setDeadline`, `setPrice`, `setQuantity`, `add`, `remove`, `duplicate`.
- **Queries**: `listBySession`, `getFlowTemplate`, `listPending` (agrupa por prazo: atrasado/hoje/amanhã/semana/futuro).
- **Eventos**: `produto_stage_changed`, `produto_flow_changed`, `produto_deadline_changed`, `produto_price_changed`, `produto_qty_changed`, `produto_added`, `produto_removed`.
- **Anti-eco**: cada command memoriza (`mirrorMemoStore`) o hash de etapas + título esperado antes de persistir, para o reconciliador Produto↔Tarefa não sobrescrever a intenção durante a janela de realtime.

**6 critérios (PRODUCT_GUIDE)** — escopo produtos:
1. **Para quem?** Fotógrafos que vendem itens tangíveis (álbum, quadro, ampliação).
2. **Problema?** Rastrear em que ponto da produção cada item está + prazo de entrega.
3. **Jornada?** Pós-venda: adicionar produto → avançar etapas → entregar.
4. **Sucesso?** % produtos entregues no prazo, lead time médio por fluxo.
5. **Dependências?** `clientes_sessoes.produtos_incluidos`, `PricingFreezingService`, `tasksStore` (espelho), `useProductDeadlineNotifications`.
6. **Eventos?** Emite `workflow.produto_*`. Não consome — origem é UI/IA.

## Bridges (presentation)
- `WorkflowEventBridge` — assina `billing.charge_created`, invalida o cache financeiro do TanStack Query e re-emite `workflow.payment_attached` quando há `sessionId`.

Hooks legados (`useWorkflowRealtime`, etc.) continuam funcionando; as capabilities oferecem a superfície única consumida por Web/Mobile/IA para operações pontuais e auditadas.
