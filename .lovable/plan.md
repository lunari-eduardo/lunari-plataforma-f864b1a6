

# Vendas Avulsas: Lançamento de receitas com pacote/produto sem Workflow

## Contexto

Hoje, toda receita de venda passa pelo Workflow (`clientes_sessoes` → `clientes_transacoes`). Não existe caminho para registrar uma venda avulsa (ex: venda de álbum, produto físico, sessão rápida sem fluxo completo) que apareça corretamente em:
- Extrato financeiro
- Dashboard financeiro
- Análise de vendas

## Abordagem escolhida

**Usar `clientes_sessoes` como registro da venda avulsa**, com um campo marcador para diferenciar de sessões do workflow. Isso garante que a Análise de Vendas (que lê exclusivamente de `clientes_sessoes`) capture automaticamente, sem duplicar lógica.

A entrada do pagamento segue o fluxo normal: `clientes_transacoes` (que já alimenta o extrato). Os triggers existentes de `valor_pago` / `valor_total` continuam funcionando.

### Por que não usar `fin_transactions`?

O módulo de `fin_transactions` é para despesas/receitas financeiras genéricas. A análise de vendas não lê dele. Colocar vendas avulsas lá criaria uma fonte de dados paralela, exigindo refatoração pesada do domínio de vendas.

## Plano de implementação

### 1. Migration: adicionar campo `tipo_registro` em `clientes_sessoes`

```sql
ALTER TABLE clientes_sessoes 
ADD COLUMN tipo_registro text NOT NULL DEFAULT 'workflow';
```

Valores: `'workflow'` (padrão, sessões normais) | `'venda_avulsa'`

Isso permite filtrar vendas avulsas no Workflow (para não poluir a tabela de gestão) e incluí-las na Análise de Vendas.

### 2. Componente: Modal de Venda Avulsa

Novo modal acessível no painel **Financeiro** (aba Lançamentos), com botão dedicado "+ Venda Avulsa" ao lado dos botões de receita/despesa.

Campos do modal:
- **Cliente** (combobox dos clientes existentes, ou campo texto para nome avulso)
- **Data** (date picker)
- **Categoria** (select das categorias do usuário)
- **Pacote** (opcional, select dos pacotes configurados)
- **Produtos** (opcional, multi-select dos produtos configurados)
- **Valor** (calculado automaticamente se pacote selecionado, editável)
- **Desconto** (opcional)
- **Descrição/Observações**
- **Registrar pagamento?** (checkbox — se sim, cria transação de pagamento junto)

### 3. Hook: `useVendaAvulsa`

Responsável por:
1. Inserir registro em `clientes_sessoes` com `tipo_registro = 'venda_avulsa'`, `session_id` gerado (prefixo `VA-`), `hora_sessao = '00:00'`
2. Se pagamento marcado: inserir em `clientes_transacoes` com tipo `'pagamento'`
3. Os triggers de banco atualizam `valor_total` e `valor_pago` automaticamente

### 4. Filtro no Workflow

O `SupabaseSalesDataSource` (análise de vendas) **não precisa de mudança** — já lê todas as `clientes_sessoes` com `status != 'cancelado'`.

O **Workflow** (gestão de sessões) precisa filtrar `tipo_registro = 'workflow'` para não exibir vendas avulsas na tabela de gestão.

### 5. Extrato

Já funciona automaticamente: `clientes_transacoes` alimenta `extrato_unificado`. A venda avulsa terá `session_id` com prefixo `VA-`, permitindo identificação visual.

### 6. Análise de Vendas

Funciona automaticamente via `clientes_sessoes`. Para diferenciar visualmente, adicionar `'Venda Avulsa'` como possível valor de `origin` no `SalesOriginData`.

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Adicionar coluna `tipo_registro` |
| `src/components/financas/ModalVendaAvulsa.tsx` | **Novo** — Modal de venda avulsa |
| `src/hooks/useVendaAvulsa.ts` | **Novo** — Lógica de inserção |
| `src/components/financas/LancamentosTab.tsx` | Adicionar botão "+ Venda Avulsa" |
| `src/domain/sales/SupabaseSalesDataSource.ts` | Mapear `tipo_registro` no campo `source` |
| Workflow query (onde busca sessões) | Filtrar `tipo_registro = 'workflow'` |

## Fluxo resumido

```text
Fotógrafo clica "+ Venda Avulsa" no Financeiro
          ↓
  Preenche modal (cliente, categoria, pacote, valor)
          ↓
  INSERT clientes_sessoes (tipo_registro='venda_avulsa')
  INSERT clientes_transacoes (se pagamento imediato)
          ↓
  Triggers atualizam valor_total / valor_pago
          ↓
  ✅ Aparece na Análise de Vendas (clientes_sessoes)
  ✅ Aparece no Extrato (clientes_transacoes → extrato_unificado)
  ✅ Aparece no Dashboard Financeiro
  ✅ NÃO aparece no Workflow (filtrado por tipo_registro)
```

## Riscos mitigados

- **Sem duplicação**: usa as mesmas tabelas e triggers existentes
- **Sem quebra**: campo tem default `'workflow'`, registros existentes não são afetados
- **Sem refatoração da view**: `extrato_unificado` já lê de `clientes_transacoes`
- **Análise de vendas**: funciona sem mudança na query principal

