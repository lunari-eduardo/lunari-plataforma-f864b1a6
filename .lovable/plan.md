

# Fix: Rolagem Vertical no Modal de Cobrança

## Problema

O conteúdo do modal ultrapassa a altura da viewport e fica cortado na parte inferior. O `ScrollArea` tem `max-h-[calc(90vh-180px)]` mas o componente `Tabs` que o envolve não usa layout flex, impedindo que a restrição de altura funcione corretamente.

## Solução

### `src/components/cobranca/ChargeModal.tsx`

1. **Tabs**: Adicionar `className="flex-1 flex flex-col min-h-0 overflow-hidden"` para que participe do layout flex do `DialogContent`
2. **ScrollArea**: Trocar a classe fixa `max-h-[calc(90vh-180px)]` por um `overflow-y-auto` nativo, já que o Radix ScrollArea Viewport precisa de height constraints explícitas vindas do container flex — ou substituir o `ScrollArea` por uma `div` com `overflow-y-auto flex-1 min-h-0`

A abordagem mais confiável: substituir `<ScrollArea>` por `<div className="flex-1 min-h-0 overflow-y-auto">` pois o Radix ScrollArea tem problemas conhecidos com containers flex dinâmicos.

### Detalhes

- `DialogContent` já tem `flex flex-col` e `max-h-[90vh]` ✓
- `DialogHeader` é fixo no topo ✓  
- `Footer` é fixo embaixo ✓
- O conteúdo central (Tabs + conteúdo) precisa receber `flex-1 min-h-0` e scroll interno

