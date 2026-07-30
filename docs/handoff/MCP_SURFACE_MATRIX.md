# MCP Surface Matrix — Rodada A1

Fonte de verdade da **audiência** das capabilities do Lunari Studio.
Gerado/validado a partir de `src/shared/capability/audience.ts` e do inventário
vivo em `docs/handoff/AI_SURFACE_CAPS.txt`.

- **Registry total:** 177 capabilities
- **Expostas ao MCP (`audience` inclui `mcp`):** 150
- **App-only (`audience = ["app"]`):** 27

Princípios (ADR-008 + decisão do roteiro A):

1. MCP é **transporte para o usuário final** (o fotógrafo). Nenhuma superfície
   admin/plataforma entra.
2. **Gallery entra só como leitura** de dados que já vivem no Gestão. Nenhuma
   escrita, nenhuma chamada a edge function do projeto Gallery.
3. Os **anéis internos** da arquitetura são infraestrutura da Lu, não ferramenta
   de cliente externo.

## Matriz por domínio

| Domínio | Registry | MCP | App-only | Veredito |
| --- | ---: | ---: | ---: | --- |
| workflow | 35 | 35 | 0 | IMPL |
| tasks | 26 | 26 | 0 | IMPL |
| finance | 24 | 21 | 3 | IMPL · BLOQ crédito |
| configuracoes | 19 | 19 | 0 | IMPL |
| contratos | 13 | 13 | 0 | IMPL |
| agenda | 13 | 13 | 0 | IMPL |
| formularios | 9 | 9 | 0 | IMPL |
| clientes | 8 | 8 | 0 | IMPL |
| gallery | 4 | 3 | 1 | IMPL leituras · BLOQ escrita |
| billing | 3 | 3 | 0 | IMPL |
| learning | 5 | 0 | 5 | BLOQ (anel) |
| automation | 5 | 0 | 5 | BLOQ (anel) |
| decision | 4 | 0 | 4 | BLOQ (anel) |
| memory | 3 | 0 | 3 | BLOQ (anel) |
| observation | 2 | 0 | 2 | BLOQ (anel) |
| knowledge | 2 | 0 | 2 | BLOQ (anel) |
| intelligence | 2 | 0 | 2 | BLOQ (anel) |
| context | 1 | 0 | 1 | BLOQ (anel) |
| **Total** | **177** | **150** | **27** | |

## Bloqueios individuais e justificativa

| Capability | Motivo |
| --- | --- |
| `finance.credit.grant` | Conceder crédito de fotos é decisão comercial da plataforma, não operação de chat. |
| `finance.credit.revoke` | Mesma razão — revogação afeta saldo pago pelo cliente. |
| `finance.credit.apply` | Aplicação de crédito altera liquidação financeira; fica no app com UI de conferência. |
| `gallery.reopenSelection` | Escrita no domínio Gallery. Regra do roteiro: MCP só lê dados Gallery-derivados. |

As leituras `gallery.checkAccess`, `gallery.listExpiring` e `gallery.listInSelection`
permanecem expostas: consultam tabelas do Gestão, sem efeito colateral.

## Bloqueios por módulo (anéis internos)

`context`, `memory`, `knowledge`, `observation`, `intelligence`, `decision`,
`learning`, `automation`.

Expor `memory.forget`, `learning.patches.apply` ou `automation.tick` a um cliente
MCP externo permitiria ao agente reescrever o próprio estado cognitivo e disparar
o scheduler — fora do contrato de "ferramenta do fotógrafo".

## Como isso é aplicado no código

`defineCommand`/`defineQuery` derivam `audience` de `defaultAudienceFor(id)`
(`src/shared/capability/audience.ts`). Para sobrescrever numa capability
específica, basta declarar `audience: ["app"]` na definição.

Consumo:

```ts
listCapabilities({ audience: "mcp" }); // 150 capabilities
```

## Status por rodada

- **A1 (esta):** campo `audience` declarado e disponível no registry. **Nenhuma
  mudança de runtime** — catálogo, executor e MCP server seguem inalterados.
- **A2:** dispatcher genérico passa a resolver handlers a partir do registry.
- **A3:** `scripts/build-mcp-catalog.ts` passa a filtrar por `audience: "mcp"`,
  eliminando a flag `hideApprovalRequired` e as capabilities hoje invisíveis.
