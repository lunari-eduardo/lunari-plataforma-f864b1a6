
## Diagnóstico

Investiguei o fluxo de criação da galeria a partir do Workflow e encontrei **dois problemas distintos** que se somam para gerar o sintoma:

### Problema A — Gestão envia o valor congelado e com nome de param errado

Em `src/components/workflow/WorkflowCardCollapsed.tsx` (linha 224), o handler `handleCreateSelecao` monta a URL de criação da galeria assim:

```ts
precoExtra: session.regras_congeladas?.pacote?.valorFotoExtra,  // ← lê só o JSON congelado
fotosIncluidas: session.regras_congeladas?.pacote?.fotosIncluidas,
modeloCobranca: session.regras_congeladas?.precificacaoFotoExtra?.modelo,
```

E `src/utils/galleryRedirect.ts` traduz para query string usando os nomes:

| Gestão envia | Gallery (`useGestaoParams.ts`) espera | Resultado |
|---|---|---|
| `preco_extra` | `preco_da_foto_extra` | **Ignorado** |
| `fotos_incluidas` | `fotos_incluidas_no_pacote` | **Ignorado** |
| `modelo_cobranca` | `modelo_de_cobranca` | **Ignorado** |
| (não enviamos) | `modelo_de_preco` | n/a |
| `tipo_assinatura`, `pacote_nome`, `pacote_categoria`, `cliente_*`, `session_id` | iguais | OK |

Como o Gallery não recebe `preco_da_foto_extra` válido, ele cai no fallback que lê a sessão pelo `session_id` e copia `clientes_sessoes.regras_congeladas.pacote.valorFotoExtra` — que é o **valor original congelado de R$ 250,05**, mesmo o usuário tendo editado o campo "Vlr foto extra" para R$ 25,00.

Confirmado no banco para a sessão da Andreza (`workflow-1776882726236-…`):

- `clientes_sessoes.valor_foto_extra = 25` ✅ (editado pelo usuário)
- `clientes_sessoes.regras_congeladas.pacote.valorFotoExtra = 250.05` ❌ (congelado)
- `galerias.valor_foto_extra = 250.05` ❌ (criada com o valor errado)

### Problema B — Edição do workflow não atualiza o JSON congelado

Quando o usuário edita "Vlr foto extra" no card do workflow, `useWorkflowRealtime.ts` grava em `clientes_sessoes.valor_foto_extra` mas **não** atualiza `regras_congeladas.pacote.valorFotoExtra`. Isso faz com que:

1. A Gallery (que prioriza o JSONB em vários caminhos) continue vendo o valor antigo.
2. Outras telas/relatórios que consultam o JSON também divergem.
3. 9 das 10 sessões "Mães 26 5 fotos" estão hoje em estado divergente (25 no campo, 250.05 no JSON).

O próprio time da Gallery já mapeou isso no plano interno deles (`.lovable/plan.md`) e aponta o JSONB como fonte de verdade na precificação progressiva.

---

## Plano de correção

A correção precisa atuar em 3 frentes complementares: enviar o dado certo, manter o JSON congelado sincronizado, e corrigir os dados existentes.

### 1) Gestão — enviar o valor atual e com os nomes corretos (front)

**`src/utils/galleryRedirect.ts`**
- Renomear (ou adicionar como aliases) os query params para bater com o contrato do Gallery:
  - `preco_extra` → `preco_da_foto_extra`
  - `fotos_incluidas` → `fotos_incluidas_no_pacote`
  - `modelo_cobranca` → `modelo_de_cobranca`
- Por compatibilidade temporária e segurança, **enviar ambos** os nomes (antigo + novo) por 1–2 ciclos. O Gallery passa a consumir só o novo, e em seguida removemos os antigos.
- Adicionar suporte a `modelo_de_preco` (`fixed`/`packages`) opcional, para alinhar com o contrato do Gallery (não obrigatório para fechar o bug, mas evita outro fallback).
- Sanitizar `precoExtra` (clamp 0–999,99) antes de serializar, espelhando o `sanitizeExtraPrice` da Gallery.

**`src/components/workflow/WorkflowCardCollapsed.tsx` — `handleCreateSelecao`**
- Trocar a fonte de verdade do `precoExtra`:
  ```ts
  // Prioridade: valor atual editado na sessão > valor congelado > 0
  const precoExtraAtual =
    Number(session.valor_foto_extra) ||
    Number(session.regras_congeladas?.pacote?.valorFotoExtra) ||
    0;
  ```
  Para isso, expor `valor_foto_extra` (numérico cru) no `SessionData` (`src/types/workflow.ts`) e no `convertSessionToData` de `src/hooks/useWorkflowPackageData.ts` — hoje só temos a versão formatada `valorFotoExtra: string`. Adicionar campo `valorFotoExtraNumber: number` (ou similar) sem quebrar consumidores.
- Idem para `fotosIncluidas`: já usa `regras_congeladas` (campo estável); manter como está.
- `modeloCobranca`: manter `regras_congeladas?.precificacaoFotoExtra?.modelo` (correto), só ajustar o nome da chave na URL.

### 2) Gestão — manter `regras_congeladas.pacote.valorFotoExtra` sincronizado quando o usuário edita

**Banco (preferencial — uma única fonte de garantia, idempotente):**
Criar um trigger `BEFORE UPDATE` em `clientes_sessoes` que, sempre que `valor_foto_extra` mudar, faça `jsonb_set(regras_congeladas, '{pacote,valorFotoExtra}', to_jsonb(NEW.valor_foto_extra))` (com clamp 0–999,99 e proteção contra recursão via `pg_trigger_depth()`). Isso resolve **todas** as edições futuras independentemente do front-end (workflow, agenda, edição inline, importações).

**Front (defesa em profundidade — opcional, mas recomendado):**
Em `src/hooks/useWorkflowRealtime.ts`, no caminho do `case 'valorFotoExtra'` (linhas ~461–482), além de `sanitizedUpdates.valor_foto_extra = …`, calcular um `regras_congeladas` patcheado e mandar junto no UPDATE. Garante consistência mesmo se o trigger for desativado.

### 3) Backfill dos dados já corrompidos

Migration única que, para cada sessão onde `valor_foto_extra` divergir de `regras_congeladas.pacote.valorFotoExtra`, sincroniza o JSONB para o valor do campo (que é o que o usuário editou e considera correto). Tratamento dos casos:

- **Caso normal** (campo > 0 e diferente do JSON): JSON ← campo.
- **Caso "campo = 0 e JSON > 0"**: NÃO sobrescrever — significa que o usuário ainda não editou; manter o congelado.
- **Caso "Huimi Loreto"** (`valorFotoExtra = 2550`, valor em centavos não normalizado, citado no plano da Gallery): clampar com `LEAST(GREATEST(v, 0), 999.99)`.

Cobertura imediata: as 9 sessões "Mães 26 5 fotos" identificadas no diagnóstico passam de 250,05 para 25,00 no JSON.

**Importante:** **não** atualizar `cobrancas` históricas (preço cobrado é imutável). E **não** alterar `galerias` já criadas com valor errado — para essas, o usuário deve usar o "Editar" da Gallery para ajustar (ver seção 4).

### 4) Galerias já criadas com R$ 250,05 (correção pontual)

Para a galeria da Andreza (e outras 4 do Dia das Mães já criadas com 250,05), oferecer duas opções ao usuário:

- (a) Atualizar manualmente via tela de "Editar" da Gallery (campo `valor_foto_extra`).
- (b) Script de correção pontual no backfill: para galerias **sem cobranças geradas ainda** (sem `cobrancas.galeria_id`), atualizar `galerias.valor_foto_extra` e `galerias.regras_congeladas.pacote.valorFotoExtra` para o valor atual da sessão. Cobranças já emitidas permanecem intocadas.

Recomendo (b) com filtro de "sem cobrança", pois é seguro e elimina a fricção manual.

### 5) Revisão sugerida no projeto Lunari Gallery

(Não vou alterar o Gallery por aqui, mas vale comunicar — a equipe deles já tem um plano paralelo e o que falta é uma única peça nova:)

**Aceitar `preco_da_foto_extra` da query como override do JSONB na criação assistida**, mesmo quando o `session_id` resolve uma sessão com `regras_congeladas`. Hoje, mesmo que mandássemos com o nome certo, há caminhos onde o JSON da sessão prevalece. Sugestão: na hidratação inicial da galeria a partir de `session_id`, se `preco_da_foto_extra` veio da query e for válido (e divergir do JSONB), usar o da query e logar um warning para telemetria de divergência.

Adicionalmente, o trigger `sync_gallery_extras_to_session` deveria também propagar para o JSONB nos dois lados (sessão e galeria), conforme já está descrito no `.lovable/plan.md` interno deles.

---

## Resumo dos arquivos que serão alterados (Gestão)

- `src/utils/galleryRedirect.ts` — corrigir nomes de query params, adicionar sanitização e `modelo_de_preco`.
- `src/components/workflow/WorkflowCardCollapsed.tsx` — usar valor atual da sessão (com fallback para o congelado) no `handleCreateSelecao`.
- `src/types/workflow.ts` — adicionar `valorFotoExtraNumber: number` no `SessionData`.
- `src/hooks/useWorkflowPackageData.ts` — popular `valorFotoExtraNumber` a partir de `session.valor_foto_extra`.
- `src/hooks/useWorkflowRealtime.ts` — (defesa em profundidade) patchear o JSONB ao salvar `valor_foto_extra`.
- **Migration nova**: trigger `BEFORE UPDATE` em `clientes_sessoes` mantendo `regras_congeladas.pacote.valorFotoExtra` sincronizado, + backfill one-shot das sessões já divergentes, + correção pontual de galerias sem cobrança.

## Resultado esperado

- Editar "Vlr foto extra" no workflow passa a refletir corretamente em qualquer nova galeria criada (assistida ou não).
- O JSON congelado deixa de divergir do campo simples — bug de raiz resolvido.
- Galerias futuras criadas para a Andreza e qualquer outro pacote com valor extra editado virão com o valor certo desde o primeiro clique.
- Galerias já existentes com valor errado e **sem cobrança** são corrigidas no backfill; as com cobrança permanecem auditáveis e podem ser ajustadas manualmente.

