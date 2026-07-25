# Módulo Contratos

Motor de contratos do Lunari Studio — cobre templates reutilizáveis e
instâncias vinculadas a cliente/sessão, com preparação para assinatura
eletrônica (D4Sign/ZapSign) e geração assistida por IA.

## Estado atual (P6.C — Contratos operacionais + IA)

Wave P6.C entrega a superfície `ai/` completa e capabilities operacionais
via `runCapabilityAsAssistant`:

| ID                                     | Tipo    | Descrição                                                    |
| -------------------------------------- | ------- | ------------------------------------------------------------ |
| `contratos.listTemplates`              | query   | Lista templates (com filtro por categoria/ativo).            |
| `contratos.getTemplate`                | query   | Detalhe do template.                                         |
| `contratos.createTemplate`             | command | Cria template (rascunho).                                    |
| `contratos.updateTemplate`             | command | Edita template.                                              |
| `contratos.deleteTemplate`             | command | Exclusão — **aprovação humana (`type_name`)**.               |
| `contratos.generateTemplateWithAI`     | command | Gera template do zero via IA — **aprovação humana**.         |
| `contratos.listContratos`              | query   | Lista contratos por status/cliente/sessão.                   |
| `contratos.getContrato`                | query   | Detalhe do contrato instanciado.                             |
| `contratos.createContrato`             | command | Cria contrato para cliente/sessão a partir de template.      |
| `contratos.updateContrato`             | command | Edita título/conteúdo/observações (enquanto rascunho).       |
| `contratos.markSentContrato`           | command | Marca `enviado_em` — **aprovação humana**.                   |
| `contratos.deleteContrato`             | command | Exclusão — **aprovação humana (`type_name`)**.               |
| `contratos.generateContratoWithAI`     | command | Personaliza conteúdo IA para cliente/sessão — **aprovação**. |

## Regras da constituição aplicadas

- Toda IA passa por Edge Function (`assistant-contracts-generate`) que
  detém a `LOVABLE_API_KEY`. Nunca chamamos IA direto do cliente.
- Geração IA devolve **proposta**; usuário revisa antes de gravar
  (`createTemplate` / `updateContrato`). Sem escrita implícita.
- Excluir contrato/template e marcar como enviado são ações
  irreversíveis para o cliente — requerem `ConfirmationChallenge`.
- Placeholder oficial do sistema é `{{variavel}}`. A IA é instruída a usar
  apenas as variáveis suportadas: `cliente_nome`, `cliente_email`,
  `cliente_telefone`, `cliente_documento`, `session_data`, `session_local`,
  `session_valor`, `fotografo_nome`, `fotografo_email`, `estudio_nome`.
- Assinatura eletrônica externa (`signature_provider`) permanece fora
  do escopo do assistente na v1.

## Dependências server-side

- Tabelas: `contrato_templates`, `contratos`.
- Edge Function: `assistant-contracts-generate` (Lovable AI Gateway,
  modelo `google/gemini-2.5-flash`).

## Critérios de decisão (constituição)

1. **Reversível?** — templates e contratos rascunho: sim. `markSent` e
   deletes: não → gate humano obrigatório.
2. **Afeta cliente externo?** — envio muda percepção do cliente final →
   aprovação.
3. **Custa crédito de IA?** — sim para as duas capabilities `*WithAI`
   → aprovação obrigatória.
4. **Escopo do usuário?** — todas as capabilities operam apenas em
   registros com `user_id = auth.uid()` (RLS + escopo aplicado no
   handler).
5. **Idempotência?** — creates via UUID, updates por PK, sem side-effects
   externos além da própria linha DB.
6. **Auditoria?** — todas as invocações passam por
   `runCapabilityAsAssistant`, que grava em `assistant_invocations`.
