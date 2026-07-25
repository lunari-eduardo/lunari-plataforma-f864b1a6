# Módulo Configurações

Catálogo operacional do estúdio: categorias, pacotes, produtos, etapas de
workflow, modelo de precificação de fotos extras e templates de contratos.
É o dicionário que Workflow, Finance, Gallery e Formulários referenciam.

Superfície principal: `src/pages/Configuracoes.tsx` (`/configuracoes`), com
abas Categorias, Modelos de preço, Pacotes, Produtos, Etapas, Formulários e
Contratos. A aba **Formulários** é apenas atalho — o módulo próprio é
`modules/formularios`. Configurações financeiras (contas, categorias
contábeis, integrações de pagamento) NÃO pertencem aqui — vivem em
`modules/finance`.

## Estado atual (P6.A tranche 2)

Superfície `ai/` completa + capabilities operacionais implementadas para
**Categorias**, **Pacotes**, **Produtos** e **Etapas** (CRUD + toggle
favorito em produtos + move em etapas). Deletes exigem aprovação humana
com desafio `type_name` via `buildDeleteChallenge`. Etapas de sistema
protegidas contra rename/delete. Formulários e Contratos + geração IA
entram na próxima tranche:

| ID (planejado)                                | Tipo    | Aprovação | Descrição                                                        |
| --------------------------------------------- | ------- | --------- | ---------------------------------------------------------------- |
| `configuracoes.listCategorias`                | query   | não       | Lista categorias (com cor).                                      |
| `configuracoes.listPacotes`                   | query   | não       | Lista pacotes (filtro por categoria).                            |
| `configuracoes.listProdutos`                  | query   | não       | Lista produtos (filtros: ativo/etiqueta/search).                 |
| `configuracoes.listEtapas`                    | query   | não       | Etapas ordenadas.                                                |
| `configuracoes.getPricingModel`               | query   | não       | Modelo atual + tabela global se houver.                          |
| `configuracoes.listContratoTemplates`         | query   | não       | Templates de contrato.                                           |
| `configuracoes.createCategoria`               | command | não       | Cria categoria.                                                  |
| `configuracoes.updateCategoria`               | command | não       | Renomeia / muda cor.                                             |
| `configuracoes.deleteCategoria`               | command | **sim**   | Cascata em pacotes/sessões.                                      |
| `configuracoes.createPacote`                  | command | não       | Cria pacote.                                                     |
| `configuracoes.updatePacote`                  | command | não       | Edita valores/inclusos.                                          |
| `configuracoes.deletePacote`                  | command | **sim**   | Impacto em orçamentos/sessões.                                   |
| `configuracoes.createProduto`                 | command | não       | Cria produto.                                                    |
| `configuracoes.updateProduto`                 | command | não       | Edita produto.                                                   |
| `configuracoes.toggleProdutoAtivo`            | command | não       | Ativa/desativa produto.                                          |
| `configuracoes.deleteProduto`                 | command | **sim**   | Remove item com histórico.                                       |
| `configuracoes.createEtapa`                   | command | não       | Cria etapa.                                                      |
| `configuracoes.updateEtapa`                   | command | não       | Renomeia / muda cor.                                             |
| `configuracoes.moveEtapa`                     | command | não       | Reordena.                                                        |
| `configuracoes.deleteEtapa`                   | command | **sim**   | Afeta workflow inteiro e tasks espelho.                          |
| `configuracoes.createContratoTemplate`        | command | não       | Cria template.                                                   |
| `configuracoes.updateContratoTemplate`        | command | não       | Edita template.                                                  |
| `configuracoes.deleteContratoTemplate`        | command | **sim**   | Perda de template usado em contratos.                            |
| `configuracoes.setPricingModel`               | command | **sim**   | Troca `fixo/global/categoria` (afeta sessões novas).             |
| `configuracoes.updateGlobalPricingTable`      | command | **sim**   | Muda tabela global de fotos extras.                              |
| `configuracoes.setCategoriaPricingTable`      | command | **sim**   | Muda tabela de preço por categoria.                              |

## Fora do escopo (v1)

- Publicar/enviar contrato assinado ao cliente.
- Configurações financeiras (`modules/finance`).
- Integrações de pagamento (Asaas, MP, InfinitePay, Stripe).
- Import/export massivo de catálogo.

## Superfície AI (P5)

- `src/modules/configuracoes/ai/permissions.ts` — `AI_CONFIGURACOES_REQUIRES_APPROVAL`, `needsHumanApproval`, `canUserRun`.
- `src/modules/configuracoes/ai/tools.ts` — `listConfiguracoesAITools`.
- `src/modules/configuracoes/ai/context.ts` — `buildConfiguracoesPageSnapshot` (v1).
- `src/modules/configuracoes/index.ts` — re-export da superfície.

## Snapshot (`buildConfiguracoesPageSnapshot`)

Campos principais:

- `activeTab`: aba visível.
- `selection`: `{ categoriaId, pacoteId, produtoId, etapaId, contratoTemplateId }`.
- `counts`: totais de cada catálogo (+ `produtosAtivos`).
- `pricing`: `{ modelo, hasGlobalTable }`.
- `visible*Ids`: até 30 IDs por catálogo.
- `etapasOrdenadas`: `{ id, nome, ordem }[]`.
- `permissions`: `{ canWrite, canDelete, isAuthenticated }`.
- `capabilities`: IDs registradas em `capability` para o módulo.
- `notes`: guardrails que o Lu deve respeitar.

O snapshot é derivado — a página injeta o estado real via store leve nas
próximas ondas. `snapshotForConfiguracoes(user)` retorna a versão vazia
segura enquanto isso.

## Auditoria

Toda execução via Lu passa por `runCapabilityAsAssistant` → gravação em
`assistant_invocations` com `module="configuracoes"`, `capabilityId`,
`status`, `approvalRequired`.

## Critérios para o Assistente Lu (6 do PRODUCT_GUIDE)

1. **Sugerir quando?** Quando o usuário pedir para criar/editar catálogo,
   renomear etapa/categoria, ativar/desativar produto ou ajustar valor de
   pacote — capabilities sem aprovação.
2. **Pedir aprovação quando?** Qualquer delete de catálogo, mudança de
   modelo de precificação e atualização de tabelas de preço.
3. **Recusar quando?** Configurações financeiras, integrações de pagamento,
   publicação/envio de contratos, import/export em massa.
4. **Dados sensíveis?** Templates de contrato podem conter cláusulas
   pessoais — não vazar conteúdo em respostas amplas.
5. **Impacto em outras áreas?** Sim — Categorias/Pacotes alimentam
   Orçamentos, Sessões e Workflow; Etapas alimentam Workflow/Tasks;
   Pricing alimenta Gallery e Finance. Preferir edições incrementais.
6. **Reversibilidade?** Renomes/cor são reversíveis; deletes e mudança de
   modelo de preço têm efeito imediato em fluxos dependentes — sempre
   requerem confirmação humana.
