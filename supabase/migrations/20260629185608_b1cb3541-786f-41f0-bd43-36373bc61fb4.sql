
-- Função server-side para promover Agendado → Faturado quando vencido
create or replace function public.fin_promote_overdue_to_faturado()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.fin_transactions
     set status = 'Faturado'
   where status = 'Agendado'
     and data_vencimento <= (now() at time zone 'America/Sao_Paulo')::date;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

grant execute on function public.fin_promote_overdue_to_faturado() to service_role;
grant execute on function public.fin_promote_overdue_to_faturado() to authenticated;

-- Agendamento diário 03:05 UTC (= 00:05 BRT)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'fin-promote-overdue-daily') then
    perform cron.unschedule('fin-promote-overdue-daily');
  end if;
  perform cron.schedule(
    'fin-promote-overdue-daily',
    '5 3 * * *',
    $cron$select public.fin_promote_overdue_to_faturado();$cron$
  );
end
$$;
