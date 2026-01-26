
# Plano: Gerenciamento de Planos para Usuários Autorizados pelo Admin

## Visão Geral

Implementar seleção de plano ao adicionar usuários autorizados (emails). Atualmente, usuários na tabela `allowed_emails` recebem acesso PRO fixo sem Gallery. A nova funcionalidade permitirá ao admin escolher qual plano liberar para cada usuário.

---

## Diagnóstico Atual

### Tabela `allowed_emails` (existente)
```sql
CREATE TABLE allowed_emails (
  email CITEXT PRIMARY KEY,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ
);
-- ❌ Não tem campo para especificar plano
```

### Função `get_access_state()` (atual)
```sql
-- Para usuários autorizados:
RETURN jsonb_build_object(
  'planCode', 'pro_monthly',     -- ❌ Fixo
  'hasGaleryAccess', false       -- ❌ Fixo
);
```

### Comportamento Esperado
| Tipo de Usuário | planCode | hasGaleryAccess |
|-----------------|----------|-----------------|
| Admin | pro_galery_monthly | true |
| Autorizado (PRO+Gallery) | pro_galery_monthly | true |
| Autorizado (PRO) | pro_monthly | false |
| Autorizado (Starter) | starter_monthly | false |

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ANTES (Fixo)                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  allowed_emails: email, note, created_at, created_by                        │
│                                                                             │
│  get_access_state():                                                        │
│    → planCode = 'pro_monthly' (sempre)                                      │
│    → hasGaleryAccess = false (sempre)                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     DEPOIS (Configurável)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  allowed_emails: email, note, created_at, created_by, plan_code             │
│                           ↑ NOVO CAMPO                                      │
│                                                                             │
│  get_access_state():                                                        │
│    → Busca plan_code da tabela allowed_emails                               │
│    → hasGaleryAccess = (plan_code LIKE 'pro_galery%')                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FASE 1: Alterações no Banco de Dados

### 1.1 Adicionar coluna `plan_code` na tabela `allowed_emails`

```sql
-- Adicionar coluna com valor padrão PRO + Gallery (acesso total)
ALTER TABLE allowed_emails
ADD COLUMN plan_code TEXT DEFAULT 'pro_galery_monthly';

-- Atualizar registros existentes para PRO + Gallery (admin e autorizados têm acesso total)
UPDATE allowed_emails
SET plan_code = 'pro_galery_monthly'
WHERE plan_code IS NULL;

-- Criar constraint para validar códigos de plano
ALTER TABLE allowed_emails
ADD CONSTRAINT allowed_emails_plan_code_check
CHECK (plan_code IN (
  'starter_monthly', 'starter_yearly',
  'pro_monthly', 'pro_yearly', 
  'pro_galery_monthly', 'pro_galery_yearly'
));
```

### 1.2 Atualizar função `get_access_state()`

```sql
-- Para usuários autorizados, buscar o plan_code da tabela
IF v_is_authorized THEN
  -- Buscar o plano configurado
  SELECT ae.plan_code INTO v_authorized_plan
  FROM public.allowed_emails ae
  WHERE ae.email = v_user_email;
  
  -- Determinar acesso à galeria baseado no plano
  v_has_galery_access := v_authorized_plan LIKE 'pro_galery%';
  
  RETURN jsonb_build_object(
    'status', 'ok',
    'reason', 'Authorized email access',
    'isAdmin', false,
    'isVip', false,
    'isTrial', false,
    'isAuthorized', true,
    'planCode', COALESCE(v_authorized_plan, 'pro_galery_monthly'),
    'hasGaleryAccess', v_has_galery_access
  );
END IF;
```

---

## FASE 2: Alterações na UI do Admin

### 2.1 Atualizar tipo TypeScript

```typescript
interface AllowedEmail {
  email: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
  plan_code: string | null; // ← NOVO CAMPO
}
```

### 2.2 Atualizar modal de adicionar email

Adicionar seletor de plano no formulário:

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium">Plano de Acesso *</label>
  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
    <SelectTrigger>
      <SelectValue placeholder="Selecione o plano" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="pro_galery_monthly">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-amber-500" />
          PRO + Gallery (Acesso Total)
        </div>
      </SelectItem>
      <SelectItem value="pro_monthly">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          PRO
        </div>
      </SelectItem>
      <SelectItem value="starter_monthly">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          Starter
        </div>
      </SelectItem>
    </SelectContent>
  </Select>
</div>
```

### 2.3 Atualizar tabela para exibir plano

Adicionar coluna "Plano" na listagem:

```tsx
<TableHeader>
  <TableRow>
    <TableHead>Email</TableHead>
    <TableHead>Plano</TableHead>       {/* ← NOVA COLUNA */}
    <TableHead>Observação</TableHead>
    <TableHead>Adicionado em</TableHead>
    <TableHead>Ações</TableHead>
  </TableRow>
</TableHeader>

<TableBody>
  {emails.map((item) => (
    <TableRow key={item.email}>
      <TableCell>{item.email}</TableCell>
      <TableCell>
        <PlanBadge planCode={item.plan_code} />
      </TableCell>
      {/* ... */}
    </TableRow>
  ))}
</TableBody>
```

### 2.4 Componente PlanBadge

```tsx
function PlanBadge({ planCode }: { planCode: string | null }) {
  const plan = planCode || 'pro_galery_monthly';
  
  if (plan.startsWith('pro_galery')) {
    return (
      <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
        <Crown className="h-3 w-3 mr-1" />
        PRO + Gallery
      </Badge>
    );
  }
  
  if (plan.startsWith('pro')) {
    return (
      <Badge className="bg-primary/20 text-primary border-primary/30">
        <Crown className="h-3 w-3 mr-1" />
        PRO
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary">
      Starter
    </Badge>
  );
}
```

### 2.5 Permitir editar plano de usuário existente

Adicionar botão de edição para alterar plano sem remover o usuário:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm">
      <MoreVertical className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => openEditPlanModal(item.email)}>
      <Edit className="h-4 w-4 mr-2" />
      Alterar Plano
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem 
      onClick={() => setDeleteEmail(item.email)}
      className="text-destructive"
    >
      <Trash2 className="h-4 w-4 mr-2" />
      Remover
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## FASE 3: Provisionamento de Status do Sistema

Quando um email autorizado recebe plano PRO + Gallery, provisionar automaticamente os status de sistema no workflow:

```typescript
// Na função handleAddEmail ou handleUpdatePlan
if (selectedPlan.startsWith('pro_galery')) {
  // Chamar edge function para provisionar status do sistema
  await supabase.functions.invoke('provision-gallery-workflow-statuses', {
    body: { userId: userIdDoEmailAutorizado }
  });
}
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Migration SQL | Criar | Adicionar `plan_code` à tabela + atualizar `get_access_state()` |
| `src/integrations/supabase/types.ts` | Auto-gerado | Refletirá nova coluna |
| `src/components/admin/AllowedEmailsManager.tsx` | Modificar | Adicionar seletor de plano, coluna na tabela, edição de plano |

---

## Comportamento Final

### Admin e Usuários Autorizados (PRO + Gallery por padrão)
- Acesso a **todas** as funcionalidades
- `hasGaleryAccess: true`
- Status de sistema do workflow provisionados automaticamente
- Integração Gallery completa

### Usuários com plano específico configurado
- Acesso conforme plano selecionado pelo admin
- Starter: apenas Agenda, CRM, Workflow, Configurações
- PRO: tudo exceto Gallery
- PRO + Gallery: acesso total

---

## Fluxo do Admin

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│  1. ADMIN ADICIONA NOVO EMAIL                                                  │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  Modal "Autorizar Novo Email":                                                │
│  ├─ Email: [_____________________]                                            │
│  ├─ Plano: [PRO + Gallery (Acesso Total) ▼]  ← Seletor de plano               │
│  ├─ Observação: [_____________________]                                       │
│  └─ [Autorizar Email]                                                         │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────────────────────────────┐
│  2. LISTAGEM COM COLUNA DE PLANO                                               │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  | Email                    | Plano           | Observação | Ações     |      │
│  |--------------------------|-----------------|------------|-----------|      │
│  | filipe@gmail.com         | 🏆 PRO+Gallery  | Teste      | ⋮ 🗑️     |      │
│  | eduardo@gmail.com        | 👑 PRO          | -          | ⋮ 🗑️     |      │
│  | cliente@gmail.com        | Starter         | Cliente    | ⋮ 🗑️     |      │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────────────────────────────┐
│  3. MENU DE AÇÕES                                                              │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ⋮ Dropdown:                                                                  │
│  ├─ ✏️ Alterar Plano                                                         │
│  └─ 🗑️ Remover                                                                │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Próximos Passos

1. **Executar migration** para adicionar `plan_code` e atualizar `get_access_state()`
2. **Atualizar tipos TypeScript** (auto-gerado após migration)
3. **Modificar AllowedEmailsManager.tsx** com seletor de plano e nova coluna
4. **Testar fluxo completo** - adicionar email com diferentes planos e verificar acesso
