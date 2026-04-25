
## Diagnóstico

O toast exibido após excluir uma sessão com "Excluir dados de pagamentos permanentemente" mostra:

> "1 pagamento(s) excluído(s) • **1 cobrança(s) preservada(s) por conter pagamento confirmado** • agendamento removido"

A descrição é **tecnicamente correta**, mas **conceitualmente confusa** para o usuário, porque ele acabou de escolher "excluir tudo permanentemente" — e parece que o sistema desobedeceu sua escolha.

### O que realmente acontece (é o comportamento correto e desejado)

A RPC `delete_workflow_session_cascade` (action `remove`) aplica uma **regra de integridade fiscal**:
- Cobranças **pagas** vinculadas a gateways externos (Asaas, Mercado Pago, InfinitePay) **NÃO são excluídas** — são apenas desvinculadas da sessão (`session_id = NULL`).
- Isso garante rastreabilidade fiscal/contábil: o dinheiro **realmente entrou** na conta do fotógrafo via gateway, então não pode "sumir" do extrato sem rastro.
- Está alinhado com a memória `mem://finance/sistema-estorno-integridade` ("pagamentos confirmados ou via gateway não são excluídos").

Esse comportamento é **correto e deve ser mantido**. O problema é apenas de **comunicação** no toast.

### Por que parece contraditório

A palavra "preservada" sugere ao usuário que a cobrança continua aparecendo na sessão / no card do cliente — quando na verdade ela foi removida do contexto da sessão e movida para o extrato como registro fiscal independente.

---

## Plano de Correção

Ajuste **isolado** em `src/pages/Workflow.tsx` (linhas 782–803), sem alterar a RPC nem a lógica de negócio.

### 1. Reescrever a descrição do toast para action `remove`

Tornar explícito:
- O que foi de fato **removido** (transações manuais + agendamento)
- O que foi **mantido no extrato fiscal** (cobranças de gateway pago) e **por quê**
- Que a sessão em si foi excluída

**Proposta de novo texto:**

| Cenário | Texto do toast (description) |
|---|---|
| Tudo excluído sem cobrança de gateway | "Sessão, X pagamento(s) e o agendamento foram excluídos permanentemente." |
| Com cobrança de gateway preservada | "Sessão e agendamento excluídos. **X pagamento(s) confirmado(s) por gateway foram mantidos no extrato fiscal** para auditoria, mas desvinculados da sessão." |

### 2. Refinar título por contexto

- `preserve` → "Sessão arquivada" (em vez de "excluída")
- `refund` → "Sessão excluída com estorno"
- `remove` → "Sessão excluída"

### 3. Adicionar dica visual quando houver preservação fiscal

Quando `unlinked_cobrancas > 0`, exibir o toast com `duration` maior (ex.: 8000ms) para o usuário ter tempo de ler a explicação fiscal.

### 4. (Opcional, mas recomendado) Ajustar também o modal de confirmação

No `WorkflowDeleteConfirmModal`, na opção "Excluir dados de pagamentos permanentemente", adicionar um aviso pequeno em texto secundário:

> ℹ️ Pagamentos já confirmados por gateways externos (Asaas, Mercado Pago, InfinitePay) serão mantidos no extrato fiscal para auditoria, mesmo nesta opção.

Isso prepara a expectativa do usuário **antes** da ação, evitando a sensação de contradição depois.

---

## Arquivos a modificar

- `src/pages/Workflow.tsx` — linhas 782–803 (montagem do `description` e título do toast)
- `src/components/workflow/WorkflowDeleteConfirmModal.tsx` — adicionar nota informativa na opção "remove" (item 4)

## O que NÃO muda

- ❌ Não alterar a RPC `delete_workflow_session_cascade`
- ❌ Não alterar a regra de preservação fiscal de cobranças de gateway
- ❌ Não mexer em `useWorkflowRealtime.ts` (o toast principal vem do Workflow.tsx)

## Resultado esperado

O usuário entenderá imediatamente:
1. Que a sessão e o agendamento foram realmente removidos
2. Que cobranças de gateway pago **devem permanecer** no extrato fiscal (regra contábil, não falha)
3. Que essa preservação é uma proteção, não uma desobediência à sua escolha
