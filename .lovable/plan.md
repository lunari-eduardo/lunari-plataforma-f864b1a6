

# Plano: Badge de Status de Pagamento de Fotos Extras no Workflow

## Objetivo
Adicionar um badge visual ao lado de "Total fotos extras" mostrando se o valor está pendente, pago ou sem vendas.

---

## Análise da Situação Atual

### O que funciona:
- Quantidade e valor de fotos extras são sincronizados da Gallery
- O trigger `sync_gallery_status_to_session` sincroniza o `status_galeria`
- Pagamentos são refletidos no `valor_pago` total da sessão

### O que falta:
- O campo `status_pagamento` da galeria (sem_vendas | pendente | pago) **não** está sincronizado para `clientes_sessoes`
- A UI não tem como distinguir se o valor de fotos extras especificamente está pago ou pendente

---

## Sobre Escalabilidade

O modelo atual é escalável:

| Aspecto | Implementação | Status |
|---------|---------------|--------|
| N+1 Queries | Batch query única para transações | ✅ Escalável |
| Cálculos | Triggers no banco de dados | ✅ Escalável |
| Sincronização | BroadcastChannel cross-tab | ✅ Escalável |
| Cache | WorkflowCacheManager com TTL | ✅ Escalável |
| Realtime | Postgres Changes subscription | ✅ Escalável |

Sugestão de melhoria futura: Implementar paginação virtual para fotógrafos com +500 sessões ativas.

---

## Solução Proposta

### Fase 1: Sincronizar status_pagamento da galeria para a sessão

**1.1 Migração SQL - Adicionar coluna e atualizar trigger**

Adicionar campo `status_pagamento_fotos_extra` em `clientes_sessoes` e modificar o trigger para sincronizar:

```sql
-- Adicionar coluna para status de pagamento de fotos extras
ALTER TABLE clientes_sessoes 
ADD COLUMN IF NOT EXISTS status_pagamento_fotos_extra TEXT DEFAULT 'sem_vendas';

-- Atualizar função de sincronização
CREATE OR REPLACE FUNCTION sync_gallery_status_to_session()
RETURNS TRIGGER AS $$
...
  -- Agora também sincroniza status_pagamento
  UPDATE clientes_sessoes
  SET status = target_status,
      status_galeria = NEW.status,
      status_pagamento_fotos_extra = NEW.status_pagamento, -- NOVO
      updated_at = NOW()
  WHERE id = session_record.id;
...
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger adicional para mudanças em status_pagamento
CREATE TRIGGER trigger_sync_gallery_payment_status
AFTER UPDATE OF status_pagamento ON galerias
FOR EACH ROW
EXECUTE FUNCTION sync_gallery_status_to_session();
```

---

### Fase 2: Atualizar tipos e mapeamento de dados

**2.1 Atualizar interface SessionData (`src/types/workflow.ts`)**

Adicionar campo para status de pagamento de fotos extras:

```typescript
export interface SessionData {
  // ... campos existentes ...
  
  // Campos para integração com Galeria
  galeriaId?: string;
  galeriaStatus?: 'rascunho' | 'publicada' | 'em_selecao' | 'finalizada';
  galeriaStatusPagamento?: 'sem_vendas' | 'pendente' | 'pago'; // NOVO
}
```

**2.2 Atualizar hook de conversão (`src/hooks/useWorkflowPackageData.ts`)**

Mapear o novo campo no `convertSessionToData`:

```typescript
const converted: SessionData = {
  // ... campos existentes ...
  
  galeriaId: session.galeria_id,
  galeriaStatus: session.status_galeria as any,
  galeriaStatusPagamento: session.status_pagamento_fotos_extra as any // NOVO
};
```

---

### Fase 3: Criar componente de badge para fotos extras

**3.1 Criar novo componente (`src/components/workflow/FotosExtrasPaymentBadge.tsx`)**

Badge compacto específico para status de pagamento de fotos extras:

```typescript
interface FotosExtrasPaymentBadgeProps {
  status: 'sem_vendas' | 'pendente' | 'pago' | undefined;
  valor?: string; // "R$ 9,00"
}

export function FotosExtrasPaymentBadge({ status, valor }: FotosExtrasPaymentBadgeProps) {
  // Não mostrar badge se não há vendas ou sem valor
  if (!status || status === 'sem_vendas') return null;
  
  const config = status === 'pago' 
    ? { icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Pago' }
    : { icon: Clock, className: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Pendente' };
  
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.className}`}>
      <config.icon className="h-2.5 w-2.5 mr-0.5" />
      {config.label}
    </Badge>
  );
}
```

---

### Fase 4: Integrar badge no WorkflowCardExpanded

**4.1 Modificar bloco de "Total fotos extras" (`src/components/workflow/WorkflowCardExpanded.tsx`)**

Adicionar badge ao lado do valor:

```tsx
// Linha ~292-295
<div className="flex justify-between items-center">
  <span className="text-xs text-muted-foreground">Total fotos extras:</span>
  <div className="flex items-center gap-2">
    <span className="text-sm font-medium text-foreground">{valorFotoExtraTotal}</span>
    {/* Badge de status de pagamento */}
    <FotosExtrasPaymentBadge 
      status={session.galeriaStatusPagamento} 
    />
  </div>
</div>
```

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Nova migração SQL | Criar | Adicionar coluna + trigger para sincronizar status_pagamento |
| `src/types/workflow.ts` | Modificar | Adicionar `galeriaStatusPagamento` |
| `src/hooks/useWorkflowPackageData.ts` | Modificar | Mapear novo campo |
| `src/components/workflow/FotosExtrasPaymentBadge.tsx` | Criar | Componente de badge |
| `src/components/workflow/WorkflowCardExpanded.tsx` | Modificar | Integrar badge |

---

## Resultado Esperado

```
┌────────────────────────────────────────────┐
│ ADICIONAIS                                 │
├────────────────────────────────────────────┤
│ Total fotos extras:    R$ 9,00  [Pendente] │
│ Total produtos:        R$ 0,00             │
│ Adicional:            [________]           │
└────────────────────────────────────────────┘
```

O badge aparecerá:
- **Não aparece** - Se `sem_vendas` ou valor = R$ 0,00
- **🟠 Pendente** - Se há fotos extras vendidas mas não pagas
- **🟢 Pago** - Se o valor de fotos extras foi pago

---

## Escalabilidade Mantida

Esta solução mantém a escalabilidade porque:
1. **Trigger no banco** - Sincronização automática sem frontend
2. **Sem queries adicionais** - Dados já vêm no SELECT existente
3. **Componente leve** - Badge não faz chamadas de API

