

# Plano: Corrigir Sincronização Gallery → Workflow e Etapas de Sistema

## Problemas Identificados

### 1. Trigger não sincroniza status corretamente

O trigger `sync_gallery_status_to_session` possui dois bugs:

| Status real na galeria | O que o trigger mapeia | O que deveria mapear |
|---|---|---|
| `enviado` | Nada (cai no ELSE, mantém status atual) | "Enviado para seleção" |
| `selecao_iniciada` | Nada (cai no ELSE) | "Enviado para seleção" |
| `selecao_completa` | Nada (cai no ELSE) | "Seleção finalizada" |
| `publicada` | "Enviado para seleção" | Esse status nem existe no sistema |
| `em_selecao` | "Enviado para seleção" | Esse status nem existe no sistema |
| `finalizada` | "Seleção finalizada" | Esse status nem existe no sistema |

A migração `20260128` sobrescreveu a função correta (de `20260126`) com mapeamentos errados (`publicada`/`em_selecao`/`finalizada` em vez de `enviado`/`selecao_iniciada`/`selecao_completa`).

Além disso, o trigger só dispara em `UPDATE`, mas galerias criadas via "criar galeria vinculada" podem ser inseridas já com status `enviado` -- nesse caso o trigger não dispara.

### 2. Falta status "Expirada" como etapa de sistema

O usuário quer que galerias expiradas mudem automaticamente o workflow para "Expirada".

### 3. Etapas de sistema permitem editar e excluir

Na screenshot, "Enviado para seleção" e "Seleção finalizada" mostram botões de editar e excluir. O `isSystemStatus()` só protege quando `hasGalleryAccess` é true, mas na imagem esses botões estão visíveis.

---

## Solução

### Parte 1: Corrigir o trigger (migração SQL)

Recriar a função `sync_gallery_status_to_session()` com o mapeamento correto dos status reais da tabela `galerias` e adicionar suporte a `INSERT` + `expirada`:

```sql
CREATE OR REPLACE FUNCTION sync_gallery_status_to_session()
RETURNS TRIGGER AS $$
DECLARE
  session_record RECORD;
  target_status TEXT;
BEGIN
  -- Buscar sessão vinculada
  SELECT id, status INTO session_record
  FROM clientes_sessoes
  WHERE galeria_id = NEW.id LIMIT 1;
  
  IF session_record.id IS NULL AND NEW.session_id IS NOT NULL THEN
    SELECT id, status INTO session_record
    FROM clientes_sessoes
    WHERE session_id = NEW.session_id LIMIT 1;
  END IF;
  
  IF session_record.id IS NULL THEN RETURN NEW; END IF;
  
  -- Mapeamento CORRETO dos status reais da tabela galerias
  CASE NEW.status
    WHEN 'enviado' THEN target_status := 'Enviado para seleção';
    WHEN 'selecao_iniciada' THEN target_status := 'Enviado para seleção';
    WHEN 'selecao_completa' THEN target_status := 'Seleção finalizada';
    WHEN 'expirada' THEN target_status := 'Expirada';
    ELSE target_status := session_record.status;
  END CASE;
  
  UPDATE clientes_sessoes
  SET status = target_status,
      status_galeria = NEW.status,
      status_pagamento_fotos_extra = COALESCE(NEW.status_pagamento, 'sem_vendas'),
      updated_at = NOW()
  WHERE id = session_record.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para INSERT E UPDATE
DROP TRIGGER IF EXISTS trigger_sync_gallery_status ON galerias;
CREATE TRIGGER trigger_sync_gallery_status
AFTER INSERT OR UPDATE OF status, status_pagamento ON galerias
FOR EACH ROW
EXECUTE FUNCTION sync_gallery_status_to_session();
```

### Parte 2: Adicionar "Expirada" como etapa de sistema

Atualizar o Edge Function `provision-gallery-workflow-statuses` para incluir a etapa "Expirada":

```typescript
const GALLERY_SYSTEM_STATUSES = [
  { nome: 'Enviado para seleção', cor: '#3B82F6' },
  { nome: 'Seleção finalizada', cor: '#10B981' },
  { nome: 'Expirada', cor: '#EF4444' }  // NOVO
];
```

Atualizar também `useProvisionGalleryStatuses.ts` para verificar 3 status em vez de 2.

### Parte 3: Proteger etapas de sistema no UI

Modificar `FluxoTrabalho.tsx` para:
- Remover a condição `hasGalleryAccess &&` do `isSystemStatus()` -- etapas com `is_system_status = true` devem ser sempre protegidas
- Substituir o bloco "Protegido" por: botões de mover (cima/baixo) + botão de ocultar (eye icon) -- sem editar nem excluir
- Manter os botões de mover para permitir reordenação

### Parte 4: Sincronizar sessões existentes

Na mesma migração SQL, corrigir sessões que já estão dessincronizadas:

```sql
-- Corrigir sessões com galeria enviada que não têm status correto
UPDATE clientes_sessoes cs
SET status = 'Enviado para seleção',
    status_galeria = g.status,
    updated_at = NOW()
FROM galerias g
WHERE (cs.galeria_id = g.id OR cs.session_id = g.session_id)
  AND g.status IN ('enviado', 'selecao_iniciada')
  AND cs.status NOT IN ('Enviado para seleção');
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---|---|
| **Nova migração SQL** | Corrigir trigger + sincronizar dados existentes + provisionar "Expirada" |
| `supabase/functions/provision-gallery-workflow-statuses/index.ts` | Adicionar "Expirada" na lista de status de sistema |
| `src/hooks/useProvisionGalleryStatuses.ts` | Verificar 3 status em vez de 2 |
| `src/components/configuracoes/FluxoTrabalho.tsx` | Proteger etapas de sistema sem depender de `hasGalleryAccess`, remover editar/excluir, manter mover + ocultar |

---

## Fluxo Corrigido

```text
Galeria criada (INSERT com status 'rascunho')
  -> Trigger dispara, status = rascunho -> ELSE -> mantém status atual

Galeria enviada (UPDATE status -> 'enviado')
  -> Trigger dispara, 'enviado' -> 'Enviado para seleção'
  -> clientes_sessoes.status = 'Enviado para seleção'

Cliente inicia seleção (UPDATE status -> 'selecao_iniciada')
  -> Trigger dispara, 'selecao_iniciada' -> 'Enviado para seleção'
  -> Mantém status no workflow

Galeria expirada (UPDATE status -> 'expirada')
  -> Trigger dispara, 'expirada' -> 'Expirada'
  -> clientes_sessoes.status = 'Expirada'

Seleção completa (UPDATE status -> 'selecao_completa')
  -> Trigger dispara, 'selecao_completa' -> 'Seleção finalizada'
  -> clientes_sessoes.status = 'Seleção finalizada'

Galeria excluída (DELETE ou status -> 'excluida')
  -> Trigger dispara, 'excluida' -> ELSE -> mantém status atual
```
