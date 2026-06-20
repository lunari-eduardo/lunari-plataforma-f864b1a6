
-- ========== ENUMS ==========
CREATE TYPE public.support_ticket_status AS ENUM
  ('novo','recebido','em_analise','aguardando_cliente','resolvido','resolvido_whatsapp','fechado');
CREATE TYPE public.support_ticket_priority AS ENUM ('baixa','normal','alta','urgente');
CREATE TYPE public.support_ticket_category AS ENUM
  ('problema_tecnico','duvida','sugestao','financeiro','conta','galerias','outro');
CREATE TYPE public.support_suggestion_status AS ENUM
  ('recebida','em_analise','planejada','em_desenvolvimento','implementada','recusada');
CREATE TYPE public.support_faq_category AS ENUM
  ('conta','galerias','lunari_studio','lunari_gallery','financeiro','assinatura','configuracoes','outros');
CREATE TYPE public.support_message_author_role AS ENUM ('user','admin','system');
CREATE TYPE public.support_attachment_kind AS ENUM ('image','video');

-- ========== HELPERS ==========
CREATE OR REPLACE FUNCTION public.support_is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.support_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

-- ========== TICKETS ==========
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  user_id uuid NOT NULL,
  assunto text NOT NULL CHECK (char_length(assunto) BETWEEN 3 AND 200),
  categoria public.support_ticket_category NOT NULL,
  status public.support_ticket_status NOT NULL DEFAULT 'novo',
  priority public.support_ticket_priority NOT NULL DEFAULT 'normal',
  suggestion_status public.support_suggestion_status,
  assigned_to uuid,
  technical_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (suggestion_status IS NULL OR categoria = 'sugestao')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_support_tickets_user_created ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX idx_support_tickets_status ON public.support_tickets (status);
CREATE INDEX idx_support_tickets_categoria ON public.support_tickets (categoria);
CREATE INDEX idx_support_tickets_last_msg ON public.support_tickets (last_message_at DESC);
CREATE INDEX idx_support_tickets_assigned ON public.support_tickets (assigned_to) WHERE assigned_to IS NOT NULL;

CREATE TRIGGER trg_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.support_set_updated_at();

CREATE OR REPLACE FUNCTION public.support_tickets_user_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.support_is_admin(auth.uid())
     AND auth.uid() = OLD.user_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.suggestion_status IS DISTINCT FROM OLD.suggestion_status
       OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
       OR NEW.technical_snapshot IS DISTINCT FROM OLD.technical_snapshot
       OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
       OR NEW.numero IS DISTINCT FROM OLD.numero
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Não permitido alterar campos administrativos do chamado';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_support_tickets_user_guard
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.support_tickets_user_guard();

CREATE OR REPLACE FUNCTION public.support_tickets_set_closed_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('fechado','resolvido','resolvido_whatsapp')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.closed_at IS NULL THEN
    NEW.closed_at := now();
  END IF;
  IF NEW.status NOT IN ('fechado','resolvido','resolvido_whatsapp')
     AND OLD.status IN ('fechado','resolvido','resolvido_whatsapp') THEN
    NEW.closed_at := NULL;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_support_tickets_closed_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.support_tickets_set_closed_at();

CREATE POLICY "users_select_own_tickets" ON public.support_tickets
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.support_is_admin(auth.uid()));
CREATE POLICY "users_insert_own_tickets" ON public.support_tickets
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users_update_own_tickets" ON public.support_tickets
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.support_is_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.support_is_admin(auth.uid()));
CREATE POLICY "admin_delete_tickets" ON public.support_tickets
FOR DELETE TO authenticated USING (public.support_is_admin(auth.uid()));

-- ========== MESSAGES ==========
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_role public.support_message_author_role NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_support_messages_ticket ON public.support_messages (ticket_id, created_at);

CREATE OR REPLACE FUNCTION public.support_messages_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.support_tickets%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.support_tickets WHERE id = NEW.ticket_id;
  UPDATE public.support_tickets
  SET last_message_at = now(),
      status = CASE
        WHEN NEW.author_role = 'user' AND t.status = 'aguardando_cliente' THEN 'em_analise'::public.support_ticket_status
        WHEN NEW.author_role = 'admin' AND t.status = 'novo' THEN 'recebido'::public.support_ticket_status
        ELSE t.status
      END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_support_messages_after_insert
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.support_messages_after_insert();

CREATE POLICY "select_messages_of_accessible_tickets" ON public.support_messages
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
  AND (t.user_id = auth.uid() OR public.support_is_admin(auth.uid()))));
CREATE POLICY "insert_messages_user" ON public.support_messages
FOR INSERT TO authenticated
WITH CHECK (
  author_id = auth.uid() AND (
    (author_role = 'user' AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()))
    OR (author_role = 'admin' AND public.support_is_admin(auth.uid()))
  )
);
CREATE POLICY "admin_modify_messages" ON public.support_messages
FOR UPDATE TO authenticated USING (public.support_is_admin(auth.uid())) WITH CHECK (public.support_is_admin(auth.uid()));
CREATE POLICY "admin_delete_messages" ON public.support_messages
FOR DELETE TO authenticated USING (public.support_is_admin(auth.uid()));

-- ========== ATTACHMENTS ==========
CREATE TABLE public.support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.support_messages(id) ON DELETE CASCADE,
  kind public.support_attachment_kind NOT NULL,
  r2_key text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_attachments TO authenticated;
GRANT ALL ON public.support_attachments TO service_role;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_support_attachments_ticket ON public.support_attachments (ticket_id);

CREATE POLICY "select_attachments_of_accessible_tickets" ON public.support_attachments
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
  AND (t.user_id = auth.uid() OR public.support_is_admin(auth.uid()))));
CREATE POLICY "insert_attachments_owner_or_admin" ON public.support_attachments
FOR INSERT TO authenticated
WITH CHECK (uploaded_by = auth.uid() AND EXISTS (
  SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
    AND (t.user_id = auth.uid() OR public.support_is_admin(auth.uid()))));
CREATE POLICY "delete_own_attachments_or_admin" ON public.support_attachments
FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.support_is_admin(auth.uid()));

-- ========== INTERNAL NOTES ==========
CREATE TABLE public.support_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_internal_notes TO authenticated;
GRANT ALL ON public.support_internal_notes TO service_role;
ALTER TABLE public.support_internal_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_support_internal_notes_ticket ON public.support_internal_notes (ticket_id, created_at);
CREATE POLICY "admin_only_internal_notes" ON public.support_internal_notes
FOR ALL TO authenticated
USING (public.support_is_admin(auth.uid()))
WITH CHECK (public.support_is_admin(auth.uid()) AND author_id = auth.uid());

-- ========== FAQ ARTICLES ==========
CREATE TABLE public.support_faq_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  category public.support_faq_category NOT NULL,
  pergunta text NOT NULL,
  resposta text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  media jsonb NOT NULL DEFAULT '[]'::jsonb,
  ordem int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  views_count int NOT NULL DEFAULT 0,
  helpful_count int NOT NULL DEFAULT 0,
  not_helpful_count int NOT NULL DEFAULT 0,
  source_ticket_id uuid,
  search_tsv tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_faq_articles TO authenticated;
GRANT ALL ON public.support_faq_articles TO service_role;
ALTER TABLE public.support_faq_articles ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_support_faq_articles_search ON public.support_faq_articles USING GIN (search_tsv);
CREATE INDEX idx_support_faq_articles_cat_ordem ON public.support_faq_articles (category, ordem);
CREATE INDEX idx_support_faq_articles_published ON public.support_faq_articles (published, active);

CREATE OR REPLACE FUNCTION public.support_faq_set_tsv()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('portuguese', coalesce(NEW.pergunta,'')), 'A') ||
    setweight(to_tsvector('portuguese', array_to_string(coalesce(NEW.keywords,'{}'),' ')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.resposta,'')), 'C');
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_support_faq_tsv
BEFORE INSERT OR UPDATE OF pergunta, resposta, keywords ON public.support_faq_articles
FOR EACH ROW EXECUTE FUNCTION public.support_faq_set_tsv();
CREATE TRIGGER trg_support_faq_articles_updated_at
BEFORE UPDATE ON public.support_faq_articles
FOR EACH ROW EXECUTE FUNCTION public.support_set_updated_at();

CREATE POLICY "select_published_faq" ON public.support_faq_articles
FOR SELECT TO authenticated
USING ((published AND active) OR public.support_is_admin(auth.uid()));
CREATE POLICY "admin_insert_faq" ON public.support_faq_articles
FOR INSERT TO authenticated WITH CHECK (public.support_is_admin(auth.uid()));
CREATE POLICY "admin_update_faq" ON public.support_faq_articles
FOR UPDATE TO authenticated USING (public.support_is_admin(auth.uid())) WITH CHECK (public.support_is_admin(auth.uid()));
CREATE POLICY "admin_delete_faq" ON public.support_faq_articles
FOR DELETE TO authenticated USING (public.support_is_admin(auth.uid()));

-- ========== FAQ FEEDBACK ==========
CREATE TABLE public.support_faq_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.support_faq_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  helpful boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (article_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_faq_feedback TO authenticated;
GRANT ALL ON public.support_faq_feedback TO service_role;
ALTER TABLE public.support_faq_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_or_admin_feedback" ON public.support_faq_feedback
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.support_is_admin(auth.uid()));
CREATE POLICY "insert_own_feedback" ON public.support_faq_feedback
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update_own_feedback" ON public.support_faq_feedback
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ========== RPCs ==========
CREATE OR REPLACE FUNCTION public.support_faq_search(q text, lim int DEFAULT 30)
RETURNS SETOF public.support_faq_articles
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT *
  FROM public.support_faq_articles
  WHERE active AND (published OR public.support_is_admin(auth.uid()))
    AND (coalesce(trim(q), '') = '' OR search_tsv @@ plainto_tsquery('portuguese', q))
  ORDER BY
    CASE WHEN coalesce(trim(q),'') = '' THEN 0
         ELSE ts_rank(search_tsv, plainto_tsquery('portuguese', q)) END DESC,
    ordem ASC, created_at DESC
  LIMIT GREATEST(1, LEAST(coalesce(lim, 30), 100));
$$;
GRANT EXECUTE ON FUNCTION public.support_faq_search(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_faq_increment_view(_article_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.support_faq_articles
  SET views_count = views_count + 1
  WHERE id = _article_id AND active AND published;
$$;
GRANT EXECUTE ON FUNCTION public.support_faq_increment_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_faq_register_feedback(_article_id uuid, _helpful boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth.uid() is null'; END IF;
  INSERT INTO public.support_faq_feedback (article_id, user_id, helpful)
  VALUES (_article_id, _uid, _helpful)
  ON CONFLICT (article_id, user_id) DO UPDATE SET helpful = EXCLUDED.helpful, created_at = now();
  UPDATE public.support_faq_articles a
  SET helpful_count = (SELECT count(*) FROM public.support_faq_feedback WHERE article_id = a.id AND helpful),
      not_helpful_count = (SELECT count(*) FROM public.support_faq_feedback WHERE article_id = a.id AND NOT helpful)
  WHERE a.id = _article_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.support_faq_register_feedback(uuid, boolean) TO authenticated;

-- ========== REALTIME ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_internal_notes;
