

# Padronização Final Glassmorphic da Agenda

## Problemas Identificados

### 1. DayPreviewPopover (popover flutuante) - Fundo `bg-popover` sólido
Linha 28: `bg-popover` + `border-border` = fundo sólido bege/branco. O usuário quer que este tenha fundo com degradê (não transparente).

### 2. AgendaModals - Modais com `bg-background` sólido
4 instâncias em `AgendaModals.tsx` usando `bg-background border-border` — ignora a padronização de modais com `bg-gray-50/90 backdrop-blur-2xl`.

### 3. AgendaTasksSection - Fundo sólido
Linha 129: `bg-lunar-surface/30 border border-lunar-border/20` — `lunar-surface` é `0 0% 100%` (branco puro), mesmo com `/30` fica opaco demais.

### 4. AppointmentForm - `bg-muted` sólido em painéis internos
Linhas 434, 561: `bg-muted border border-border` — sólido cinza.

### 5. AvailabilityConfigModal - `bg-muted` e `bg-background` nos toggles
Linhas 288, 295, 307: segmented buttons com fundo sólido.

### 6. ShareAvailabilityModal - `bg-muted` no preview
Linha 258: `bg-muted` sólido.

### 7. Popover global - `bg-popover` + `border` sólido
Já tem `backdrop-blur-xl`, mas `bg-popover` no light mode é `30 30% 98% / 0.7` (bege translúcido). Precisa ser cinza neutro.

## Alterações

### 1. `src/components/agenda/DayPreviewPopover.tsx`
- Linha 28: `border border-border bg-popover` → `border border-white/30 dark:border-white/10 bg-gradient-to-b from-gray-50/95 to-white/90 dark:from-neutral-900/95 dark:to-neutral-950/90 backdrop-blur-xl`
- Linha 30: `border-b border-border/50` → `border-b border-white/30 dark:border-white/10`
- Linha 76: `border-t border-border/50` → `border-t border-white/30 dark:border-white/10`

### 2. `src/components/agenda/AgendaModals.tsx`
- Linhas 76, 95, 109, 126: `bg-background border-border` → remover (deixar o Dialog base aplicar seu estilo glass padrão `bg-gray-50/90`)

### 3. `src/components/agenda/AgendaTasksSection.tsx`
- Linha 129: `bg-lunar-surface/30 border border-lunar-border/20` → `bg-white/30 dark:bg-white/[0.04] border border-white/25 dark:border-white/10 backdrop-blur-sm`
- Linhas 159, 184: `bg-lunar-background/40 hover:bg-lunar-background/70` → `bg-white/30 hover:bg-white/50 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]`

### 4. `src/components/agenda/AppointmentForm.tsx`
- Linhas 434, 561: `bg-muted border border-border` → `bg-white/30 dark:bg-white/[0.05] border border-white/25 dark:border-white/10`

### 5. `src/components/agenda/AvailabilityConfigModal.tsx`
- Linha 288: `bg-muted` → `bg-white/30 dark:bg-white/[0.05]`
- Linhas 295, 307: `bg-background` → `bg-white/70 dark:bg-white/[0.1]`

### 6. `src/components/agenda/ShareAvailabilityModal.tsx`
- Linha 258: `bg-muted` → `bg-white/30 dark:bg-white/[0.05] border border-white/25 dark:border-white/10`

### 7. `src/components/ui/popover.tsx`
- Linha 25: `border bg-popover` → `border border-white/30 dark:border-white/10 bg-gray-50/90 dark:bg-neutral-950/85`

8 arquivos, apenas classes CSS. Zero lógica alterada.

