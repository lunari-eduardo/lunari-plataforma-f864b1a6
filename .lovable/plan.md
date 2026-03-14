

# Glassmorphism para Tarefas e Leads + Modal de Gerenciamento

## Diagnóstico

### Tarefas
- **Colunas Kanban** (`glass-column` em CSS): já têm glassmorphism via `Tarefas.css` — funciona
- **Cards** (`glass-task-card`): já têm glassmorphism via CSS — funciona
- **ChecklistPanel**: usa `<Card className="bg-lunar-surface">` — **opaco, sem glass**
- **ListView**: usa `<Card className="bg-lunar-surface">` — **opaco, sem glass**
- **Página**: usa `page-tarefas-modern` com background próprio — OK

### Leads
- **Página**: `bg-lunar-bg` — **opaco, bloqueia background decorativo**
- **Colunas**: `<Card>` com `backgroundColor: ${statusColor}08` — **opaco, sem glass**
- **Cards**: `bg-gradient-to-br from-gray-100 to-white` — **opaco, cinza, sem glass**
- **Métricas**: `bg-lunar-surface` — **opaco**
- **DragOverlay**: sem glass styling

### Modais
- Dialog base já é `bg-white` (corrigido antes) — OK
- ManageTaskStatusesModal: UX fraca (color pickers, layout denso, sem hierarquia visual)

## Plano de Mudanças

### 1. Leads — Página (`src/pages/Leads.tsx`)
- Remover `bg-lunar-bg` do container principal → fundo transparente para ver o background decorativo

### 2. Leads — Colunas Kanban (`src/components/leads/LeadsKanban.tsx`)
- Substituir `<Card>` opaco por `div` com classes glassmorphic:
  - Light: `bg-white/25 backdrop-blur-xl border border-white/35`
  - Dark: `bg-white/[0.04] backdrop-blur-xl border border-white/[0.08]`
  - `border-top: 3px solid statusColor` (tinted por status, como Tarefas)
  - Drop zone glow: `ring-2 ring-[statusColor]/50`
- DragOverlay: adicionar glass styling similar ao `glass-drag-overlay`

### 3. Leads — Cards (`src/components/leads/LeadCard.tsx`)
- Substituir `bg-gradient-to-br from-gray-100 to-white` por:
  - Light: `bg-white/50 backdrop-blur-md border border-white/50`
  - Dark: `bg-white/[0.06] backdrop-blur-md border border-white/[0.08]`
- Hover: aumentar opacidade (`bg-white/70` light, `bg-white/[0.10]` dark) + shadow

### 4. Leads — Métricas (`src/components/leads/LeadMetricsCards.tsx`)
- Substituir `bg-lunar-surface` por glass: `bg-white/40 backdrop-blur-sm border-white/30`
- Dark: `bg-white/[0.05] border-white/[0.08]`

### 5. Tarefas — ChecklistPanel (`src/components/tarefas/ChecklistPanel.tsx`)
- Card container: `bg-lunar-surface` → `bg-white/30 backdrop-blur-xl border-white/35` (light) / `bg-white/[0.04] border-white/[0.08]` (dark)

### 6. Tarefas — Página background (`src/pages/Tarefas.tsx`)
- Remover `page-tarefas-modern` background override do CSS (já tem background decorativo global)
- ListView Card: mesma conversão glass

### 7. Tarefas.css — Limpeza
- Remover `.page-tarefas-modern` background rules (linhas 7-21) para que o background decorativo global seja visível
- Manter todas as regras de glass-column, glass-task-card, glass-drag-overlay (já estão corretas)

### 8. Modal de Gerenciamento (`src/components/tarefas/ManageTaskStatusesModal.tsx`)
- Remover `input type="color"` (já feito em categorias, aplicar aqui)
- Mostrar apenas dot colorido (read-only) com cor do status
- Layout mais compacto: cada status em uma row com `divide-y`, padding reduzido
- Hierarquia visual: seções com headers claros, separadores sutis
- Botões de ação (mover/remover) menores e agrupados
- Switch "Concluído" mais integrado na row
- Formulário de adicionar: row simples com input + botão
- Tabs com visual mais limpo

## Arquivos Modificados

```text
Arquivo                                         Mudança
──────────────────────────────────────────────── ─────────
src/pages/Leads.tsx                             Remover bg-lunar-bg
src/components/leads/LeadsKanban.tsx            Colunas glass + drag overlay glass
src/components/leads/LeadCard.tsx               Card glass em vez de gray gradient
src/components/leads/LeadMetricsCards.tsx        Métricas glass
src/pages/Tarefas.tsx                           ListView glass
src/pages/Tarefas.css                           Remover page background override
src/components/tarefas/ChecklistPanel.tsx        Card glass
src/components/tarefas/ManageTaskStatusesModal   UX redesign compacto
```

8 arquivos.

