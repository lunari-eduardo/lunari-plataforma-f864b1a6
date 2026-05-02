## Diagnóstico da varredura

O erro de upload continua por um problema estrutural mais importante do que apenas permissão de bucket:

1. **Conflito de Edge Function com o Gallery**
   - O projeto Gestão e o projeto `lunari_gallery` usam o mesmo Supabase.
   - No Supabase, o nome da Edge Function é global dentro do projeto.
   - Já existe no Gallery uma função chamada `r2-upload` usada para upload de fotos de galerias.
   - A função `r2-upload` publicada atualmente tem comportamento de Gallery: ela espera `galleryId` e salva em `galeria_fotos`.
   - O Gestão está chamando `r2-upload` para logo/blog/documentos enviando `context=logo`, `context=blog`, etc.
   - Resultado: a função publicada recebe um upload sem `galleryId` e responde **400 Bad Request**.

2. **Não devemos sobrescrever a função `r2-upload` do Gallery**
   - Se eu simplesmente publicar a função genérica do Gestão com o mesmo nome `r2-upload`, o upload de fotos no Gallery pode quebrar.
   - A correção segura é criar funções com nomes exclusivos para o Gestão.

3. **Bucket do Gallery pode ser usado, mas não para tudo**
   - O bucket `lunari-previews` é o bucket público do Gallery e está ligado ao domínio `media.lunarihub.com`.
   - Ele é adequado para arquivos públicos: logos, avatares, imagens de blog, imagens públicas de formulários e previews.
   - Ele **não é adequado para documentos privados**, como documentos de clientes, anexos internos de tarefas e contratos assinados. Mesmo que a UI use URL assinada, se o bucket tem domínio público, qualquer objeto pode ficar acessível por URL se o caminho for conhecido.

4. **Recomendação de arquitetura**

```text
Cloudflare R2

1) lunari-previews  [público]
   Domínio: https://media.lunarihub.com
   Usar para:
   - Gallery previews
   - logos
   - avatares
   - blog
   - mídia pública de formulários

2) lunari-private  [privado, sem domínio público]
   Sem custom domain público
   Usar para:
   - documentos de clientes
   - anexos de tarefas
   - contratos assinados
   - qualquer arquivo sensível
```

## Plano de correção

### 1. Eliminar conflito com o Gallery

Criar novas Edge Functions exclusivas do Gestão:

- `gestao-r2-upload`
- `gestao-r2-signed-url`
- `gestao-r2-delete`
- `gestao-r2-public-upload`
- `gestao-migrate-supabase-to-r2`

E manter a função `r2-upload` do Gallery intacta.

Depois, atualizar todas as chamadas no Gestão:

- `ProfileService.ts`: logo/avatar passam a chamar `gestao-r2-upload` e `gestao-r2-delete`.
- `useR2Upload.ts`: blog e mídia passam a chamar `gestao-r2-upload`.
- `useR2SignedUrl.ts`: URLs privadas passam a chamar `gestao-r2-signed-url` e `gestao-r2-delete`.
- `useFileUpload.ts`: documentos e tarefas passam a chamar `gestao-r2-upload`.
- `ClienteSupabaseService.ts`: documentos de clientes passam a chamar `gestao-r2-upload`, `gestao-r2-signed-url` e `gestao-r2-delete`.
- `useContratos.ts`: contratos assinados passam a chamar `gestao-r2-upload` e `gestao-r2-signed-url`.
- `FormularioPublico.tsx`: upload público passa a chamar `gestao-r2-public-upload`.

### 2. Separar bucket público e bucket privado

Atualizar o helper R2 para escolher bucket por contexto:

- Contextos públicos:
  - `avatar`
  - `logo`
  - `blog`
  - `form`
  - `general`

  Bucket: `lunari-previews`  
  URL retornada: `https://media.lunarihub.com/...`

- Contextos privados:
  - `task`
  - `client-document`
  - `contrato-assinado`

  Bucket: `lunari-private`  
  URL retornada no upload: vazia ou apenas `storagePath`  
  Acesso posterior: somente via `gestao-r2-signed-url`.

### 3. Preservar organização por prefixos

Usar prefixos claros para evitar colisão com arquivos do Gallery:

```text
lunari-previews:
  galleries/{galleryId}/...              # já usado pelo Gallery
  gestao/avatars/{userId}/...
  gestao/logos/{userId}/...
  gestao/blog/{userId}/...
  gestao/formulario-uploads/{token}/...
  gestao/general/{userId}/...

lunari-private:
  gestao/client-documents/{userId}/{clienteId}/...
  gestao/task-attachments/{userId}/{taskId}/...
  gestao/contratos-assinados/{userId}/{contratoId}/...
```

### 4. Corrigir permissões e validações das funções

Nas novas funções do Gestão:

- Validar JWT dentro do código para uploads autenticados.
- Manter `verify_jwt = false` no `config.toml`, seguindo o padrão atual do projeto, mas com autenticação manual no handler.
- Garantir CORS completo em todas as respostas, inclusive erros.
- Retornar mensagens de erro claras, por exemplo:
  - `R2 credentials not configured`
  - `Bucket privado não configurado`
  - `Token R2 sem permissão para este bucket`
  - `Arquivo excede o limite`
  - `Tipo de arquivo não permitido`
- Melhorar o frontend para extrair o corpo do erro da Edge Function em vez de mostrar apenas “Edge Function returned a non-2xx status code”.

### 5. Não quebrar arquivos legados do Supabase Storage

Manter fallback para arquivos antigos:

- `avatars`
- `blog-images`
- `client-documents`
- `contratos-assinados`
- `formulario-uploads`

Enquanto nem tudo estiver migrado, a UI deve continuar abrindo arquivos antigos via Supabase Storage e arquivos novos via R2.

### 6. Atualizar rotina de migração

Renomear a função de migração para `gestao-migrate-supabase-to-r2` e ajustar o destino:

- Buckets públicos legados vão para `lunari-previews`:
  - `avatars`
  - `blog-images`
  - `formulario-uploads`

- Buckets privados legados vão para `lunari-private`:
  - `client-documents`
  - `contratos-assinados`

Atualizar metadados no banco:

- `profiles.avatar_url`
- `profiles.logo_url`
- `blog_posts.featured_image_url`
- `clientes_documentos.r2_storage_path`
- `contratos.r2_arquivo_assinado_path`
- `task_attachments.storage_path`

### 7. Limpar inconsistências de UI/UX

- Remover toast de sucesso em upload de imagem de blog, porque o projeto tem padrão de não usar toast de sucesso para CRUD/upload simples.
- Mostrar erro específico quando a Edge Function retornar erro.
- Em uploads, manter feedback visual de “enviando” e permitir nova tentativa.

### 8. Validação pós-correção

Testar os fluxos principais:

1. Minha Conta → Trocar Logo
   - Deve salvar em `https://media.lunarihub.com/gestao/logos/...`
   - Deve atualizar `profiles.logo_url`.

2. Avatar/perfil, se existir no fluxo
   - Deve salvar em `https://media.lunarihub.com/gestao/avatars/...`

3. Blog/conteúdo
   - Upload de imagem deve salvar em `gestao/blog/...` no bucket público.

4. Formulário público
   - Upload sem login deve funcionar via `gestao-r2-public-upload`.

5. Documento de cliente
   - Deve salvar no bucket privado.
   - Deve abrir somente por URL assinada.

6. Contrato assinado
   - Upload manual e sync Autentique devem salvar no bucket privado.
   - Visualização/download deve usar URL assinada.

7. Gallery
   - Confirmar que o upload de fotos do Gallery continua usando a função `r2-upload` original e não foi sobrescrito.

## Passo a passo manual necessário no Cloudflare

### A. Verificar bucket público existente

1. Entrar no painel Cloudflare.
2. Ir em **R2 Object Storage**.
3. Abrir o bucket `lunari-previews`.
4. Confirmar que o domínio público/custom domain é:

```text
media.lunarihub.com
```

5. Manter esse bucket para arquivos públicos e previews do Gallery.

### B. Criar bucket privado recomendado

1. Em **R2 Object Storage**, clicar em **Create bucket**.
2. Nome sugerido:

```text
lunari-private
```

3. Não conectar custom domain público nesse bucket.
4. Não ativar acesso público direto.

### C. Ajustar token/API key R2

1. Ir em **R2 → Manage R2 API Tokens**.
2. Criar ou editar um token com permissão:

```text
Object Read & Write
```

3. Escopo recomendado:

```text
lunari-previews
lunari-private
```

4. Copiar:

```text
Account ID
Access Key ID
Secret Access Key
```

5. Se o token atual só tiver acesso ao bucket do Gallery, será necessário gerar um novo token com acesso aos dois buckets.

### D. Secrets no Supabase

Já existem estes secrets:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

Após criar o bucket privado, eu vou configurar o código para usar:

```text
R2_PUBLIC_BUCKET = lunari-previews
R2_PRIVATE_BUCKET = lunari-private
R2_CDN_BASE = https://media.lunarihub.com
```

Esses três podem ser hardcoded como configuração segura não secreta ou adicionados como secrets/config runtime para facilitar manutenção. Minha recomendação é usar runtime env/secrets para evitar novo deploy se algum nome mudar.

### E. CORS

O CORS que você colocou no bucket público está adequado para leitura pública e cenários futuros de upload direto. Para o fluxo atual, o upload real acontece assim:

```text
Browser → Supabase Edge Function → Cloudflare R2
```

Ou seja, CORS do bucket não é a causa principal do erro 400 atual. O erro atual vem do conflito da função `r2-upload` com o Gallery.

## Resultado esperado

Depois da correção:

- O upload de logo deixa de chamar a função do Gallery.
- O Gallery continua funcionando sem regressão.
- Arquivos públicos usam `media.lunarihub.com`.
- Arquivos privados deixam de ficar no bucket público e passam a usar URL assinada real.
- Os erros de upload passam a mostrar mensagens úteis para diagnóstico.
- A migração do Supabase Storage para R2 fica segura e separada por tipo de dado.