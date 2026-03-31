

# Redesign: Configurações Financeiras — UI Premium (Notion/Stripe style)

## Visão Geral

Transformar a página de configurações financeiras de "cards pesados com grid aleatório" para uma interface limpa, hierárquica e rápida, inspirada em Notion/Stripe.

## Mudanças Principais

### 1. Barra de criação inline (substituir card pesado)

Remover o Card com borda dupla/gradiente. Substituir por uma barra inline leve:

```text
[ Digite um novo item financeiro... ] [ Despesa Fixa ▼ ] [ + Adicionar ]
```

- Sem Card, sem CardHeader, sem borda pesada
- Uma única linha horizontal com input + select + botão
- Fundo sutil (`bg-muted/30`) com borda fina (`border border-border/50`)
- Padding mínimo (`p-3`)

### 2. Agrupamento por tipo principal (hierarquia visual)

Reorganizar os 5 grupos em 3 seções macro:

```text
🔴 DESPESAS
  ── Fixas ──────────────────────
  Adobe                    ✏️ 🗑️
  Água                     ✏️ 🗑️
  
  ── Variáveis ──────────────────
  Alimentação              ✏️ 🗑️
  Combustível              ✏️ 🗑️

🟢 RECEITAS
  ── Operacionais ───────────────
  (vazio: "Nenhum item ainda.")
  
  ── Não Operacionais ───────────
  Receita Extra            ✏️ 🗑️

🟣 INVESTIMENTOS
  Acervo/Cenário           ✏️ 🗑️
  Equipamentos             ✏️ 🗑️
```

- Seções macro com título colorido (não badge, apenas texto com cor)
- Sub-seções com separador simples (linha fina + label)
- Sem cards ao redor dos itens
- Layout vertical single-column (não grid 3 colunas)

### 3. Edição inline ao clicar no nome

- Clicar no nome do item → transforma em input editável inline
- Enter salva, Escape cancela
- Sem botão "Editar" separado — o nome É o trigger
- Ícones de ação (editar/excluir) aparecem **apenas no hover** da linha

### 4. Linhas limpas sem boxes

Cada item será uma linha simples:

```text
<nome>                                    [ações no hover]
```

- Sem `bg-lunar-surface/50`, sem `border`, sem `rounded-md` por item
- Apenas `border-b border-border/20` entre itens (separador sutil)
- Hover: `bg-muted/30` suave
- Ações (editar/excluir) com `opacity-0 group-hover:opacity-100`

### 5. Estados vazios úteis

De: `"Nenhum item cadastrado neste grupo."`
Para: `"Nenhum item ainda. Adicione um usando o campo acima."`

### 6. Mobile: Seções colapsáveis (acordeão)

- Em mobile (`< 768px`), cada seção macro (Despesas, Receitas, Investimentos) vira um acordeão
- Usar `Collapsible` do Radix (já existe no projeto)
- Sub-seções ficam sempre abertas dentro do acordeão expandido

### 7. Cartões de Crédito — mesma filosofia

- Remover Card pesado do formulário → inline leve
- Lista de cartões: linhas simples em vez de cards
- Remover card "Como funciona?" (mover para tooltip ou texto discreto)

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/financas/configuracoes/AddItemForm.tsx` | Reescrever: barra inline sem Card |
| `src/components/financas/configuracoes/ItemsList.tsx` | Reescrever: seções macro, linhas limpas, hover actions, edição inline por clique |
| `src/components/financas/ConfiguracaoCartoes.tsx` | Simplificar: formulário inline, lista sem cards |
| `src/constants/financialConstants.ts` | Adicionar agrupamento macro (DESPESAS/RECEITAS/INVESTIMENTOS) |
| `src/components/financas/configuracoes/FinancialConfigHeader.tsx` | Manter simples, sem mudanças |

## Detalhes Técnicos

- Agrupamento macro definido como constante:
  ```ts
  const MACRO_GROUPS = [
    { label: 'Despesas', color: 'text-destructive', groups: ['Despesa Fixa', 'Despesa Variável'] },
    { label: 'Receitas', color: 'text-lunar-success', groups: ['Receita Operacional', 'Receita Não Operacional'] },
    { label: 'Investimentos', color: 'text-primary', groups: ['Investimento'] },
  ];
  ```
- Edição inline: ao clicar no nome, `onEditItem(item)` já existe — apenas mudar o trigger de botão para o texto
- Mobile accordion: usar `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` (já importado no projeto)
- Animações: `transition-all duration-200` para hover e expand

## O que NÃO muda

- Lógica de CRUD (hooks, services, Supabase) — intacta
- `useFinancialItemsManagement` — sem alteração
- Props e interface do `ConfiguracoesFinanceirasTab` — sem alteração
- Funcionalidade de sync com precificação — mantida
- Confirm dialog para exclusão — mantido

