# Constituição Oficial do Projeto Lunari

**Versão 2.0** — 2026-07-26. Substitui a v1.0 integralmente. Ancorada no Blueprint AI-First v2.0 e no Plano de Migração por Evolução Progressiva. Prevalece sobre qualquer decisão técnica. Conflito = revisar a implementação, não a constituição.

> **Documentos vinculados (leitura obrigatória):**
> - `docs/constitution/ARCHITECTURE.md` — arquitetura em 4 anéis, 10 engines, ports.
> - `docs/constitution/PRODUCT_GUIDE.md` — visão de produto e critérios de decisão.
> - `docs/constitution/ASSISTANT_GUIDE.md` — regras do Assistente Lu.
> - `docs/constitution/DESIGN_DNA.md` — DNA visual/UX.
> - `docs/adr/` — 20 Architecture Decision Records que fundamentam esta constituição.
> - `.lovable/plan.md` — Plano de Migração por Ondas (Evolução Progressiva).

---

## Preâmbulo

O Lunari **não é** um CRM. Não é um ERP. Não é um chatbot. Não é um MCP Server.

O Lunari **é uma Plataforma de Inteligência** para fotógrafos profissionais. Web, Mobile, Voice, Assistente Lu, MCP e API são apenas *clientes descartáveis* dessa plataforma. Toda inteligência pertence ao núcleo; nunca às interfaces.

---

## Parte I — Princípios Absolutos (nunca negociáveis)

### Art. 1 — O fotógrafo é o centro
Toda funcionalidade deve responder: "isso economiza tempo para o fotógrafo?" Se não, reavaliar.

### Art. 2 — O produto vem antes da tecnologia
Entre duas soluções tecnicamente válidas, escolher a de melhor experiência. Nenhuma decisão técnica pode comprometer a experiência do usuário.

### Art. 3 — Uma única fonte da verdade
Toda regra de negócio existe apenas uma vez. Zero duplicação entre Interface, Assistente, API, Mobile, Integrações ou Edge Functions.

### Art. 4 — Kernel é a única porta pública
Toda ação de todo cliente (Web, Lu, MCP, API, Mobile, Voice, Webhook, Automation) passa por `Kernel.execute`. Zero atalho. Zero `supabase.from` fora de Infrastructure. **Zero exceção.**

### Art. 5 — Interfaces são clientes descartáveis
Interface apenas apresenta e captura intenção. Zero regra de negócio, zero acesso a Ports, zero acesso a DB. Enforçado por lint boundary.

### Art. 6 — Segurança acima da automação
Toda automação usa as mesmas Policies e validações da UI. O Assistente Lu nunca acessa DB direto nem Edge Function fora do Kernel.

### Art. 7 — Nenhuma ação destrutiva sem confirmação
Excluir, mover valores, cancelar, enviar cobrança, alterar contrato → confirmação explícita via `ApprovalTicket`, salvo policy pré-autorizada declarada.

### Art. 8 — Nada da IA decide sozinho
IA **propõe**; humano confirma. Exceção: automações declaradas pelo próprio fotógrafo com Policy explícita. Learning Engine **nunca** aplica; sempre propõe.

### Art. 9 — Eventos são o sangue do sistema
Toda mudança relevante emite evento tipado no Event Bus. Nenhuma engine escreve em outra sem passar pelo bus ou por proposta explícita.

### Art. 10 — MCP e Lu são transportes, não pilares
A arquitetura funciona integralmente se o MCP for removido amanhã. O Lu também. Nenhum código de negócio vive dentro deles.

---

## Parte II — Arquitetura (canônica)

### Art. 11 — 4 anéis
1. **Interfaces** (Web, Mobile, Voice, Lu, MCP, API, Webhooks)
2. **Kernel** (`execute`, `subscribe`, `list`, `describe`)
3. **Domain + Engines** (regras puras + 10 engines definidas)
4. **Infrastructure Ports** (Db, Storage, VectorDb, Realtime, AI Gateway, Payments, Comms, Sign, Calendar, IdempotencyStore, AuditSink, EventBus, Clock, Logger, Auth)

Dependência é sempre para dentro. Nunca para fora. Enforçado por lint.

### Art. 12 — 10 engines canônicas
Kernel · Policy · Context · Memory · Knowledge · Observation · Intelligence · Decision · Learning · Automation.

Nem mais, nem menos. Rejeitadas explicitamente: AI Engine, Audit Engine, Identity Engine, Event Engine, Notification Engine, Search Engine, Workflow/BPM Engine, Reporting Engine.

### Art. 13 — Módulos são organização física
`src/modules/*` existe para organizar código, **não** como modelo mental. O sistema é descrito por Capabilities, Entities, Events, Policies, Engines, Ports.

### Art. 14 — Cada camada tem UMA responsabilidade
Sobreposição é bug arquitetural. Matriz de responsabilidades no Blueprint é lei.

### Art. 15 — Context ≠ Memory ≠ Knowledge
- **Context** = fatos declarados pelo fotógrafo.
- **Memory** = fatos observados pelo sistema.
- **Knowledge** = conteúdo textual recuperável semanticamente.

Se conflitarem, Context vence.

### Art. 16 — AI Gateway é Port, não Engine
Encapsula LLMs, embeddings, TTS/STT. Nunca contém regra de negócio. Nunca executa Capability — só propõe tool call para o Kernel.

### Art. 17 — Business Graph é projeção, não fonte
Se Postgres relacional divergir do grafo, Postgres vence. Grafo é reconstruível de zero.

---

## Parte III — Capabilities

### Art. 18 — Toda ação é uma Capability
Nome único, input Zod, output Zod, permissions, side-effects declarados, idempotência quando aplicável, auditoria conforme modo (`always | on-success | never`), exemplos NL.

### Art. 19 — Audience explícita
Toda Capability declara `audience: ("ui" | "lu" | "mcp" | "api" | "automation" | "mobile")[]`. MCP catalog, tools do Lu e API pública são **derivados** disso.

### Art. 20 — Consultas são independentes
Queries nunca produzem efeitos colaterais. Enforçado pelo tipo `CapabilityKind`.

### Art. 21 — Versionamento
Capabilities usam semver. V1 e V2 coexistem por ≥ 6 meses. Break exige ADR novo.

---

## Parte IV — Evolução

### Art. 22 — Evolução Progressiva
Nenhuma engine é construída "porque está no blueprint". Cada engine nasce quando existir gatilho de produto concreto. Ordem canônica de nascimento: Kernel → Policy → Context → (Knowledge sob demanda) → Observation → Intelligence → Decision → Memory → Learning → Automation. Business Graph só quando query cross-entidade justificar.

### Art. 23 — Estrangulamento, nunca big-bang
Toda migração convive com o legado atrás de feature flag. Rollback via env var em < 1 minuto. Consumer-a-consumer. Deleta em ≤ 3 releases.

### Art. 24 — Compatibilidade é prioridade
Refatorações não quebram funcionalidades. Camadas de compatibilidade obrigatórias durante migrações.

### Art. 25 — Nova onda só nasce se a anterior estiver estável
Checklist da §5 do Plano de Migração vale. Métrica de valor obrigatória antes de abrir onda.

### Art. 26 — Deletamos código morto
Shim tem prazo. Feature flag tem dono. Débito rastreado.

---

## Parte V — Qualidade

### Art. 27 — Performance faz parte da experiência
Menor número de consultas, menor processamento, menor tempo de resposta.

### Art. 28 — Escalabilidade obrigatória
Toda funcionalidade continua válida para milhares de estúdios.

### Art. 29 — Documentação faz parte do código
Nenhum módulo é concluído sem `MODULE.md` atualizado. Nenhuma decisão arquitetural sem ADR.

### Art. 30 — O código deve ser compreensível
Clareza prevalece sobre soluções complexas. Consistência prevalece sobre criatividade.

---

## Parte VI — Governança

### Art. 31 — Hierarquia documental
Em conflito, vence: Constituição > ADRs > Blueprint > Plano de Migração > MODULE.md > código.

### Art. 32 — Como mudar a constituição
Alteração exige ADR dedicado + revisão explícita do usuário. Nenhuma mudança silenciosa.

### Art. 33 — Consulta obrigatória
Esta constituição deve ser consultada antes de qualquer implementação.

---

**Ratificada em 2026-07-26. Substitui integralmente a v1.0.**
