
# Integração Autentique — Assinatura Digital de Contratos

## Estado atual (auditoria)

Já existe:
- Tabela `contratos` com colunas `signature_provider`, `signature_external_id`, `signers`, `status`, `arquivo_assinado_path`, `enviado_em`, `assinado_em` — pronta para integração.
- Geração de PDF estável (`src/utils/contratoPdf.ts`) com cabeçalho, partes, corpo formatado e bloco de assinatura.
- Modal de contrato (`ContratoViewerModal`) com baixar PDF, mudar status manual, anexar PDF assinado.
- Tabela `usuarios_integracoes` (multi-provedor por `provedor`) — reaproveitável.
- Status enum no front: `rascunho | enviado | assinado | cancelado`.

Falta:
1. Conectar Autentique (API Key por usuário).
2. Botão "Enviar para assinatura" + edge function que cria documento na Autentique.
3. Persistir `signature_external_id` e atualizar status.
4. Status `visualizado` + UI de acompanhamento.
5. Webhook para sincronizar status e baixar PDF assinado automaticamente.
6. Reenvio, cancelamento e tratamento de erros.

---

## Etapa 1 — Conexão da conta Autentique (Configurações)

**Onde:** `Configurações > Integrações` (já existe `IntegracoesTab`). Adicionar terceira aba **"Assinatura Digital"** ao lado de Pagamentos e Google Calendar.

**UI (novo arquivo `AutentiqueCard.tsx`):**
- Estado desconectado: input de API Key + botão "Conectar". Link para `https://www.autentique.com.br/api/` explicando onde obter o token.
- Estado conectado: mostra nome/email da conta Autentique, ambiente (produção/sandbox), botão "Desconectar" e "Testar conexão".
- Aviso: "Sua API Key fica criptografada e só é usada pelo backend."

**Edge functions (3 novas, `verify_jwt = false`, validam JWT em código):**
- `autentique-connect`: recebe `{ api_key }`, chama `query { me { id name email } }` na GraphQL Autentique, valida, salva em `usuarios_integracoes` (`provedor='autentique'`, `access_token=api_key`, `dados_extras={ name, email, account_id }`).
- `autentique-disconnect`: marca `status='desconectado'`.
- `autentique-status`: retorna estado atual da conexão para o card.

**Segurança:** API key NUNCA vai pro frontend. Frontend só chama edge functions; resolução do token é server-side (mesmo padrão já usado por Asaas/MercadoPago no projeto).

---

## Etapa 2 — Envio do contrato para assinatura (MVP)

**Onde:** `ContratoViewerModal.tsx`. Substituir o botão "Marcar como enviado" por **"Enviar para assinatura"** (visível só quando status = `rascunho` E integração Autentique ativa). Manter "Marcar como enviado" como fallback secundário num menu "...".

**Validações antes de enviar (no front, com toasts):**
- Cliente tem `email` válido.
- `conteudo` não está vazio.
- Salva alterações pendentes do editor antes (auto-save).

**Edge function `autentique-send-contrato`:**
1. Valida JWT, busca contrato + cliente + perfil do fotógrafo.
2. Resolve `api_key` do `usuarios_integracoes`.
3. Gera PDF server-side a partir do HTML salvo. **Decisão técnica:** como o gerador atual é client-side (`html2pdf` + DOM), usar abordagem híbrida:
   - **MVP:** front gera o Blob com `downloadContratoPdf` (modo retornar Blob, não baixar), envia base64 para a edge function via `supabase.functions.invoke`.
   - Adicionar opção `returnBlob: true` em `contratoPdf.ts` (já está quase pronto — `generateViaHtml2Pdf` já retorna Blob).
4. Edge function envia `multipart/form-data` para Autentique GraphQL `mutation createDocument` com:
   - `document.name` = título
   - `signers` = [{ email cliente, action: SIGN, name }] (e fotógrafo opcional como segundo signatário, configurável)
   - `file` = PDF
5. Persiste retorno: `signature_provider='autentique'`, `signature_external_id=<doc.id>`, `status='enviado'`, `enviado_em=now()`, `signers=[{...}]`.

**UX:**
- Loading no botão.
- Após sucesso: badge muda para "Enviado", toast só de erro (regra do projeto), modal mostra link público da Autentique se retornado.

---

## Etapa 3 — UI de acompanhamento e ações

**Adicionar status `visualizado`** ao tipo `ContratoStatus` e ao `ContratoStatusBadge` (cor amarela). Migration: nenhuma (status é `text`, não enum).

**No `ContratoViewerModal`, quando contrato tem `signature_external_id`:**
- Bloco "Assinatura digital" mostrando: provedor, ID externo, link público, lista de signatários com status individual (assinado/pendente).
- Botões contextuais:
  - **Reenviar e-mail** → `autentique-resend-contrato` (mutation `resendSignatures`).
  - **Atualizar status** → `autentique-sync-contrato` (consulta GraphQL `query document(id)` e atualiza local — substitui webhook no MVP).
  - **Cancelar assinatura** → `autentique-cancel-contrato`.
  - **Baixar PDF assinado** → quando `assinado`, chama edge function que baixa de `document.files.signed` da Autentique e salva em `contratos-assinados/{userId}/{contratoId}/...`, atualizando `arquivo_assinado_path`.
- Bloqueio de edição do conteúdo após `enviado` (já bloqueia em `assinado`; estender).

**Tratamento de erros:** todas as edge functions retornam `{ error: { code, message } }` com códigos amigáveis: `INTEGRATION_NOT_CONNECTED`, `INVALID_API_KEY`, `CLIENT_EMAIL_MISSING`, `AUTENTIQUE_RATE_LIMIT`, `AUTENTIQUE_PLAN_LIMIT`. Frontend traduz para mensagens claras.

---

## Etapa 4 — Webhook (automação)

**Edge function pública `autentique-webhook`** (sem JWT, valida via segredo compartilhado em header):
- Recebe eventos `signature.accepted`, `signature.rejected`, `document.signed`, `document.viewed`.
- Localiza contrato por `signature_external_id`.
- Atualiza status (`visualizado`, `assinado`, `cancelado`).
- Quando `assinado`: baixa PDF final da Autentique e salva no Storage.
- Idempotente: usa tabela `webhook_events` (criar se não existir) para deduplicar por `event_id`.

**Configuração:** mostrar a URL do webhook no card de configuração para o usuário colar no painel Autentique.

---

## Detalhes técnicos

### Banco
Sem mudança estrutural na tabela `contratos` (colunas já existem). Migrations necessárias:
- Inserir registro de provider `autentique` em qualquer tabela de catálogo se houver (verificar — não vi nenhuma).
- Criar tabela `webhook_events (id, provider, event_id unique, received_at, payload jsonb)` na Etapa 4.

### Secrets
- Nenhum secret global: cada usuário usa sua própria API Key armazenada em `usuarios_integracoes.access_token`.
- Opcional: `AUTENTIQUE_WEBHOOK_SECRET` global (Etapa 4) para validar origem do webhook.

### Endpoint Autentique
- GraphQL: `https://api.autentique.com.br/v2/graphql` (produção) / `/sandbox` (sandbox).
- Auth: header `Authorization: Bearer <API_KEY>`.
- Upload: `multipart/form-data` com `operations`, `map`, `0` (arquivo) — formato GraphQL multipart spec.

### Arquivos a criar
```text
supabase/functions/autentique-connect/index.ts
supabase/functions/autentique-disconnect/index.ts
supabase/functions/autentique-status/index.ts
supabase/functions/autentique-send-contrato/index.ts
supabase/functions/autentique-sync-contrato/index.ts
supabase/functions/autentique-resend-contrato/index.ts
supabase/functions/autentique-cancel-contrato/index.ts
supabase/functions/autentique-download-signed/index.ts
supabase/functions/autentique-webhook/index.ts        (Etapa 4)
src/components/integracoes/AutentiqueCard.tsx
src/hooks/useAutentiqueIntegration.ts
src/lib/autentique.ts                                 (helpers de UI)
```

### Arquivos a editar
```text
src/components/preferencias/IntegracoesTab.tsx        (nova aba)
src/components/contratos/ContratoViewerModal.tsx      (botões + bloco assinatura)
src/components/contratos/ContratoStatusBadge.tsx      (status visualizado)
src/types/contrato.ts                                 (+ 'visualizado')
src/utils/contratoPdf.ts                              (export retornar Blob sem baixar)
src/hooks/useContratos.ts                             (mutations: enviarParaAssinatura, sync, resend, cancel, baixarAssinado)
```

---

## Ordem de implementação proposta

1. **Etapa 1** (conexão) — destrava tudo o resto.
2. **Etapa 2** (envio MVP) — entrega valor imediato; usuário já pode enviar contratos.
3. **Etapa 3** (acompanhamento + sync manual + download assinado) — fecha o ciclo sem depender de webhook.
4. **Etapa 4** (webhook) — automação final.

Cada etapa é entregável de forma independente.

Aguardando aprovação para iniciar pela **Etapa 1**.
