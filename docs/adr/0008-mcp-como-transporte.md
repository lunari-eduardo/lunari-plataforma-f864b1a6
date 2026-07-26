# ADR-008: MCP como transporte, sem protagonismo arquitetural

**Status:** Accepted — 2026-07-26

## Problema
Blueprint v1 tratava MCP quase como pilar. Isso criou riscos: (a) código de negócio começou a vazar para dentro de `assistant-mcp/`, (b) catálogo manual `catalog.json` virou fonte de bug, (c) arquitetura ficaria acoplada a um padrão externo que pode mudar.

## Alternativas consideradas
1. **MCP como pilar** — status atual, cria acoplamento perigoso.
2. **MCP como transporte** ao lado de Web, Mobile, Voice, API — trivial de remover, zero acoplamento.
3. **Remover MCP** — perde interoperabilidade com ChatGPT/Claude.

## Decisão
MCP é **interface de transporte**, listado ao lado de Web/Mobile/Voice/API/Webhooks. Todo código MCP vive em `src/interfaces/mcp/` (edge function). Catálogo é **gerado** a partir de `Kernel.list({audience: "mcp"})` em build. Zero flag `if (mcp)` no Kernel. Arquitetura sobrevive integralmente à remoção do MCP.

## Consequências (+)
- Toda Capability nova aparece automaticamente no MCP conforme `audience`.
- Zero manutenção manual de catálogo.
- MCP pode ser desativado por 1 flag sem afetar Web/Lu.

## Consequências (–)
- Onda 7 exige refactor do `assistant-mcp` para consumir Kernel via HTTP/RPC.
- Alguns clientes MCP (ChatGPT) cachearam metadados; precisa versão bump para forçar re-index.

## Impacto futuro
Se MCP for descontinuado ou substituído (por outro padrão de interoperabilidade), migração é trivial: novo transporte lê do mesmo Kernel.
