

# Padronizar Design da Agenda com Glassmorphism

## Problemas Identificados

### Camadas e cores sólidas que bloqueiam o glassmorphism:

1. **`Agenda.tsx` (linha 258)**: `<Card className="bg-lunar-bg">` — fundo branco sólido (`--lunar-bg: 0 0% 100%`) no container principal, bloqueia completamente o background decorativo.

2. **`DailyView.tsx` (linha 206)**: `bg-lunar-bg` no container, mais `bg-lunar-surface` e `bg-muted` nos slots de horário — tudo sólido.

3. **`WeeklyView.tsx` (linha 158)**: `bg-border` na grid, `bg-muted` nos headers e célula vazia, `bg-card` nos slots — cores sólidas diferentes do mensal. No light mode, `--card: 30 30% 98% / 0.65` já tem alguma transparência, mas `--muted: 30 15% 90%` é sólido.

4. **`MonthlyView.tsx` (linhas 86, 96, 204)**: `bg-lunar-surface` nas células, `bg-lunar-bg` nos espaços vazios — sólidos.

5. **`Dialog` (linha 85)**: `bg-popover` — no light mode `--popover: 30 30% 98% / 0.7` tem transparência, mas no dark `--popover: 20 12% 10%` é sólido.

6. **Dialog overlay**: `bg-black/80` — muito escuro, não permite ver o glass effect.

### Inconsistências visuais:
- WeeklyView usa `bg-border` + `bg-muted` (cinza frio) vs MonthlyView usa `bg-lunar-surface` (warm)
- DailyView usa `bg-lunar-bg` + `bg-lunar-surface` (warm)
- Modais usam `bg-popover` com valores diferentes entre light/dark

## Solução

### Princípio: Uma paleta glassmórfica consistente
- Container principal da agenda: transparente com backdrop-blur
- Células/slots: `bg-white/40 dark:bg-white/[0.05]` com `backdrop-blur-sm`
- Headers de dia: `bg-white/50 dark:bg-white/[0.06]`
- Modais: fundo com blur forte, cinza muito claro com transparência
- Overlay de modais: reduzir de `bg-black/80` para `bg-black/40` para preservar o efeito glass

### Alterações

#### 1. `src/pages/Agenda.tsx`
- Linha 258: Remover `bg-lunar-bg` do Card — usar classe transparente com blur

#### 2. `src/components/agenda/MonthlyView.tsx`
- Grid container (linha 81): `bg-lunar-border/30` → remover fundo ou usar glass sutil
- Headers (linha 86): `bg-lunar-surface` → `bg-white/50 dark:bg-white/[0.06]`
- Células vazias (linha 96): `bg-lunar-bg` → `bg-white/20 dark:bg-white/[0.02]`
- Células dia (linha 204): `bg-lunar-surface` → `bg-white/40 dark:bg-white/[0.05]`

#### 3. `src/components/agenda/WeeklyView.tsx`
- Grid (linha 158): `bg-border` → `bg-white/20 dark:bg-white/[0.03]`
- Célula vazia (linha 160): `bg-muted` → `bg-white/30 dark:bg-white/[0.04]`
- Headers (linha 173): `bg-muted` → `bg-white/50 dark:bg-white/[0.06]`
- Slots (linha 216): `bg-card hover:bg-muted` → `bg-white/40 hover:bg-white/60 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]`
- Time labels: `bg-muted` → `bg-white/30 dark:bg-white/[0.04]`

#### 4. `src/components/agenda/DailyView.tsx`
- Container (linha 206): `bg-lunar-bg` → remover (transparente)
- Time column (linha 302): `bg-muted` → `bg-white/30 dark:bg-white/[0.04]`
- Slot area (linha 342): `bg-lunar-surface` → `bg-white/40 dark:bg-white/[0.05]`

#### 5. `src/components/ui/dialog.tsx`
- Overlay (linha 28): `bg-black/80` → `bg-black/40 backdrop-blur-sm`
- Content (linha 85): `bg-popover` → `bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl`

#### 6. `src/index.css` — Ajustar variáveis CSS
- `--popover` dark mode (linha 182): adicionar transparência: `20 12% 10% / 0.80`
- `--muted` light mode (linha 49): manter sólido (usado em outros contextos), as mudanças são feitas inline nos componentes da agenda

#### 7. `src/components/agenda/AgendaHeader.tsx`
- Botões com `bg-lunar-surface` → `bg-white/40 dark:bg-white/[0.06]` para consistência
- ViewToggleGroup container: `bg-lunar-surface` → `bg-white/40 dark:bg-white/[0.06]`

Todas as alterações usam `backdrop-blur-sm` nos elementos menores (células) para performance, e `backdrop-blur-xl` apenas nos containers principais e modais.

