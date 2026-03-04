

# Diagnóstico e Correção: Página de Planos Travando

## Causa Raiz

A página `EscolherPlano.tsx` foi refatorada para usar `useUnifiedPlans()`, mas **não trata o estado de loading**. Enquanto a query carrega, `getAllPlanPrices()` retorna `{}`. O código acessa `prices.yearly` sem null check (linhas 338 e 466), causando crash imediato (`Cannot read properties of undefined`).

## Correção

### 1. Adicionar loading guard + null safety em `EscolherPlano.tsx`

- Mostrar `<Loader2>` enquanto `plansLoading` for `true`
- Adicionar null checks em todos os acessos a `prices` (linhas 338, 398, 464, 466) com fallback `{ monthly: 0, yearly: 0 }`
- Filtrar planos que não existem no banco (safety net)

### 2. Adicionar fallback no hook `useUnifiedPlans`

Se a query falhar (rede, RLS, etc), o hook deve retornar os valores hardcoded de `planConfig.ts` como fallback, garantindo que a página nunca trave.

## Sobre a Arquitetura: Um Admin ou Dois?

**Um único admin no Gestão é suficiente.** A tabela `unified_plans` é compartilhada no mesmo Supabase. O que falta é:

- **Gestão**: Já usa `useUnifiedPlans` (só precisa do fix de loading)
- **Gallery**: Ainda usa hardcoded `ALL_PLAN_PRICES` em `transferPlans.ts` -- precisa da mesma migração para `useUnifiedPlans` (tarefa separada, no projeto Gallery)
- **Edge Functions**: Já foram migradas para ler do banco

Não é necessário duplicar o painel admin. O Gallery só precisa **ler** da mesma tabela.

## Arquivos a modificar

| Arquivo | Acao |
|---------|------|
| `src/pages/EscolherPlano.tsx` | Loading state + null safety nos acessos a prices |
| `src/hooks/useUnifiedPlans.ts` | Fallback para hardcoded se query falhar |

