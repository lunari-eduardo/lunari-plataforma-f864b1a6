

# Redesign: Aba Lançamentos — UI moderna, rápida e intuitiva

## Problemas identificados

1. **Seletor de grupo no meio da tela** (Fixas/Variáveis/Investimentos/Receitas) quebra o fluxo — obriga o usuário a escolher antes de ver qualquer dado
2. **Botão "Novo Lançamento" genérico** — não diferencia despesa vs receita
3. **Tela "morta"** quando vazia — não convida à ação
4. **Linha de input na tabela** (data/select/valor/obs) é confusa e pesada visualmente
5. **Métricas no topo** (Total/Pago/Faturado/Agendado) pouco claras para quem não é contador

## Nova estrutura

```text
┌─────────────────────────────────────────────────────────────────┐
│  < Mar 2026 >          [+ Despesa] [+ Receita]                 │
├─────────────────────────────────────────────────────────────────┤
│  Resumo: Receitas R$5.000  •  Despesas R$2.650  •  Saldo R$2.350│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔴 DESPESAS FIXAS                                               │
│  ─────────────────────────────────────────────────────────────── │
│  01/03  Adobe          R$ 50,00   Pago     [editar] [excluir]   │
│  05/03  Internet       R$ 100,00  Agendado [editar] [excluir]   │
│  + Adicionar despesa fixa                                        │
│                                                                  │
│  🟠 DESPESAS VARIÁVEIS                                           │
│  ─────────────────────────────────────────────────────────────── │
│  10/03  Combustível    R$ 200,00  Pago                          │
│  + Adicionar despesa variável                                    │
│                                                                  │
│  🟣 INVESTIMENTOS                                                │
│  ─────────────────────────────────────────────────────────────── │
│  (Nenhum investimento neste mês)                                 │
│                                                                  │
│  🟢 RECEITAS                                                     │
│  ─────────────────────────────────────────────────────────────── │
│  15/03  Ensaio Maria   R$ 800,00  Pago                          │
│  + Adicionar receita                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Mudanças principais

### 1. Header com botões rápidos separados
- Remover o seletor de abas Fixas/Variáveis/Investimentos/Receitas
- Adicionar **dois botões** no topo: `+ Despesa` (vermelho suave) e `+ Receita` (verde suave)
- Navegador de mês/ano à esquerda
- No mobile: botão FAB flutuante com menu (Despesa/Receita)

### 2. Vista unificada por seções (sem abas)
- Mostrar **todas as transações do mês** agrupadas por tipo em seções colapsáveis
- Ordem: Despesas Fixas → Variáveis → Investimentos → Receitas
- Cada seção tem título colorido + contagem + total
- Seções sem dados ficam colapsadas com mensagem orientativa

### 3. Resumo simplificado
- Trocar "Total/Pago/Faturado/Agendado" por **"Receitas / Despesas / Saldo"**
- Cores claras: verde para receitas, vermelho para despesas, destaque para saldo

### 4. Botões "Adicionar" contextuais dentro de cada seção
- No fim de cada seção: `+ Adicionar despesa fixa` / `+ Adicionar receita`
- Ao clicar, abre o **modal já pré-configurado** com o grupo correto

### 5. Modal inteligente melhorado
- Ao clicar `+ Despesa` no header: modal com seletor de tipo (Fixa/Variável/Investimento)
- Ao clicar `+ Receita` no header: modal já como receita
- Ao clicar `+ Adicionar` dentro da seção: modal já com grupo definido
- Data já vem preenchida com **hoje** (não primeiro dia do mês)

### 6. Tabela mais limpa
- Remover a **linha de input** do topo da tabela (substituída pelos botões + modal)
- Linhas simples: Data | Descrição | Valor + Status | Ações (hover)
- Remover colunas "Parcela" e "Opções" da visualização principal (mostrar parcela como badge inline quando existir)

### 7. Mobile
- Botão FAB flutuante `+` no canto inferior direito
- Ao clicar: popover com "Nova Despesa" / "Nova Receita"
- Seções como acordeão (já usando Collapsible)

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/financas/LancamentosTab.tsx` | Reescrever: remover abas de grupo, adicionar header com botões rápidos, vista unificada por seções |
| `src/components/financas/TabelaLancamentos.tsx` | Simplificar: remover linha de input do topo, limpar colunas |
| `src/components/financas/TabelaLancamentosMobile.tsx` | Adaptar para nova estrutura de seções |
| `src/components/financas/ModalNovoLancamentoRefatorado.tsx` | Adicionar prop para pré-selecionar grupo, melhorar seletor de tipo |

## O que NÃO muda

- Hooks (`useNovoFinancas`, `useFinancialTransactionsSupabase`) — intactos
- CRUD de transações — mesma lógica
- `createTransactionEngine` — continua sendo usado
- Abas principais (Lançamentos/Dashboard/Extrato/Configurações) — mantidas
- Modal de opções (recorrente, cartão) — mantido dentro do modal

## Detalhes técnicos

- Usar `GRUPOS_ORDEM` e `GRUPOS_CONFIG` já existentes para iterar as seções
- Cada seção renderiza uma mini-tabela (desktop) ou lista de cards (mobile)
- Estado `modalGrupoPreSelecionado` controla qual grupo o modal abre
- Resumo calculado somando `calcularMetricasPorGrupo` de todos os grupos
- Seções colapsáveis com `Collapsible` (Radix) — já no projeto

