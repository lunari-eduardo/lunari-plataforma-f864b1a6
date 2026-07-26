# ADR-006: Automation Engine é a única auto-executora

**Status:** Accepted — 2026-07-26

## Problema
Se qualquer engine puder disparar Capabilities automaticamente, risco de auto-execução se espalha por todo o sistema — impossível auditar "quem apertou o botão".

## Alternativas consideradas
1. **Múltiplas engines podem executar** (Intelligence, Decision, Learning, Automation) — auditoria fragmentada.
2. **Só Automation executa** — Intelligence propõe (via Decision), Decision propõe (via UI/Lu ou Automation), Learning propõe (via Hub).
3. **Nenhuma engine executa** (só humano) — perde valor de automação.

## Decisão
**Automation Engine é a única engine autorizada a chamar `Kernel.execute` autonomamente.** Sempre com `actor="automation:<rule_id>"`. Sempre passando por Policy (que pode exigir approval mesmo em automação). Sempre logado em `automation_runs`. Regras são declaradas pelo fotógrafo no Hub.

## Consequências (+)
- Auditoria centralizada: toda execução automática vem de uma regra rastreável.
- Fotógrafo tem UI única para revisar automações.
- Policy pode revogar automação sem tocar em código.

## Consequências (–)
- Automation vira componente crítico — bugs afetam múltiplos fluxos.
- Regras complexas podem exigir DSL, o que aumenta escopo.

## Impacto futuro
Base para "Modo Substituto" (fotógrafo desliga UI e IA opera dentro dos limites de suas regras). Sem essa concentração, Modo Substituto seria impossível de auditar.
