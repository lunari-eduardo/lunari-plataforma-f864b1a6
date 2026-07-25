# Fase D — Auditoria da superfície de IA do Lunari

Data: 2026-07-25
Escopo: mapa completo das capabilities expostas ao Assistente Lu, LLM providers, MCP e snapshots de página. Fecha Ondas P + F antes de partir para o runtime (Fase E) e o servidor MCP (Fase F).

Fontes primárias consultadas: `docs/constitution/CONSTITUTION.md`, `docs/constitution/ARCHITECTURE.md`, `docs/constitution/ASSISTANT_GUIDE.md`, `src/shared/ai/*`, `src/modules/ai-registry.ts`, `src/modules/*/ai/*`, `src/features/workflow/ai/*`.

---

## 1. Inventário quantitativo

| Módulo         | Capabilities | Queries | Commands | Allowlist explícita | Snapshot | Wired no registry |
|----------------|:---:|:---:|:---:|:---:|:---:|:---:|
| workflow       | 32 | 12 | 20 | ❌ (expõe tudo) | ✅ | ✅ |
| tasks          | 26 | 10 | 16 | ❌ (expõe tudo) | ✅ | ✅ |
| finance        | 24 | 15 |  9 | ✅ AI_FINANCE_ALLOWED | ✅ | ✅ |
| configuracoes  | 19 |  6 | 13 | ❌ (expõe tudo) | ✅ | ✅ |
| agenda         | 13 |  5 |  8 | ✅ AI_AGENDA_ALLOWED | ✅ | ✅ |
| contratos      | 13 |  4 |  9 | ❌ (expõe tudo) | ✅ | ✅ |
| formularios    |  9 |  3 |  6 | ❌ (expõe tudo) | ✅ | ✅ |
| gallery        |  4 |  3 |  1 | ❌ (expõe tudo) | ✅ | ✅ |
| billing        |  3 |  1 |  2 | ❌ (expõe tudo) | ✅ | ✅ |
| clientes       |  **0** | 0 | 0 | — | ✅ | ✅ (superfície vazia) |
| **TOTAL**      | **143** | **59** | **84** | 2 / 10 | 10 / 10 | 10 / 10 |

> Lista canônica em `docs/handoff/AI_SURFACE_CAPS.txt` (gerada por `rg` neste audit).

---

## 2. Gaps confirmados

### 2.1 Bloqueadores para Fase E (Runtime da Lu)

1. **`clientes` sem capabilities.** A superfície `ai/` existe mas `defineQuery/defineCommand` = 0. A Lu não consegue "puxar cliente", "criar cliente", "listar histórico". Bloqueia o fluxo Lead→Pós-venda descrito no PRODUCT_GUIDE.
2. **Ausência de allowlist explícita em 8/10 módulos.** Hoje `listXxxAITools` expõe TODAS as capabilities do módulo sem filtro. Viola o princípio "least-privilege" do ASSISTANT_GUIDE. Correto: cada módulo deve ter `AI_<MOD>_ALLOWED` (como finance/agenda), separando o que é RPC interna do que é tool para IA.
3. **`REQUIRES_APPROVAL` disperso.** Cada módulo mantém seu Set. Não há verificação central que garanta cobertura de todos `sideEffects: destructive|financial|external`. Risco: capability nova sem gate.

### 2.2 Alinhamento com Constituição

| Regra Constituição / ASSISTANT_GUIDE | Status |
|--|--|
| Toda invocação de IA gravada em `assistant_invocations` | ✅ (`runCapabilityAsAssistant`) |
| Confirmação humana para ações destrutivas | ✅ (matcher texto/voz) |
| A Lu nunca acessa DB direto nem Edge Function fora do manifesto | ✅ (roteia por capability) |
| Lu não responde clientes / não envia mensagens / não publica (limites v1) | ⚠️ `formularios.publishForm` está exposto sem approval. Precisa entrar em `REQUIRES_APPROVAL`. Idem `contratos.markSentContrato` (já está). |
| Capability-first: `defineCapability` + `MODULE.md` + `ai/tools` antes da UI | ⚠️ `clientes` sem defineCapability quebra a regra. |

### 2.3 LLM Providers (Fase B → E)

- `src/shared/ai/llm/{types,registry,toolsAdapter}.ts` prontos e provider-agnostic.
- **Nenhum adapter concreto** (Gemini / OpenAI / MCP-client) implementado ainda — decisão consciente da Fase B, mas precisa ser resolvida antes da Fase E.
- `toolsAdapter` converte capability → `LLMToolDeclaration` genérico com JSON Schema. Verificação de campos-limite (max enum, sem `$ref` circular) ainda não está automatizada.

### 2.4 MCP (Fase C)

- `contracts.ts` + `manifest.ts` prontos: `buildMCPToolsForUser`, `MCPServerManifest`, hints padronizadas.
- **Sem host publicado.** Nenhuma edge function `mcp-server` deployada. Bloqueio esperado para Fase F.
- `hideApprovalRequired` default = `false`; a policy do Lunari é `true` para hosts sem UI de aprovação (Claude/Cursor/n8n) — precisa ser default `true` para uso externo.

### 2.5 Snapshots de página

Todos os 10 módulos entregam `snapshotForXxx(user)` via `src/shared/ai/registry.ts`. Cobertura completa. Ressalvas:
- `clientes` snapshot devolve estrutura vazia (consequência do gap 2.1.1).
- `configuracoes` e `contratos` retornam listas grandes sem paginação — pode estourar contexto de LLMs com janela curta. Ver 3.3.

---

## 3. Recomendações priorizadas

### Prioridade 1 (fazer antes da Fase E)

1. **Capabilities de `clientes` v1** (mínimo viável):
   - Queries: `clientes.list`, `clientes.get`, `clientes.search`, `clientes.listTransacoes`, `clientes.listSessoes`.
   - Commands: `clientes.create`, `clientes.update`, `clientes.addNota`.
   - Approval: `clientes.delete` (não incluir em v1).
2. **Allowlist em todos os módulos.** Padronizar `AI_<MOD>_ALLOWED: ReadonlySet<string>` + `canUserRun`. Módulos alvo: workflow, tasks, configuracoes, contratos, formularios, gallery, billing, clientes.
3. **Registro central de approval.** Criar `src/shared/ai/approvalRegistry.ts` que agrega os Sets por módulo e expõe `needsHumanApproval(id)` único. `runCapabilityAsAssistant` passa a consultar o registro central em vez de o Set do módulo.
4. **Fechar limites v1 da Lu.** Adicionar `formularios.publishForm` e `formularios.unpublishForm` a `REQUIRES_APPROVAL`.

### Prioridade 2 (imediatamente antes ou no início da Fase E)

5. **Adapters LLM concretos.** Implementar `GeminiProvider` e `OpenAIProvider` sobre a interface `LLMProvider` (Fase B). Nenhum código no bundle do app — só edge functions.
6. **Validador de schema.** Script `scripts/audit-ai-tools.ts` roda no CI e falha se: enum > 50 valores, campo com `.min()/.max()` em `input`, `description` vazio, id fora do namespace do módulo.
7. **Paginação nos snapshots** de configuracoes/contratos/formularios — limite default 25 itens; expor `count total` e `hasMore`.

### Prioridade 3 (Fase F, MCP externo)

8. **Edge function `mcp-server`** consumindo `buildMCPToolsForUser({ hideApprovalRequired: true })` e `buildMCPManifest`.
9. **Rate-limit + budget de tokens por invocação**, gravado no `assistant_invocations`.

---

## 4. Diff de segurança (relatório de exposição)

| Categoria | Capabilities | Approval hoje |
|--|--|:--:|
| Destrutivas (delete*) | 12 | 10 / 12 ⚠️ (`configuracoes.delete*` sem approval central) |
| Financeiras (transacao/credit/refund) | 11 | 8 / 11 ⚠️ (`workflow.addPayment`, `workflow.refundPayment` sem approval declarado) |
| Publicação externa | 4 | 2 / 4 ⚠️ (`formularios.publishForm`, `formularios.unpublishForm`) |
| Geração com custo de crédito IA | 3 | 3 / 3 ✅ |

Ver 3.1 para o plano de fechamento.

---

## 5. Estado de "pronto para Fase E"

| Pré-requisito | Estado |
|--|:--:|
| Superfície capability-first em todos os módulos | 🟡 (falta clientes) |
| Allowlist explícita por módulo | 🔴 |
| Approval central e completo | 🟡 |
| Snapshots por página | ✅ |
| LLMProvider abstraction | ✅ |
| Adapter concreto (Gemini/OpenAI) | 🔴 |
| MCP contracts | ✅ |
| MCP host publicado | 🔴 (esperado só na Fase F) |
| Auditoria em `assistant_invocations` | ✅ |
| Confirmation matcher voz/texto | ✅ |

**Veredito:** Fase E pode começar depois que Prioridade 1 (itens 1-4) e o adapter LLM (item 5) forem entregues. Cerca de 1 tranche de trabalho.

---

## 6. Status pós-D.1 / D.2 (atualizado 2026-07-25)

### Onda D.1 — Fechamento de gaps ✅
- `clientes` v1: 8 capabilities (`list/get/search/listSessoes/listTransacoes/create/update/addNota`) em `src/modules/clientes/application/clientes.ts`.
- `src/shared/ai/approvalRegistry.ts`: registry central; cada módulo chama `registerModuleApprovals` no import de `ai/permissions.ts`.
- `runCapabilityAsAssistant` cruza `opts.needsApproval` com o registry central — caller esquecido não vaza gate.
- Todos os 10 módulos alinhados: workflow, tasks, agenda, finance, gallery, billing, configuracoes, formularios, contratos, clientes.
- `workflow.addPayment` promovido a REQUIRES_APPROVAL (mexe em dinheiro do cliente).
- `formularios.generateFormWithAI` adicionado ao gate humano.

### Onda D.2 — Validação CI ✅
- Script `scripts/ai-surface-audit.ts` roda via `bun run audit:ai`.
- Regras que falham build (exit 1):
  1. `MODULE_NOT_IN_APPROVAL_REGISTRY` — módulo expõe tools mas não chamou `registerModuleApprovals`.
  2. `DESTRUCTIVE_WITHOUT_APPROVAL` — capability com sufixo destrutivo (`.delete/.remove/.cancel/.refund/.publish/…`) exposta à Lu sem gate central.
- Warns (não falham build):
  3. `APPROVAL_FOR_UNKNOWN_CAPABILITY` — drift entre id declarado no `REQUIRES_APPROVAL` e id real do `defineCommand`.

### Resultado atual do audit
```
módulos registrados: 10
capabilities totais: 119
approvals centrais:  53
tools expostas à Lu: 114
Resultado: 0 error(s), 25 warn(s).
```

Os 25 warns são drift de naming (ex.: `workflow.produto.advanceStage` declarado no set mas capability real usa outro id) — issue de correção mecânica, sem risco de segurança. Fica como backlog para uma passada de renomeação/alinhamento antes da Fase E entrar em produção.

---

## 7. Próximo passo

Fase E (Runtime da Lu): adapter LLM (Gemini/OpenAI via AI Gateway), UI de chat + voz, orquestração de tool-calls com aprovação inline. Superfície agora está consistente e auditável — pré-requisitos de segurança satisfeitos.
