## Contexto

A Etapa 2 enviou o contrato com sucesso para a Autentique (ID `73f97ce0…` confirma). O cliente assinou no e-mail dele, mas o Lunari ainda não sabe — falta o caminho de **retorno** (status + PDF assinado) e a **ação de assinatura do fotógrafo**.

Vamos resolver em 4 frentes complementares: sync manual (botão), webhook automático, download do PDF assinado, e UI para o fotógrafo assinar.

---

## Etapa 3.1 — Sync manual de status (resolve seu caso AGORA)

Cria botão "Atualizar status" no modal do contrato que consulta a Autentique sob demanda. É a forma mais rápida de você ver "Assinado" hoje, sem depender de webhook configurado.

**Edge function `autentique-sync-contrato`:**
- Recebe `{ contrato_id }`.
- Busca `signature_external_id` no contrato (com checagem de `user_id`).
- Resolve API Key da `usuarios_integracoes`.
- Query GraphQL Autentique:
  ```
  query { document(id: $id) {
    id name signed_count refusable
    signatures { public_id email name signed { created_at }
                 rejected { created_at } viewed { created_at }
                 link { short_link } action { name } }
    files { signed original }
  }}
  ```
- Atualiza `contratos.signers` com status individual (`assinado` / `visualizado` / `recusado` / `pendente` + timestamps).
- Se TODOS os signatários assinaram → status `assinado`, `assinado_em = max(signed.created_at)`, e dispara o passo de download do PDF (Etapa 3.2).
- Se algum recusou → status `cancelado`.
- Se algum visualizou (mas nenhum assinou ainda) → mantém `enviado` (status não muda, mas a info aparece na UI).

**UI (`ContratoViewerModal.tsx`):**
- Adicionar botão "Atualizar status" (ícone `RefreshCw`) ao lado do bloco "Enviado via Autentique", visível quando `signature_external_id` existe e status ≠ `assinado`/`cancelado`.
- Cada signatário no bloco passa a mostrar badge: Pendente / Visualizado / Assinado / Recusado, com timestamp.

---

## Etapa 3.2 — Download automático do PDF assinado

Quando todos assinarem (via sync ou webhook), baixar o PDF final da Autentique e gravar no Storage.

**Lógica reutilizável (helper na própria function `autentique-sync-contrato`, e chamada também pelo webhook):**
1. Pega `files.signed` (URL temporária da Autentique).
2. `fetch` da URL → `arrayBuffer`.
3. Upload para bucket `contratos-assinados` em `${user_id}/${contrato_id}/autentique-${doc_id}.pdf` (admin client, `upsert: true`).
4. Atualiza no contrato:
   - `arquivo_assinado_path`
   - `arquivo_assinado_nome` = `${titulo}-assinado.pdf`
   - `arquivo_assinado_tamanho`
   - `status = 'assinado'`, `assinado_em`

**Storage:** o bucket `contratos-assinados` já existe (Etapa 2 / upload manual). Apenas confirmar via SQL — se a policy atual só permite ao próprio user inserir, o admin client (service role) ignora RLS e funciona normalmente.

---

## Etapa 3.3 — Cancelar / reenviar (ações secundárias)

Pequenos extras para fechar o ciclo:

**Edge function `autentique-cancel-contrato`:**
- Mutation GraphQL: `deleteDocument(id: $id)`.
- Atualiza contrato para `status = 'cancelado'`, limpa `signature_external_id`/`signers` (mantém em `observacoes` o ID antigo p/ histórico).

**Edge function `autentique-resend-signer`:**
- Recebe `{ contrato_id, public_id }`.
- Mutation `resendSignatures(public_ids: [$public_id])`.
- Sem mudanças no DB.

**UI:** botões "Reenviar e-mail" por signatário pendente, e "Cancelar assinatura" no rodapé do bloco azul (com `AlertDialog` de confirmação).

---

## Etapa 4 — Webhook automático (tempo real)

Para deixar tudo automático sem o usuário clicar em "Atualizar".

**Edge function pública `autentique-webhook`** (`verify_jwt = false` em `config.toml`):
- Recebe POST da Autentique com `{ event, document: { id, ... }, signature: { ... } }`.
- Eventos relevantes da Autentique: `signature.accepted`, `signature.rejected`, `signature.viewed`, `document.finished`.
- Busca contrato por `signature_external_id = document.id` (sem filtrar por user — é webhook).
- Reaproveita o mesmo helper da Etapa 3.1 (faz uma query completa do documento e reescreve `signers` + status), garantindo idempotência.
- Em `document.finished` → executa também o download do PDF (Etapa 3.2).
- Resposta 200 sempre que o evento for processado (ou 200 mesmo em "ignorado", para não estourar reentregas).

**Configuração na Autentique:**
- A Autentique configura webhook por organização no painel deles. Vou registrar a URL pública no painel da integração da nossa UI ("Configurações > Integrações > Assinatura"), com botão **"Copiar URL do webhook"** apontando para `https://tlnjspsywycbudhewsfv.functions.supabase.co/autentique-webhook`.
- Adiciono instrução no card mostrando: "Cole esta URL em Autentique > Organização > Webhooks" + link.

**Realtime no front:** o `useContratos` já usa React Query — basta o webhook atualizar a row para o usuário ver assim que voltar à tela (a UI hoje não escuta realtime, então adiciono uma `supabase.channel('contratos-changes')` com invalidate da query no modal aberto).

---

## Etapa 5 — Assinatura do fotógrafo

Hoje o envio é só com o cliente como signatário (`include_fotografo: false`). Você quer poder assinar também.

**Decisão de UX (recomendado):** incluir o fotógrafo como signatário **desde o envio**, mas com `action: SIGN` e ordem livre. Assim:
- A Autentique já manda e-mail para você junto com o cliente.
- No bloco "Enviado via Autentique", aparece **seu próprio link de assinatura** com botão **"Assinar agora"** que abre `link.short_link` em nova aba.
- Funciona antes ou depois do cliente assinar (Autentique permite ordem livre por padrão).

**Mudanças:**
- Em `ContratoViewerModal.handleEnviarParaAssinatura`, passar `includeFotografo: true` por padrão (com checkbox opcional "Apenas o cliente assina" para casos raros — escondido em "opções avançadas").
- Após o envio, identificar o signatário do fotógrafo comparando `email` com o do `profile`, e renderizar botão destacado **"Assinar como fotógrafo"** ao lado dele.
- Pré-requisito: garantir que o `profiles.email` do user logado existe — se não houver, fallback para `auth.user.email` no momento do envio.

---

## Ordem de execução proposta

1. **Etapa 3.1 + 3.2** (sync manual + download automático) — resolve seu problema do contrato já assinado da Lise hoje, com 1 clique.
2. **Etapa 5** (fotógrafo como signatário) — resolve a parte de UI que falta.
3. **Etapa 3.3** (cancelar/reenviar) — polimento.
4. **Etapa 4** (webhook) — automação total, configurada por último porque depende de você colar a URL no painel da Autentique.

## Arquivos afetados

- **Novos:** `supabase/functions/autentique-sync-contrato/index.ts`, `autentique-cancel-contrato/index.ts`, `autentique-resend-signer/index.ts`, `autentique-webhook/index.ts`.
- **Editados:** `src/hooks/useContratos.ts` (mutations sync/cancel/resend), `src/components/contratos/ContratoViewerModal.tsx` (botões + badges + assinar como fotógrafo + realtime), `src/components/integracoes/AutentiqueCard.tsx` (URL do webhook), `supabase/config.toml` (registrar `autentique-webhook` com `verify_jwt = false`).
- **Sem migration de DB** — todas as colunas necessárias (`signers`, `arquivo_assinado_*`, `signature_external_id`, `assinado_em`) já existem.

## Confirmação antes de começar

Posso seguir com a **ordem proposta acima**, começando por 3.1+3.2+5 num único bloco (resolve seu caso e a UI do fotógrafo), depois 3.3 e 4? Ou prefere que eu deixe a Etapa 5 (fotógrafo signatário) como **opt-in por checkbox** em vez de padrão?