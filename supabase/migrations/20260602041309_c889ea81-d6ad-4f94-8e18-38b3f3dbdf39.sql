UPDATE public.fin_items_master im
SET ativo = true, updated_at = now()
WHERE ativo = false
  AND (
    EXISTS (SELECT 1 FROM public.fin_transactions t WHERE t.item_id = im.id)
    OR EXISTS (SELECT 1 FROM public.fin_recurring_blueprints r WHERE r.item_id = im.id)
  );