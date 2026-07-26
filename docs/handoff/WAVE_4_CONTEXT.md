# Onda 4 — Context Engine v1 (ADR-003, Art. 15)

**Status:** Entregue em 2026-07-26.

## O que é

Camada única e tipada para **fatos declarados pelo fotógrafo**. Nunca aprende, nunca infere, nunca guarda documento — isso é Memory e Knowledge (nascem sob demanda, Art. 22).

Se Context conflitar com Memory ou Knowledge no futuro, **Context vence**.

## API

```ts
import { loadContext, invalidateContext, formatContextForPrompt } from "@/shared/context";
import { useContextSnapshot } from "@/shared/context/react";
```

- `loadContext(userId)` — snapshot combinando todos os providers (TTL 60s).
- `invalidateContext(userId?)` — força refetch.
- `formatContextForPrompt(snapshot)` — string pronta para injetar no prompt do Lu.
- `useContextSnapshot(userId)` — hook React (TanStack Query).

Capability pública `context.get` já no registry — Lu e MCP a enxergam automaticamente.

## Providers v1

| Provider | Fatos | Fonte |
|---|---|---|
| `profile` | `profile.nome`, `profile.empresa`, `profile.nicho`, `profile.cidade`, `profile.telefone`, `profile.logo_url` | tabela `profiles` |
| `rollout` | `rollout.assistant_stage` | `app_settings.assistant_rollout_stage` |

Adicionar provider = 1 arquivo em `src/shared/context/providers/` + registro em `bootstrap.ts`. Não mexe em ninguém.

## O que ficou fora (intencional)

- Escrita: continua nas telas de Perfil/Configurações/Admin. Só criamos setters se surgir Capability específica (ex.: "Lu, mude minha cidade" — precisa de Policy própria + confirmação).
- Business goals, working hours, defaults financeiros: nascem como providers quando o consumo justificar (não temos um gatilho de produto agora).
- Aba "Contexto" no Hub do Lu: entra na Onda 5 (Hub de IA).

## Onde plugar

- Bootstrap: `src/main.tsx` chama `bootstrapContext()` antes do render.
- Prompt do Lu: `src/shared/ai/systemPrompt.ts` pode chamar `formatContextForPrompt(await loadContext(userId))` para enriquecer respostas com dados declarados (ligação fica pra Onda 5 quando o Hub for reorganizado).

## ADRs relacionados

- ADR-003 (esta onda), ADR-018 (interfaces descartáveis — Context alimenta todas), ADR-022 (evolução progressiva).
