# Módulo Workflow

Reage ao fluxo oficial Lead → Pós-venda. Nesta Onda C o módulo expõe:

- **Eventos**
  - `workflow.payment_attached` — emitido quando uma cobrança recém-criada
    pertence a uma sessão do funil (derivado de `billing.charge_created`).

- **Bridges (presentation)**
  - `WorkflowEventBridge` — assina `billing.charge_created`, invalida o
    cache financeiro do TanStack Query (`financial-transactions`,
    `extrato-unificado`) e re-emite `workflow.payment_attached` quando há
    `sessionId`.

Nenhuma capability `defineCommand`/`defineQuery` ainda — Workflow continua
operando via hooks legados e realtime; o módulo serve como **ponto único
de assinatura** para reagir aos eventos do barramento sem espalhar
`eventBus.on(...)` pela UI.
