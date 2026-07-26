# ADR-018: Interfaces são clientes descartáveis; nada de regra de negócio

**Status:** Accepted — 2026-07-26

## Problema
Hoje há regra de negócio em hooks React, em edge functions e em componentes. Duplicação garantida; troca de interface (mobile nativo, voz) exige reescrita.

## Alternativas consideradas
1. **Status quo** — regra espalhada.
2. **Interfaces só apresentam** — nada de negócio; tudo passa por Kernel. Enforçado por lint.
3. **Regra "conveniente" em UI** para performance — cria exceções que viram regra.

## Decisão
Interfaces (`src/pages/`, `src/components/`, `src/interfaces/mcp/`, `src/interfaces/lu/`, futuro mobile/voz) só podem:
- Chamar `Kernel.execute / list / subscribe / describe`.
- Renderizar dados.
- Capturar intenção do usuário.

**Não podem**:
- Importar `@/modules/*/domain/`, `@/modules/*/infrastructure/`.
- Importar `supabase-js` direto.
- Ter cálculo de negócio (formatação visual OK; cálculo de valor não).

Lint bloqueia. CI falha se violado.

## Consequências (+)
- Trocar Web por Mobile = reescrever só apresentação.
- Voz vira interface trivial.
- Nada duplicado.

## Consequências (–)
- Alguns cálculos "óbvios" na UI viram Capability (às vezes é chato).
- Migração de código legado é grande.

## Impacto futuro
Fundamento para plataforma multi-cliente. Sem essa disciplina, Mobile + Voice ficam inviáveis.
