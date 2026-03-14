
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'blog';
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS route_reference TEXT;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- Update RLS to allow authenticated users to read published help articles
CREATE POLICY "Authenticated can view published help posts"
  ON public.blog_posts
  FOR SELECT
  TO authenticated
  USING (status = 'published' AND type = 'help');
