# Módulo Clientes (CRM)

Cadastro e ciclo de vida dos clientes do fotógrafo. Fonte única de
identidade de pessoas dentro do Lunari Studio — sessões, cobranças,
galerias e créditos referenciam este módulo.

## Estado atual (P3)

Wave P3 do plano de paridade AI entrega apenas a **superfície `ai/`**
(permissions, tools, context, snapshot). Capabilities operacionais
serão introduzidas nas próximas ondas, seguindo o padrão capability-first:

| ID (planejado)             | Tipo    | Descrição                                              |
| -------------------------- | ------- | ------------------------------------------------------ |
| `clientes.listClients`     | query   | Lista paginada com filtros (search/origem/status).     |
| `clientes.getClient`       | query   | Detalhe + agregados (sessões, cobranças, créditos).    |
| `clientes.createClient`    | command | Cria cliente (validação de duplicidade por email/tel). |
| `clientes.updateClient`    | command | Edita dados básicos.                                   |
| `clientes.mergeClients`    | command | Une dois cadastros — **aprovação humana**.             |
| `clientes.deleteClient`    | command | Remove cadastro — **aprovação humana**.                |
| `clientes.adjustCredits`   | command | Ajuste manual de créditos — **aprovação humana**.      |

## Dependências server-side

- Tabelas: `clientes`, `clientes_familia`, `clientes_documentos`,
  `clientes_transacoes`, `cliente_creditos_ledger`.
- RLS: escopo por `user_id` do fotógrafo.

## Superfície AI (Assistente Lu)

- `ai/permissions.ts` — `REQUIRES_APPROVAL` já reserva
  `deleteClient`, `mergeClients`, `adjustCredits`.
- `ai/tools.ts` — `listClientesAITools` (vazio enquanto não há caps).
- `ai/context.ts` — `buildClientesPageSnapshot` v1 com contadores,
  filtros, seleção, ids visíveis e top-recentes.
- Registrado em `src/shared/ai/registry.ts` (`getPageSnapshot("clientes", user)`).

## Critérios de decisão (Guia do Produto v1.0)

1. **Autonomia**: Lu consulta livremente; escrita futura sempre passa
   por capability com Zod e auditoria.
2. **Segurança**: dados sensíveis (email/telefone/documento) não são
   ecoados em respostas amplas; RLS já isola por fotógrafo.
3. **Reversibilidade**: merge, exclusão e ajuste de créditos são
   irreversíveis ou de alto impacto — gate humano obrigatório.
4. **Escopo**: Lu opera do ponto de vista do fotógrafo; nunca fala
   com o cliente final por este módulo.
5. **Observabilidade**: toda invocação futura passa por
   `runCapabilityAsAssistant` → `assistant_invocations`.
6. **Custo**: snapshot ≤ ~8 KB, sem broadcast realtime adicional.

## Princípios

- Nunca duplicar cadastros — reconciliação sempre via `mergeClients`.
- Créditos são derivados do ledger — nunca escrever `saldo` direto.
- Origem (`lead`, `manual`, `gallery`, `workflow`, `importacao`) deve
  ser preservada para métricas de aquisição.
