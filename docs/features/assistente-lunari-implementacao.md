# Assistente Lunari — Guia de Implementação Pendente

> Status: **Infraestrutura pronta, runtime não plugado.**
> Todas as capabilities, tools de IA, permissions e o registry central já existem no código.
> Este documento lista **exatamente** o que falta fazer para ativar a Lunari em produção.

---

## 1. Situação atual (o que JÁ existe)

### 1.1 Capabilities registradas
Módulo | Capability | Tipo | Aprovação humana
--- | --- | --- | ---
`workflow` | `getSessionFinancials` | query | não
`workflow` | `listSessionsByPaymentStatus` | query | não
`workflow` | `diagnoseSession` | query | não
`workflow` | `addPayment` | command | **sim**
`workflow` | `refundPayment` | command | **sim**
`gallery` | `listInSelection` | query | não
`gallery` | `listExpiring` | query | não
`gallery` | `reopenSelection` | command | **sim** (perguntar dias)
`billing` | `listSessionPayments` | query | não
`billing` | `createGalleryPayment` | command | **sim** (confirmar meio)
`billing` | `registerManualPayment` | command | **sim** (meio + escopo)
`finance` | `credit.listClientsWithCredit` | query | não
`finance` | `credit.getClientCredit` | query | não
`finance` | `credit.grant` | command | **sim**
`finance` | `credit.apply` | command | **sim**
`finance` | `credit.revoke` | command | **sim**

### 1.2 Arquivos-chave já criados
- `src/modules/ai-registry.ts` — agregador único (`listLunariAITools({ user })`).
- `src/modules/{workflow,billing,gallery,finance}/ai/{tools,permissions,index}.ts`.
- `src/shared/capability/{define,registry,ai-adapter,policy}.ts` — infra genérica.

---

## 2. O que FALTA implementar

### 2.1 Endpoint do chat (Edge Function)
**Arquivo alvo:** `supabase/functions/lunari-assistant-chat/index.ts` (criar).

Requisitos:
1. Usar AI SDK (`streamText` + `toUIMessageStreamResponse`) via Lovable AI Gateway (`_shared/ai-gateway.ts`).
2. Modelo padrão: **`google/gemini-2.5-flash`** (rápido, cheap, suporta tools). Fallback: `google/gemini-2.5-pro` para diagnósticos.
3. Autenticação: exigir JWT do usuário. Extrair `user.id` do token para passar ao registry.
4. Carregar tools via `listLunariAITools({ user })` — **rodar no server**, nunca no client.
5. `stopWhen: stepCountIs(50)` (padrão de agent loops).
6. System prompt: ver seção 2.4.
7. Persistir histórico via `chat_messages` (tabela nova — ver 2.6).

Contrato de request:
```ts
POST /functions/v1/lunari-assistant-chat
{ threadId: string, messages: UIMessage[] }
```

### 2.2 Aprovação humana (needsApproval)
As tools com `needsApproval: true` **não podem executar direto**. O padrão AI SDK é:
1. Modelo emite `tool-call`.
2. Server suspende e devolve `tool-approval-request` no stream.
3. UI mostra card de confirmação com preview dos parâmetros.
4. Usuário aprova/rejeita → client envia `tool-approval-response`.
5. Server executa `capability.handler(input, ctx)` só após aprovação.

**Referência:** https://ai-sdk.dev/docs/agents/loop-control.md (seção Human-in-the-loop).

**Preview obrigatório por command:**
- `billing.createGalleryPayment` / `registerManualPayment`: mostrar cliente, sessão, valor total, breakdown (sessão/extras), meio.
- `gallery.reopenSelection`: mostrar galeria, cliente, nova data de expiração (hoje + N dias).
- `workflow.refundPayment`: mostrar cobrança original, valor, motivo.
- `finance.credit.*`: mostrar cliente, valor, tipo (adicionar/consumir/estornar).

### 2.3 UI do chat
**Arquivos alvo:**
- `src/features/assistant/pages/AssistantPage.tsx`
- `src/features/assistant/components/ChatWindow.tsx`
- `src/features/assistant/components/ToolCallCard.tsx` (approval UI)
- `src/features/assistant/components/ThreadList.tsx`

Decisões pendentes (**perguntar ao usuário antes de codar**):
- **Conversation shape**: threads múltiplas OU uma conversa única?
- **Storage**: DB (persistente entre devices) OU localStorage?

Padrões obrigatórios (`chat-agent-ui-contract`):
- Se threads → rota `/lu/:threadId` com `useParams`.
- Renderizar `message.parts`, não `content` flat.
- Textarea sempre focado (init, após envio, após stream, após trocar thread).
- Optimistic UI: mostrar mensagem do usuário + typing indicator imediatamente.
- Markdown via `react-markdown` para respostas do assistente.

### 2.4 System prompt (rascunho)
```
Você é a Lunari, assistente da plataforma Lunari para fotógrafos profissionais.

REGRAS:
- Nunca acesse o banco diretamente. Use apenas as ferramentas expostas.
- Antes de qualquer ação financeira (cobrança, pagamento manual, estorno, crédito),
  confirme com o usuário o cliente, valor e meio de pagamento.
- Para reabrir galeria, SEMPRE pergunte por quantos dias antes de executar.
- Para diagnosticar problemas em sessão, comece por `workflow.diagnoseSession`
  e explique os findings em linguagem simples.
- Não invente valores. Se faltar dado, chame a query correspondente.
- Responda em português BR, tom profissional e conciso.

LIMITES v1:
- Não responde a clientes finais.
- Não envia mensagens/e-mails.
- Não publica conteúdo.
```

### 2.5 Auditoria
**Obrigatório** por `mem://constitution/assistant-guide-v1`.

Criar tabela `assistant_invocations` (migration):
```sql
CREATE TABLE public.assistant_invocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL,
  tool_name text NOT NULL,
  tool_input jsonb NOT NULL,
  tool_output jsonb,
  approved boolean,
  approved_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.assistant_invocations TO authenticated;
GRANT ALL ON public.assistant_invocations TO service_role;
ALTER TABLE public.assistant_invocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own invocations"
  ON public.assistant_invocations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Service inserts invocations"
  ON public.assistant_invocations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
```

Wrapper obrigatório no Edge Function: toda execução de tool grava linha antes e após.

### 2.6 Persistência de histórico (se DB)
Tabelas `assistant_threads` e `assistant_messages` seguindo o padrão de
`chat-agent-ui-contract`. IDs de mensagem do AI SDK são `msg_...` (text),
**não usar como PK UUID**. Persistir mensagens completas via `onFinish` do
`toUIMessageStreamResponse`.

### 2.7 Rate limit + créditos
- `429` do gateway → toast "muitas requisições, aguarde".
- `402` → toast "créditos Lovable AI esgotados" com link para billing.
- Contabilizar uso por `user_id` (opcional v1) para limitar plano gratuito.

### 2.8 Testes manuais mínimos antes do release
1. Perguntar "quais sessões têm pagamento pendente?" → chama `listSessionsByPaymentStatus`.
2. "Diagnostique a sessão do cliente X" → chama `diagnoseSession`, explica findings.
3. "Gere cobrança de sessão + extras para Y via PIX" → pede confirmação, executa `createGalleryPayment`.
4. "Reabra a galeria do cliente Z" → pergunta dias, executa `reopenSelection`.
5. "Registre pagamento manual de R$ 500 em dinheiro na sessão W" → confirma, executa `registerManualPayment`.
6. "Adicione R$ 100 de crédito para o cliente K" → confirma, executa `credit.grant`.
7. "Quem tem crédito disponível?" → executa `listClientsWithCredit`.
8. "Quais galerias expiram nos próximos 3 dias?" → executa `listExpiring`.

Cada teste deve gerar linha em `assistant_invocations`.

---

## 3. Ordem sugerida de implementação

1. Perguntar ao usuário: **thread × storage** (bloqueia UI).
2. Migration `assistant_invocations` (+ threads/messages se DB).
3. Edge Function `lunari-assistant-chat` com wrapper de auditoria.
4. UI base (`AssistantPage` + `ChatWindow`) sem approval.
5. `ToolCallCard` de approval + fluxo human-in-the-loop.
6. Rota + navegação (sidebar item "Lunari").
7. Testes manuais 1–8.
8. Ajuste de system prompt conforme comportamento observado.

---

## 4. Não fazer nesta v1

- Envio de mensagens a clientes (WhatsApp/e-mail).
- Publicação de galeria/blog.
- Alteração de plano/assinatura.
- Exclusão de sessões, clientes ou cobranças.
- Configurações de sistema (integrações, secrets).

Essas capabilities **não existem** no registry propositalmente. Adicionar apenas
após revisão do `mem://constitution/assistant-guide-v1`.

---

## 5. Referências rápidas
- Constituição do assistente: `mem://constitution/assistant-guide-v1`
- Arquitetura: `docs/ARCHITECTURE_TECHNICAL.md`
- Padrão de chat UI: knowledge `chat-agent-ui-contract` + `chat-ui-composition`
- AI SDK loop control: https://ai-sdk.dev/docs/agents/loop-control.md
- Registry central: `src/modules/ai-registry.ts`
