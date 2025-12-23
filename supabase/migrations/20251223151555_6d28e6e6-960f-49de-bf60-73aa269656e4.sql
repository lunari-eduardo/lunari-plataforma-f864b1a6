-- Criar bucket para imagens do blog
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para blog-images
-- Leitura pública (imagens do blog são públicas)
CREATE POLICY "Blog images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');

-- Upload apenas para usuários autenticados
CREATE POLICY "Authenticated users can upload blog images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'blog-images' AND auth.uid() IS NOT NULL);

-- Delete apenas para quem fez upload
CREATE POLICY "Users can delete their own blog images"
ON storage.objects FOR DELETE
USING (bucket_id = 'blog-images' AND auth.uid()::text = (storage.foldername(name))[1]);