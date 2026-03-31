

# Filtro contextual no modal + rolagem nativa no Select

## Problema 1: Itens não filtrados por contexto
O modal sempre mostra "grupo ativo + todos os itens". Quando clicado em "Adicionar despesa fixa", deveria mostrar **apenas** itens de Despesa Fixa. Os botões do header devem mostrar todos.

## Problema 2: Rolagem só funciona nas setas
O `SelectContent` do Radix usa `overflow-hidden` e depende dos `ScrollUpButton`/`ScrollDownButton`. Isso impede scroll normal com roda do mouse ou touch.

## Solução

### 1. Modal: nova prop `filtrarApenasGrupo` (boolean)
- Botões do header: `filtrarApenasGrupo = false` → mostra todos os itens agrupados
- Botões contextuais das seções: `filtrarApenasGrupo = true` → mostra **apenas** itens do `grupoAtivo`

**`src/components/financas/LancamentosTab.tsx`**
- Adicionar estado `modalFiltrarApenas: boolean`
- `abrirModal` dos botões do header: `setModalFiltrarApenas(false)`
- `abrirModal` dos botões contextuais: `setModalFiltrarApenas(true)`
- Passar nova prop ao modal

**`src/components/financas/ModalNovoLancamentoRefatorado.tsx`**
- Nova prop `filtrarApenasGrupo?: boolean`
- Quando `true`: mostrar apenas `itensGrupoAtivo` (sem seção "Todos os Itens")
- Quando `false`: mostrar todos os itens organizados por grupo (comportamento atual dos botões do header)

### 2. Select: habilitar rolagem nativa

**`src/components/ui/select.tsx`**
- No `SelectPrimitive.Viewport`: adicionar `overflow-y-auto max-h-[300px]` (ou similar) para scroll nativo
- Isso é um fix conhecido do Radix Select — basta trocar `overflow-hidden` por `overflow-auto` no Content e garantir que o Viewport tenha `max-height`

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/financas/LancamentosTab.tsx` | Adicionar estado `modalFiltrarApenas`, passar ao modal |
| `src/components/financas/ModalNovoLancamentoRefatorado.tsx` | Nova prop `filtrarApenasGrupo`, lógica de filtro condicional |
| `src/components/ui/select.tsx` | Habilitar scroll nativo no Viewport |

