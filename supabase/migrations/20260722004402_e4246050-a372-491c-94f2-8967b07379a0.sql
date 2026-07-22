
-- 1) Freeze on delete robusto: derivar quantidade viva antes de apagar galeria
CREATE OR REPLACE FUNCTION public.freeze_session_extras_on_gallery_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_unit           numeric;
  v_qtd_derived    integer;
  v_qtd_final      integer;
  v_current_qtd    integer;
  v_current_total  numeric;
  v_existing_snap  jsonb;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN OLD; END IF;

  -- Valor unitário efetivo (prioriza regras congeladas da galeria)
  v_unit := COALESCE(
    NULLIF((OLD.regras_congeladas->'pacote'->>'valorFotoExtraEfetivo')::numeric, 0),
    NULLIF((OLD.regras_congeladas->'pacote'->>'valorFotoExtra')::numeric, 0),
    NULLIF(OLD.valor_foto_extra, 0)
  );

  -- Quantidade derivada da galeria (mesma regra do RPC workflow_session_financials)
  v_qtd_derived := COALESCE(OLD.total_fotos_extras_vendidas, 0);
  IF OLD.status = 'selecao_completa' THEN
    v_qtd_derived := GREATEST(
      v_qtd_derived,
      COALESCE(OLD.fotos_selecionadas, 0) - COALESCE(OLD.fotos_incluidas, 0)
    );
  END IF;
  v_qtd_derived := GREATEST(v_qtd_derived, 0);

  FOR v_current_qtd, v_current_total, v_existing_snap IN
    SELECT s.qtd_fotos_extra, s.valor_total_foto_extra, s.snapshot_extras_at_gallery_delete
      FROM public.clientes_sessoes s
     WHERE s.galeria_id = OLD.id
  LOOP
    -- Nunca reduzir o que a sessão já tem gravado
    v_qtd_final := GREATEST(COALESCE(v_current_qtd, 0), v_qtd_derived);

    UPDATE public.clientes_sessoes s
       SET extras_overridden = true,
           qtd_fotos_extra   = v_qtd_final,
           valor_foto_extra  = COALESCE(NULLIF(s.valor_foto_extra, 0), v_unit, s.valor_foto_extra),
           valor_total_foto_extra = ROUND(
             (v_qtd_final * COALESCE(NULLIF(s.valor_foto_extra, 0), v_unit, 0))::numeric, 2
           ),
           snapshot_extras_at_gallery_delete = jsonb_build_object(
             'galeria_id',            OLD.id,
             'deleted_at',            now(),
             'motivo',                'frozen_from_gallery_state',
             'qtd_pre_freeze',        COALESCE(v_current_qtd, 0),
             'qtd_derived',           v_qtd_derived,
             'qtd_final',             v_qtd_final,
             'fotos_selecionadas',    OLD.fotos_selecionadas,
             'fotos_incluidas',       OLD.fotos_incluidas,
             'galeria_total_vendidas', OLD.total_fotos_extras_vendidas,
             'galeria_valor_vendido',  OLD.valor_total_vendido,
             'galeria_status',        OLD.status,
             'valor_foto_extra',      COALESCE(NULLIF(s.valor_foto_extra,0), v_unit),
             'previous_snapshot',     v_existing_snap
           ),
           updated_at = now()
     WHERE s.galeria_id = OLD.id;
  END LOOP;

  BEGIN
    INSERT INTO public.audit_log (action, resource_type, resource_id, gallery_id, metadata)
    VALUES (
      'freeze_session_extras_on_gallery_delete',
      'galerias',
      OLD.id,
      OLD.id,
      jsonb_build_object(
        'qtd_derived', v_qtd_derived,
        'unit', v_unit,
        'status', OLD.status,
        'fotos_selecionadas', OLD.fotos_selecionadas,
        'fotos_incluidas', OLD.fotos_incluidas,
        'total_fotos_extras_vendidas', OLD.total_fotos_extras_vendidas
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN OLD;
END;
$function$;

-- 2) Data-fix: restaurar extras da sessão da Evelise (galeria já deletada)
UPDATE public.clientes_sessoes
   SET qtd_fotos_extra = 1,
       valor_foto_extra = 2,
       valor_total_foto_extra = 2.00,
       extras_overridden = true,
       snapshot_extras_at_gallery_delete =
         COALESCE(snapshot_extras_at_gallery_delete, '{}'::jsonb)
         || jsonb_build_object(
              'restaurado_manualmente', true,
              'restaurado_em', now(),
              'motivo_restauracao', 'freeze anterior congelou zero — extras vivos derivados da galeria pré-delete'
            ),
       updated_at = now()
 WHERE id = '0a3bb26a-d414-475a-ab54-cfec3d86f052'
   AND qtd_fotos_extra = 0;
