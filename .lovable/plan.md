
# Plano: Sistema de Status Fixos para PRO + Gallery com Triggers Automáticos

## Visão Geral

Implementar um sistema onde os status "Enviado para seleção" e "Seleção finalizada" são fixos e automáticos **apenas** para usuários no plano PRO + Gallery. Para outros planos, esses status (se existirem) comportam-se como quaisquer outros status personalizáveis.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PLANOS SEM GALLERY                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Etapas do Workflow: TOTALMENTE PERSONALIZÁVEIS                                 │
│  ├─ Editar ✅                                                                   │
│  ├─ Excluir ✅                                                                  │
│  ├─ Renomear ✅                                                                 │
│  └─ Reorganizar ✅                                                              │
│                                                                                 │
│  Nenhuma automação. Fluxo 100% manual.                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                         PLANO PRO + GALLERY                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Etapas Personalizáveis: ✅ Podem editar/excluir/reorganizar                    │
│                                                                                 │
│  Etapas de Sistema (FIXAS):                                                     │
│  ├─ "Enviado para seleção" (is_system_status = true)                            │
│  │   ├─ Acionado automaticamente quando galeria é publicada                     │
│  │   ├─ NÃO pode ser editado                                                    │
│  │   ├─ NÃO pode ser excluído                                                   │
│  │   └─ Identificado visualmente como "Automático"                              │
│  │                                                                              │
│  └─ "Seleção finalizada" (is_system_status = true)                              │
│      ├─ Acionado automaticamente quando cliente finaliza seleção                │
│      ├─ NÃO pode ser editado                                                    │
│      ├─ NÃO pode ser excluído                                                   │
│      └─ Identificado visualmente como "Automático"                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Alterações no Banco de Dados

### 1.1 Adicionar coluna `is_system_status` na tabela `etapas_trabalho`

```sql
ALTER TABLE etapas_trabalho
ADD COLUMN is_system_status BOOLEAN DEFAULT false;

-- Índice para performance
CREATE INDEX idx_etapas_system_status ON etapas_trabalho(user_id, is_system_status);
```

**Propósito:** Identificar etapas que são controladas pelo sistema vs. personalizáveis.

### 1.2 Adicionar constantes para nomes de status do sistema

Definir os nomes exatos dos status do sistema que serão usados nas automações:
- `GALLERY_STATUS_SENT = 'Enviado para seleção'`
- `GALLERY_STATUS_FINALIZED = 'Seleção finalizada'`

### 1.3 Criar trigger para mudança de status da galeria

```sql
-- Trigger function que atualiza status da sessão quando galeria muda de status
CREATE OR REPLACE FUNCTION sync_gallery_status_to_session()
RETURNS TRIGGER AS $$
DECLARE
  session_record RECORD;
  target_status TEXT;
  status_exists BOOLEAN;
BEGIN
  -- Só processar se status mudou
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Buscar sessão vinculada
  SELECT id, session_id, status INTO session_record
  FROM clientes_sessoes
  WHERE (session_id = NEW.session_id OR galeria_id = NEW.id)
    AND user_id = NEW.user_id
  LIMIT 1;

  IF session_record IS NULL THEN
    RETURN NEW; -- Sem sessão vinculada, ignorar
  END IF;

  -- Mapear status da galeria para status da sessão
  CASE NEW.status
    WHEN 'enviado' THEN
      target_status := 'Enviado para seleção';
    WHEN 'selecao_iniciada' THEN
      target_status := 'Enviado para seleção'; -- Mantém mesmo status
    WHEN 'selecao_completa' THEN
      target_status := 'Seleção finalizada';
    ELSE
      RETURN NEW; -- Outros status não afetam a sessão
  END CASE;

  -- Verificar se o status de destino existe nas etapas do usuário
  SELECT EXISTS(
    SELECT 1 FROM etapas_trabalho
    WHERE user_id = NEW.user_id 
      AND nome = target_status
      AND is_system_status = true
  ) INTO status_exists;

  -- Só atualizar se o status de sistema existe (usuário tem PRO + Gallery ativo)
  IF status_exists THEN
    UPDATE clientes_sessoes
    SET status = target_status,
        status_galeria = NEW.status,
        updated_at = NOW()
    WHERE id = session_record.id;
    
    RAISE NOTICE '[Gallery Trigger] Session % status updated to %', session_record.id, target_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger na tabela galerias
CREATE TRIGGER trigger_sync_gallery_status
AFTER UPDATE OF status ON galerias
FOR EACH ROW
EXECUTE FUNCTION sync_gallery_status_to_session();
```

---

## FASE 2: Provisionamento Automático de Status do Sistema

### 2.1 Edge Function: `provision-gallery-workflow-statuses`

Será chamada quando o usuário adquire o plano PRO + Gallery para criar automaticamente os status do sistema.

```typescript
// Pseudocódigo da lógica
async function provisionGalleryStatuses(userId: string) {
  const systemStatuses = [
    { nome: 'Enviado para seleção', cor: '#3B82F6', is_system_status: true },
    { nome: 'Seleção finalizada', cor: '#10B981', is_system_status: true }
  ];

  for (const status of systemStatuses) {
    // Verificar se já existe
    const existing = await supabase
      .from('etapas_trabalho')
      .select('id')
      .eq('user_id', userId)
      .eq('nome', status.nome)
      .single();

    if (existing.data) {
      // Já existe, apenas marcar como system status
      await supabase
        .from('etapas_trabalho')
        .update({ is_system_status: true })
        .eq('id', existing.data.id);
    } else {
      // Criar novo status de sistema
      const maxOrdem = await getMaxOrdem(userId);
      await supabase
        .from('etapas_trabalho')
        .insert({
          user_id: userId,
          nome: status.nome,
          cor: status.cor,
          ordem: maxOrdem + 1,
          is_system_status: true
        });
    }
  }
}
```

### 2.2 Remoção de Status de Sistema ao Downgrade

Quando o usuário faz downgrade para um plano sem Gallery:
```typescript
// Remover flag is_system_status (status vira editável)
await supabase
  .from('etapas_trabalho')
  .update({ is_system_status: false })
  .eq('user_id', userId)
  .eq('is_system_status', true);
```

---

## FASE 3: Alterações no Frontend

### 3.1 Atualizar tipo `EtapaTrabalho`

```typescript
// src/types/configuration.ts
export interface EtapaTrabalho {
  id: string;
  user_id?: string;
  nome: string;
  cor: string;
  ordem: number;
  is_system_status?: boolean; // ← NOVO CAMPO
  created_at?: string;
  updated_at?: string;
}
```

### 3.2 Atualizar componente `FluxoTrabalho.tsx`

```typescript
interface FluxoTrabalhoProps {
  etapas: EtapaTrabalho[];
  onAdd: (etapa: Omit<EtapaTrabalho, 'id' | 'ordem'>) => void;
  onUpdate: (id: string, dados: Partial<EtapaTrabalho>) => Promise<void>;
  onDelete: (id: string) => Promise<boolean>;
  onMove: (id: string, direcao: 'cima' | 'baixo') => void;
  hasGalleryAccess?: boolean; // ← NOVO PROP
}

// Na renderização de cada etapa:
{etapasOrdenadas.map((etapa, index) => {
  const isSystemStatus = hasGalleryAccess && etapa.is_system_status;
  
  return (
    <div key={etapa.id} className={cn(...)}>
      {/* Coluna do nome */}
      <div className="col-span-7 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: etapa.cor }} />
        <span className="font-medium">{etapa.nome}</span>
        
        {/* Badge de status automático */}
        {isSystemStatus && (
          <Badge variant="secondary" className="text-xs ml-2">
            <Zap className="h-3 w-3 mr-1" />
            Automático
          </Badge>
        )}
      </div>
      
      {/* Coluna de ações - desabilitada para status de sistema */}
      <div className="flex justify-end gap-1">
        {!isSystemStatus && (
          <>
            <Button onClick={() => moverEtapa(etapa.id, 'cima')} disabled={...}>
              <ArrowUp />
            </Button>
            <Button onClick={() => moverEtapa(etapa.id, 'baixo')} disabled={...}>
              <ArrowDown />
            </Button>
            <Button onClick={() => iniciarEdicaoEtapa(etapa.id)}>
              <Edit />
            </Button>
            <Button onClick={() => removerEtapa(etapa.id)}>
              <Trash2 />
            </Button>
          </>
        )}
        
        {isSystemStatus && (
          <Tooltip content="Etapa controlada automaticamente pela integração Gallery">
            <div className="flex items-center text-muted-foreground text-xs px-2">
              <Lock className="h-3.5 w-3.5 mr-1" />
              Protegido
            </div>
          </Tooltip>
        )}
      </div>
    </div>
  );
})}
```

### 3.3 Mensagem Explicativa na UI

Quando `hasGalleryAccess === true`, exibir no topo da seção de Etapas:

```tsx
{hasGalleryAccess && (
  <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg mb-4">
    <Zap className="h-4 w-4 text-primary" />
    <p className="text-sm text-muted-foreground">
      As etapas <strong>"Enviado para seleção"</strong> e <strong>"Seleção finalizada"</strong> 
      são automáticas e fazem parte da integração com o Gallery.
    </p>
  </div>
)}
```

---

## FASE 4: Integração com `gallery-update-session-photos`

Atualizar a Edge Function existente para também acionar mudança de status quando a seleção é finalizada:

```typescript
// supabase/functions/gallery-update-session-photos/index.ts

// Adicionar novo campo ao request
interface UpdateSessionPhotosRequest {
  // ... campos existentes
  selecaoFinalizada?: boolean; // Flag para indicar que seleção foi concluída
}

// Na lógica de processamento:
if (body.selecaoFinalizada === true) {
  // Verificar se usuário tem status de sistema configurado
  const { data: systemStatus } = await supabase
    .from('etapas_trabalho')
    .select('nome')
    .eq('user_id', session.user_id)
    .eq('nome', 'Seleção finalizada')
    .eq('is_system_status', true)
    .single();

  if (systemStatus) {
    // Atualizar status da sessão automaticamente
    await supabase
      .from('clientes_sessoes')
      .update({ 
        status: 'Seleção finalizada',
        status_galeria: 'selecao_completa'
      })
      .eq('id', session.id);
  }
}
```

---

## FASE 5: Validações de Backend

### 5.1 RLS Policy para proteger status de sistema

```sql
-- Impedir DELETE de status de sistema
CREATE POLICY "Prevent delete of system statuses"
ON etapas_trabalho
FOR DELETE
USING (
  is_system_status = false
  OR is_system_status IS NULL
);

-- Impedir UPDATE de nome/cor em status de sistema
CREATE POLICY "Prevent update of system status attributes"
ON etapas_trabalho
FOR UPDATE
USING (true)
WITH CHECK (
  -- Se é status de sistema, só permite alterar ordem
  (is_system_status = true AND nome = OLD.nome AND cor = OLD.cor)
  OR is_system_status = false
  OR is_system_status IS NULL
);
```

---

## Resumo de Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/types/configuration.ts` | Modificar | Adicionar `is_system_status` ao tipo |
| `src/components/configuracoes/FluxoTrabalho.tsx` | Modificar | Adicionar prop `hasGalleryAccess`, desabilitar ações para status de sistema, badge "Automático" |
| `src/pages/Configuracoes.tsx` | Modificar | Passar `hasGalleryAccess` para `FluxoTrabalho` |
| `supabase/functions/gallery-update-session-photos/index.ts` | Modificar | Adicionar lógica de `selecaoFinalizada` |
| `supabase/functions/provision-gallery-workflow-statuses/index.ts` | Criar | Edge Function para provisionar status de sistema |
| Migration SQL | Criar | Adicionar coluna, trigger e policies |

---

## Fluxo Completo PRO + Gallery

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ 1. USUÁRIO ADQUIRE PRO + GALLERY                                               │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  stripe-webhook detecta upgrade                                               │
│       ↓                                                                       │
│  Chama provision-gallery-workflow-statuses                                    │
│       ↓                                                                       │
│  Cria/marca status de sistema:                                                │
│    • "Enviado para seleção" (is_system_status=true)                           │
│    • "Seleção finalizada" (is_system_status=true)                             │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────────────────────────────┐
│ 2. FOTÓGRAFO PUBLICA GALERIA                                                   │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Gestão: updateGaleriaStatus(id, 'enviado')                                   │
│       ↓                                                                       │
│  Trigger sync_gallery_status_to_session                                       │
│       ↓                                                                       │
│  clientes_sessoes.status = 'Enviado para seleção'                             │
│       ↓                                                                       │
│  Workflow exibe card na coluna "Enviado para seleção"                         │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────────────────────────────┐
│ 3. CLIENTE FINALIZA SELEÇÃO NO GALLERY                                         │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Gallery: Chama gallery-update-session-photos                                 │
│    { selecaoFinalizada: true }                                                │
│       ↓                                                                       │
│  Edge Function verifica status de sistema existe                              │
│       ↓                                                                       │
│  clientes_sessoes.status = 'Seleção finalizada'                               │
│       ↓                                                                       │
│  Workflow exibe card na coluna "Seleção finalizada"                           │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Próximos Passos

1. Executar migration para adicionar coluna `is_system_status`
2. Criar trigger de sincronização galeria → sessão
3. Atualizar tipos TypeScript
4. Modificar componente `FluxoTrabalho.tsx`
5. Atualizar Edge Function `gallery-update-session-photos`
6. Criar Edge Function `provision-gallery-workflow-statuses`
7. Testar fluxo completo
