

# Correção: Erro 404 no chunk do PaymentSupabaseService (cache stale após deploy)

## Diagnóstico

O erro na imagem é claro: **404 no asset `/assets/PaymentSupab...rvice-BtNCrt...`**. Isso é um problema clássico de **chunk stale após deploy** no Vite:

1. O usuário abre o app e o browser carrega o `index.html` com referências a chunks (ex: `PaymentSupabaseService-BtNCrt.js`)
2. Um novo deploy acontece → os chunks recebem novos hashes nos nomes
3. O chunk antigo deixa de existir no servidor → **404**
4. O `dynamic import()` falha → `addPayment()` cai no catch → toast "Erro ao adicionar pagamento"

Agravantes no projeto:
- **Service Worker (PWA)** com `globPatterns: ['**/*.{js,css,html,...}']` pode servir HTML/JS cacheado antigo mas não ter o chunk específico
- **`PaymentSupabaseService`** é importado via `await import()` (lazy) em 3 arquivos — qualquer deploy quebra esse import se o browser tiver a versão antiga carregada
- O erro "Could not establish connection. Receiving end does not exist" é consequência (Supabase realtime perde conexão após muito tempo aberto)

## Por que acontece raramente

Só ocorre quando o usuário **mantém a aba aberta por horas** e um deploy acontece nesse intervalo. Por isso aconteceu "meses atrás" e agora novamente.

## Correção

### 1. Adicionar handler global para falha de dynamic import (auto-reload)

Em `src/main.tsx`, interceptar erros de carregamento de chunk e recarregar a página automaticamente:

```ts
// Detectar falha de chunk (deploy novo invalidou assets antigos)
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});
```

O Vite 5 já emite esse evento nativo. Para imports dinâmicos manuais (`await import()`), adicionar wrapper com retry.

### 2. Wrapper de import dinâmico com retry + reload

Criar `src/utils/dynamicImport.ts` com função que:
- Tenta o `import()` normalmente
- Se falhar com erro de rede/404, recarrega a página 1x (usando sessionStorage para evitar loop)

### 3. Aplicar nos 3 pontos que usam `await import('@/services/PaymentSupabaseService')`

- `src/contexts/AppContext.tsx` (addPayment)
- `src/hooks/useSessionPayments.ts` (save, update, delete, pending)

Substituir `await import(...)` pelo wrapper com retry.

### 4. Melhorar resiliência do Service Worker

No `vite.config.ts`, adicionar `navigateFallback` e melhorar a estratégia de cache para assets JS:
- Assets JS: `NetworkFirst` em vez de cache-first (evita servir chunks obsoletos)
- Ou usar `navigateFallbackDenylist` para não cachear chunks dinâmicos

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/utils/dynamicImport.ts` | Novo: wrapper com retry + auto-reload para imports dinâmicos |
| `src/main.tsx` | Adicionar listener `vite:preloadError` para auto-reload |
| `src/contexts/AppContext.tsx` | Usar wrapper no import do PaymentSupabaseService |
| `src/hooks/useSessionPayments.ts` | Usar wrapper nos imports do PaymentSupabaseService |

## Resultado Esperado

- Se um deploy ocorrer com o app aberto, o primeiro erro de chunk causa **reload automático silencioso** (1x)
- Após reload, o browser carrega os chunks novos → tudo funciona
- Sem loop infinito de reload (flag em sessionStorage)
- Sem impacto em uso normal (wrapper é transparente quando chunks existem)

