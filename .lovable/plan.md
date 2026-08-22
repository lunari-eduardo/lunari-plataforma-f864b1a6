# Mapa de Navegação do Codebase para IAs Externas

## Objetivo

Criar **um documento-mapa** (`docs/AI_CODEBASE_MAP.md`) que permita a qualquer IA externa entender o contexto do Lunari, localizar a página/arquivo certo para cada tipo de pedido e editar com segurança — sem precisar ler o sistema inteiro. O documento é um **índice com ponteiros**, não uma cópia da documentação: ele diz *onde* está cada coisa e *qual doc resolver* cada dúvida.

Documento único, em português, com tabelas e caminhos exatos. Meta: ≤ ~800 linhas, denso em ponteiros, zero prosa desnecessária.

## O que a varredura encontrou (insumos do mapa)

- **Rotas**: definidas em `src/app-photographer/PhotographerApp.tsx` (app do fotógrafo sob `/app/*`), `src/app-admin/AdminApp.tsx` (admin) e site público na raiz. ~60 rotas mapeadas (páginas em `src/pages/*`).
- **Arquitetura dual em transição**:
  - Nova: `src/modules/<modulo>/` (domain/application/ports/infrastructure/presentation/ai + MODULE.md) — módulos: `agenda, assistant, automation, billing, clientes, configuracoes, contratos, decision, finance, formularios, gallery, intelligence, knowledge, leads, learning, memory, observation, precificacao, support, tasks, workflow`.
  - Legada: `src/hooks/` (189 hooks), `src/components/<dominio>/`, `src/pages/`, `src/features/workflow/` (refatoração em ondas).
  - Migração por estrangulamento (ADR-017) — o mapa precisa dizer, por domínio, **qual lado é a fonte atual** e para onde está migrando.
- **Backend**: 90 edge functions em `supabase/functions/` (agrupáveis por domínio: asaas, mercadopago, infinitepay, autentique, gallery, r2, assistant, automation...). 327 migrations; ~100 tabelas já identificadas por domínio.
- **Docs oficiais existentes**: `docs/constitution/*` (CONSTITUTION, ARCHITECTURE, PRODUCT_GUIDE, ASSISTANT_GUIDE, DESIGN_DNA), `docs/ARCHITECTURE_TECHNICAL.md`, 20 ADRs, handoffs. O mapa referencia — não duplica.
- **Regras operacionais** (memória do projeto): capability-first, sem toast de sucesso, máscara BRL via `useCurrencyInput`, valores financeiros só via triggers DB, uploads sempre R2, padrões de z-index, etc.

## Estrutura do documento `docs/AI_CODEBASE_MAP.md`

1. **Como usar este mapa** — fluxo de 3 passos: (1) identificar domínio do pedido, (2) consultar tabela de rotas/módulo, (3) abrir só os arquivos apontados. Aviso de ordem de leitura: Constituição → este mapa → MODULE.md do módulo → código.
2. **Visão do produto em 10 linhas** — Lunari Studio vs Gallery, fluxo Lead→Pós-venda, público.
3. **Tabela de Rotas → Arquivos** — cada URL (`/app/financas`, `/app/workflow`, `/app/gallery/...`, site público, rotas públicas de cliente como `/formulario/:token`, `/checkout/:cobrancaId`) com: arquivo da página, componentes principais, hooks/módulo que alimentam, tabelas envolvidas. É a seção mais importante — "quero mexer na tela X" resolve aqui.
4. **Mapa de Módulos (`src/modules/`)** — tabela por módulo: status (esqueleto/em ondas/ativo), tabelas que possui, capabilities expostas, MODULE.md. Indicação explícita de módulos que ainda são esqueleto vs. os que já carregam lógica real.
5. **Mapa do Legado** — `src/hooks/` agrupados por domínio (financeiro, agenda, leads, gallery...), `src/components/<dominio>/`, `src/features/workflow/` com status das ondas. Regra: "se o módulo novo existe, prefira ele; senão o legado é a fonte".
6. **Mapa de Dados** — tabelas agrupadas por domínio (CRM, financeiro, billing, agenda, gallery, tasks, assistant, intelligence...), views (`extrato_unificado`), triggers críticos (status_financeiro, anti-regressão de status gallery), funções SECURITY DEFINER relevantes.
7. **Mapa de Edge Functions** — as 90 functions agrupadas por provedor/domínio com uma linha cada; contratos especiais (shared com Gallery: skip JWT, userId no body; webhooks com idempotência).
8. **Infra compartilhada (`src/shared/`)** — capability system, ai registry, event-bus, ports, policy, result. Como Lu/MCP enxergam o sistema.
9. **Regras Inegociáveis** (checklist antes de qualquer edição) — capability-first, RLS + GRANTs obrigatórios, roles em tabela separada, nunca localStorage como verdade, uploads só R2, máscara BRL, sem success toast, z-index padrão, links canônicos com VITE_SITE_URL, registro financeiro via trigger.
10. **Receitas por tipo de pedido** — 10-15 cenários frequentes ("adicionar campo na sessão", "mudar painel de lançamento financeiro", "alterar capa da galeria", "criar nova página", "adicionar integração de pagamento") cada um com a lista exata de arquivos a abrir, em ordem.
11. **Índice de documentos oficiais** — tabela: pergunta → doc que responde (ex.: "posso criar tabela?" → ARCHITECTURE.md; "como a Lu acessa?" → ASSISTANT_GUIDE.md).
12. **Como manter este mapa** — regra de atualização: toda nova rota/módulo/tabela atualiza o mapa no mesmo PR; ponteiro no README.

## Etapas de implementação

1. **Etapa 1 — Extração automatizada**: script de varredura (rg) para gerar esqueleto factual: rotas do `PhotographerApp.tsx`/`AdminApp.tsx`, lista de módulos com presença/ausência de cada camada, edge functions, tabelas por migration. Garante que o mapa nasce 100% fiel ao código, sem achismo.
2. **Etapa 2 — Enriquecimento por domínio**: para cada uma das ~12 áreas (CRM, Agenda, Leads, Workflow, Financeiro, Billing, Gallery, Tarefas, Formulários, Contratos, Precificação, Assistente/IA), cruzar rota ↔ página ↔ hook/módulo ↔ tabelas ↔ edge functions, lendo os MODULE.md e os pontos de entrada.
3. **Etapa 3 — Redação das seções 9-11** (regras, receitas, índice de docs) consolidando o que hoje está disperso em memória + constitution.
4. **Etapa 4 — Validação**: conferir 100% dos caminhos citados existem de fato (script de verificação de paths), e testar o mapa com 3 pedidos simulados ("mexer no checkout", "adicionar coluna no kanban de leads", "mudar capa editorial") verificando se o mapa leva aos arquivos certos.
5. **Etapa 5 — Ponteiros**: adicionar referência ao mapa no `README.md` e na memória do projeto (regra: consultar `docs/AI_CODEBASE_MAP.md` no início de qualquer tarefa).

## Detalhes técnicos

- Arquivo único: `docs/AI_CODEBASE_MAP.md` (markdown puro, tabelas, sem front matter).
- Nenhuma alteração de código de produto — apenas documentação + 1 linha no README + memória.
- Caminhos sempre relativos à raiz do repo (`src/pages/NovaFinancas.tsx`), nunca descrições vagas.
- Onde houver dualidade módulo novo × legado, o mapa marca: `[NOVO]`, `[LEGADO]`, `[MIGRANDO → módulo X]`.
- Tabelas/funções citadas apenas se confirmadas nas migrations/código (a varredura inicial já levantou a lista real).

## Fora de escopo

- Não altera nenhum código, rota ou comportamento.
- Não substitui os docs da constituição — apenas indexa e aponta.
- Não gera documentação de API de capabilities (já coberta por MODULE.md e `docs/handoff/MCP_SURFACE_MATRIX.md`).
