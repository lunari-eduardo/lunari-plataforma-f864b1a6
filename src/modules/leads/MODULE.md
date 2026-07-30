# Módulo Leads (funil comercial)

Topo do funil do Lunari Studio: captura, qualificação, follow-up, perda e
conversão em cliente. Este módulo encapsula a lógica antes espalhada em
`src/hooks/useSupabaseLeads.ts` e nas páginas de Leads, expondo-a como
capabilities tipadas para app e MCP.

## Fonte de verdade

| Tabela | Papel |
| --- | --- |
| `leads` | Lead, contato, status, interações, histórico, motivo de perda |
| `lead_statuses` | Estágios configuráveis do kanban (`is_converted`, `is_lost`) |
| `lead_follow_up_config` | Dias para follow-up e status monitorado |
| `lead_follow_up_history` | Histórico de disparos de follow-up |
| `appointments` (`type = 'budget'`) | Orçamentos — **não existe tabela própria** |

Todas as tabelas usam RLS por `user_id`; nenhuma capability filtra usuário
manualmente.

## Capabilities

### Leitura (`leads:read`)
- `leads.list` — filtros por status, origem, tag, período, busca, arquivados.
- `leads.get` — lead completo com interações e histórico.
- `leads.listStatuses` — colunas do funil na ordem configurada.
- `leads.metrics` — totais por estágio/origem, conversões, perdas e taxa.
- `leads.listFollowUpsDue` — leads parados além do configurado.
- `leads.listOrcamentosAgendados` — projeção de orçamentos sobre a agenda.

### Escrita (`leads:write`)
- `leads.create`
- `leads.update` (cadastro; não muda estágio)
- `leads.addInteracao` (zera dias sem interação)
- `leads.moveStatus` (bloqueia colunas de perda)
- `leads.markLost` (motivo obrigatório)
- `leads.archive` (arquivar/desarquivar)
- `leads.convertToCliente` — **requer aprovação humana**

## Os 6 critérios do Guia do Produto

1. **Resolve dor real?** Sim — fotógrafo perde venda por esquecer follow-up.
2. **Reduz cliques?** Sim — a Lu lista pendências e move estágios por voz/chat.
3. **Cabe no fluxo Lead → Pós-venda?** É a primeira etapa do fluxo.
4. **Reaproveita o existente?** Sim — reutiliza tabelas, statuses e a agenda
   como origem de orçamentos, sem novo domínio.
5. **Simples para o usuário final?** Sim — vocabulário do kanban já conhecido.
6. **Seguro por padrão?** Sim — RLS por usuário, conversão sob aprovação,
   perda sempre com motivo, histórico imutável por append.

## Decisão de arquitetura: orçamentos

O antigo sistema de orçamentos foi removido. Orçamentos hoje são compromissos
de agenda (`appointments.type = 'budget'`). Em vez de recriar um domínio,
`leads.listOrcamentosAgendados` expõe uma projeção somente-leitura. Criação e
edição continuam pelas capabilities de `agenda.*`.

## Audiência

Todas as capabilities são `["app", "mcp"]` (default). Nenhuma pertence a anel
interno ou superfície administrativa.
