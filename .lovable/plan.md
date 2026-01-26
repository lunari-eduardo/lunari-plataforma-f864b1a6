
# Plano de Correção: Status de Sistema do Gallery para Admin

## Diagnóstico Completo

### Problemas Identificados

**1. Status de sistema nunca foram provisionados para o admin**

Dados do banco revelam:
- `"Enviado para seleção"` **NÃO EXISTE** nas etapas do usuário admin
- Existe `"Enviado Seleç"` (nome diferente/truncado - editado manualmente)
- `"Seleção finalizada"` existe MAS com `is_system_status = false`

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPAS DO ADMIN (user_id: db0ca3d8-...)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Backup                    is_system_status = false                       │
│  2. Enviado Seleç ❌          is_system_status = false  (nome errado)        │
│  3. Seleção finalizada ⚠️    is_system_status = false  (flag incorreta)     │
│  4. Editando                  is_system_status = false                       │
│  ...                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**2. Edge Function de provisionamento nunca é chamada**

A função `provision-gallery-workflow-statuses` foi criada, mas **não é chamada em nenhum fluxo**:
- `AllowedEmailsManager.tsx` - adiciona/atualiza email mas NÃO provisiona status
- `AdminUsuarios.tsx` - atribui plano mas NÃO provisiona status
- `sync-user-subscription` - sincroniza assinatura mas NÃO provisiona status

**3. O trigger `sync_gallery_status_to_session` falha silenciosamente**

O trigger verifica:
```sql
SELECT EXISTS(
  SELECT 1 FROM etapas_trabalho
  WHERE user_id = NEW.user_id 
    AND nome = 'Enviado para seleção'  -- Nome exato
    AND is_system_status = true        -- Flag obrigatória
)
```

Como essa condição NUNCA é satisfeita, o `status` da sessão permanece vazio.

**4. Etapas ainda são editáveis no frontend**

A proteção no `FluxoTrabalho.tsx` depende de:
```typescript
const isSystemStatus = hasGalleryAccess && etapa.is_system_status === true;
```

Como `is_system_status = false` para todas as etapas do admin, elas continuam editáveis.

---

## Fluxo do Erro Atual

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│  1. ADMIN TEM ACESSO PRO + GALLERY                                             │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  get_access_state() retorna:                                                  │
│    planCode = 'pro_galery_monthly' ✅                                         │
│    hasGaleryAccess = true ✅                                                  │
│                                                                               │
│  MAS os status de sistema nunca foram criados/marcados!                       │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  2. ADMIN CRIA GALERIA E ENVIA                                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  galerias.status = 'enviado' ✅                                               │
│                                                                               │
│  Trigger sync_gallery_status_to_session é acionado:                           │
│    → Busca sessão vinculada ✅                                                │
│    → Mapeia 'enviado' → 'Enviado para seleção' ✅                             │
│    → Verifica se status existe com is_system_status = true                    │
│                                                                               │
│  ❌ FALHA: Etapa "Enviado para seleção" não existe OU is_system_status=false  │
│                                                                               │
│  Resultado: clientes_sessoes.status permanece VAZIO                           │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  3. WORKFLOW EXIBE STATUS VAZIO                                                │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  WorkflowCard mostra campo "STATUS" sem valor selecionado                     │
│  Etapas continuam editáveis (sem badge "Automático")                          │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Solução Proposta

### FASE 1: Integrar Provisionamento Automático

Adicionar chamada à Edge Function `provision-gallery-workflow-statuses` nos fluxos críticos:

**1.1 AllowedEmailsManager.tsx - Ao adicionar email com PRO + Gallery**

```typescript
const handleAddEmail = async () => {
  // ... código existente de insert ...
  
  // Se plano inclui Gallery, provisionar status de sistema
  if (selectedPlan.startsWith('pro_galery')) {
    // Buscar userId do email (se já existe no sistema)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', newEmail.trim().toLowerCase())
      .single();
    
    if (profiles?.id) {
      await supabase.functions.invoke('provision-gallery-workflow-statuses', {
        body: { userId: profiles.id, action: 'provision' }
      });
    }
  }
};
```

**1.2 AllowedEmailsManager.tsx - Ao atualizar plano para PRO + Gallery**

```typescript
const handleUpdatePlan = async () => {
  // ... código existente de update ...
  
  // Se novo plano inclui Gallery, provisionar
  if (selectedPlan.startsWith('pro_galery')) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', editingEmail)
      .single();
    
    if (profiles?.id) {
      await supabase.functions.invoke('provision-gallery-workflow-statuses', {
        body: { userId: profiles.id, action: 'provision' }
      });
    }
  } else {
    // Se removeu Gallery, remover flags de sistema
    // (opcional - manter editável)
  }
};
```

### FASE 2: Provisionamento no Login/Verificação de Acesso

Criar hook `useProvisionGalleryStatuses` para verificar e provisionar no primeiro acesso.

**2.1 Novo hook - src/hooks/useProvisionGalleryStatuses.ts**

```typescript
export function useProvisionGalleryStatuses() {
  const { user } = useAuth();
  const { hasGaleryAccess } = useAccessControl();
  const provisionedRef = useRef(false);
  
  useEffect(() => {
    if (!user?.id || !hasGaleryAccess || provisionedRef.current) return;
    
    const checkAndProvision = async () => {
      // Verificar se já tem status de sistema
      const { data: systemStatuses } = await supabase
        .from('etapas_trabalho')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_system_status', true)
        .limit(1);
      
      if (!systemStatuses?.length) {
        // Provisionar
        await supabase.functions.invoke('provision-gallery-workflow-statuses', {
          body: { userId: user.id, action: 'provision' }
        });
        console.log('✅ Status de sistema Gallery provisionados');
      }
      
      provisionedRef.current = true;
    };
    
    checkAndProvision();
  }, [user?.id, hasGaleryAccess]);
}
```

**2.2 Integrar no App.tsx ou contexto principal**

Chamar o hook no ponto de entrada da aplicação autenticada.

### FASE 3: Corrigir Usuários Existentes (Admin)

Criar migration ou script para corrigir dados existentes:

**3.1 Correção manual via SQL para o admin atual**

```sql
-- Remover etapa com nome incorreto (se quiser)
DELETE FROM etapas_trabalho 
WHERE user_id = 'db0ca3d8-8848-4194-aa74-40d265b73849' 
  AND nome = 'Enviado Seleç';

-- Inserir etapas corretas com is_system_status = true
INSERT INTO etapas_trabalho (user_id, nome, cor, ordem, is_system_status)
VALUES 
  ('db0ca3d8-8848-4194-aa74-40d265b73849', 'Enviado para seleção', '#3B82F6', 2, true)
ON CONFLICT DO NOTHING;

-- Atualizar Seleção finalizada para is_system_status = true
UPDATE etapas_trabalho 
SET is_system_status = true
WHERE user_id = 'db0ca3d8-8848-4194-aa74-40d265b73849' 
  AND nome = 'Seleção finalizada';
```

**3.2 Corrigir status_galeria -> status da sessão atual**

```sql
-- Atualizar sessão do Euclides para ter o status correto
UPDATE clientes_sessoes
SET status = 'Enviado para seleção'
WHERE session_id = 'workflow-1769466628485-wdpyfqwulbe';
```

### FASE 4: Melhorar Edge Function de Provisionamento

Adicionar busca por email quando `userId` não está disponível:

```typescript
// provision-gallery-workflow-statuses/index.ts
interface ProvisionRequest {
  userId?: string;
  email?: string;  // Alternativa quando userId não é conhecido
  action: 'provision' | 'deprovision';
}

// Se email fornecido, buscar userId
if (!body.userId && body.email) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', body.email.toLowerCase())
    .single();
  
  if (!profile?.id) {
    return { success: true, message: 'Usuário ainda não cadastrado' };
  }
  userId = profile.id;
}
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/admin/AllowedEmailsManager.tsx` | Modificar | Chamar Edge Function após add/update com PRO+Gallery |
| `src/hooks/useProvisionGalleryStatuses.ts` | Criar | Hook para auto-provisionar no primeiro acesso |
| `src/App.tsx` ou contexto | Modificar | Integrar hook de provisionamento |
| `supabase/functions/provision-gallery-workflow-statuses/index.ts` | Modificar | Suportar busca por email |
| Migration SQL | Criar | Corrigir dados existentes do admin |

---

## Fluxo Corrigido

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│  1. ADMIN/USUÁRIO RECEBE PRO + GALLERY                                         │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  AllowedEmailsManager → handleAddEmail/handleUpdatePlan                       │
│    → Detecta plan_code = 'pro_galery_monthly'                                 │
│    → Chama provision-gallery-workflow-statuses                                │
│                                                                               │
│  OU                                                                           │
│                                                                               │
│  useProvisionGalleryStatuses (hook no login)                                  │
│    → hasGaleryAccess = true                                                   │
│    → Verifica se já tem is_system_status = true                               │
│    → Se não, chama provision-gallery-workflow-statuses                        │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  2. ETAPAS PROVISIONADAS CORRETAMENTE                                          │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  etapas_trabalho:                                                             │
│    • "Enviado para seleção" (is_system_status = true) ✅                      │
│    • "Seleção finalizada" (is_system_status = true) ✅                        │
│                                                                               │
│  FluxoTrabalho.tsx:                                                           │
│    • Exibe badge "Automático" ✅                                              │
│    • Botões editar/excluir ocultos ✅                                         │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  3. TRIGGER FUNCIONA CORRETAMENTE                                              │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Admin cria galeria → status = 'enviado'                                      │
│    → Trigger encontra "Enviado para seleção" com is_system_status = true      │
│    → UPDATE clientes_sessoes.status = 'Enviado para seleção' ✅               │
│                                                                               │
│  Cliente finaliza seleção → status = 'selecao_completa'                       │
│    → Trigger encontra "Seleção finalizada" com is_system_status = true        │
│    → UPDATE clientes_sessoes.status = 'Seleção finalizada' ✅                 │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Ordem de Implementação

1. **Correção imediata (SQL)** - Criar etapas corretas para o admin atual
2. **Modificar AllowedEmailsManager.tsx** - Integrar provisionamento ao adicionar/atualizar email
3. **Criar useProvisionGalleryStatuses hook** - Auto-provisionar no primeiro acesso
4. **Atualizar Edge Function** - Suportar busca por email
5. **Testar fluxo completo** - Criar nova galeria e verificar automação
