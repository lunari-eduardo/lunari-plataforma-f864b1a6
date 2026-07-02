-- 1) Remover trigger e função que forçavam etapa default em toda sessão nova
DROP TRIGGER IF EXISTS trg_default_session_status ON public.clientes_sessoes;
DROP FUNCTION IF EXISTS public.default_session_status();

-- 2) Reverter as 17 sessões marcadas como "Backup" pelo backfill da migração
--    20260701162536 (execução em 2026-07-01). Sessões anteriores (marcadas
--    manualmente antes dessa data) são preservadas.
UPDATE public.clientes_sessoes
   SET status = NULL,
       updated_at = now()
 WHERE status = 'Backup'
   AND updated_at >= '2026-07-01 00:00:00+00'
   AND updated_at <  '2026-07-02 00:00:00+00';

-- 3) Documentar semântica de status vazio na coluna
COMMENT ON COLUMN public.clientes_sessoes.status IS
  'Etapa do funil (livre, definida em etapas_trabalho). NULL/vazio = intencionalmente sem etapa. Nenhum trigger/função pode aplicar default automático.';