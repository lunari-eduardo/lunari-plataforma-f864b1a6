-- Create unique constraints for tabelas_precos table
CREATE UNIQUE INDEX IF NOT EXISTS tabelas_precos_global_unique 
ON tabelas_precos (user_id, tipo) 
WHERE tipo = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS tabelas_precos_categoria_unique 
ON tabelas_precos (user_id, tipo, categoria_id) 
WHERE tipo = 'categoria' AND categoria_id IS NOT NULL;