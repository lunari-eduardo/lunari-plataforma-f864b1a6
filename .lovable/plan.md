
# Melhoria UI do Editor de Templates + Fix "Adicionar campo"

## Problemas

1. **"Adicionar campo" não funciona**: O `DropdownMenu` com `modal={false}` dentro de um `Dialog` (que é modal) causa conflito — o Dialog captura os cliques e impede que o DropdownMenuItem dispare o `onClick`. O `z-[9999]` não resolve porque o problema é de evento, não de camada visual.

2. **UI verbosa**: Cada campo ocupa muito espaço vertical com bordas grossas, labels separados e inputs grandes. A hierarquia visual é fraca.

## Correções

### 1. Fix "Adicionar campo"

Trocar o `DropdownMenu` por um `Popover` (do Radix) que funciona melhor dentro de Dialogs modais. O Popover usa Portal e não tem o conflito de modal nesting. Alternativamente, usar `DropdownMenu` **sem** `modal={false}` (removendo essa prop) e adicionando `onCloseAutoFocus={(e) => e.preventDefault()}` para evitar o refocus.

**Solução escolhida**: Remover `modal={false}` do DropdownMenu. O padrão `modal={true}` funciona corretamente dentro de Dialogs porque cria sua própria camada modal.

### 2. UI compacta dos campos

Redesenhar o `SortableCampoItem` com layout mais denso:

**Antes** (atual):
```
┌─────────────────────────────────────────┐
│ ⠿ TEXTO CURTO          Obrigatório 🔘 🗑│
│                                         │
│ Pergunta                                │
│ ┌─────────────────────────────────────┐ │
│ │ Nome do bebê                        │ │
│ └─────────────────────────────────────┘ │
│ Placeholder                             │
│ ┌─────────────────────────────────────┐ │
│ │ Ex: Sofia                           │ │
│ └─────────────────────────────────────┘ │
│ Texto de ajuda (opcional)               │
│ ┌─────────────────────────────────────┐ │
│ │ Pode ser deixado em branco...       │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Depois** (compacto):
```
┌ ⠿ TEXTO CURTO              Obrigatório 🔘 🗑
│
│ [Pergunta___________] [Placeholder______]
│ [Texto de ajuda (opcional)_______________]
└─────────────────────────────────────────────
```

Mudanças específicas:
- Remover `<Label>` separado de cada input — usar apenas `placeholder` nos inputs como label contextual
- Borda esquerda sutil (como o block hierarchy pattern) em vez de borda completa com `rounded-lg border`
- Padding reduzido: `p-4` → `pl-3 pr-2 py-2`
- Pergunta e Placeholder lado a lado em **todos** os tamanhos (não só `sm:grid-cols-2`)
- Texto de ajuda: input menor, `h-8` com `text-xs`
- Para campos de seleção (opções): inputs de opção inline menores com `h-8`

### 3. Cabeçalho do modal mais compacto

- Nome + Categoria na mesma linha (já está)
- Descrição + Tempo estimado: Descrição ocupa mais espaço (3/4), tempo estimado compacto (1/4)
- Reduzir `space-y-6` → `space-y-4` no container geral

## Arquivo a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/configuracoes/FormularioTemplateEditor.tsx` | Fix dropdown, redesign compacto dos campos |
