# Refinamento do Workflow Card

## Problemas identificados

1. **Grid desktop não aproveita a largura disponível** — colunas usam larguras fixas (`160px 160px 130px 120px 70px 70px 80px auto`) que deixam o card "amontoado" à esquerda mesmo em telas largas. A coluna de Pacote precisa respirar e ficar maior.
2. **Desalinhamento quando não há pacote** — o `WorkflowPackageCombobox` tem `h-7`, mas o ícone do contador de Produtos (`h-7 px-3`), Status (`h-8`) e o número de Fotos Extras (texto puro) começam em alturas diferentes, criando o efeito visual de "colunas amontoadas/desalinhadas".
3. **Selecionar "Nenhum pacote" não limpa o pacote** (bug crítico). Em `useWorkflowRealtime.ts` linha 298, o handler de `case 'pacote'` faz `if (typeof value === 'string' && value)` — quando o usuário escolhe "Nenhum pacote", o valor enviado é string vazia, então o `if` é pulado e nada é persistido. Além disso, mesmo se persistisse, `WorkflowCardCollapsed` exibe `regras_congeladas?.pacote?.nome || session.pacote`, então o nome do pacote antigo continuaria aparecendo.
4. **Mobile não usa a mesma estrutura** — hoje o desktop tem grid de 11 colunas e o mobile cai num layout vertical diferente. Pedido é unificar: usar a mesma estrutura horizontal com scroll.

## Mudanças

### 1. `src/hooks/useWorkflowRealtime.ts` — corrigir clear do pacote
- No `case 'pacote'`, tratar explicitamente o caso `value === ''` (ou `null`):
  - Persistir `pacote = ''`, `valor_base_pacote = 0`, `valor_foto_extra = 0`, `categoria = ''`.
  - Zerar `regras_congeladas` para `{ pacote: null, precificacaoFotoExtra: null, produtos: [] }` (não setar NULL — o guard da Fase 3 bloqueia NULL, mas objeto vazio passa).
  - Filtrar `produtos_incluidos` mantendo só produtos `tipo === 'manual'`.
  - Disparar recálculo de `valor_total` igual ao fluxo normal.

### 2. `src/components/workflow/WorkflowCardCollapsed.tsx` — grid e alinhamento
- **Grid desktop**: trocar template fixo por proporcional usando `fr`:
  ```
  grid-cols-[28px_44px_minmax(140px,1.2fr)_minmax(160px,1.4fr)_minmax(200px,1.8fr)_minmax(120px,1fr)_72px_80px_minmax(110px,1fr)_minmax(140px,1.2fr)_28px]
  ```
  Pacote ganha o maior `fr` (1.8). Aumentar `gap-3` → `gap-4` para "desamontoar".
- **Alinhamento vertical**: padronizar todas as zonas com a mesma altura de campo (`h-8`) e mesma estrutura `flex flex-col gap-1` com label `text-[10px] uppercase` no topo. Hoje algumas zonas (Data, Nome) usam `pt-1` ad-hoc — substituir por wrappers consistentes.
- **Fotos Extras / Produtos / Pendente / Galerias**: alinhar números/badges em uma baseline única (centro vertical do slot de 32px), usando `min-h-8 flex items-center justify-{start|center|end}`.
- **Pacote vazio**: quando `displayPackageName` for vazio, mostrar placeholder `"Selecione pacote"` em itálico/muted para não colapsar a célula.
- **Contador de Produtos = 0**: estilizar o botão com `min-w-[56px]` para igualar largura do badge quando há pacote/produto, evitando o "encolhimento" mostrado no print.

### 3. `src/components/workflow/WorkflowCardCollapsed.tsx` — clear visual imediato
- Alterar `displayPackageName` para: se `session.pacote === ''` (clear explícito), ignorar `regras_congeladas?.pacote?.nome` e mostrar vazio. Garantir que após o clear o combobox volte ao estado "Selecione".
- No handler `onValueChange` do combobox (linha 413), quando `packageData.id === '' && packageData.nome === ''`, chamar `onFieldUpdate(session.id, 'pacote', '')` explicitamente.

### 4. Mobile — usar mesma estrutura horizontal
- Hoje o `WorkflowCard` envolve só `WorkflowCardCollapsed`. Em mobile o grid vira ilegível.
- Solução: manter o **mesmo grid desktop**, envolvido por um wrapper `overflow-x-auto` em telas `<md`, com `min-w-[1100px]` no grid interno. Resultado: rolagem horizontal no mobile preservando a mesma leitura de colunas pedida pelo usuário.
- Adicionar sombra/indicador sutil de "rolável" nas bordas em mobile.

### 5. Pequenos polimentos
- `ColoredStatusBadge` (Status "Sem status") — manter altura igual a badge ativo para não pular.
- Coluna "Pendente" — alinhar valor `R$ 0,00` à direita com `tabular-nums` para que valores diferentes não desloquem.

## Detalhes técnicos

- Arquivos editados:
  - `src/hooks/useWorkflowRealtime.ts` (case `'pacote'` com branch de clear)
  - `src/components/workflow/WorkflowCardCollapsed.tsx` (grid, alinhamento, wrapper scroll mobile, displayPackageName)
  - `src/components/workflow/WorkflowCard.tsx` (wrapper `overflow-x-auto` responsivo)
  - `src/components/workflow/WorkflowPackageCombobox.tsx` (garantir que `handleClearPackage` envie `id: ''` e `nome: ''`, já está OK — só validar)

- Sem mudanças de schema/DB. Sem mudanças em `WorkflowCardExpanded` além de eventual ajuste de divisor para casar com novo grid.

## Fora de escopo
- Reescrever `WorkflowTable` (tabela legada) — só o `WorkflowCard`.
- Mudar lógica financeira de `valor_total` (já recalculado pelo trigger no DB).
- Adicionar novas colunas.
