CREATE POLICY "Anon can read submitted respostas for public forms"
ON public.formulario_respostas FOR SELECT TO anon
USING (
  formulario_id IN (
    SELECT id FROM public.formularios 
    WHERE public_token IS NOT NULL AND status = 'publicado'
  )
);