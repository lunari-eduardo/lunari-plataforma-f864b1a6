-- Adicionar novas colunas ao profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS nicho TEXT,
  ADD COLUMN IF NOT EXISTS cidade_ibge_id INTEGER,
  ADD COLUMN IF NOT EXISTS cidade_nome TEXT,
  ADD COLUMN IF NOT EXISTS cidade_uf TEXT;

-- Criar tabela de municípios IBGE
CREATE TABLE IF NOT EXISTS municipios_ibge (
  id INTEGER PRIMARY KEY,
  nome TEXT NOT NULL,
  uf TEXT NOT NULL,
  estado TEXT NOT NULL,
  regiao TEXT NOT NULL
);

-- Índices para busca rápida (sem trigram)
CREATE INDEX IF NOT EXISTS idx_municipios_nome ON municipios_ibge(nome);
CREATE INDEX IF NOT EXISTS idx_municipios_uf ON municipios_ibge(uf);
CREATE INDEX IF NOT EXISTS idx_municipios_nome_lower ON municipios_ibge(LOWER(nome));

-- RLS: Todos podem ler (dados públicos)
ALTER TABLE municipios_ibge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos podem visualizar municípios" ON municipios_ibge;
CREATE POLICY "Todos podem visualizar municípios" ON municipios_ibge FOR SELECT USING (true);