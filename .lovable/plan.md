## Plano: Atualizar logos da Sidebar e favicon

### 1. Copiar assets para o projeto

Copiar os 4 logos para `src/assets/branding/` e o favicon para `public/`:

- `user-uploads://lunari_-_..._320px_branco_icone.png` → `src/assets/branding/lunari-icon-white.png` (icon colapsado, dark)
- `user-uploads://lunari_-_..._320px_preto_icone.png` → `src/assets/branding/lunari-icon-black.png` (icon colapsado, light)
- `user-uploads://lunari_-_..._branco_320px.png` → `src/assets/branding/lunari-full-white.png` (full expandido, dark)
- `user-uploads://lunari_-_..._preto_hor320px.png` → `src/assets/branding/lunari-full-black.png` (full expandido, light)
- `user-uploads://favicon-2.png` → `public/favicon.png`

### 2. Sidebar (`src/components/layout/Sidebar.tsx`, linhas 220-230)

Substituir o bloco atual (texto "Lunari") por um logo que troca entre 4 variantes baseado em:
- **Modo** (`light` vs `dark`): detectar via `document.documentElement.classList.contains('dark')` usando o hook `useThemePreference` já existente, ou via `useEffect` + `MutationObserver` simples na classe `dark` do `<html>`.
- **Estado** (`isHovered` = expandido vs colapsado): já disponível como prop local.

Renderizar dois `<img>` (ícone e horizontal completo), alternando via `opacity` + `absolute` para transição suave acompanhando a animação de width já existente (300ms). Importar os 4 PNGs como ES6 modules de `@/assets/branding/`. Altura ~28px, `object-contain`, `alt="Lunari"`.

### 3. Favicon (`index.html`)

- Adicionar `<link rel="icon" type="image/png" href="/favicon.png" />` no `<head>`.
- Remover/sobrescrever `public/favicon.ico` se existir (para evitar precedência do navegador).
- Manter o `apple-touch-icon` existente apontando para o upload atual (não foi pedido mudar).

### 4. Detecção de tema

O projeto já tem `useThemePreference` + `VisualThemeContext` que toggla a classe `dark` no `<html>`. Criar um pequeno hook `useIsDarkMode()` (ou reusar contexto) que retorna boolean reativo observando `classList` — assim a Sidebar troca instantaneamente quando o usuário muda o preset no AppearanceModal.

### Arquivos alterados

- `src/components/layout/Sidebar.tsx` — render do logo
- `src/hooks/useIsDarkMode.ts` (novo, ~15 linhas) — observa classe `dark`
- `index.html` — link do favicon
- `public/favicon.png` (novo)
- `public/favicon.ico` (remover)
- `src/assets/branding/*.png` (4 novos)

### Fora de escopo

- Header, Auth, LandingPage, emails, PWA manifest (não solicitados).
- Não trocar o `apple-touch-icon` existente.
