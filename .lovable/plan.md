## Diagnóstico

O erro persistente continua apontando para `.toFixed()` durante o render do Workflow. A correção anterior protegeu parte do fluxo antigo (`useWorkflowRealtime.convertToSessionData`), mas a página atual usa principalmente:

- `src/pages/Workflow.tsx`
- `src/hooks/useWorkflowPackageData.ts`
- `src/contexts/WorkflowCacheContext.tsx`
- componentes internos de `src/components/workflow/*`

O ponto mais provável de crash agora é `useWorkflowPackageData.ts`, especialmente:

```ts
packageData.packageFotoExtraValue.toFixed(2)
```

Mesmo que os valores da sessão tenham sido normalizados, `packageData.packageFotoExtraValue` vem de `session.regras_congeladas.pacote.valorFotoExtra`. Se esse campo vier `undefined`, `null`, string inválida ou objeto legado, o render quebra antes do `ErrorBoundary` conseguir isolar corretamente a experiência.

Também há chamadas ainda frágeis em:

- `Workflow.tsx`: `pacote.valor_base.toFixed`, `produto.preco_venda.toFixed`, `formatCurrency(value.toFixed)` e `change.toFixed`
- `WorkflowPackageCombobox.tsx`: `pkg.valor.toFixed`
- `QuickSessionAdd.tsx`: `value.toFixed`
- `SessionChangeLog.tsx`: `payment.valor.toFixed`, `entry.valor.toFixed`
- `RegrasCongeladasIndicator.tsx`: `regras.valorFixo?.toFixed` retorna número formatado com ponto antes do fallback
- `ReconcileExtrasModal.tsx`: `n.toFixed`

## Plano de correção

### 1. Blindar a conversão central do Workflow
Editar `src/hooks/useWorkflowPackageData.ts` para criar helpers locais:

- `toSafeNumber(value, fallback = 0)`
- `formatBRL(value, fallback = 0)`
- `safeArray(value)`

Aplicar esses helpers em todos os valores monetários e quantidades antes de renderizar `SessionData`.

Também envolver `convertSessionToData(session)` em `try/catch`, retornando uma sessão mínima segura se um registro específico estiver corrompido. Assim, uma única sessão ruim nunca derruba a página inteira.

### 2. Higienizar dados antes de salvar/ler no cache
Editar `src/contexts/WorkflowCacheContext.tsx` para normalizar sessões vindas de:

- Supabase
- IndexedDB
- realtime
- eventos customizados

Criar `normalizeWorkflowSession(session)` e aplicar antes de `setMonthData`/`mergeUpdate`. A normalização garantirá defaults para:

- `valor_total`, `valor_pago`, `valor_base_pacote`
- `valor_foto_extra`, `valor_total_foto_extra`
- `valor_adicional`, `desconto`
- `qtd_fotos_extra`
- `produtos_incluidos`
- `regras_congeladas`
- `clientes`

Isso previne que cache antigo ou payload parcial de realtime continue reintroduzindo valores quebrados.

### 3. Corrigir todas as chamadas frágeis de `.toFixed()` no Workflow
Editar os arquivos do escopo Workflow para trocar chamadas diretas por `Number(value) || 0` antes de formatar:

- `src/pages/Workflow.tsx`
- `src/components/workflow/WorkflowPackageCombobox.tsx`
- `src/components/workflow/QuickSessionAdd.tsx`
- `src/components/workflow/SessionChangeLog.tsx`
- `src/components/workflow/RegrasCongeladasIndicator.tsx`
- `src/components/workflow/ReconcileExtrasModal.tsx`

Não mexer em telas fora do Workflow para evitar escopo desnecessário.

### 4. Ajustar o ErrorBoundary para pegar o erro certo
Hoje o `ErrorBoundary` está dentro do `return` de `Workflow.tsx`; erros que acontecem antes do `return` principal, em `useMemo`, continuam podendo deixar a tela branca.

Solução: transformar a página em:

```tsx
export default function Workflow() {
  return (
    <ErrorBoundary label="Workflow">
      <WorkflowContent />
    </ErrorBoundary>
  );
}
```

Mover a lógica atual para `WorkflowContent`. Assim o boundary envolve também os hooks/memos internos do conteúdo.

### 5. Adicionar fallback de recuperação de cache
No fallback do `ErrorBoundary` do Workflow, oferecer ação de recuperação real:

- limpar cache local do Workflow/IndexedDB via `forceRefresh` quando possível
- ou recarregar a página se o contexto ainda não estiver disponível

Objetivo: se o usuário estiver com cache corrompido no navegador, ele consegue se recuperar sem precisar suporte manual.

### 6. Verificação
Após implementar:

- navegar para `/app/workflow`
- verificar console sem `Cannot read properties of undefined (reading 'toFixed')`
- verificar que a página não fica preta/vazia
- confirmar que uma sessão com dados financeiros nulos/corrompidos aparece com `R$ 0,00`, não quebra o render
- confirmar que cache/realtime não reintroduz dados inválidos

## Ajuste manual recomendado para produção

Se ainda houver usuários presos com cache antigo depois do deploy, orientar a limpar cache do app/PWA uma única vez. A correção acima reduz a necessidade disso porque o próprio app passará a normalizar cache legado ao carregar.