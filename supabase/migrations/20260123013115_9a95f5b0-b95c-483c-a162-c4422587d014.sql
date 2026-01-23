-- Adiciona campo fotos_incluidas na tabela pacotes
-- Representa o número máximo de fotos que o cliente pode selecionar

ALTER TABLE pacotes 
ADD COLUMN IF NOT EXISTS fotos_incluidas INTEGER NOT NULL DEFAULT 0;

-- Comentário para documentação
COMMENT ON COLUMN pacotes.fotos_incluidas IS 
  'Número máximo de fotos que o cliente pode selecionar dentro do pacote. Usado para controle no Gallery.';

-- Atualiza pacotes existentes com valor padrão razoável (50 fotos)
UPDATE pacotes SET fotos_incluidas = 50 WHERE fotos_incluidas = 0;