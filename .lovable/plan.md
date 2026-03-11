

# Padronização Glassmorphic Completa da Agenda

## Diagnóstico

Analisando as 4 views + modais, encontrei estas inconsistências:

### Cores sólidas remanescentes
- **AnnualView**: Cards dos meses usam `bg-lunar-surface border-lunar-border` (sólido). Botões de dia usam `bg-lunar-bg border-lunar-border` (sólido branco).
- **DailyView**: Slots usam `border-border` (borda sólida forte). Time column usa `bg-white/30` (ok) mas a borda do slot `border-border` é muito pesada.
- **MonthlyView**: Já usa `bg-white/40` nas células — está ok, mas a grid gap `bg-white/10` cria linhas muito sutis.
- **WeeklyView**: Células e headers já estão com glass — ok.

### Bordas fortes na DailyView
- Linha 299: `border-border` produz uma borda sólida cinza forte que não combina com glassmorphism. Deveria ser `border-white/20 dark:border-white/10`.

### Modais inconsistentes (bege vs cinza)
- **Dialog** (linha 85): Usa `bg-white/80 dark:bg-neutral-900/80` — leve tom cinza com blur. OK.
- **AlertDialog** (linha 37): Usa `bg-background` — que é `hsl(30 40% 96%)` = bege sólido. Overlay usa `bg-black/80` — muito escuro. Totalmente diferente do Dialog.
- O modal de agendamento (que é um Dialog) está com `bg-white/80` = cinza claro. O modal de disponibilidade (também Dialog) está igual. Mas a barra superior do Dialog mostra o tom bege do `--background` por trás quando a transparência é aplicada.

**Solução para cor dos modais**: Ambos devem usar cinza muito claro (`bg-gray-50/90 dark:bg-neutral-900/85`) com backdrop-blur forte, eliminando qualquer tom bege.

## Plano de Alterações

### 1. `src/components/agenda/AnnualView.tsx`
- Linha 77: `bg-lunar-surface border-lunar-border` → `bg-white/30 backdrop-blur-sm dark:bg-white/[0.04] border border-white/30 dark:border-white/10`
- Linha 120: Botões de dia `bg-lunar-bg border-lunar-border` → `bg-white/30 dark:bg-white/[0.03] border-white/20 dark:border-white/10`

### 2. `src/components/agenda/DailyView.tsx`
- Linha 299: `border-border` → `border-white/25 dark:border-white/10` (borda glass suave)
- Linha 299: Adicionar `backdrop-blur-sm` ao container do slot
- Blocked variant: `border-destructive/30` mantém (semântico)

### 3. `src/components/agenda/MonthlyView.tsx`
- Já está ok com `bg-white/40`. Apenas ajustar a grid gap para `bg-white/15 dark:bg-white/[0.03]` para linhas de separação mais visíveis.

### 4. `src/components/ui/dialog.tsx`
- Linha 85: `bg-white/80` → `bg-gray-50/90 dark:bg-neutral-950/85 backdrop-blur-2xl` — cinza neutro muito claro, sem tom bege
- Borda: manter `border-white/30 dark:border-white/10`

### 5. `src/components/ui/alert-dialog.tsx`
- Linha 19: `bg-black/80` → `bg-black/40 backdrop-blur-sm` (alinhar com Dialog)
- Linha 37: `bg-background` → `bg-gray-50/90 dark:bg-neutral-950/85 backdrop-blur-2xl border border-white/30 dark:border-white/10` (alinhar com Dialog)

### 6. `src/hooks/useResponsiveLayout.ts`
- Linha 40: Adicionar `bg-white/30 dark:bg-white/[0.04]` ao `timeLabel` classes (já está no DailyView inline, padronizar)

## Resumo visual

```text
Camada         Antes                          Depois
─────────────  ─────────────────────────────  ────────────────────────────────
Annual cards   bg-lunar-surface (sólido)      bg-white/30 backdrop-blur-sm
Annual days    bg-lunar-bg (branco sólido)    bg-white/30 border-white/20
Daily slots    border-border (forte)          border-white/25 backdrop-blur-sm
Dialog modal   bg-white/80 (bege leve)        bg-gray-50/90 backdrop-blur-2xl
AlertDialog    bg-background (bege sólido)    bg-gray-50/90 backdrop-blur-2xl
Alert overlay  bg-black/80                    bg-black/40 backdrop-blur-sm
```

6 arquivos alterados, zero lógica tocada — apenas classes CSS.

