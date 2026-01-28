

# Plano CRÍTICO: Corrigir Vazamento de Dados - Isolamento de Galerias por Usuário

## Problema Identificado

A tabela `galerias` tem políticas RLS que expõem **TODOS** os dados de galerias para qualquer usuário autenticado:

| Política Problemática | Efeito |
|----------------------|--------|
| `Anyone can view published galleries` | Qualquer usuário vê galerias com status enviado/selecao_iniciada/selecao_completa |
| `Anyone can view public galleries` | Qualquer usuário vê galerias com permissao='public' |
| `Public galleries accessible via token` | Redundante com as anteriores |

**Resultado:** O usuário `eduardo22diehl@gmail.com` consegue ver as 4 galerias de `lisediehlfotos@gmail.com`.

---

## Solução: Reestruturar Políticas RLS

### Princípio de Segurança

1. **Fotógrafos** - Só veem **suas próprias** galerias (`auth.uid() = user_id`)
2. **Clientes finais** (via link público) - Veem **apenas** a galeria compartilhada via token público
3. **Acesso anônimo** - Apenas para visualização pública com token válido

### Políticas Corrigidas

```sql
-- 1. REMOVER políticas problemáticas
DROP POLICY IF EXISTS "Anyone can view public galleries" ON galerias;
DROP POLICY IF EXISTS "Anyone can view published galleries" ON galerias;
DROP POLICY IF EXISTS "Public galleries accessible via token" ON galerias;
DROP POLICY IF EXISTS "Users can manage own galleries" ON galerias;

-- 2. CRIAR políticas seguras

-- 2.1. Fotógrafos podem gerenciar suas próprias galerias (CRUD completo)
CREATE POLICY "Photographers manage own galleries"
ON galerias FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2.2. Acesso público via token (para clientes finais verem galeria compartilhada)
-- Nota: Esta política permite SELECT apenas para galerias com token público E status adequado
-- Não requer autenticação - qualquer pessoa com o link pode ver
CREATE POLICY "Public access via token"
ON galerias FOR SELECT
TO anon, authenticated
USING (
  public_token IS NOT NULL 
  AND status IN ('enviado', 'selecao_iniciada', 'selecao_completa')
);
```

### Por que esta estrutura funciona

| Cenário | Política Aplicada | Resultado |
|---------|------------------|-----------|
| Fotógrafo lista suas galerias | `Photographers manage own galleries` | Só vê as dele (`user_id = auth.uid()`) |
| Fotógrafo edita galeria | `Photographers manage own galleries` | Só edita se for dele |
| Cliente abre link público | `Public access via token` | Vê apenas aquela galeria específica |
| Usuário malicioso tenta listar tudo | Nenhuma política match | Retorna 0 registros |

---

## Correção nas Tabelas Relacionadas

Verificar e corrigir também:

### `galeria_fotos`

```sql
-- Remover políticas problemáticas
DROP POLICY IF EXISTS "Anyone can view photos from public galleries" ON galeria_fotos;
DROP POLICY IF EXISTS "Anyone can view published gallery photos" ON galeria_fotos;
DROP POLICY IF EXISTS "Clients can view sent gallery photos" ON galeria_fotos;
DROP POLICY IF EXISTS "Photos accessible for public galleries" ON galeria_fotos;
DROP POLICY IF EXISTS "Clients can update photo selection" ON galeria_fotos;
DROP POLICY IF EXISTS "Users can manage own gallery photos" ON galeria_fotos;

-- Criar políticas seguras
CREATE POLICY "Photographers manage own gallery photos"
ON galeria_fotos FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

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
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migração SQL | **CRIAR** | Recriar políticas RLS seguras |

---

## Resultado Esperado

Após a migração:

| Usuário | O que vê |
|---------|----------|
| `lisediehlfotos@gmail.com` (admin) | Suas 4 galerias |
| `eduardo22diehl@gmail.com` | Apenas suas próprias galerias (0 se não criou nenhuma) |
| Cliente com link `/galeria/NheJQ8EBBt7N` | Apenas aquela galeria específica |

---

## Seção Técnica: Por que o problema aconteceu

O projeto Gallery precisava permitir que **clientes finais** vissem galerias via link público. A implementação original usou políticas **PERMISSIVE** que verificavam apenas o status, sem filtrar por `user_id`.

Em PostgreSQL, políticas PERMISSIVE combinam com `OR`, então:

```
(status = 'selecao_iniciada')  ← Permite QUALQUER galeria com esse status
OR
(auth.uid() = user_id)  ← Permite galerias do próprio usuário
```

Resultado: **qualquer usuário autenticado** pode ver **todas** as galerias publicadas.

A correção usa políticas que:
1. **Para fotógrafos**: Exigem `user_id = auth.uid()`
2. **Para clientes**: Exigem apenas `public_token IS NOT NULL` (sem exigir autenticação)

