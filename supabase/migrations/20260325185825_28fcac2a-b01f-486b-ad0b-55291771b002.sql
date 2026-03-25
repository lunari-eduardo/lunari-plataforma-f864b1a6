-- Delete 2 duplicate [auto-reconciled] transactions that were created by the 2026-03-24 migration
-- These sessions already had [retroativo] transactions with different description format
DELETE FROM clientes_transacoes 
WHERE id IN (
  '052cd661-bad8-45e1-962c-9d1c50503fe4',
  '138eecdb-fdee-4263-9fcd-844bc83f5ef5'
);