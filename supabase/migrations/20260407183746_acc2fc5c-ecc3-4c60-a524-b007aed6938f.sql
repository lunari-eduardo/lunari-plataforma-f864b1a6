
-- Remove duplicates keeping only the most recent response per formulario_id
DELETE FROM public.formulario_respostas
WHERE id NOT IN (
  SELECT DISTINCT ON (formulario_id) id
  FROM public.formulario_respostas
  ORDER BY formulario_id, submitted_at DESC NULLS LAST, created_at DESC
);

-- Add unique constraint to prevent multiple responses per form
CREATE UNIQUE INDEX IF NOT EXISTS idx_formulario_respostas_unique_formulario 
ON public.formulario_respostas (formulario_id);

-- RPC for public reading of response via public_token (no auth needed)
CREATE OR REPLACE FUNCTION public.get_formulario_resposta_publica(p_token text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'respostas', fr.respostas,
    'respondente_nome', fr.respondente_nome,
    'respondente_email', fr.respondente_email,
    'submitted_at', fr.submitted_at,
    'campos', f.campos,
    'titulo', COALESCE(f.titulo_cliente, f.titulo),
    'mensagem_conclusao', f.mensagem_conclusao
  )
  FROM public.formularios f
  JOIN public.formulario_respostas fr ON fr.formulario_id = f.id
  WHERE f.public_token = p_token
    AND f.status_envio = 'respondido'
  LIMIT 1;
$$;
