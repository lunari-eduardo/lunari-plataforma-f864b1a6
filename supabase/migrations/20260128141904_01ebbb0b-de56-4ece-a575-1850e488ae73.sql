-- ============================================
-- MIGRAÇÃO CRÍTICA: Corrigir Vazamento de Dados
-- Isolar galerias por usuário (user_id)
-- ============================================

-- 1. REMOVER políticas problemáticas da tabela galerias
DROP POLICY IF EXISTS "Anyone can view public galleries" ON galerias;
DROP POLICY IF EXISTS "Anyone can view published galleries" ON galerias;
DROP POLICY IF EXISTS "Public galleries accessible via token" ON galerias;
DROP POLICY IF EXISTS "Users can manage own galleries" ON galerias;

-- 2. CRIAR políticas seguras para galerias

-- 2.1. Fotógrafos podem gerenciar suas próprias galerias (CRUD completo)
CREATE POLICY "Photographers manage own galleries"
ON galerias FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2.2. Acesso público via token (para clientes finais verem galeria compartilhada)
CREATE POLICY "Public access via token"
ON galerias FOR SELECT
TO anon, authenticated
USING (
  public_token IS NOT NULL 
  AND status IN ('enviado', 'selecao_iniciada', 'selecao_completa')
);

-- 3. REMOVER políticas problemáticas da tabela galeria_fotos
DROP POLICY IF EXISTS "Anyone can view photos from public galleries" ON galeria_fotos;
DROP POLICY IF EXISTS "Anyone can view published gallery photos" ON galeria_fotos;
DROP POLICY IF EXISTS "Clients can view sent gallery photos" ON galeria_fotos;
DROP POLICY IF EXISTS "Photos accessible for public galleries" ON galeria_fotos;
DROP POLICY IF EXISTS "Clients can update photo selection" ON galeria_fotos;
DROP POLICY IF EXISTS "Users can manage own gallery photos" ON galeria_fotos;

-- 4. CRIAR políticas seguras para galeria_fotos

-- 4.1. Fotógrafos podem gerenciar fotos das suas galerias
CREATE POLICY "Photographers manage own gallery photos"
ON galeria_fotos FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4.2. Acesso público às fotos via token da galeria
CREATE POLICY "Public view photos via gallery token"
ON galeria_fotos FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM galerias g
    WHERE g.id = galeria_fotos.galeria_id
    AND g.public_token IS NOT NULL
    AND g.status IN ('enviado', 'selecao_iniciada', 'selecao_completa')
  )
);

-- 4.3. Clientes podem atualizar seleção de fotos via token
CREATE POLICY "Public update photo selection via token"
ON galeria_fotos FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM galerias g
    WHERE g.id = galeria_fotos.galeria_id
    AND g.public_token IS NOT NULL
    AND g.status IN ('enviado', 'selecao_iniciada')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM galerias g
    WHERE g.id = galeria_fotos.galeria_id
    AND g.public_token IS NOT NULL
    AND g.status IN ('enviado', 'selecao_iniciada')
  )
);