

# Workflow: Layout único desktop em todos os dispositivos

## Problema
O `WorkflowCardCollapsed` tem 3 layouts separados: desktop (`lg:`), tablet (`md:`-`lg:`) e mobile (`<md`). No mobile, o layout é simplificado e desorganizado. No tablet, há pequenos erros como botão "Criar" fora de posição.

O `WorkflowCardExpanded` também tem uma seção `md:hidden` exclusiva para mobile com layout diferente do desktop.

## Solução
Remover os layouts tablet e mobile, manter **apenas o layout desktop** em todos os breakpoints. O container pai (`WorkflowCardList`) já tem `overflow-x-auto` e `min-w-[900px]`, garantindo rolagem horizontal em telas menores.

## Mudanças

### 1. `WorkflowCardCollapsed.tsx`
- **Remover** o bloco tablet (linhas 462-593): `hidden md:grid lg:hidden grid-cols-[...]`
- **Remover** o bloco mobile (linhas 595-647): `flex md:hidden items-center gap-2 flex-wrap`
- **Alterar** o bloco desktop (linha 311): trocar `hidden lg:grid` por apenas `grid` — visível sempre
- Labels de coluna (`Descrição`, `Pacote`, `Status`, etc.) permanecem intactos

### 2. `WorkflowCardExpanded.tsx`
- **Remover** a seção mobile exclusiva (linhas 173-266): `md:hidden space-y-4` com "Editar Sessão"
- O grid de 3 blocos (linha 269) já funciona bem; trocar `grid-cols-1 md:grid-cols-3` por `grid-cols-3` fixo

### 3. `WorkflowCardList.tsx`
- Manter `min-w-[900px]` e `overflow-x-auto` no container — sem mudanças necessárias

## Resultado
- Smartphone e tablet mostram exatamente o mesmo layout do desktop
- Rolagem horizontal natural para telas menores
- Sem zoom artificial nem media queries diferentes
- Card expandido também mantém layout de 3 colunas

## Arquivos
| Arquivo | Mudança |
|---------|---------|
| `src/components/workflow/WorkflowCardCollapsed.tsx` | Remover layouts tablet/mobile, tornar desktop visível sempre |
| `src/components/workflow/WorkflowCardExpanded.tsx` | Remover seção mobile, fixar grid em 3 colunas |

