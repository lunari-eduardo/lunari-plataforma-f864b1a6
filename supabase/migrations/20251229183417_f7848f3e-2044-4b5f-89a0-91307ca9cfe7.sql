-- Step 1: Delete all duplicate credit cards, keeping only the oldest one for each (user_id, nome)
DELETE FROM fin_credit_cards
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, nome) id
  FROM fin_credit_cards
  ORDER BY user_id, nome, created_at ASC
);

-- Step 2: Create unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_fin_credit_cards_unique_name 
ON fin_credit_cards (user_id, nome) 
WHERE ativo = true;