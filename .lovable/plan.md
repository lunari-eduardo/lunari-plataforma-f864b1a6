

# Fix definitivo: Cobrança em agendamento pendente não confirma nem aparece no extrato

## Causa raiz (confirmada via DB)

Pagamento da cobrança `1aef2e05` foi processado corretamente pelo webhook (`status: processed`), mas **três coisas falharam em cadeia**:

1. **`cobrancas.session_id = NULL`** — `infinitepay-create-link` faz `normalizeSessionId` que busca em `clientes_sessoes` por `session_id` ou `id`. Como o agendamento está "a confirmar" (sem registro em `clientes_sessoes`), retornou `null` e gravou `NULL`.
2. **`clientes_transacoes.session_id = NULL`** — trigger `ensure_transaction_on_cobranca_paid` herdou esse NULL. Resultado: extrato mostra a transação solta, não vinculada a nenhuma sessão.
3. **Appointment continua "a confirmar"** — não existe `clientes_sessoes` → `valor_pago` nunca muda → trigger `auto_confirm_appointment_on_payment` nunca dispara.

Arquitetura assume que `clientes_sessoes` só nasce quando appointment vira `confirmado` (via `sync_appointment_to_session`). Mas agora estamos cobrando **antes** disso. Há um gap.

## Solução em 3 camadas (defesa em profundidade)

### Camada 1 — Remover normalização destrutiva no `infinitepay-create-link`

Hoje: se sessão não existe em `clientes_sessoes`, grava `session_id = NULL`.
**Mudança:** se não encontrar, **preservar o valor original** (`agenda-xxx-yyy`) em vez de zerar. O trigger de cobranca paga depois resolve, e o webhook já busca por `session_id OR id::text`.

Aplicar a mesma correção em **todas** as `*-create-link` / `*-create-pix` (mercadopago, asaas, infinitepay) — mesmo padrão de bug.

### Camada 2 — Auto-criar `clientes_sessoes` quando cobrança é gerada para appointment pendente

Quando `ChargeModal` abre via `AppointmentDetails` para agendamento `a confirmar`, **criar previamente** a `clientes_sessoes` (status `agendado`, `tipo_registro = 'workflow'`, `valor_total = appointment.paid_amount > 0 ? valorTotal : 0`, `appointment_id`, `session_id` = `appointment.sessionId`).

Isso garante que:
- A cobrança nasce com `session_id` válido apontando para uma sessão real
- O trigger `ensure_transaction_on_cobranca_paid` cria a transação vinculada corretamente
- O `recompute_session_paid` atualiza `valor_pago` da sessão
- O `auto_confirm_appointment_on_payment` confirma o appointment automaticamente
- `sync_appointment_to_session` atualiza data/hora quando appointment confirmar

Local: `AppointmentDetails.tsx` — antes de abrir `ChargeModal`, se status = "a confirmar" e não existe `clientes_sessoes` para `appointment.sessionId`, fazer `INSERT` (idempotente via check).

### Camada 3 — Reconciliação do pagamento órfão atual

SQL one-shot para corrigir o caso do Euclides (e quaisquer outros órfãos):

```sql
-- 1. Criar clientes_sessoes para o appointment órfão
INSERT INTO clientes_sessoes (user_id, cliente_id, session_id, appointment_id, 
  data_sessao, hora_sessao, categoria, status, valor_total, valor_pago, tipo_registro)
SELECT a.user_id, a.cliente_id, a.session_id, a.id, a.date, a.time, 
  COALESCE(a.type, 'sessao'), 'agendado', 0, 0, 'workflow'
FROM appointments a
WHERE a.id = '4f5e54f9-028a-40c0-b65d-3d55d77ffb0e'
  AND NOT EXISTS (SELECT 1 FROM clientes_sessoes WHERE appointment_id = a.id);

-- 2. Vincular cobrança e transação à sessão criada
UPDATE cobrancas SET session_id = 'agenda-1776372813237-g7uiozrsnc' 
WHERE id = '1aef2e05-d9c3-4154-9ba1-9097bdb6fb96';

UPDATE clientes_transacoes SET session_id = 'agenda-1776372813237-g7uiozrsnc' 
WHERE cobranca_id = '1aef2e05-d9c3-4154-9ba1-9097bdb6fb96';

-- 3. Forçar recompute do valor_pago (trigger dispara auto-confirm)
UPDATE clientes_sessoes SET updated_at = now() 
WHERE session_id = 'agenda-1776372813237-g7uiozrsnc';
```

Generalizar com loop para qualquer cobrança paga com `session_id` apontando para `agenda-*` sem `clientes_sessoes` correspondente.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/infinitepay-create-link/index.ts` | Preservar `sessionId` original quando não achar match em `clientes_sessoes` |
| `supabase/functions/mercadopago-create-link/index.ts` | Mesma correção (mesmo bug) |
| `supabase/functions/mercadopago-create-pix/index.ts` | Mesma correção |
| `supabase/functions/gestao-asaas-create-payment/index.ts` | Verificar e aplicar se aplicável |
| `src/components/agenda/AppointmentDetails.tsx` | Antes de abrir `ChargeModal`, criar `clientes_sessoes` se appointment "a confirmar" não tiver uma |
| Migration SQL | Reconciliar o pagamento órfão do Euclides + qualquer outro órfão similar |

