

# Plano: Corrigir Duplicações de Sessões e Carregamento de Status

## Problema 1: 95 Sessões Duplicadas

### Causa Raiz Identificada

As 95 sessões duplicadas foram criadas **hoje (2026-02-16)** entre 13:45 e 14:25 UTC. Todas possuem:

| Característica | Valor |
|---|---|
| session_id | `proj_1771249265XXX_random` (prefixo `proj_`) |
| appointment_id | NULL |
| status | "agendado" |
| pacote | "Básico" ou "Completo" |
| valor_total | 0 |
| valor_pago | 0 |

**O que aconteceu:**

1. O `AppContext.tsx` (linha 270-280) executa `ProjetoService.migrarDadosExistentes()` e `deduplicarProjetos()` a cada inicialização
2. Essa migração lê `localStorage.getItem('workflow_sessions')` e cria "Projetos" no localStorage com IDs `proj_TIMESTAMP_random`
3. O `AppContext` gera `workflowItems` a partir desses projetos com `id: projeto.projectId` e `sessionId: projeto.projectId` (linha 284-285)
4. O hook `useAppointmentWorkflowSync` (linha 292-312) executa `migrateLocalStorageData()` que lê `workflow_sessions` do localStorage e insere no Supabase
5. A flag `workflow_migration_completed` foi perdida (possível limpeza de cache/cookies), fazendo a migração rodar novamente
6. Como o localStorage já continha dados contaminados com IDs `proj_`, foram inseridas 95 sessões fantasmas no Supabase

Fluxo do problema:

```text
workflow_sessions (localStorage)
    |
    v
ProjetoService.migrarDadosExistentes() -- cria projetos com IDs proj_
    |
    v
AppContext workflowItems -- sessionId = proj_XXX
    |
    v
migrateLocalStorageData() -- insere no Supabase com session_id = proj_XXX
    |
    v
95 sessões duplicadas no banco (appointment_id = NULL, status = agendado)
```

### Correção Imediata (Banco)

Deletar as 95 sessões fantasmas do banco. Elas são identificáveis com 100% de segurança por:
- `session_id LIKE 'proj_%'`
- `appointment_id IS NULL`
- `status = 'agendado'`
- `valor_total = 0`
- Todas criadas em 2026-02-16

```sql
DELETE FROM clientes_sessoes 
WHERE session_id LIKE 'proj_%' 
  AND appointment_id IS NULL 
  AND status = 'agendado' 
  AND valor_total = 0;
```

### Correção no Código (Prevenção)

**Arquivo: `src/hooks/useAppointmentWorkflowSync.ts`**

Remover ou desativar permanentemente a migração de localStorage para Supabase. O sistema já é 100% Supabase, essa migração é um legado perigoso.

```typescript
// ANTES (linha 292-312):
useEffect(() => {
  const migrationKey = 'workflow_migration_completed';
  const hasRunMigration = localStorage.getItem(migrationKey);
  if (!hasRunMigration) {
    // ... migrateLocalStorageData()
  }
}, []);

// DEPOIS:
// Removido completamente - migração legada não é mais necessária
```

**Arquivo: `src/contexts/AppContext.tsx`**

Remover a execução automática de `ProjetoService.migrarDadosExistentes()` na inicialização do estado, que contamina o localStorage:

```typescript
// ANTES (linha 270-280):
const [projetos, setProjetos] = useState<Projeto[]>(() => {
  ProjetoService.migrarDadosExistentes();  // PERIGOSO
  ProjetoService.deduplicarProjetos();     // PERIGOSO
  return ProjetoService.carregarProjetos();
});

// DEPOIS:
const [projetos, setProjetos] = useState<Projeto[]>(() => {
  // Migração legada removida - dados são gerenciados pelo Supabase
  return [];
});
```

---

## Problema 2: Erros 406 no Console

### Causa Raiz

Os erros `406 (Not Acceptable)` vêm de queries ao Supabase (visível na URL `clientes_sessoes`) que retornam múltiplas linhas quando `.single()` é usado. Com as 95 duplicatas, muitas queries de busca por `cliente_id` + `data_sessao` retornam mais de uma linha, causando o erro 406.

### Correção

Ao deletar as 95 duplicatas, os erros 406 desaparecerão automaticamente. Adicionalmente, revisar queries que usam `.single()` e trocar por `.maybeSingle()` onde apropriado para evitar erros futuros.

---

## Problema 3: Cor do Status Não Carrega no Dropdown

### Causa Raiz

O `ColoredStatusBadge` usa `useWorkflowStatus()` que depende de `useRealtimeConfiguration()` para buscar as `etapas` do Supabase. Quando os dados são carregados pela primeira vez (cold start ou meses antigos), as etapas ainda não foram carregadas pelo `ConfigurationProvider`, fazendo com que `getStatusColor()` retorne a cor default `#6B7280` (cinza).

O componente `ColoredStatusBadge` não re-renderiza quando as etapas eventualmente carregam porque o `Select` do Radix já renderizou seu conteúdo interno.

### Correção

**Arquivo: `src/components/workflow/ColoredStatusBadge.tsx`**

Adicionar verificação de loading e forçar re-render quando os dados de configuração ficarem disponíveis:

```typescript
export function ColoredStatusBadge({ status, className = '', showBackground = false }) {
  const { getStatusColor, workflowStatuses } = useWorkflowStatus();
  
  // Força re-render quando workflowStatuses mudam (dados carregados)
  const statusColor = useMemo(() => {
    // ... lógica existente de getStatusColorValue
  }, [status, workflowStatuses]); // Adicionar workflowStatuses como dependência
  
  // ... resto do componente
}
```

**Arquivo: `src/hooks/useWorkflowStatus.ts`**

Garantir que o `getStatusColor` é recalculado quando as etapas mudam (já usa `useMemo` com `workflowStatuses` como dependência, mas o `useMemo` retorna uma função, que mantém closure sobre dados antigos):

```typescript
// ANTES:
const getStatusColor = useMemo(() => (statusName: string) => {
  const status = workflowStatuses.find(s => s.nome === statusName);
  return status?.cor || '#6B7280';
}, [workflowStatuses]);

// DEPOIS: useCallback para garantir nova referência quando dados mudam
const getStatusColor = useCallback((statusName: string) => {
  const status = workflowStatuses.find(s => s.nome === statusName);
  return status?.cor || '#6B7280';
}, [workflowStatuses]);
```

---

## Resumo das Alterações

| Arquivo | Ação |
|---|---|
| **Banco de dados** | DELETE 95 sessões com `session_id LIKE 'proj_%'` |
| `src/hooks/useAppointmentWorkflowSync.ts` | Remover bloco de migração localStorage (linhas 292-312) |
| `src/contexts/AppContext.tsx` | Remover `ProjetoService.migrarDadosExistentes()` da inicialização |
| `src/components/workflow/ColoredStatusBadge.tsx` | Adicionar `workflowStatuses` como dependência do useMemo |
| `src/hooks/useWorkflowStatus.ts` | Trocar `useMemo` por `useCallback` no `getStatusColor` |

---

## Verificação Pós-Correção

1. Confirmar zero sessões com `proj_`:
```sql
SELECT COUNT(*) FROM clientes_sessoes WHERE session_id LIKE 'proj_%';
-- Esperado: 0
```

2. Confirmar que erros 406 pararam no console

3. Verificar que cores do status carregam corretamente na primeira visita ao Workflow (sem reload)

4. Navegar para meses antigos e confirmar que cores aparecem imediatamente

