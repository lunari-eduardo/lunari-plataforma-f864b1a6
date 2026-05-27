
# Redesign da tela de Login — Lunari Studio

## Objetivo
Substituir totalmente a tela atual de login (que herda o tema do usuário) por uma versão **dark fixa**, com novo logotipo, fundo customizado e estética mobile-first idêntica à referência, mantendo toda a lógica de autenticação existente.

## Escopo
- `src/pages/Auth.tsx` (login + cadastro + esqueci senha)
- `src/pages/ResetPassword.tsx` (consistência visual)
- Subcomponentes: `EmailLoginForm`, `EmailSignupForm`, `ForgotPasswordForm` (apenas ajustes de inputs/labels para combinar com o novo visual escuro)
- Novos assets em `src/assets/auth/`

Fora do escopo: fluxos de auth, validações, rotas, lógica do Supabase, telas internas do app.

## Assets a copiar
- `user-uploads://background.jpg` → `src/assets/auth/login-background.jpg` (fundo escuro com o "K")
- `user-uploads://Lunari_Gallery_-_sistema_de_gestão_para_fotógrafos.png` → `src/assets/auth/lunari-studio-logo.png` (logo completo "K + lunari + STUDIO", 250px)
- Remover o uso de `src/assets/lunari-logo.png` e `src/assets/auth-background.jpg` apenas nestas duas páginas (manter os arquivos no projeto se usados em outros lugares).

## Estrutura visual (mobile-first, espelhando a referência)

```text
┌─────────────────────────────┐
│   [fundo background.jpg]    │  cover, center, fixed
│  ┌───────────────────────┐  │
│  │                       │  │
│  │      [LOGO 200px]     │  │  topo: ~10vh
│  │                       │  │
│  │   Gestão completa     │  │  título leve, branco
│  │    para fotógrafos    │  │  subtítulo, branco/70
│  │                       │  │
│  │  ┌─────────────────┐  │  │  input email (ícone Mail à esq)
│  │  │ ✉  E-mail       │  │  │  altura 52, bg #FFFFFF0A
│  │  └─────────────────┘  │  │  border #FFFFFF1A, radius 12
│  │  ┌─────────────────┐  │  │  input senha (ícone Lock + Eye)
│  │  │ 🔒 Senha     👁 │  │  │
│  │  └─────────────────┘  │  │
│  │  ☐ Lembrar  Esqueci?  │  │  linha auxiliar
│  │  ┌─────────────────┐  │  │
│  │  │     Entrar      │  │  │  botão accent (laranja/cobre)
│  │  └─────────────────┘  │  │  gradient + shadow
│  │   ─── ou continue ──  │  │
│  │  ┌─────────────────┐  │  │
│  │  │  G  Google      │  │  │  outline branco translúcido
│  │  └─────────────────┘  │  │
│  │  Ainda não tem conta? │  │
│  │       Criar conta     │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

## Tokens visuais (fixos, sem depender do tema do usuário)

- Fundo: `bg-[#0a0a0a]` com `background-image: url(background.jpg)` `cover`/`center`
- Overlay sobre o fundo: `bg-gradient-to-b from-black/40 via-black/30 to-black/60`
- Card "container" (apenas em desktop ≥ md): largura máx `420px`, sem card visível em mobile (conteúdo direto sobre o fundo, igual à referência). Em desktop o conteúdo fica centralizado, **sem borda/card** — apenas espaço respirando, para preservar o efeito de imersão.
- Texto principal: `text-white`
- Texto secundário: `text-white/60`
- Inputs:
  - bg `bg-white/[0.04]`, border `border-white/10`, focus border `border-[#C97A4A]/60`
  - altura `h-12`, radius `rounded-xl`, padding-left `pl-11` para ícone
  - ícone à esquerda: `Mail`/`Lock` em `text-white/40`, 18px
  - placeholder `placeholder:text-white/40`
- Botão primário "Entrar":
  - gradient `from-[#C97A4A] to-[#A8633A]`
  - `h-12`, `rounded-xl`, `text-white font-medium`
  - shadow `shadow-[0_8px_24px_-8px_rgba(201,122,74,0.5)]`
- Link "Esqueci minha senha" e "Criar conta": `text-[#C97A4A] hover:text-[#E08B5A]`
- Divider "ou continue com": linhas `bg-white/10`, texto `text-white/40 text-xs`
- Botão Google: `bg-white/5 border-white/10 hover:bg-white/10`, ícone Google colorido, texto branco
- Tabs Login/Cadastro: removidas (substituídas por link "Criar conta" no rodapé, como na referência). Alternância de modo via `useState` no `Auth.tsx`.
- Checkbox "Lembrar de mim": `border-white/30 data-[state=checked]:bg-[#C97A4A]`

## Espaçamentos (mobile-first)

- Container vertical: `flex flex-col items-center justify-center min-h-[100dvh] px-6 py-10`
- Bloco logo→subtítulo: `gap-3`, margin-bottom `mb-10`
- Stack de inputs: `space-y-3`
- Entre linha "lembrar/esqueci" e botão Entrar: `mt-2` / `mt-5`
- Entre botão Entrar e divider: `my-6`
- Entre Google e rodapé "Criar conta": `mt-6`
- Conteúdo respeita `max-w-[400px] w-full`

## Responsividade

- **Mobile (< 768)**: conteúdo full-bleed sobre o fundo, padding 24px lateral, fundo `bg-cover bg-center` com `background-attachment: fixed` desativado (evita bug iOS), centralizado.
- **Tablet/Desktop (≥ 768)**: mesmo layout, conteúdo centralizado em `max-w-[400px]`, fundo cobre toda a viewport e mantém o "K" centralizado (`bg-center`). Sem card/borda — apenas o conteúdo flutuando.
- **Logo**: `w-[200px]` em mobile, `w-[220px]` em desktop, `object-contain`.

## Tema fixo (independente da preferência do usuário)

A página de login NÃO deve seguir `dark`/`light` do usuário — é sempre dark.

Implementação: envolver o conteúdo em uma `<div className="dark">` local e aplicar classes Tailwind dark explícitas (`bg-black`, `text-white`, etc.). Não chamar `useVisualTheme` nesta página. Variáveis CSS de tema do app continuam funcionando para o resto do sistema; aqui usamos classes utilitárias absolutas para garantir consistência.

## Subcomponentes — ajustes mínimos

- `EmailLoginForm`: já recebe `onForgotPassword`. Ajustar:
  - inputs herdarem o novo estilo (passar `className` ou criar variante "auth-dark"). Mais simples: substituir `<Input>` por inputs locais estilizados dentro do form para evitar afetar o resto do app.
  - adicionar checkbox "Lembrar de mim" + link "Esqueci minha senha" na mesma linha (substituindo o link isolado atual).
  - botão "Entrar" no novo estilo cobre.
- `EmailSignupForm`: mesma estilização; renderizado quando `mode === 'signup'`.
- `ForgotPasswordForm`: mesma paleta dark, manter botão "Voltar".

Alternativa para evitar tocar nos 3 forms: criar `src/components/auth/AuthInput.tsx` e `AuthButton.tsx` reaproveitáveis (dark fixo) e refatorar os 3 forms para usá-los. **Recomendado** — mantém consistência e facilita replicar no Lunari Gallery.

## ResetPassword.tsx

Aplicar exatamente os mesmos tokens (fundo, logo, inputs, botão cobre) para manter consistência visual no fluxo completo de recuperação de senha.

## Documentação para replicar no Lunari Gallery

Criar `src/styles/auth-login-design-spec.md` com:
1. Lista de assets necessários (background + logo)
2. Tokens (cores hex, radius, alturas, sombras, gradients)
3. Estrutura de layout (ASCII + breakpoints)
4. Componentes reutilizáveis (`AuthInput`, `AuthButton`, `AuthGoogleButton`)
5. Snippet completo do JSX da tela de login
6. Notas sobre tema dark fixo (não usar `useVisualTheme`)
7. Checklist de paridade Studio ↔ Gallery

Esse arquivo fica versionado no projeto Studio e serve de referência one-to-one quando formos aplicar no Gallery.

## Memória do projeto

Adicionar memória `mem://design/auth-login-dark-spec` referenciando o doc acima, para que futuras alterações em qualquer um dos dois projetos mantenham paridade.

## Arquivos tocados

- **Criados**: `src/assets/auth/login-background.jpg`, `src/assets/auth/lunari-studio-logo.png`, `src/components/auth/AuthInput.tsx`, `src/components/auth/AuthButton.tsx`, `src/components/auth/AuthGoogleButton.tsx`, `src/styles/auth-login-design-spec.md`, `mem://design/auth-login-dark-spec`
- **Editados**: `src/pages/Auth.tsx`, `src/pages/ResetPassword.tsx`, `src/components/auth/EmailLoginForm.tsx`, `src/components/auth/EmailSignupForm.tsx`, `src/components/auth/ForgotPasswordForm.tsx`, `mem://index.md`

## Riscos / Pontos de atenção

- Tela `Auth` hoje exibe toasts via `reason=suspended|session_expired` e `error=access_denied` — manter intacto.
- Lógica de redirect (`navigate('/app')`) e `useAuth` — não alterar.
- Os 3 forms já fazem submit próprio com `supabase.auth.*` — não mexer na lógica, só na apresentação.
- Garantir contraste AA em todos os textos sobre o fundo escuro.
