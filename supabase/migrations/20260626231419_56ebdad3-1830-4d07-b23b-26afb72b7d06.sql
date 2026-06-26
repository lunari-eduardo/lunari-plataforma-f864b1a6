-- Reduz egress de Realtime: payloads de UPDATE/DELETE passam a enviar apenas PK + colunas alteradas
-- em vez da linha inteira (REPLICA IDENTITY FULL → DEFAULT).
-- Tabelas mantidas em FULL (porque listeners consomem colunas do row antigo):
--   - appointments (status/date/time em useAppointmentWorkflowSync)
--   - clientes_transacoes (session_id em useWorkflowData/V2/WorkflowCacheContext)
ALTER TABLE public.clientes_sessoes REPLICA IDENTITY DEFAULT;
ALTER TABLE public.clientes REPLICA IDENTITY DEFAULT;
ALTER TABLE public.fin_transactions REPLICA IDENTITY DEFAULT;