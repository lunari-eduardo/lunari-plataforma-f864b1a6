## 🎯 Objetivo

Entregar ao fotógrafo **4 modelos de contrato profissionais** prontos para uso (Casamento, Ensaio, Newborn, Evento), com o padrão de variáveis solicitado, mantendo total compatibilidade com modelos já criados e permitindo edição livre.

---

## 📊 Análise do estado atual

| Item | Situação |
|---|---|
| Tabela `contrato_templates` | ✅ Já existe — suporta múltiplos modelos |
| Editor + variáveis dinâmicas | ✅ Funcional, mas com 1 modelo seed apenas |
| Edição/salvamento de modelos | ✅ Já implementado (`ContratosConfig` + `ContratoTemplateEditorModal`) |
| Padrão de variáveis | ⚠️ Usa `cliente_nome` / `sessao_data` — diferente do solicitado (`nome_cliente` / `data_sessao`) |
| Variáveis faltantes | ❌ `cpf_cliente`, `tipo_ensaio`, `forma_pagamento`, `prazo_entrega` |
| Campo CPF no cliente | ❌ Não existe na tabela `clientes` |
| `forma_pagamento` / `prazo_entrega` na sessão | ❌ Não existem como colunas |

---

## 🧩 Estratégia para variáveis

### 1. **Aliases** (suporte aos dois padrões — sem quebrar nada)

Manter as variáveis atuais (`cliente_nome`, `sessao_data`, etc.) **e adicionar aliases** com a nomenclatura solicitada (`nome_cliente`, `data_sessao`, etc.). O `applyVariables` substitui ambos pelo mesmo valor. Modelos antigos continuam funcionando; modelos novos seguem o padrão proposto.

| Padrão solicitado | Mapeamento |
|---|---|
| `{{nome_cliente}}` | = `cliente_nome` |
| `{{cpf_cliente}}` | **novo** (campo manual ou novo no cliente) |
| `{{nome_fotografo}}` | = `fotografo_nome` |
| `{{data_sessao}}` | = `sessao_data` |
| `{{horario_sessao}}` | = `sessao_hora` |
| `{{tipo_ensaio}}` | = `sessao_categoria` (Casamento, Newborn, etc.) |
| `{{valor_total}}` | = `sessao_valor_total` |
| `{{forma_pagamento}}` | **novo** (preenchido na geração do contrato) |
| `{{prazo_entrega}}` | **novo** (preenchido na geração do contrato) |

### 2. **Novos campos: `cpf_cliente`, `forma_pagamento`, `prazo_entrega`**

Para evitar mudança grande no schema agora, esses 3 campos serão **placeholders manuais** (mostrados em destaque amarelo no contrato gerado, como já acontece com `cidade_atual`). O fotógrafo edita após gerar.

> **Decisão futura (não neste plano)**: posteriormente podemos adicionar campo `cpf` em `clientes` e `forma_pagamento` + `prazo_entrega_dias` em `clientes_sessoes` para preenchimento automático. Por ora, mantemos como placeholders editáveis — alinhado ao princípio "não complicar".

---

## 📝 Mudanças propostas

### A) `src/utils/contratoVariables.ts`
- Adicionar aliases na lista `VARIAVEIS_DISPONIVEIS` (grupo "novo padrão").
- Atualizar `buildVariableMap` retornando ambas as chaves antiga + nova apontando para o mesmo valor.
- Adicionar chaves `cpf_cliente`, `forma_pagamento`, `prazo_entrega` retornando string vazia (renderizadas como placeholder amarelo `[cpf_cliente]` etc., editáveis no review).

### B) Novo arquivo `src/utils/contratoSeedTemplates.ts`
Exporta os **4 modelos prontos** com HTML formatado (h2/h3/p/strong) usando o novo padrão de variáveis:
1. **Casamento** — 9 cláusulas conforme texto fornecido
2. **Ensaio (geral)** — 9 cláusulas
3. **Newborn** — 9 cláusulas com seção de segurança
4. **Evento (geral)** — 9 cláusulas

Cada um com `nome`, `descricao`, `categoria` (`casamento`/`ensaio`/`newborn`/`evento`) e `conteudo` HTML.

### C) `src/components/configuracoes/ContratosConfig.tsx`
- Substituir o atual `SEED_CONTENT` único por uma **galeria de modelos prontos**.
- Quando a lista está vazia (empty state), em vez de só "Usar modelo padrão" + "Criar do zero", mostrar:
  - **Card "Modelos prontos"**: 4 cards pequenos (Casamento, Ensaio, Newborn, Evento) com botão "Usar este modelo" em cada → cria o template e abre o editor para revisão.
  - Botão secundário "Criar do zero".
- Quando já há modelos, adicionar **menu "+ Adicionar modelo pronto"** no header (dropdown com os 4 modelos) ao lado do "Novo modelo" — assim o fotógrafo pode adicionar mais modelos prontos depois sem perder os já criados.

### D) `src/components/contratos/ContratoTemplateEditorModal.tsx`
- Atualizar painel lateral de variáveis para mostrar **as 9 variáveis do novo padrão em destaque** (grupo "Padrão recomendado") + manter as antigas em "Avançado/legado" colapsável.
- Inserção da variável continua via clique (mantendo comportamento atual de inserir no final).

### E) Compatibilidade
- Modelos antigos (`{{cliente_nome}}`) continuam funcionando — `buildVariableMap` retorna ambas chaves.
- Contratos já gerados (snapshots) não são afetados.

---

## 🎨 UX dos modelos prontos

**Empty state** (sem modelos ainda):
```
┌──────────────────────────────────────────────┐
│  📄 Comece com um modelo pronto              │
│  Modelos profissionais prontos para usar.   │
│                                              │
│  ┌──────────┐ ┌──────────┐                  │
│  │💍 Casa-  │ │📸 Ensaio │                  │
│  │  mento   │ │  geral   │                  │
│  │ [Usar]   │ │ [Usar]   │                  │
│  └──────────┘ └──────────┘                  │
│  ┌──────────┐ ┌──────────┐                  │
│  │👶 New-   │ │🎉 Evento │                  │
│  │  born    │ │          │                  │
│  │ [Usar]   │ │ [Usar]   │                  │
│  └──────────┘ └──────────┘                  │
│                                              │
│  ou [Criar do zero]                         │
└──────────────────────────────────────────────┘
```

**Com modelos existentes**: header passa a ter 2 botões — `[+ Modelo pronto ▾]` (dropdown) e `[+ Novo modelo]`.

Ao clicar em "Usar este modelo": cria o template no banco (com `is_padrao=false` se já houver padrão), abre direto o editor para revisão/personalização — fotógrafo pode salvar como está ou ajustar.

---

## 📁 Arquivos afetados

| Ação | Arquivo |
|---|---|
| Criar | `src/utils/contratoSeedTemplates.ts` |
| Editar | `src/utils/contratoVariables.ts` (aliases + novos campos manuais) |
| Editar | `src/components/configuracoes/ContratosConfig.tsx` (galeria de modelos prontos) |
| Editar | `src/components/contratos/ContratoTemplateEditorModal.tsx` (destaque novo padrão) |

**Sem mudanças no banco de dados**, sem breaking changes nos contratos/modelos existentes.

---

## ✅ Resultado esperado

- Fotógrafo abre Configurações > Contratos e vê 4 modelos profissionais prontos para uso imediato.
- Clica em "Usar este modelo" do tipo desejado → cai direto no editor com o conteúdo preenchido → revisa, ajusta nome/categoria → salva.
- Pode adicionar quantos modelos prontos quiser, depois editar livremente.
- Variáveis seguem o padrão limpo e profissional solicitado (`{{nome_cliente}}`, `{{data_sessao}}`, etc.).
- Modelos antigos continuam funcionando intactos.
