# Módulo Formulários (Briefings)

Motor de formulários do Lunari Studio — cobre briefings pré-sessão,
pós-venda, capturas de lead e formulários custom. É a superfície principal
de coleta de dados do cliente final.

## Estado atual (P4)

Wave P4 do plano de paridade AI entrega apenas a **superfície `ai/`**
(permissions, tools, context, snapshot). Capabilities operacionais serão
introduzidas nas próximas ondas:

| ID (planejado)                     | Tipo    | Descrição                                              |
| ---------------------------------- | ------- | ------------------------------------------------------ |
| `formularios.listForms`            | query   | Lista com filtros (tipo/status/search).                |
| `formularios.getForm`              | query   | Detalhe + esquema de blocos.                           |
| `formularios.listResponses`        | query   | Respostas paginadas por formulário.                    |
| `formularios.getResponse`          | query   | Resposta individual (dados brutos).                    |
| `formularios.createForm`           | command | Cria formulário rascunho.                              |
| `formularios.updateForm`           | command | Edita blocos/config.                                   |
| `formularios.duplicateForm`        | command | Duplica formulário existente.                          |
| `formularios.publishForm`          | command | Publica URL pública — **aprovação humana**.            |
| `formularios.unpublishForm`        | command | Remove URL pública — **aprovação humana**.             |
| `formularios.deleteForm`           | command | Exclusão definitiva — **aprovação humana**.            |
| `formularios.deleteResponse`       | command | Exclusão definitiva — **aprovação humana**.            |
| `formularios.reopenSubmission`     | command | Reabre resposta fechada — **aprovação humana**.        |
| `formularios.generateAIBriefing`   | command | Sumariza resposta com IA — **aprovação humana**.       |

## Dependências server-side

- Tabelas: `formularios`, `formulario_templates`, `formulario_respostas`.
- Trigger `forms_public_submission_status_trigger` garante integridade e
  lock do estado de submissão (ver memória
  `mem://architecture/forms-public-submission-status-trigger-integrity`).
- Página pública: `/f/:slug` (`FormularioPublico.tsx`).

## Superfície AI (Assistente Lu)

- `ai/permissions.ts` — `REQUIRES_APPROVAL` para publish/unpublish, delete,
  reopen e generateAIBriefing.
- `ai/tools.ts` — `listFormulariosAITools` (vazio enquanto não há caps).
- `ai/context.ts` — `buildFormulariosPageSnapshot` v1 com contadores,
  filtros, seleção, ids visíveis e respostas recentes.
- Registrado em `src/shared/ai/registry.ts`
  (`getPageSnapshot("formularios", user)`).

## Critérios de decisão (Guia do Produto v1.0)

1. **Autonomia**: Lu consulta formulários e respostas; qualquer ação que
   afete o cliente final (publicar, reabrir, gerar mensagem) passa por
   gate humano.
2. **Segurança**: respostas contêm dados sensíveis — não ecoar campos
   livres em respostas amplas; nunca expor URL pública sem aprovação.
3. **Reversibilidade**: publish/unpublish é reversível, mas afeta clientes
   ativos — aprovação obrigatória. Delete/reopen são irreversíveis.
4. **Escopo**: Lu não responde formulários pelo cliente; opera apenas
   sobre o ponto de vista do fotógrafo.
5. **Observabilidade**: toda invocação futura passa por
   `runCapabilityAsAssistant` → `assistant_invocations`.
6. **Custo**: snapshot ≤ ~8 KB; `generateAIBriefing` é a única cap que
   consome créditos de IA e sempre requer aprovação.

## Princípios

- Estado de submissão é gerado por trigger — nunca escrever direto.
- URL pública é o contrato com o cliente: só muda com aprovação humana.
- Integridade da resposta é imutável após fechamento; reabrir requer
  auditoria explícita.
