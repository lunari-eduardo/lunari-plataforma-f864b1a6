

# Adicionar botão "Cobrar" nos modais de Agendamento (Novo + Detalhes)

## Cenário atual

- `ChargeModal` (`src/components/cobranca/ChargeModal.tsx`) já está completo: z-[60], overlay com `backdrop-blur-sm`, provedor padrão pré-selecionado via `ProviderSelector` (estrela `is_default`), grava tudo em `cobrancas` → webhook → `clientes_transacoes` (extrato) → trigger atualiza `clientes_sessoes`.
- Já é usado no Workflow (`WorkflowCardExpanded`) e no histórico CRM (`SessionPaymentsManager`). **Reutilizar 100%, sem duplicar fluxo.**
- Agendamentos (`appointments`) e sessões (`clientes_sessoes`) são vinculados pelo `session_id` (texto). Para confirmados existe trigger `sync_appointment_to_session`. Para pendentes, o `session_id` já é gerado quando o appointment é criado (via `SupabaseAgendaAdapter`).

## Problema do "vira confirmado"

Hoje **não existe** nenhum trigger/edge function que mude `appointments.status` de `a confirmar` → `confirmado` quando uma cobrança vinculada à sessão é paga. Isso precisa ser adicionado de forma centralizada, evitando lógica duplicada em cada webhook.

## Plano

### 1. UI — Botão "Cobrar cliente" nos dois modais

**`AppointmentDetails.tsx`** (modal de detalhes do agendamento pendente — segunda imagem)
- No bloco "Financeiro", adicionar botão `Cobrar via link` ao lado/abaixo do "Valor de entrada".
- Visível **apenas** quando `formData.status === 'a confirmar'` E existe `clientId` E existe `valorTotal > 0`.
- Estado local `showChargeModal`. Renderizar `<ChargeModal>` passando `clienteId`, `clienteNome`, `clienteWhatsapp`, `sessionId={appointment.sessionId}`, `valorSugerido={valorTotal}` (permite alternar para parcial dentro do modal).

**`AppointmentForm.tsx`** (modal "Novo Agendamento" — primeira imagem)
- Botão pequeno secundário ao lado de "Valor pago (sinal)" — "Cobrar via link".
- **Habilitado apenas após salvar** (precisa de `appointment.id`/`sessionId` e `clientId`). Para novo agendamento ainda não salvo, mostrar tooltip: "Salve o agendamento para gerar cobrança". Alternativa cleaner: **só mostrar o botão quando estiver editando** (`appointment != null`); para criação, usuário salva primeiro e abre detalhes.
- Decisão recomendada: **botão só em `AppointmentDetails`** (mais limpo, sem race condition de criar cobrança antes do appointment existir).

### 2. Destaque visual do modal filho

`ChargeModal` já usa `z-[60]` + `overlay backdrop-blur-sm bg-black/60`. Para garantir o efeito de hierarquia (memória `nested-modal-visual-hierarchy-pattern`):
- No `AppointmentDetails`, aplicar classe condicional ao wrapper: `cn("...", showChargeModal && "opacity-40 blur-[2px] pointer-events-none")` — mesmo padrão já usado para `sendBriefingOpen`.

### 3. Auto-confirmar agendamento quando cobrança é paga

**Solução centralizada via trigger DB** (zero código nas edge functions, zero duplicação):

```sql
-- Trigger em clientes_sessoes: quando valor_pago > 0 e existe appointment vinculado pendente, confirma.
CREATE OR REPLACE FUNCTION public.auto_confirm_appointment_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.valor_pago > COALESCE(OLD.valor_pago, 0) AND NEW.session_id IS NOT NULL THEN
    UPDATE public.appointments
    SET status = 'confirmado', updated_at = now()
    WHERE session_id = NEW.session_id
      AND status = 'a confirmar'
      AND user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_auto_confirm_appointment
AFTER UPDATE OF valor_pago ON public.clientes_sessoes
FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_appointment_on_payment();
```

**Por que aqui e não em `cobrancas`/`clientes_transacoes`:** o `valor_pago` em `clientes_sessoes` já é calculado por trigger consolidado existente a partir das transações (memória `workflow-financial-integrity-standards`). Hookar nesse ponto cobre **todos** os provedores (MP, InfinitePay, Asaas, PIX manual, manual workflow) sem tocar em nenhum webhook. Se já estava `confirmado`, o `WHERE status = 'a confirmar'` torna a operação no-op — atende o requisito "se já estava confirmado, não acontece nada".

### 4. Anti-duplicação / integridade

- Cobrança usa `sessionId` texto (memória `webhook-session-mapping`) → sem duplicar transação no extrato (memória `reconciliation-duplicate-prevention`).
- Trigger é idempotente (filtro `status = 'a confirmar'`).
- `ChargeModal` já tem aba "Histórico" e botão "Verificar status" — usuário não consegue gerar cobrança duplicada acidentalmente.
- Não criamos nenhum novo registro em `clientes_sessoes`: a sessão já existe (criada quando appointment foi salvo).

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/agenda/AppointmentDetails.tsx` | Botão "Cobrar via link" no bloco Financeiro + import/render `<ChargeModal>` + classe blur condicional no wrapper |
| Nova migration SQL | Função `auto_confirm_appointment_on_payment` + trigger em `clientes_sessoes` |

Sem mudanças em `AppointmentForm.tsx` (criação): usuário salva → abre detalhes → cobra. Evita complexidade de "cobrar antes de existir".

