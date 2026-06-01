# Reformulação do Módulo de Tarefas

Transformar o módulo atual (formulário pesado) em uma ferramenta de **captura rápida** com profundidade opcional, mantendo 100% das integrações existentes (Workflow + Checklists).

---

## 1. Captura ultrarrápida (3 segundos)

### 1.1. Quick-capture no topo da página
Adicionar logo acima do Kanban um campo único, sempre visível:

```text
💡 [ Capturar tarefa ou ideia...                            ] ⏎
```

- `Enter` cria a tarefa imediatamente, **sem modal**.
- Defaults: `status = A Fazer` (defaultOpenKey), `priority = medium`, `type = simple`, sem prazo/responsável.
- Foco permanece no campo após criar (permite rajadas de captura).
- `Esc` limpa o campo.

### 1.2. Quick-add por coluna no Kanban
No rodapé (ou topo) de cada coluna, botão discreto `+ Nova tarefa`. Ao clicar, vira input inline:

```text
[ Escreva a tarefa... ] ⏎
```

- `Enter` cria já no status daquela coluna.
- `Esc` ou blur sem texto cancela.

### 1.3. Modal "Nova tarefa" simplificado
Ao clicar no botão principal `Nova tarefa`, abrir modal mínimo:

```text
Nova Tarefa
────────────────────────────────
[ O que precisa ser feito? ]

▸ + Mais opções

                       [Cancelar]  [Criar]
```

- Único campo obrigatório: **título**.
- `+ Mais opções` (collapsible) revela: Descrição, Prazo, Responsável, Prioridade, Etiquetas, Checklist, Anexos, Cliente/Evento/Orçamento relacionados.
- `Enter` no título cria direto (sem precisar abrir avançado).

---

## 2. Eliminar "Tipo de Tarefa"

Hoje existem 4 tipos (`simple`, `checklist`, `content`, `document`) que forçam decisão prévia.

**Mudança:** toda tarefa passa a ser unificada. Os blocos viram **seções opcionais sempre disponíveis dentro do detalhe**:
- Descrição (texto livre)
- Checklist (itens ilimitados)
- Anexos (arquivos)
- Links (URLs) — pode ser adiado para v2
- Comentários — adiado para v2

### Compatibilidade
- O campo `type` permanece no banco para não quebrar dados existentes (mantemos default `simple`).
- A UI deixa de expor o seletor. Tarefas antigas (`content`, `document`, `checklist`) continuam abrindo normalmente — todas as seções ficam visíveis igualmente.
- `activeSections` e `checklistItems` continuam sendo persistidos como hoje (preserva integração com ChecklistPanel/Workflow).
- A regra atual `filterTasks` que esconde checklists "puros" do Kanban é mantida (para não quebrar `ChecklistPanel` no Workflow).

### Arquivos a remover/aposentar
- `TaskTypeSelector.tsx` (raiz e `forms/`)
- `TaskSectionSelector.tsx`
- `forms/TaskContentForm.tsx`, `forms/TaskDocumentForm.tsx`, `forms/TaskChecklistForm.tsx`, `forms/TaskSimpleForm.tsx`
- `TaskFormModal.tsx` (substituído pelo novo Quick + Advanced modal)

---

## 3. Novo design dos cards (Kanban)

Densidade alta, informação útil sem precisar abrir:

```text
┌────────────────────────────────────────┐
│ ● Separar fotos do ensaio da Maria     │  ← ponto colorido = prioridade
│                                        │
│ 🏷 Marketing  +2                       │  ← máx 2 tags, resto agrupado
│ ─────────────────────────────────────  │
│ 📅 Atrasada 2d   ☑ 3/5     👤 EC      │
└────────────────────────────────────────┘
```

Especificação:
- **Título**: peso visual principal (font-medium, line-clamp-2).
- **Prioridade**: ponto colorido pequeno antes do título (🔴 alta, 🟡 média, ⚪ baixa). Remove badge atual que ocupa linha inteira.
- **Prazo amigável**: `Hoje`, `Amanhã`, `Em 3 dias`, `Atrasada 2d` — cor muda conforme urgência (vermelho/âmbar/neutro).
- **Checklist**: se existir, mostra `☑ x/y`. Clicável para expandir? Não — apenas indicador.
- **Responsável**: avatar circular pequeno com iniciais.
- **Etiquetas**: máximo 2 visíveis + `+N`.
- Mantém glassmorphism atual e padrão dnd-kit.

Card atual `TaskCard.tsx` será reescrito; `CleanTaskCard.tsx` (lista) recebe os mesmos ajustes de prazo/prioridade.

---

## 4. Vinculação com ecossistema Lunari

Já existem os campos `relatedClienteId`, `relatedBudgetId`, `relatedSessionId`. Atualmente subutilizados.

No modal avançado e no detalhe da tarefa, adicionar seletores opcionais:
- **Cliente** (combobox buscando clientes Supabase)
- **Evento/Sessão** (combobox de sessões; se cliente selecionado, filtra)
- **Orçamento** (combobox)
- *(Contrato fica fora desta entrega — campo ainda não existe no schema)*

Quando vinculados, o card pode exibir um chip discreto (ex.: `Maria Silva · Newborn`) abaixo do título, opcionalmente.

**Sem mudanças de schema.** Apenas usa as colunas já existentes.

---

## 5. Integrações preservadas (não tocar)

- ✅ **Workflow ↔ Tarefas com prazo**: tarefas com `dueDate` continuam aparecendo no Workflow do mês correspondente — nenhum hook/serviço de workflow é modificado.
- ✅ **Checklist do Workflow → Tarefas**: `ChecklistPanel` e a criação automática de tarefas tipo `checklist` permanecem intactas. Continuamos persistindo `type='checklist'` para esses itens para não quebrar a query atual.
- ✅ **Estrutura de dados / banco**: zero migrations. Tudo é UI + comportamento de criação.
- ✅ Status configuráveis (`useSupabaseTaskStatuses`) continuam funcionando — apenas removemos o seletor da tela de criação.

---

## 6. Detalhes técnicos

### Componentes novos
- `QuickCaptureBar.tsx` — input global no topo de `Tarefas.tsx`.
- `ColumnQuickAdd.tsx` — input inline por coluna.
- `QuickTaskModal.tsx` — substitui `UnifiedTaskModal` no modo create; reutiliza `TaskDetailsModal` para edição.
- `TaskCard.tsx` — reescrito para o novo layout denso.

### Hook `useSupabaseTasks`
Sem mudanças de assinatura. `addTask` já aceita `Omit<Task, 'id' | 'createdAt'>`. Quick-capture chama:
```ts
addTask({
  title,
  status: defaultOpenKey,
  priority: 'medium',
  type: 'simple',
  source: 'manual',
})
```

### Comportamento de status na criação
O usuário não escolhe status — sempre cai no `defaultOpenKey` (ou no status da coluna no caso de quick-add por coluna). Mudança de status só por drag-and-drop ou no detalhe.

### Toasts
Manter padrão atual (sem toast de sucesso para criações via quick-capture — alinhado à preferência do projeto de não exibir toasts de sucesso). Toast de erro permanece.

---

## 7. Fora de escopo (não será feito agora)

- Comentários em tarefas.
- Vinculação com Contrato (campo não existe).
- Recorrência de tarefas.
- Templates de tarefa (já existe `TemplateManagerModal`, sem mudanças).
- Mudanças na view de Lista (apenas o card é atualizado por consistência).
- Migrations no banco.

---

## 8. Plano de validação após implementação

1. Quick-capture: digitar título + Enter cria tarefa em "A Fazer" sem modal.
2. Quick-add em coluna "Em andamento": tarefa nasce já naquela coluna.
3. Modal `Nova tarefa`: criar só com título; depois testar `+ Mais opções` com prazo + prioridade + checklist.
4. Drag-and-drop entre colunas continua funcionando.
5. Tarefa antiga do tipo `content`/`document` abre o detalhe sem erro e mostra todas as seções.
6. Tarefa com `dueDate` aparece corretamente no Workflow do mês.
7. Checklist criado pelo Workflow continua gerando item no `ChecklistPanel`.
8. Card mostra prioridade como ponto, prazo amigável e progresso de checklist.
