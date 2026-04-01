

# Metas Personalizadas + Correção de Filtros no Dashboard Financeiro

## Problemas identificados

1. **Filtro "De-Até" não filtra receita/previsto** — `useWorkflowMetricsRealtime` só aceita `year` + `month`, não datas arbitrárias. Quando o período é "personalizado", as métricas de workflow (receita, previsto, a receber) continuam mostrando o ano inteiro.

2. **Metas no dashboard usam valores incorretos** — busca de `HISTORICAL_GOALS` no localStorage (que pode estar vazio ou desatualizado), com fallback para `GoalsIntegrationService` (precificação). Quando seleciona "De-Até", divide meta anual por 12, o que não faz sentido para um range arbitrário.

3. **Metas de precificação sendo usadas como metas reais** — precificação é referência teórica, não objetivo estratégico.

4. **SalesGoalsCard usa dados fake** (multiplicadores 0.85, 2.8, 0.75) e mostra meta trimestral que deve ser removida.

---

## Solução em 4 partes

### Parte 1: Nova tabela `metas_personalizadas` (Supabase)

```sql
CREATE TABLE public.metas_personalizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta_faturamento NUMERIC(12,2) NOT NULL DEFAULT 0,
  meta_lucro NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria TEXT DEFAULT NULL, -- futuro: metas por categoria
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ano, mes, COALESCE(categoria, '__geral__'))
);
-- RLS + trigger updated_at
```

Tipo de uso (auto vs personalizado) será salvo em `pricing_configuracoes` como novo campo `usar_metas_personalizadas BOOLEAN DEFAULT FALSE`.

### Parte 2: Correção do filtro "De-Até" no Dashboard

**`src/hooks/useWorkflowMetricsRealtime.ts`**
- Adicionar overload que aceita `startDate` + `endDate` strings em vez de `year`+`month`
- Quando `mesSelecionado === 'personalizado'`, o hook recebe as datas diretamente e filtra `data_sessao` por range

**`src/hooks/useDashboardFinanceiro.ts`**
- Criar nova instância do hook de workflow para período personalizado
- Metas no modo "personalizado": **não dividir por 12** — usar meta anual da precificação sem ajuste (o dashboard sempre mostra meta da precificação conforme requisito)

### Parte 3: Nova aba "Metas" em Configurações Financeiras

**Novo componente: `src/components/financas/MetasConfigTab.tsx`**

Conteúdo:
- **Toggle**: "Usar metas automáticas da precificação" vs "Usar metas personalizadas"
- Quando personalizado ativo, exibir **lista dos 12 meses** com campos:
  - Meta de Faturamento (input monetário)
  - Meta de Lucro (input monetário)
- **Botão "Preencher com base na precificação"** — copia valores atuais de `pricing_configuracoes` dividido por 12
- **Botão "Aplicar mesmo valor para todos os meses"** — replica o mês atual para os 11 restantes
- Salvar em `metas_personalizadas` no Supabase

**`src/pages/NovaFinancas.tsx`**
- Adicionar nova aba "Metas" (ícone Target) ao TabsList (grid-cols-4 → grid-cols-5)

**Novo hook: `src/hooks/useMetasPersonalizadas.ts`**
- CRUD no Supabase para `metas_personalizadas`
- Método `getMetaParaPeriodo(ano, mes)` com lógica de prioridade:
  1. Se `usar_metas_personalizadas = true` e existe registro → usar personalizada
  2. Senão → fallback para precificação (`pricing_configuracoes` / 12)

### Parte 4: Ajustes na Análise de Vendas

**`src/components/analise-vendas/SalesGoalsCard.tsx`**
- Remover meta **trimestral** (manter apenas mensal e anual)
- Remover dados fake (multiplicadores 0.85, 2.8, 0.75) — usar dados reais do workflow
- Usar `useMetasPersonalizadas` para buscar a meta correta
- Adicionar indicador visual: "Meta baseada na precificação" ou "Meta personalizada" (badge pequeno)
- Cores: vermelho (abaixo mínimo), amarelo (entre mínimo e meta), verde (acima da meta)
- Receber `selectedYear` e `selectedMonth` como props para reagir aos filtros

**`src/pages/AnaliseVendas.tsx`**
- Passar ano/mês selecionados para `SalesGoalsCard`

### Dashboard Financeiro — Metas (sem mudança conceitual)

**`src/hooks/useDashboardFinanceiro.ts` — `metasData`**
- Continua usando **apenas** metas da precificação (conforme requisito)
- Corrigir: quando "personalizado", manter meta anual fixa (não dividir por período arbitrário)
- Remover fallback hardcoded `metaReceita = 100000; metaLucro = 30000`

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx_metas_personalizadas.sql` | Nova tabela + campo em pricing_configuracoes |
| `src/hooks/useMetasPersonalizadas.ts` | Novo hook CRUD + lógica de prioridade |
| `src/components/financas/MetasConfigTab.tsx` | Nova aba de configuração de metas |
| `src/pages/NovaFinancas.tsx` | Adicionar aba "Metas" |
| `src/hooks/useWorkflowMetricsRealtime.ts` | Suportar filtro por date range |
| `src/hooks/useDashboardFinanceiro.ts` | Corrigir filtro personalizado + metas fixas da precificação |
| `src/components/analise-vendas/SalesGoalsCard.tsx` | Remover trimestral, usar dados reais, indicador de origem |
| `src/pages/AnaliseVendas.tsx` | Passar filtros para SalesGoalsCard |
| `src/types/precificacao.ts` | Adicionar tipo MetaPersonalizada |

## O que NÃO muda

- Página de precificação — continua calculando metas teóricas normalmente
- `GoalsIntegrationService` — continua existindo como fonte de metas de precificação
- Gráficos do dashboard (receita vs lucro mensal, composição de despesas) — continuam anuais
- Lógica de workflow, pagamentos, sessões — intacta

