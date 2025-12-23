-- Adicionar colunas para suportar "Dia Todo" e cor personalizada nos slots de disponibilidade
ALTER TABLE availability_slots 
ADD COLUMN IF NOT EXISTS is_full_day BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS full_day_description TEXT,
ADD COLUMN IF NOT EXISTS color TEXT;

-- Comentário: is_full_day indica se o slot representa o dia inteiro
-- full_day_description: descrição visível no banner (ex: "Feriado", "Férias")
-- color: cor do tipo de disponibilidade para exibição correta