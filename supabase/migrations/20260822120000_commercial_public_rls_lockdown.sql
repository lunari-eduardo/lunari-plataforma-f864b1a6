-- ============================================================
-- COMERCIAL: LOCKDOWN DE RLS PÚBLICA
-- ============================================================
-- Problema: policies de SELECT anônimo com USING (is_active = true)
-- permitiam que QUALQUER anônimo listasse shares/links de TODOS os
-- fotógrafos (incluindo `note` interna, tokens, lead_id, cliente_id).
-- A leitura pública já é feita exclusivamente pela Edge Function
-- `get-public-material` com service role (bypassa RLS e valida
-- token/slug individualmente), portanto o acesso anônimo direto
-- às tabelas é desnecessário.
--
-- Também remove a view share_analytics_summary: criada sem
-- security_invoker (roda como owner e bypassa RLS das tabelas base),
-- exposta a qualquer authenticated, e não utilizada pelo frontend.
-- ============================================================

-- 1. Remove policies públicas anônimas
DROP POLICY IF EXISTS "Public can read active shares by token"
  ON public.material_shares;

DROP POLICY IF EXISTS "Public can read active share links by slug"
  ON public.material_share_links;

DROP POLICY IF EXISTS "Public can read slug history"
  ON public.material_share_link_slugs;

-- 2. Revoga SELECT anônimo (leitura pública só via edge function com service role)
REVOKE SELECT ON public.material_shares FROM anon;
REVOKE SELECT ON public.material_share_links FROM anon;
REVOKE SELECT ON public.material_share_link_slugs FROM anon;

-- 3. Remove view sem security_invoker e não utilizada
DROP VIEW IF EXISTS public.share_analytics_summary;
