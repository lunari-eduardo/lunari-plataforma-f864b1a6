

# Remover fundo sólido branco das páginas

## Problema
As páginas de Finanças, Análise de Vendas e Integrações usam `bg-lunar-bg` que renderiza um fundo branco sólido, cobrindo o background gradiente do Layout (InternalBackground). Isso cria uma "caixa branca" que quebra a estética do sistema.

## Solução
Trocar `bg-lunar-bg` por `bg-transparent` (ou remover a classe) nos wrappers dessas páginas, permitindo que o background do Layout apareça.

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/NovaFinancas.tsx` (linha 44-45) | Remover `bg-lunar-bg` dos 2 divs |
| `src/components/financas/DashboardFinanceiro.tsx` (linha 36) | Remover `bg-lunar-bg` |
| `src/pages/AnaliseVendas.tsx` (linha 42) | Remover `bg-lunar-bg` |
| `src/pages/Integracoes.tsx` (linha 6) | Remover `bg-lunar-bg` |

Todas as mudanças são apenas remoção da classe `bg-lunar-bg` do div wrapper principal, mantendo `min-h-screen` para garantir altura mínima.

