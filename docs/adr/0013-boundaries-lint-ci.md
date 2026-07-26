# ADR-013: Boundaries via ESLint + tsgo obrigatório em CI

**Status:** Accepted — 2026-07-26

## Problema
Sem enforcement mecânico, boundaries entre camadas erodem em semanas. Convenção humana não escala.

## Alternativas consideradas
1. **Só convenção + code review** — funciona por 3 meses; depois degrada.
2. **Nx/Turbo com project boundaries** — infra pesada para monolito React.
3. **ESLint `import/no-restricted-paths`** + `tsgo` type-check no CI — leve, mecânico, incremental.

## Decisão
ESLint com `import/no-restricted-paths` bloqueia:
- Interfaces (`src/pages/`, `src/components/`) → só podem importar `@/shared/capability` e types públicos.
- Domain (`src/modules/*/domain/`) → sem infra, sem React, sem Supabase.
- Ports (`src/modules/*/ports/`) → só interfaces.
- Infrastructure → sem UI.
- AI Gateway impl → sem Kernel, sem Domain.

Fase 1: warnings por 2 semanas. Fase 2: erro no CI. `tsgo --noEmit` obrigatório em CI. Disables (`// eslint-disable`) viram débito rastreado em dashboard.

## Consequências (+)
- Regressão arquitetural impossível sem PR explícito quebrando lint.
- Refactor guiado por lint (visível).

## Consequências (–)
- Curva inicial: código legado tem centenas de violations.
- Alguns padrões (barrel exports) exigem exceções documentadas.

## Impacto futuro
Sem essa disciplina, toda decisão desta constituição vira letra morta em 6 meses.
