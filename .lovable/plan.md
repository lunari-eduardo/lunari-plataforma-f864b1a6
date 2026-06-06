# Plano: Etapas de sistema do Gallery — proteção, provisionamento e ocultar/mostrar

## Contexto atual (o que já existe)

- Coluna `etapas_trabalho.is_system_status boolean default false`.
- Função `provision-gallery-workflow-statuses` cria/marca as 3 etapas (`Enviado para seleção`, `Seleção finalizada`, `Expirada`) **apenas** quando o usuário adquire Studio Pro + Gallery.
- `FluxoTrabalho.tsx` já esconde os botões Editar/Excluir para `is_system_status`, mas o botão de ocultar é só um placeholder ("em breve").
- `InitialDataService.populateDefaultData` semeia `DEFAULT_ETAPAS` mas **não** inclui as 3 etapas de sistema.
- Não existe proteção no banco — qualquer update/delete passa pela RLS normal.

## O que falta

1. **Provisionar por padrão para todos os usuários novos** (mesmo sem Gallery) — as etapas devem nascer com a conta.
2. **Backfill** para usuários existentes que ainda não têm as 3 etapas marcadas como sistema.
3. **Proteção no banco** (defesa em profundidade) contra delete/edit (nome) de etapas de sistema, mesmo via API direta.
4. **Coluna nova** `is_hidden_in_workflow boolean default false` para o toggle ocultar/mostrar.
5. **Botão funcional** Ocultar/Mostrar (ícone `Eye` / `EyeOff`) substituindo o placeholder atual.
6. **Override automático**: quando o usuário tem Gallery ativo, etapas ocultas voltam a aparecer em todos os dropdowns/listas do workflow.
7. **Filtro em todas as fontes de status do workflow** (`useWorkflowStatus`, `useRealtimeConfiguration` consumers) respeitando o override.

## Mudanças

### 1. Migração de banco
```sql
ALTER TABLE public.etapas_trabalho
  ADD COLUMN is_hidden_in_workflow boolean NOT NULL DEFAULT false;

-- Trigger de proteção
CREATE OR REPLACE FUNCTION public.protect_system_etapas()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_system_status THEN
    RAISE EXCEPTION 'Etapas do sistema não podem ser excluídas';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_system_status THEN
    -- Permitir alterar apenas: ordem, is_hidden_in_workflow, updated_at, cor
    IF NEW.nome IS DISTINCT FROM OLD.nome
       OR NEW.is_system_status IS DISTINCT FROM OLD.is_system_status THEN
      RAISE EXCEPTION 'Etapas do sistema têm nome/flag protegidos';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_protect_system_etapas
BEFORE UPDATE OR DELETE ON public.etapas_trabalho
FOR EACH ROW EXECUTE FUNCTION public.protect_system_etapas();
```

**Backfill** (via insert tool após migração): para cada usuário existente sem as 3 etapas, criar; para os que têm com mesmo nome, marcar `is_system_status = true`.

### 2. Provisionamento padrão de novos usuários
- Atualizar `src/services/InitialDataService.ts`: adicionar as 3 etapas de sistema ao final do array `etapasData`, com `is_system_status: true` e `is_hidden_in_workflow: false` (ou `true` por padrão para quem não tem Gallery — ver decisão abaixo).
- Atualizar também `DEFAULT_ETAPAS` em `src/types/configuration.ts` para refletir as 3 etapas.

**Decisão de default**: começar com `is_hidden_in_workflow = true` para novos usuários sem Gallery — assim quem nunca usa não vê as etapas no dropdown, mas elas existem prontas. No momento que o usuário ativa Gallery, o override exibe automaticamente. Mantém UX limpa por padrão.

### 3. UI — `FluxoTrabalho.tsx`
- Substituir o botão placeholder `EyeOff` por um toggle real:
  - Ícone `Eye` quando visível, `EyeOff` quando oculta.
  - Chama nova função `toggleHiddenEtapa(id)` que faz `update` em `is_hidden_in_workflow`.
  - Linha das etapas ocultas recebe `opacity-60` + badge "Oculta" para feedback visual.
- Quando `hasGaleryAccess === true` e a etapa está oculta, mostrar tooltip: *"Visível automaticamente — Gallery ativo"*, com o toggle desabilitado.

### 4. Hook e adapter
- Adicionar `atualizarEtapa` já cobre o update (passa `is_hidden_in_workflow`). Conferir tipagem em `EtapaTrabalho` (`src/types/configuration.ts`) e em `src/integrations/supabase/types.ts` (regenera após migração).
- Em `useWorkflowStatus` filtrar:
  ```ts
  const visible = workflowStatuses.filter(s =>
    !s.is_hidden_in_workflow || hasGaleryAccess || s.is_system_status === false
  );
  ```
  Regra final: oculta uma etapa SE `is_hidden_in_workflow` E (não é system OU usuário não tem Gallery ativo).
- Expor `hasGaleryAccess` via `useAccessControl` dentro de `useWorkflowStatus`.

### 5. Pontos de consumo a auditar
Garantir que usam `useWorkflowStatus.getStatusOptions` (já filtrado) e não leem `etapas` cru:
- `WorkflowTable.tsx` (dropdown de status nas sessões)
- Filtros em `Workflow.tsx` / `WorkflowFilters`
- Kanban (se houver coluna por etapa)
- Configurações de notificação que listem etapas

Mesmo quando ocultas, as etapas continuam válidas se uma sessão já estiver com aquele status — o filtro afeta apenas a lista de seleção, nunca a exibição do valor atual.

## Arquivos afetados
- `supabase/migrations/<novo>.sql` (coluna + trigger)
- `src/services/InitialDataService.ts`
- `src/types/configuration.ts` (+ tipo `EtapaTrabalho`, + `DEFAULT_ETAPAS`)
- `src/integrations/supabase/types.ts` (regenerado)
- `src/components/configuracoes/FluxoTrabalho.tsx`
- `src/hooks/useWorkflowStatus.ts`
- `src/hooks/useRealtimeConfiguration.ts` (passar nova flag adiante, se necessário)
- Backfill via insert tool após aprovação da migração

## Resultado esperado
- Novo usuário já nasce com as 3 etapas do Gallery, ocultas por padrão.
- Usuário não-Gallery pode mostrar/ocultar livremente; nunca consegue editar nome ou excluir.
- Usuário com Gallery ativo: etapas sempre visíveis no fluxo, toggle desabilitado.
- Banco recusa qualquer tentativa direta de excluir/renomear etapa de sistema.
