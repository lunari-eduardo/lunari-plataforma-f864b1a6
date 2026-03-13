

# Correção de Dropdowns no Workflow: Fundo Escuro, Foco Intenso e Busca sem Acentos

## Problemas Identificados

1. **Input preto no dropdown**: O `CommandInput` wrapper em `command.tsx` usa `bg-background`. Porém, o `Command` raiz aplica a classe `dropdown-solid` que força `hsl(30 30% 98%) !important` — funcionando. O problema real é que os 4 comboboxes do workflow usam `bg-neumorphic-base` que **não existe** como classe CSS (zero matches). O `Command` e `PopoverContent` ficam sem fundo definido, herdando preto ou transparente. Em light mode, a ausência de fundo faz o input parecer escuro contra o overlay.

2. **Foco laranja intenso**: `data-[selected='true']:bg-accent` no `CommandItem` usa `--accent: 19 49% 45%` (terra-cotta 100% opaco). Precisa reduzir para ~20% de opacidade.

3. **Busca sem suporte a acentos**: O `cmdk` usa comparação exata por padrão. "pasc" não encontra "Páscoa". Precisa de uma função `filter` customizada que normalize diacríticos.

## Plano de Alterações

### 1. `src/components/ui/command.tsx` — Foco suave + filtro sem acentos

- **CommandItem** (linha 53): Trocar `data-[selected='true']:bg-accent` por `data-[selected='true']:bg-accent/20` para reduzir opacidade do highlight de foco
- **Command** (linha 10): Adicionar prop `filter` padrão que normaliza diacríticos usando `String.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`
- **CommandInput** wrapper (linha 28): Trocar `bg-background` por `bg-transparent` para herdar do container pai

### 2. 4 Comboboxes do Workflow — Remover `bg-neumorphic-base` inexistente

Nos 4 arquivos, substituir `bg-neumorphic-base` por `dropdown-solid` (que já existe e funciona no CSS):

- `src/components/workflow/PackageCombobox.tsx` — linhas 50-51
- `src/components/workflow/WorkflowPackageCombobox.tsx` — linhas 113-114
- `src/components/workflow/ProductCombobox.tsx` — linhas 79-80
- `src/components/workflow/CategoryCombobox.tsx` — linhas 51-52

Também trocar `bg-neutral-50` nos `CommandGroup` e `hover:bg-neumorphic-base` nos items por classes compatíveis.

### Resumo

```text
Arquivo                          Mudança
───────────────────────────────  ─────────────────────────────────
command.tsx                      bg-accent → bg-accent/20, filtro NFD, bg-transparent no input
PackageCombobox.tsx              bg-neumorphic-base → dropdown-solid
WorkflowPackageCombobox.tsx      bg-neumorphic-base → dropdown-solid
ProductCombobox.tsx              bg-neumorphic-base → dropdown-solid
CategoryCombobox.tsx             bg-neumorphic-base → dropdown-solid
```

6 arquivos, apenas CSS e uma função de filtro. Zero lógica de negócio alterada.

