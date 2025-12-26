-- Deletar duplicatas de cartões de crédito, mantendo apenas o mais recente de cada (user_id, nome)
DELETE FROM fin_credit_cards
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, nome) id
  FROM fin_credit_cards
  ORDER BY user_id, nome, created_at DESC
);