-- ============================================================
-- MÓDULO: MATERIAIS COMERCIAIS — FASE 1: FUNDAÇÃO DO MODELO
-- ============================================================
-- Cobre:
--   1. active_version_id em commercial_materials + trigger
--   2. material_share_links (Link Público Permanente)
--   3. material_share_link_slugs (histórico de slugs)
--   4. material_shares (Compartilhamento Rastreável)
--   5. material_share_sessions (Sessões de Acesso)
--   6. material_share_events (Eventos Individuais)
--   7. commercial_automation_config (Configuração de Automação)
--   8. RLS em todas as tabelas
-- ============================================================


-- ============================================================
-- 1. ADICIONAR active_version_id EM commercial_materials
-- ============================================================

ALTER TABLE public.commercial_materials
  ADD COLUMN IF NOT EXISTS active_version_id uuid
    REFERENCES public.material_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commercial_materials_active_version
  ON public.commercial_materials(active_version_id);

-- Trigger: atualiza active_version_id quando uma versão é publicada
CREATE OR REPLACE FUNCTION public.sync_active_version_on_publish()
RETURNS TRIGGER AS $$
BEGIN
  -- Ao definir published_at em uma versão, atualizar o material pai
  IF NEW.published_at IS NOT NULL AND (OLD.published_at IS NULL OR OLD.published_at IS DISTINCT FROM NEW.published_at) THEN
    UPDATE public.commercial_materials
      SET active_version_id = NEW.id,
          updated_at = now()
      WHERE id = NEW.material_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_sync_active_version ON public.material_versions;
CREATE TRIGGER trigger_sync_active_version
  AFTER UPDATE OF published_at ON public.material_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_active_version_on_publish();


-- ============================================================
-- 2. FUNÇÃO AUXILIAR: slugify
-- Converte texto em slug URL-friendly (lowercase, hifens)
-- ============================================================

CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(input,
            'áàãâäéèêëíìîïóòõôöúùûüçñÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇÑ',
            'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
          ),
          '[^a-z0-9\s-]', '', 'g'
        ),
        '\s+', '-', 'g'
      ),
      '-{2,}', '-', 'g'
    )
  );
$$ LANGUAGE sql IMMUTABLE STRICT;


-- ============================================================
-- 3. material_share_links — LINK PÚBLICO PERMANENTE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.material_share_links (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id     uuid        NOT NULL REFERENCES public.commercial_materials(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug            text        NOT NULL,
  slug_updated_at timestamptz NOT NULL DEFAULT now(),
  is_active       boolean     NOT NULL DEFAULT true,
  total_views     integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(material_id),        -- um material = um link público
  UNIQUE(slug)                -- slug único globalmente
);

-- Normalizar slug sempre em lowercase
CREATE OR REPLACE FUNCTION public.normalize_share_link_slug()
RETURNS TRIGGER AS $$
BEGIN
  NEW.slug := lower(trim(NEW.slug));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_normalize_share_link_slug ON public.material_share_links;
CREATE TRIGGER trigger_normalize_share_link_slug
  BEFORE INSERT OR UPDATE OF slug ON public.material_share_links
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_share_link_slug();

-- Índices
CREATE INDEX IF NOT EXISTS idx_material_share_links_slug
  ON public.material_share_links(slug);
CREATE INDEX IF NOT EXISTS idx_material_share_links_user_id
  ON public.material_share_links(user_id);

-- RLS
ALTER TABLE public.material_share_links ENABLE ROW LEVEL SECURITY;

-- SELECT público por slug (sem autenticação) — para o visualizador público
CREATE POLICY "Public can read active share links by slug"
  ON public.material_share_links FOR SELECT
  USING (is_active = true);

-- Fotógrafo gerencia seus próprios links
CREATE POLICY "Users can manage own share links"
  ON public.material_share_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.material_share_links TO anon;
GRANT ALL ON public.material_share_links TO authenticated;
GRANT ALL ON public.material_share_links TO service_role;


-- ============================================================
-- 4. material_share_link_slugs — HISTÓRICO DE SLUGS
-- Preserva links antigos após personalização do slug
-- ============================================================

CREATE TABLE IF NOT EXISTS public.material_share_link_slugs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id  uuid        NOT NULL REFERENCES public.material_share_links(id) ON DELETE CASCADE,
  slug           text        NOT NULL,
  active_from    timestamptz NOT NULL DEFAULT now(),
  active_until   timestamptz,           -- NULL = ainda ativo (mas não será o slug principal)
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_link_slugs_slug
  ON public.material_share_link_slugs(slug);
CREATE INDEX IF NOT EXISTS idx_share_link_slugs_share_link_id
  ON public.material_share_link_slugs(share_link_id);

-- Trigger: ao alterar slug, salva o slug anterior no histórico
CREATE OR REPLACE FUNCTION public.archive_old_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.slug IS DISTINCT FROM NEW.slug THEN
    INSERT INTO public.material_share_link_slugs (share_link_id, slug, active_until)
    VALUES (OLD.id, OLD.slug, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_archive_old_slug ON public.material_share_links;
CREATE TRIGGER trigger_archive_old_slug
  BEFORE UPDATE OF slug ON public.material_share_links
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_old_slug();

-- RLS
ALTER TABLE public.material_share_link_slugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read slug history"
  ON public.material_share_link_slugs FOR SELECT
  USING (true);

GRANT SELECT ON public.material_share_link_slugs TO anon;
GRANT ALL ON public.material_share_link_slugs TO authenticated;
GRANT ALL ON public.material_share_link_slugs TO service_role;


-- ============================================================
-- 5. material_shares — COMPARTILHAMENTO RASTREÁVEL
-- ============================================================

-- Sequência para share_number por usuário
-- Implementada via função SQL para garantir unicidade
CREATE OR REPLACE FUNCTION public.next_share_number(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(share_number), 0) + 1
    INTO next_num
    FROM public.material_shares
    WHERE user_id = p_user_id;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TABLE IF NOT EXISTS public.material_shares (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id   uuid        NOT NULL REFERENCES public.commercial_materials(id) ON DELETE RESTRICT,
  version_id    uuid        NOT NULL REFERENCES public.material_versions(id) ON DELETE RESTRICT,
  lead_id       uuid        REFERENCES public.leads(id) ON DELETE SET NULL,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token         text        NOT NULL UNIQUE,               -- opaco, gerado externamente (nanoid/uuid)
  share_number  integer     NOT NULL,                      -- sequencial por user_id
  sent_at       timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,                               -- reservado para MVP futuro; sem lógica aqui
  note          text,                                      -- nota interna, nunca exposta publicamente
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, share_number)
);

-- Trigger: gera share_number automático se não fornecido
CREATE OR REPLACE FUNCTION public.auto_share_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.share_number IS NULL OR NEW.share_number = 0 THEN
    NEW.share_number := public.next_share_number(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_auto_share_number ON public.material_shares;
CREATE TRIGGER trigger_auto_share_number
  BEFORE INSERT ON public.material_shares
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_share_number();

-- Índices
CREATE INDEX IF NOT EXISTS idx_material_shares_token
  ON public.material_shares(token);
CREATE INDEX IF NOT EXISTS idx_material_shares_user_id
  ON public.material_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_material_shares_material_id
  ON public.material_shares(material_id);
CREATE INDEX IF NOT EXISTS idx_material_shares_lead_id
  ON public.material_shares(lead_id)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_material_shares_version_id
  ON public.material_shares(version_id);
CREATE INDEX IF NOT EXISTS idx_material_shares_sent_at
  ON public.material_shares(sent_at DESC);

-- RLS
ALTER TABLE public.material_shares ENABLE ROW LEVEL SECURITY;

-- SELECT público por token (para o visualizador /p/:token)
CREATE POLICY "Public can read active shares by token"
  ON public.material_shares FOR SELECT
  USING (is_active = true);

-- Fotógrafo gerencia seus próprios compartilhamentos
CREATE POLICY "Users can manage own shares"
  ON public.material_shares FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT ON public.material_shares TO anon;
GRANT ALL ON public.material_shares TO authenticated;
GRANT ALL ON public.material_shares TO service_role;


-- ============================================================
-- 6. material_share_sessions — SESSÕES DE ACESSO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.material_share_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id         uuid        REFERENCES public.material_shares(id) ON DELETE CASCADE,
  share_link_id    uuid        REFERENCES public.material_share_links(id) ON DELETE CASCADE,
  session_token    text        NOT NULL UNIQUE,  -- uuid gerado pelo cliente (efêmero, não persiste no browser)
  ip_hash          text,                         -- SHA-256 do IP, calculado na Edge Function
  user_agent       text,
  started_at       timestamptz NOT NULL DEFAULT now(),
  ended_at         timestamptz,
  duration_seconds integer,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_session_source
    CHECK (share_id IS NOT NULL OR share_link_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_share_sessions_share_id
  ON public.material_share_sessions(share_id)
  WHERE share_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_share_sessions_share_link_id
  ON public.material_share_sessions(share_link_id)
  WHERE share_link_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_share_sessions_session_token
  ON public.material_share_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_share_sessions_started_at
  ON public.material_share_sessions(started_at DESC);

-- RLS: escrita apenas via service_role (Edge Function); leitura restrita ao fotógrafo
ALTER TABLE public.material_share_sessions ENABLE ROW LEVEL SECURITY;

-- O fotógrafo pode ver as sessões dos seus compartilhamentos
CREATE POLICY "Users can read sessions of own shares"
  ON public.material_share_sessions FOR SELECT
  USING (
    (share_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.material_shares
      WHERE id = material_share_sessions.share_id
        AND user_id = auth.uid()
    ))
    OR
    (share_link_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.material_share_links
      WHERE id = material_share_sessions.share_link_id
        AND user_id = auth.uid()
    ))
  );

GRANT SELECT ON public.material_share_sessions TO authenticated;
GRANT ALL ON public.material_share_sessions TO service_role;


-- ============================================================
-- 7. material_share_events — EVENTOS INDIVIDUAIS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.material_share_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES public.material_share_sessions(id) ON DELETE CASCADE,
  event_type   text        NOT NULL,
  payload      jsonb       NOT NULL DEFAULT '{}',
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_event_type CHECK (
    event_type IN (
      'view_start',
      'view_end',
      'scroll_depth',
      'section_view',
      'cta_view',
      'cta_click',
      'link_click'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_share_events_session_id
  ON public.material_share_events(session_id);
CREATE INDEX IF NOT EXISTS idx_share_events_event_type
  ON public.material_share_events(event_type);
CREATE INDEX IF NOT EXISTS idx_share_events_occurred_at
  ON public.material_share_events(occurred_at DESC);

-- RLS: escrita via service_role; leitura pelo fotógrafo via join
ALTER TABLE public.material_share_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read events of own sessions"
  ON public.material_share_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.material_share_sessions s
      JOIN public.material_shares ms ON ms.id = s.share_id
      WHERE s.id = material_share_events.session_id
        AND ms.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.material_share_sessions s
      JOIN public.material_share_links msl ON msl.id = s.share_link_id
      WHERE s.id = material_share_events.session_id
        AND msl.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.material_share_events TO authenticated;
GRANT ALL ON public.material_share_events TO service_role;


-- ============================================================
-- 8. commercial_automation_config — CONFIGURAÇÃO DE AUTOMAÇÃO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.commercial_automation_config (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_advance_stage_on_share boolean     NOT NULL DEFAULT true,
  target_stage_key            text        NOT NULL DEFAULT 'orcamento_enviado',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at_automation_config()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_updated_at_automation_config ON public.commercial_automation_config;
CREATE TRIGGER trigger_updated_at_automation_config
  BEFORE UPDATE ON public.commercial_automation_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at_automation_config();

-- RLS
ALTER TABLE public.commercial_automation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own automation config"
  ON public.commercial_automation_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON public.commercial_automation_config TO authenticated;
GRANT ALL ON public.commercial_automation_config TO service_role;


-- ============================================================
-- 9. FUNÇÃO: get_or_create_automation_config
-- Retorna a config de automação do usuário, criando se não existir
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_or_create_automation_config(p_user_id uuid)
RETURNS public.commercial_automation_config AS $$
DECLARE
  config public.commercial_automation_config;
BEGIN
  SELECT * INTO config
    FROM public.commercial_automation_config
    WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.commercial_automation_config (user_id)
      VALUES (p_user_id)
      RETURNING * INTO config;
  END IF;

  RETURN config;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================
-- 10. VIEW: share_analytics_summary
-- Resumo de analytics por compartilhamento (para o fotógrafo)
-- ============================================================

CREATE OR REPLACE VIEW public.share_analytics_summary AS
SELECT
  ms.id                                               AS share_id,
  ms.user_id,
  ms.material_id,
  ms.version_id,
  ms.lead_id,
  ms.share_number,
  ms.sent_at,
  ms.token,
  ms.note,
  ms.is_active,
  COUNT(DISTINCT sess.id)                             AS total_sessions,
  MIN(sess.started_at)                                AS first_opened_at,
  MAX(sess.started_at)                                AS last_opened_at,
  COALESCE(SUM(sess.duration_seconds), 0)             AS total_duration_seconds,
  CASE
    WHEN COUNT(DISTINCT sess.id) = 0 THEN 'not_opened'
    WHEN MAX(sess.started_at) > now() - INTERVAL '24 hours' THEN 'recently_opened'
    ELSE 'opened'
  END                                                 AS open_status,
  COALESCE(
    (SELECT MAX((e.payload->>'percent')::int)
     FROM public.material_share_events e
     JOIN public.material_share_sessions s2 ON s2.id = e.session_id
     WHERE s2.share_id = ms.id
       AND e.event_type = 'scroll_depth'), 0
  )                                                   AS max_scroll_depth,
  COALESCE(
    (SELECT COUNT(*)
     FROM public.material_share_events e
     JOIN public.material_share_sessions s2 ON s2.id = e.session_id
     WHERE s2.share_id = ms.id
       AND e.event_type = 'cta_click'), 0
  )                                                   AS cta_clicks
FROM public.material_shares ms
LEFT JOIN public.material_share_sessions sess ON sess.share_id = ms.id
GROUP BY ms.id, ms.user_id, ms.material_id, ms.version_id, ms.lead_id,
         ms.share_number, ms.sent_at, ms.token, ms.note, ms.is_active;

GRANT SELECT ON public.share_analytics_summary TO authenticated;
GRANT SELECT ON public.share_analytics_summary TO service_role;


-- ============================================================
-- FIM DA MIGRATION: FASE 1
-- ============================================================
