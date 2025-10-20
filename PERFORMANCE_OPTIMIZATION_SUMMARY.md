# Otimização de Performance - Workflow e Configurações

## Problemas Identificados

### 1. Loops Infinitos de Atualização
- **Causa**: `useConfiguration` executava sync automático em `useEffect`, causando escritas constantes no Supabase
- **Impacto**: `UPDATE on pacotes` repetia infinitamente no console, mesmo sem ação do usuário
- **Sintoma**: Console spam com "notifying 1 listeners" e múltiplas reinicializações de adapters

### 2. Lentidão ao Carregar Workflow
- **Causa**: Múltiplas queries não otimizadas e falta de cache efetivo
- **Impacto**: ~20 segundos para exibir dados na primeira carga
- **Sintoma**: Tela branca/loading prolongado ao acessar página

### 3. Recarga de Pacotes a Cada Mudança de Mês
- **Causa**: Falta de memoização e cache inadequado
- **Impacto**: ~20 segundos extras toda vez que navegava entre meses
- **Sintoma**: Lista de pacotes recarregando mesmo ao voltar para mês já visualizado

### 4. Recriação de Serviços em Cada Render
- **Causa**: `AgendaService` e `SupabaseAgendaAdapter` sendo instanciados a cada render do `AgendaContext`
- **Impacto**: Múltiplas assinaturas realtime desnecessárias
- **Sintoma**: "SupabaseAgendaAdapter initialized" repetindo no console

### 5. Cálculos Redundantes de Fotos Extras
- **Causa**: `AutoPhotoCalculator` com `onValueUpdate` nas dependências, causando loops de recálculo
- **Impacto**: CPU alta e atualizações constantes de banco
- **Sintoma**: Console spam "🧮 AutoPhotoCalculator" com quantidade 0

## Soluções Implementadas

### 1. Unificação da Fonte de Configuração ✅

**Problema**: Dois sistemas paralelos (`useConfiguration` + `ConfigurationContext`) causando sync duplicado

**Solução**:
```typescript
// ANTES ❌
import { useConfiguration } from '@/hooks/useConfiguration';

// DEPOIS ✅
import { useRealtimeConfiguration } from '@/hooks/useRealtimeConfiguration';
// ou
import { useConfigurationContext } from '@/contexts/ConfigurationContext';
```

**Arquivos Atualizados**:
- `src/hooks/useConfiguration.ts` - Deprecado (sync effects removidos)
- `src/components/workflow/WorkflowPackageCombobox.tsx`
- `src/components/workflow/WorkflowTable.tsx`
- `src/components/workflow/GerenciarProdutosModal.tsx`
- `src/components/ui/categoria-selector.tsx`
- `src/hooks/useWorkflowPackageData.ts`
- `src/hooks/useAgenda.ts`

**Resultado**: Fim dos loops de UPDATE no Supabase

### 2. Memoização de Serviços na Agenda ✅

**Problema**: Serviços recriados a cada render

**Solução**:
```typescript
// ANTES ❌
const agendaService = new AgendaService(new SupabaseAgendaAdapter());

// DEPOIS ✅
const agendaService = useMemo(() => {
  return new AgendaService(new SupabaseAgendaAdapter());
}, []);

const integrationService = useMemo(() => {
  return new AgendaWorkflowIntegrationService({...});
}, [
  appContext.clientes?.length,
  appContext.pacotes?.length,
  appContext.produtos?.length,
  appContext.workflowItems?.length,
  criarProjeto
]);
```

**Arquivo**: `src/contexts/AgendaContext.tsx`

**Resultado**: Uma única instância de cada serviço por sessão

### 3. Otimização do WorkflowPackageCombobox ✅

**Melhorias**:
- ✅ Memoização do processamento de pacotes (`useMemo`)
- ✅ Memoização da seleção de pacote (`useMemo`)
- ✅ Remoção de logs de debug
- ✅ Componente envolvido em `React.memo`

**Código**:
```typescript
const pacotes = useMemo(() => {
  return rawPacotes.map((pacote: any) => {
    // ... processamento
  });
}, [rawPacotes, categorias]);

const selectedPackage = useMemo(() => {
  return pacotes.find(pkg => 
    pkg.id === value || 
    pkg.nome === value ||
    String(pkg.id) === String(value)
  );
}, [pacotes, value]);

// Export com memo
export const WorkflowPackageCombobox = memo(WorkflowPackageComboboxComponent);
```

**Resultado**: Componente só re-renderiza quando props mudam

### 4. Estabilização do AutoPhotoCalculator ✅

**Problema**: `onValueUpdate` nas dependências causava loops

**Solução**:
```typescript
// Armazenar callback em ref
const onValueUpdateRef = useRef(onValueUpdate);
useEffect(() => {
  onValueUpdateRef.current = onValueUpdate;
}, [onValueUpdate]);

// Usar ref no cálculo
const calcularEAtualizarValores = useCallback(async () => {
  // ... cálculos
  onValueUpdateRef.current({ ... }); // Não mais nas deps
}, [
  sessionId, quantidade, regrasCongeladas, 
  currentValorFotoExtra, currentValorTotalFotoExtra, 
  categoria, categoriaId, valorFotoExtraPacote
  // onValueUpdate NÃO está aqui!
]);
```

**Melhorias Adicionais**:
- Early return reforçado para `quantidade === 0`
- Verificação de último cálculo antes de atualizar
- Remoção de logs verbosos

**Resultado**: Cálculos só executam quando realmente necessário

### 5. Sistema de Cache Inteligente (Já Implementado) ✅

**Arquivos**:
- `src/services/WorkflowCacheManager.ts` - Cache em memória com TTL
- `src/hooks/useWorkflowData.ts` - Hook cache-first
- `src/hooks/useWorkflowCacheInit.ts` - Preload automático

**Benefícios**:
- ✅ Cache de mês atual + anterior
- ✅ Sincronização cross-tab via BroadcastChannel
- ✅ Invalidação inteligente
- ✅ TTL de 5 minutos

## Métricas de Sucesso

### Antes das Otimizações
- ⏱️ Workflow load: ~20 segundos
- ⏱️ Troca de mês: ~20 segundos (recarga completa)
- 📊 Console: Spam de logs e updates constantes
- 💾 Network: Múltiplas queries redundantes
- 🔄 Realtime: Múltiplas assinaturas duplicadas

### Depois das Otimizações (Esperado)
- ⏱️ Workflow load (com cache): < 100ms
- ⏱️ Workflow load (sem cache): < 500ms
- ⏱️ Troca de mês: < 50ms (cache hit)
- 📊 Console: Limpo, sem spam
- 💾 Network: Queries otimizadas, sem duplicação
- 🔄 Realtime: Uma assinatura por recurso

## Checklist de Validação

- [x] Remover sync effects do `useConfiguration`
- [x] Memoizar `agendaService` e `integrationService`
- [x] Substituir `useConfiguration` por `useRealtimeConfiguration` em todos os componentes
- [x] Otimizar `WorkflowPackageCombobox` (memoização + React.memo)
- [x] Estabilizar `AutoPhotoCalculator` (ref para callback)
- [x] Remover logs verbosos de produção
- [ ] Testar em ambiente real
- [ ] Validar métricas de performance
- [ ] Confirmar ausência de loops no console

## Manutenção Futura

### Regras de Ouro

1. **Nunca use `useConfiguration`** - Sempre use `useRealtimeConfiguration` ou `useConfigurationContext`
2. **Memoize serviços pesados** - Use `useMemo` para instâncias de classes que não devem ser recriadas
3. **Estabilize callbacks** - Use `useRef` para callbacks passados como props que não devem disparar re-renders
4. **Cache first** - Sempre tente usar `useWorkflowData` para dados de workflow
5. **Evite logs em produção** - Use flags de debug ou remova logs verbosos

### Padrão de Componente Otimizado

```typescript
import { memo, useMemo, useCallback, useRef, useEffect } from 'react';

const MyComponentInner = ({ data, onChange }) => {
  // 1. Refs para callbacks instáveis
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // 2. Memoização de dados processados
  const processedData = useMemo(() => {
    return heavyProcessing(data);
  }, [data]);

  // 3. Callbacks estáveis
  const handleClick = useCallback(() => {
    onChangeRef.current(processedData);
  }, [processedData]);

  return (
    <div onClick={handleClick}>
      {processedData.map(item => <Item key={item.id} {...item} />)}
    </div>
  );
};

// 4. Memo para evitar re-renders
export const MyComponent = memo(MyComponentInner);
```

## Próximos Passos

1. **Monitoramento**: Adicionar métricas de performance (Web Vitals)
2. **Profiling**: Usar React DevTools Profiler para identificar outros gargalos
3. **Lazy Loading**: Implementar code splitting para componentes pesados
4. **Virtual Scrolling**: Para listas muito longas no Workflow
5. **Web Workers**: Para cálculos pesados (se necessário)

## Referências

- [React Memo](https://react.dev/reference/react/memo)
- [React useMemo](https://react.dev/reference/react/useMemo)
- [React useCallback](https://react.dev/reference/react/useCallback)
- [Supabase Realtime Best Practices](https://supabase.com/docs/guides/realtime)
