

# R2 Media Upload — Implementado ✅

## Arquitetura

```text
Frontend (useR2Upload hook)
  → supabase.functions.invoke('r2-media-upload', FormData)
  → Edge Function autentica JWT + faz upload via AWS Sig V4
  → Cloudflare R2 (bucket: lunari-previews, prefix: media/)
  → Retorna URL pública: https://media.lunarihub.com/media/{context}/{userId}/{file}
```

## Arquivos Criados/Modificados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/r2-media-upload/index.ts` | ✅ Criado — Edge function com AWS Sig V4 |
| `supabase/config.toml` | ✅ Modificado — Adicionado config da função |
| `src/hooks/useR2Upload.ts` | ✅ Criado — Hook compartilhado para uploads R2 |
| `src/components/blog/blocks/ImageBlock.tsx` | ✅ Modificado — Usa R2 ao invés de Supabase Storage |
| `src/components/blog/blocks/VideoBlock.tsx` | ✅ Modificado — Adicionada aba de upload de vídeo via R2 |

## Detalhes Técnicos

- **Bucket**: `lunari-previews` (mesmo do Gallery)
- **Prefixo**: `media/` (separado do `galleries/` do Gallery)
- **CDN**: `https://media.lunarihub.com`
- **Secrets**: Reutiliza `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` já configurados
- **Limites**: 10MB imagens, 50MB vídeos
- **Contextos**: `blog`, `form`, `task`, `general`

## Não alterado (mantido como está)
- `FormularioPublico.tsx` — formulários públicos sem auth, mantém Supabase Storage
- `TaskDocumentForm.tsx` — usa URL.createObjectURL (local)
- Avatares, documentos de clientes — pequenos, funcionam bem no Supabase Storage
