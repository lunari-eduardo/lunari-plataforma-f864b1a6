-- 1. Tabela para histórico de galerias excluídas (CRM)
CREATE TABLE IF NOT EXISTS public.galerias_arquivadas (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    session_id TEXT,
    nome_sessao TEXT,
    nome_pacote TEXT,
    tipo TEXT,
    fotos_incluidas INTEGER DEFAULT 0,
    fotos_selecionadas INTEGER DEFAULT 0,
    total_fotos_extras_vendidas INTEGER DEFAULT 0,
    valor_total_vendido NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.galerias_arquivadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own archived galleries" ON public.galerias_arquivadas;
CREATE POLICY "Users can view own archived galleries"
    ON public.galerias_arquivadas FOR SELECT
    USING (auth.uid() = user_id);

-- 2. Trigger para arquivar a galeria ao deletar e preservar dados extras no workflow
CREATE OR REPLACE FUNCTION public.trg_archive_gallery_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Salvar resumo na tabela de arquivadas para visualização no Perfil do Cliente
    INSERT INTO public.galerias_arquivadas (
        id, user_id, cliente_id, session_id, nome_sessao, nome_pacote,
        tipo, fotos_incluidas, fotos_selecionadas,
        total_fotos_extras_vendidas, valor_total_vendido,
        created_at, finalized_at
    ) VALUES (
        OLD.id, OLD.user_id, OLD.cliente_id, OLD.session_id, OLD.nome_sessao, OLD.nome_pacote,
        OLD.tipo, OLD.fotos_incluidas, OLD.fotos_selecionadas,
        OLD.total_fotos_extras_vendidas, OLD.valor_total_vendido,
        OLD.created_at, OLD.finalized_at
    ) ON CONFLICT (id) DO NOTHING;

    -- Garantir que a sessão mantenha a informação de fotos extras se a galeria for excluída
    -- (Fallback utilizado em workflow_photo_production_month e na Analise de Vendas)
    IF OLD.session_id IS NOT NULL THEN
        UPDATE public.clientes_sessoes
        SET 
            qtd_fotos_extra = GREATEST(COALESCE(qtd_fotos_extra, 0), OLD.total_fotos_extras_vendidas),
            valor_total_foto_extra = GREATEST(COALESCE(valor_total_foto_extra, 0), OLD.valor_total_vendido)
        WHERE session_id = OLD.session_id AND user_id = OLD.user_id;
    END IF;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_archive_gallery ON public.galerias;
CREATE TRIGGER trigger_archive_gallery
    BEFORE DELETE ON public.galerias
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_archive_gallery_on_delete();
