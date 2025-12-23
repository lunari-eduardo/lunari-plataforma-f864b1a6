-- Criar tabela blog_posts para sistema de conteúdos/blog
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  meta_title text,
  meta_description text,
  featured_image_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para performance em consultas públicas
CREATE INDEX idx_blog_posts_status_published ON blog_posts(status, published_at DESC) WHERE status = 'published';
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);

-- Trigger para updated_at
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ativar RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Leitura pública: apenas artigos publicados (sem autenticação)
CREATE POLICY "Public can view published posts"
  ON public.blog_posts FOR SELECT
  USING (status = 'published');

-- Admins podem gerenciar todos os posts (INSERT, UPDATE, DELETE, SELECT all)
CREATE POLICY "Admins can manage all posts"
  ON public.blog_posts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));