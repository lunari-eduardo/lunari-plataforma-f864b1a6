-- 1) Religar transações de itens duplicados ao item canônico (mais antigo) antes de remover
WITH ranked AS (
  SELECT id, user_id, lower(nome) as nome_l, grupo_principal,
    FIRST_VALUE(id) OVER (
      PARTITION BY user_id, lower(nome), grupo_principal
      ORDER BY created_at ASC, id ASC
    ) AS canonical_id
  FROM public.fin_items_master
)
UPDATE public.fin_transactions t
SET item_id = r.canonical_id
FROM ranked r
WHERE t.item_id = r.id
  AND r.id <> r.canonical_id;

-- 2) Religar quaisquer outras tabelas que referenciem item_id (defensivo - se não existir, no-op)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cobrancas' AND column_name='item_id') THEN
    EXECUTE $sql$
      WITH ranked AS (
        SELECT id, FIRST_VALUE(id) OVER (
          PARTITION BY user_id, lower(nome), grupo_principal
          ORDER BY created_at ASC, id ASC
        ) AS canonical_id
        FROM public.fin_items_master
      )
      UPDATE public.cobrancas c
      SET item_id = r.canonical_id
      FROM ranked r
      WHERE c.item_id = r.id AND r.id <> r.canonical_id;
    $sql$;
  END IF;
END $$;

-- 3) Deletar duplicatas (mantendo o canônico mais antigo)
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, lower(nome), grupo_principal
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.fin_items_master
)
DELETE FROM public.fin_items_master
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 4) Criar índice único para impedir duplicatas futuras (case-insensitive por nome+grupo+usuário)
CREATE UNIQUE INDEX IF NOT EXISTS fin_items_master_user_nome_grupo_uniq
  ON public.fin_items_master (user_id, lower(nome), grupo_principal);