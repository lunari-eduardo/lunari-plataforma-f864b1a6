# ADR-017: Migração por estrangulamento

**Status:** Accepted — 2026-07-26

## Problema
Big-bang refactors do Lunari falharam historicamente. Precisamos padrão de migração que **nunca** quebre produção.

## Alternativas consideradas
1. **Big-bang refactor** (branch longo, merge grande) — histórico de dor.
2. **Estrangulamento**: novo nasce ao lado do antigo; consumers migram um a um; antigo vira shim; deleta quando shim tem 0 imports.
3. **Refactor "quando tocar"** — sem meta, dívida cresce.

## Decisão
Toda migração segue o Strangler Fig Pattern:
1. Novo nasce em paralelo, atrás de feature flag.
2. Antigo continua atendendo produção.
3. Consumer 1 migra + flag ligada → valida em produção.
4. Consumers restantes migram progressivamente.
5. Antigo vira shim que delega ao novo.
6. Shim removido em ≤ 3 releases após 0 imports.

**Regra inegociável**: nenhum PR de migração deixa produção em estado quebrado.

## Consequências (+)
- Rollback em < 1 minuto por env var.
- Progresso mensurável (nº de consumers migrados).
- Nenhum big-bang.

## Consequências (–)
- Coexistência temporária de código duplicado.
- Disciplina para deletar shims (não acumular).

## Impacto futuro
Padrão único para todo refactor. Sem exceção. Blueprint só é implementável porque este padrão vale.
