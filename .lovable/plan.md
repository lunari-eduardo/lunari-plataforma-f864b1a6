

# R2 Media Upload for Gestão — Using Existing Gallery Infrastructure

## Analysis

The Gallery project's `r2-upload` edge function uploads to bucket **`lunari-previews`** using secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — already configured in the shared Supabase. Files are served via **`https://media.lunarihub.com`**.

You created a new bucket `lunari-media`, but it has **no custom domain** and **no public URL** configured. Setting up a new domain would add complexity.

**Recommended approach**: Use the existing `lunari-previews` bucket with a `media/` path prefix. Files would be at `media.lunarihub.com/media/blog/...`, `media.lunarihub.com/media/form/...`, etc. No new bucket config needed, no new domain, same R2 credentials.

## Bucket Config

For `lunari-media` (if you prefer a separate bucket): you'd need to either enable the Public Development URL or add a custom domain (e.g., `assets.lunarihub.com`).

**If you're OK using `lunari-previews` with a `media/` prefix, no bucket config is needed.**

## Changes (5 files)

### 1. New: `supabase/functions/r2-media-upload/index.ts`
Simplified version of Gallery's `r2-upload`:
- Same AWS Sig V4 signing logic (copied from Gallery)
- Auth via Supabase JWT (no credit system)
- Accepts `file` + `context` (blog/form/task) via FormData
- Uploads to `lunari-previews` bucket at path `media/{context}/{userId}/{timestamp}-{random}.{ext}`
- Returns public URL: `https://media.lunarihub.com/media/...`
- Size limits: 10MB images, 50MB videos

### 2. Update: `supabase/config.toml`
Add `[functions.r2-media-upload]` with `verify_jwt = false`

### 3. New: `src/hooks/useR2Upload.ts`
```text
useR2Upload(context: 'blog' | 'form' | 'task')
  → uploadFile(file: File): Promise<string>  // returns CDN URL
  → uploading: boolean
```
Calls the edge function via `supabase.functions.invoke('r2-media-upload', { body: FormData })`.

### 4. Update: `src/components/blog/blocks/ImageBlock.tsx`
Replace Supabase Storage (`blog-images` bucket) with `useR2Upload('blog')`.

### 5. Update: `src/components/blog/blocks/VideoBlock.tsx`
Add file upload tab (alongside URL input) using `useR2Upload('blog')` for MP4/WebM files.

### Not changed (keep as-is)
- `FormularioPublico.tsx` — public forms (no auth, R2 requires JWT; keep Supabase Storage)
- `TaskDocumentForm.tsx` — uses `URL.createObjectURL` (local only; separate concern)
- Avatars, client-documents — small files, working fine on Supabase Storage

## Technical Notes
- R2 secrets are already in Supabase (shared with Gallery) — no new secrets needed
- The `media/` prefix cleanly separates Gestão uploads from Gallery's `galleries/` prefix
- Both projects deploy edge functions to the same Supabase — the new function won't interfere with `r2-upload`

