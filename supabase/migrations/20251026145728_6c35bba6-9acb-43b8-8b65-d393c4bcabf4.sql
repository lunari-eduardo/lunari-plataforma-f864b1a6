-- Adicionar campo usar_valor_fixo_pacote na tabela tabelas_precos
ALTER TABLE tabelas_precos 
ADD COLUMN usar_valor_fixo_pacote BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tabelas_precos.usar_valor_fixo_pacote IS 
  'Se TRUE, ignora a tabela progressiva e usa o valor_foto_extra do pacote da categoria';