

# Reordenar seções do Dashboard

Mover a seção "Indicadores principais" (KPIs) de cima para baixo no `src/pages/Index.tsx`.

## Nova ordem das seções:

1. **DailyHero** (resumo do dia) — mantém
2. **Próximos Agendamentos + Lembretes de Produção** — sobe
3. **Contas a Pagar + Tarefas Pendentes** (Critical Cards) — sobe
4. **Indicadores principais** (KPIs) — desce para o final

## Arquivo: `src/pages/Index.tsx`

Reordenar os blocos `<section>` dentro do `<main>`, movendo as linhas 94-105 (KPIGroupCard) para depois das linhas 154-158 (Critical Cards).

