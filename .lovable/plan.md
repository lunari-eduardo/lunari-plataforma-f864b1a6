
# Plano: Migrar todos os uploads para Cloudflare R2

Hoje o sistema usa **Supabase Storage em 5 buckets** (`avatars`, `blog-images`, `formulario-uploads`, `contratos-assinados`, `client-documents`) + **R2** (apenas blog) + **localStorage base64** (legado em Tarefas/Documentos do Cliente).

Objetivo: **um único storage (R2 `lunari-previews`)** com prefixos por contexto, padronizando upload/download via edge functions. Metadados (paths, nomes, links) continuam no Supabase Postgres.

---

## 1. Arquitetura final

Bucket único R2: `lunari-previews` (já existe, usado por Gallery e blog).
CDN público: `https://media.lunarihub.com`.

Estrutura de prefixos:

```text
lunari-previews/
├── media/              ← já existe (blog/conteúdo)
│   ├── blog/{user_id}/...
│   ├── form/{user_id}/...
│   ├── task/{user_id}/...
│   └── general/{user_id}/...
├── avatars/{user_id}/...                  ← novo (avatar + logo)
├── client-documents/{user_id}/{cliente_id}/...   ← novo (privado)
├── contratos-assinados/{user_id}/{contrato_id}/... ← novo (privado)
└── formulario-uploads/{token}/{campo_id}/... ← novo (público via CDN)
```

Privacidade:
- **Públicos (CDN direto)**: avatars, blog, formulario-uploads.
- **Privados (URL assinada via edge function)**: client-documents, contratos-assinados. Servidos por uma edge function `r2-signed-url` que valida usuário + RLS no Postgres antes de gerar URL pré-assinada S3 (válida por 5 min).

---

## 2. O que será criado

### Edge functions novas
1. **`r2-upload`** — generaliza a atual `r2-media-upload`. Aceita `context` (`avatar` | `logo` | `blog` | `form` | `task` | `client-document` | `contrato-assinado` | `formulario-publico`) e `entityId` opcional. Faz validação de tipo/tamanho por contexto e devolve `{ url, storagePath, isPublic }`.
2. **`r2-signed-url`** — gera URL pré-assinada GET (S3 Sig V4) para objetos privados. Valida via Postgres se o usuário pode ver aquele path (consulta `contratos`, `clientes_documentos`).
3. **`r2-delete`** — remove objeto do R2 (DELETE Sig V4) e devolve 200. Chamada quando metadado é deletado.
4. **`r2-public-upload`** — variante sem auth para `FormularioPublico` (formulários públicos respondidos por terceiros). Valida o `token` do formulário no Postgres antes de aceitar o upload.

Todas usam as secrets já existentes: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.

### Hook frontend único
- `useR2Upload` é estendido para receber `context` + `entityId` e retornar `{ url, storagePath }`.
- Novo `useR2SignedUrl(storagePath)` para arquivos privados (cache de 4 min).

### Migração de código
| Arquivo | Antes | Depois |
|---|---|---|
| `src/services/ProfileService.ts` (`uploadAvatar`, `uploadLogo`, `deleteAvatar`, `deleteLogo`) | `supabase.storage.from('avatars')` | `useR2Upload({context:'avatar'\|'logo'})` + `r2-delete` |
| `src/services/ClienteSupabaseService.ts` (`uploadDocument`, `downloadDocument`, `getDocumentUrl`, `deleteDocument`) | `client-documents` Supabase | `r2-upload` (privado) + `r2-signed-url` para abrir/baixar |
| `src/hooks/useContratos.ts` (`uploadAssinadoMutation`, `getSignedUrl`) | `contratos-assinados` Supabase | `r2-upload` (privado) + `r2-signed-url` |
| `supabase/functions/autentique-webhook`, `autentique-sync-contrato`, `autentique-cron-sync` | upload do PDF assinado para Supabase | upload server-side direto ao R2 (helper Sig V4 reusado) |
| `src/pages/FormularioPublico.tsx` (`handleFileUpload`) | `formulario-uploads` Supabase | `r2-public-upload` (valida token) |
| `src/components/blog/blocks/ImageBlock.tsx`, `VideoBlock.tsx` | já usa R2 | sem mudança |
| `src/hooks/useFileUpload.ts` (localStorage base64) | salvo no navegador | **substituído** por `useR2Upload({context:'task'\|'client-document'})`. Tabela `task_attachments` nova ou reuso de `clientes_documentos`. |
| `src/components/shared/FileUploadZone.tsx`, `src/components/tarefas/forms/TaskDocumentForm.tsx` | hook localStorage | usa novo hook + persiste metadados |

### Banco de dados (migrações Supabase)
- Nova tabela `task_attachments(id, task_id, user_id, nome, tipo, tamanho, storage_path, created_at)` com RLS por `user_id`.
- Adicionar colunas `r2_storage_path` em `clientes_documentos` e `contratos` (compatibilidade enquanto migra; ao final renomeamos `storage_path`).
- **Nada será apagado** dos buckets Supabase enquanto a migração de dados não terminar.

---

## 3. Migração dos arquivos existentes

Edge function pontual `migrate-supabase-to-r2` (executada uma vez, com paginação):

1. Lista `storage.objects` por bucket.
2. Para cada objeto: baixa do Supabase, faz PUT no R2 no novo prefixo, atualiza a coluna correspondente no Postgres (`r2_storage_path`).
3. Loga em `migration_log` (sucessos/erros).
4. **Não deleta** os arquivos originais; isso é um segundo passo manual após validação visual.

Volume atual a migrar é pequeno (~10,7 MB total: blog 7.7 MB, avatars 1.2 MB, contratos 304 KB, formulários 1.5 MB, client-documents 0).

---

## 4. Passo a passo manual (que só você consegue fazer)

Tudo abaixo é no painel **Cloudflare** (a conta dona do bucket `lunari-previews`):

### 4.1. Verificar CORS do bucket R2
1. Abra **Cloudflare Dashboard → R2 → `lunari-previews` → Settings → CORS Policy**.
2. Cole/garanta esta policy (substitua os domínios pelos seus reais):
   ```json
   [
     {
       "AllowedOrigins": [
         "https://lunari-plataforma.lovable.app",
         "https://*.lovable.app",
         "https://app.seu-dominio.com.br"
       ],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
3. Salve.

### 4.2. Confirmar custom domain do CDN
1. **R2 → `lunari-previews` → Settings → Public access**.
2. Verifique que `media.lunarihub.com` está conectado e com status **Active**. Se não estiver, clique **Connect Domain** e siga o wizard (precisa do DNS no Cloudflare).

### 4.3. Confirmar credenciais R2 no Supabase
1. Abra **Supabase Dashboard → Edge Functions → Secrets** (link no fim deste plano).
2. Verifique que existem: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
3. Se faltar alguma, gere uma API Token nova em **Cloudflare → R2 → Manage R2 API Tokens → Create API Token** com permissão **Object Read & Write** restrita ao bucket `lunari-previews` e cole no Supabase.

### 4.4. (Pós-migração, só após validação) Limpar buckets Supabase
Quando confirmar que tudo funciona no R2:
1. **Supabase Dashboard → Storage → Buckets**.
2. Para cada bucket (`avatars`, `blog-images`, `formulario-uploads`, `contratos-assinados`, `client-documents`): abrir → selecionar tudo → **Delete**.
3. Em seguida, deletar o bucket vazio (botão **Delete bucket**). Manter `client-documents` se preferir backup por mais alguns dias.

> Eu executo tudo o resto (código, edge functions, migração de dados, atualização de RLS) automaticamente depois que você aprovar.

---

## 5. Ordem de execução (lado Lovable)

1. **DB migrations**: criar `task_attachments`, adicionar colunas `r2_storage_path` em `clientes_documentos` e `contratos`.
2. **Edge functions**: deploy de `r2-upload`, `r2-signed-url`, `r2-delete`, `r2-public-upload`.
3. **Frontend**:
   - Atualizar `ProfileService` (avatar/logo).
   - Migrar `useFileUpload` + `FileUploadZone` + `TaskDocumentForm` (mata o localStorage base64).
   - Migrar `ClienteSupabaseService` (documentos).
   - Migrar `useContratos` (PDF assinado).
   - Migrar `FormularioPublico`.
   - Atualizar edge functions Autentique (webhook/sync/cron) para gravar no R2.
4. **Migração de dados**: rodar `migrate-supabase-to-r2` uma vez.
5. **Validação**: abrir Minha Conta, Documentos do Cliente, Tarefas, Contratos, Formulário Público — confirmar visual e download.
6. **Cleanup**: você executa o passo 4.4 manualmente.

---

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| URLs antigas (Supabase) ficarem quebradas em registros existentes | Migração escreve `r2_storage_path` mas mantém `storage_path` antigo; resolver/fallback no código durante 30 dias. |
| CORS do R2 bloqueando upload direto | Já mitigamos: upload sempre passa pela edge function (server-side PUT), navegador só fala com Supabase Functions. |
| Objetos privados vazando | Edge function `r2-signed-url` valida ownership via Postgres antes de assinar; URL expira em 5 min. |
| Custos R2 (egress = 0; ops = baixíssimo) | Volume atual <11 MB — irrelevante. Limites mantidos: 10 MB imagem / 50 MB vídeo / 10 MB documento. |
| Perda dos dados em localStorage de Tarefas/Documentos | Esses dados **já não persistem** entre dispositivos; serão substituídos por upload real. Se quiser, posso adicionar um botão "Reenviar arquivos antigos" que lê o localStorage do navegador atual e sobe pro R2. |

---

## 7. Detalhes técnicos

- Sig V4 helpers já existem em `r2-media-upload/index.ts` — serão extraídos para `supabase/functions/_shared/r2.ts` e reusados.
- Para PUT/DELETE/GET assinado, mesmo algoritmo (mudar `httpMethod` e canonical request).
- Validação de contexto na edge function:
  - `avatar`/`logo`: imagens, ≤5 MB.
  - `client-document`/`task`: PDF/Office/imagem, ≤10 MB.
  - `contrato-assinado`: PDF, ≤20 MB.
  - `formulario-publico`: imagem/PDF, ≤10 MB, requer `token` válido em `formularios`.
- RLS do Postgres continua sendo a fonte de verdade para "quem pode ver o quê" — o R2 nunca é consultado direto pelo navegador para conteúdo privado.

<lov-actions>
<lov-link href="https://supabase.com/dashboard/project/tlnjspsywycbudhewsfv/settings/functions">Supabase Edge Functions Secrets</lov-link>
<lov-link href="https://supabase.com/dashboard/project/tlnjspsywycbudhewsfv/storage/buckets">Supabase Storage Buckets</lov-link>
<lov-link href="https://dash.cloudflare.com/?to=/:account/r2/default/buckets/lunari-previews">Cloudflare R2 — bucket lunari-previews</lov-link>
</lov-actions>
