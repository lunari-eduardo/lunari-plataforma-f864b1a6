# Módulo Billing

Centraliza a criação e o ciclo de vida das cobranças do fotógrafo (galeria,
sessão e vendas avulsas), independente do provedor de pagamento.

## Capabilities

| ID                              | Tipo    | Descrição                                                                 |
| ------------------------------- | ------- | ------------------------------------------------------------------------- |
| `billing.createGalleryPayment`  | command | Cria/reaproveita cobrança para galeria ou sessão no provedor padrão.      |

## Eventos emitidos

- `billing.charge_created` — uma cobrança foi criada (ou reaproveitada por
  idempotência). Workflow assina para mover a sessão para o status correto.

## Dependências server-side

- Edge function `gallery-create-payment` (provedor, persistência, idempotência).
- Tabelas: `cobrancas`, `usuarios_integracoes`, `galerias`, `clientes_sessoes`.

## Princípios

- Sem lógica de negócio duplicada no front: handler delega à edge function.
- Contrato Zod único usado por Web, Mobile e Assistente Lunari.
- Idempotência declarada em `idempotencyKey` + reforço de 10 min no servidor.
