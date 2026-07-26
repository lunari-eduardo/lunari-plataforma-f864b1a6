# Onda 3 — Boundaries/Lint CI (ADR-013)

**Status:** Entregue — Fase 1 (warnings) ativa em 2026-07-26.

## O que foi ligado

`eslint-plugin-import` com `import/no-restricted-paths` bloqueia (por enquanto como **warning**) as violações arquiteturais previstas na Constituição v2.0:

| Zona alvo | Não pode importar de | Motivo |
|---|---|---|
| `src/pages/**` | `src/modules/*/infrastructure/**`, `src/integrations/supabase/**` | Interface só fala com Kernel/capabilities. |
| `src/components/**` | idem | idem |
| `src/modules/*/domain/**` | infra, presentation, Supabase, components | Domínio é puro. |
| `src/modules/*/ports/**` | infra, Supabase | Ports só declaram contrato. |
| `src/modules/*/infrastructure/**` | components, pages | Infra não conhece UI. |
| `src/shared/ai/**` | `src/shared/kernel/**`, `src/modules/*/domain/**` | AI Gateway é Port (ADR-007). |

Config: `eslint.config.js` — variável `BOUNDARY_SEVERITY` controla o modo.

- **Fase 1 (agora):** `"warn"` — libera o CI mas expõe o débito. 2 semanas.
- **Fase 2 (flip):** `"error"` — CI quebra em nova violação.

## Baseline atual

Após ligar a regra: **35 arquivos** violando (todos legado). Zero em código novo (`shared/kernel`, `shared/policy`, `shared/capability`).

Lista completa fica em `docs/handoff/BOUNDARY_DEBT.md` (gerada por `bunx eslint src`).

Categorias dominantes:
- **`src/pages/*` → `@/integrations/supabase/client`** (auth pages, admin, onboarding, OAuth consent) — 12 arquivos.
- **`src/components/*` → Supabase direto** (cobranca, contratos, precificação, workflow log) — 22 arquivos.
- **`src/shared/ai/runCapabilityAsAssistant.ts` → Kernel** — 1 arquivo, exceção documentada (é a ponte oficial Onda 1).

## Próximos passos (não bloqueantes para Onda 4)

1. Marcar as 35 violações com `// eslint-disable-next-line import/no-restricted-paths -- LEGADO Onda 3, migrar em Onda X` para deixar a intenção rastreável.
2. Migrar em lotes conforme cada módulo entra em ondas posteriores (estrangulamento — ADR-017).
3. Flip para `"error"` quando a lista chegar perto de zero ou quando o CI rodar em PRs.

## Como rodar localmente

```bash
bunx eslint src
```

## ADRs relacionados

- ADR-013: Boundaries/Lint CI (esta onda).
- ADR-017: Estrangulamento (como migrar o legado).
- ADR-007: AI Gateway como Port (explica a restrição de `src/shared/ai`).
