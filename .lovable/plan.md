# Painel de Tema do Usuário — Lunari

Transformar o atual "Visual Theme Studio" (admin, técnico) em um painel **único, premium e simples** para o usuário final escolher a cor do seu sistema, com persistência multi-dispositivo.

## 1. Objetivos

- Cada usuário escolhe **1 cor de tema** entre 7 opções curadas.
- Modo claro/escuro/sistema continua disponível.
- Brilho/saturação ajustados **automaticamente** para garantir contraste WCAG AA em ambos os modos — sem sliders manuais expostos.
- Preferência sincronizada via Supabase entre todos os dispositivos do mesmo usuário.
- Acesso movido para o **menu do avatar** (Header), removido da Sidebar.

## 2. Cores oficiais (presets)

| ID | Nome | Hex base |
|---|---|---|
| `lunari` | Lunari (padrão) | `#893806` (terracota atual) |
| `sage` | Sage | `#8eb882` |
| `ocean` | Ocean | `#82b5b8` |
| `lavender` | Lavender | `#a282b8` |
| `rose` | Rose | `#b88299` |
| `coral` | Coral | `#c27e7e` |
| `mono` | Preto & Branco | `#1a1a1a` |

Cada preset gera automaticamente:
- `--brand-h/s/l` (cor principal)
- `--brand-hover-l` (−7% no light, +7% no dark)
- `--brand-glow-l` (+15%)
- `--primary-foreground` (branco ou preto conforme luminância da base, garantindo contraste ≥ 4.5:1)
- Em **dark mode**: a lightness é elevada (+10–15%) automaticamente para manter legibilidade de textos/ícones tintados em superfícies escuras.
- `mono` recebe tratamento especial: saturação 0, brilho que inverte entre modos.

A lógica vive em `src/lib/visualTheme.ts` (função `resolvePresetTokens(presetId, mode)`), eliminando a necessidade do usuário tocar em sliders.

## 3. Tabela Supabase

Migração nova:

```text
create table public.user_theme_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preset_id text not null default 'lunari',
  mode text not null default 'system',  -- 'light' | 'dark' | 'system'
  updated_at timestamptz not null default now()
);
```

- RLS: usuário só lê/escreve a própria linha (`auth.uid() = user_id`).
- Trigger `update_updated_at_column` para `updated_at`.
- Upsert no salvar.

## 4. Mudanças de UX

### Remover
- Item "Visual Theme" da Sidebar (`src/components/layout/Sidebar.tsx`).
- Sliders de Brand HSL, Hover/Glow Lightness, Glassmorphism alpha/blur, Surface hue/sat, Border radius — todos saem do painel do usuário (a lógica interna permanece e é controlada pelo preset).

### Adicionar no menu do avatar (Header.tsx)
- Novo item **"Aparência"** com ícone `Palette`, abrindo um **modal** (não rota nova) com:
  - Grid 2x4 das 7 cores como swatches grandes (com check no selecionado).
  - Toggle **Claro / Escuro / Sistema** (3 botões segmentados).
  - Mini preview ao vivo (botão primário, card, badge) dentro do modal.
  - Botão "Restaurar padrão" (volta para `lunari` + `system`).
- Salvamento automático ao clicar (sem botão "salvar"), com debounce de 400ms para o upsert no Supabase.

### Rota admin
- `/app/admin/visual-theme` é **removida**. O arquivo `AdminVisualTheme.tsx` é deletado.
- (Sem painel admin global nesta fase — cada usuário controla o próprio tema.)

## 5. Arquitetura técnica

```text
src/
├── lib/visualTheme.ts         (refatorar: 7 presets + resolvePresetTokens)
├── contexts/VisualThemeContext.tsx
│   - carrega de Supabase ao logar (fallback localStorage offline)
│   - aplica via applyTheme()
│   - persiste em Supabase via upsert debounced
├── hooks/useThemePreference.ts (novo: encapsula fetch/upsert)
└── components/preferences/
    └── AppearanceModal.tsx    (novo modal aberto pelo Header)
```

Fluxo:
1. Login → `VisualThemeProvider` chama `useThemePreference()` → busca `user_theme_preferences` do usuário.
2. Aplica tokens no `:root` via `applyTheme(resolvePresetTokens(preset, mode))`.
3. Usuário muda no modal → state local atualiza imediato + upsert debounced no Supabase.
4. Outras abas/dispositivos: subscription realtime opcional (fase 2) ou refresh ao reabrir.

Garantia de contraste:
- `resolvePresetTokens` calcula luminância relativa da cor base e decide `primary-foreground` entre `0 0% 100%` e `0 0% 10%`.
- Em dark mode, eleva `--brand-l` mínimo de 55% e satura levemente para não "sumir" sobre fundos escuros.
- Surface tokens (`--surface-*`) ficam **fixos** por modo (neutros), independentes do preset, para evitar fundos coloridos demais.

## 6. Migração de dados existentes

- `localStorage` key antiga `lunari:visual-theme:v1` é lida uma vez no primeiro login pós-deploy; se houver `brandH` próximo a um preset, mapeia; caso contrário, default `lunari`. Depois disso, a chave é removida.

## 7. Entregáveis

1. Migração Supabase (`user_theme_preferences` + RLS + trigger).
2. Refator `src/lib/visualTheme.ts` com os 7 presets e `resolvePresetTokens`.
3. Hook `useThemePreference` (fetch/upsert/debounce).
4. Refator `VisualThemeContext` para usar Supabase + fallback localStorage.
5. Novo `AppearanceModal.tsx` + entrada no `Header.tsx` (ícone Palette, acima de "Sair").
6. Remoção do link "Visual Theme" da `Sidebar.tsx`.
7. Deleção de `src/pages/AdminVisualTheme.tsx` e rota correspondente em `App.tsx`.
8. QA: alternar entre os 7 presets nos dois modos verificando contraste de texto sobre `bg-primary`, badges, botões e cards.

## 8. Fora de escopo (esta fase)

- Painel admin para definir tema padrão global da plataforma.
- Sincronização realtime entre abas (pode ser adicionada depois sem mudar o contrato).
- Customização de glassmorphism/blur/radius pelo usuário (permanece controlado pelo design system).
