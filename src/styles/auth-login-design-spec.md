# Lunari Auth Login — Design Spec

Espec de referência para a tela de **login / cadastro / recuperação de senha**.
Use este documento como fonte única de verdade para replicar o visual no
projeto **Lunari Gallery**, garantindo paridade absoluta entre os dois apps.

> Princípio: a tela de auth é **sempre dark**, independente do tema do
> usuário. Não use `useVisualTheme` aqui. Use tokens fixos abaixo.

---

## 1. Assets

| Asset | Caminho no projeto | Origem |
|---|---|---|
| Fundo escuro com "K" | `src/assets/auth/login-background.jpg` | upload do cliente |
| Logo completo (K + lunari + STUDIO) | `src/assets/auth/lunari-studio-logo.png` | upload (250px) |

Para o **Gallery**, copiar os mesmos arquivos para `src/assets/auth/` no projeto Gallery.

---

## 2. Tokens visuais (fixos)

| Token | Valor |
|---|---|
| Cor de fundo base | `#0a0a0a` |
| Cor accent (cobre) | `#C97A4A` |
| Accent hover | `#E08B5A` |
| Accent darker (gradient) | `#A8633A` |
| Texto primário | `text-white` |
| Texto secundário | `text-white/60` |
| Texto terciário | `text-white/40` |
| Input bg | `bg-white/[0.04]` |
| Input border | `border-white/10` |
| Input border focus | `border-[#C97A4A]/60` |
| Altura input/botão | `h-12` |
| Radius input/botão | `rounded-xl` |
| Sombra botão primário | `shadow-[0_8px_24px_-8px_rgba(201,122,74,0.6)]` |
| Gradient botão primário | `bg-gradient-to-b from-[#C97A4A] to-[#A8633A]` |
| Overlay no background | `bg-gradient-to-b from-black/30 via-black/20 to-black/60` |

---

## 3. Layout (mobile-first)

```text
container: min-h-[100dvh] flex-col items-center justify-center px-6 py-10
main:      w-full max-w-[400px]
  logo:    w-[200px] md:w-[220px], mb-6 dentro do bloco header (mb-8 no header)
  título:  text-xl font-light text-white
  sub:     text-sm text-white/60 mt-1
  form:    space-y-3
  divider: my-6 com texto "ou continue com" em white/40
  google:  AuthGoogleButton
  footer:  "Ainda não tem conta? Criar conta" em white/60 mt-8
  legal:   white/40 mt-6
```

### Background
- `background-image: url(login-background.jpg)`
- `background-size: cover; background-position: center;`
- **Não usar** `background-attachment: fixed` (bug iOS Safari).
- Sempre por cima, um overlay gradient suave para legibilidade.

---

## 4. Componentes reutilizáveis

Criados em `src/components/auth/`:

- **`AuthInput`** — input com ícone à esquerda (lucide), height 52px, bg white/4%, border white/10, focus accent. Para `type="password"` exibe toggle Eye/EyeOff à direita.
- **`AuthButton`** — botão (primary/outline). Primary = gradient cobre + shadow. Suporta `loading`.
- **`AuthGoogleButton`** — botão Google com ícone colorido SVG, bg white/4%, border white/10.

Usar esses 3 componentes em **todos** os forms (login, signup, forgot, reset).

---

## 5. Estrutura das telas

### `/auth` (Auth.tsx)
- Estado `mode: 'login' | 'signup' | 'forgot'`
- Header (logo + headline "Gestão completa / para fotógrafos")
- Renderiza `<EmailLoginForm>`, `<EmailSignupForm>` ou `<ForgotPasswordForm>`
- Abaixo (apenas se não for forgot): divider, Google, toggle login↔signup, links legais
- **Tabs Login/Cadastro foram removidas** — substituídas pelo link "Criar conta / Entrar" no rodapé

### `/reset-password` (ResetPassword.tsx)
- Reusa `AuthShell` (mesmo background + logo)
- Estados: verificando link / inválido / form / sucesso

---

## 6. Tema fixo dark

Para garantir que a tela ignore o `dark`/`light` global:

1. Envolver a tela em `<div className="dark ...">` (ativa variantes `dark:` do Tailwind localmente).
2. Usar classes Tailwind **absolutas** (`bg-[#0a0a0a]`, `text-white`, `text-white/60`) ao invés de tokens semânticos (`bg-background`, `text-foreground`).
3. Não chamar `useVisualTheme()`.

---

## 7. Checklist de paridade Studio ↔ Gallery

- [ ] Copiar `login-background.jpg` e `lunari-studio-logo.png` para `src/assets/auth/`
- [ ] Copiar `AuthInput.tsx`, `AuthButton.tsx`, `AuthGoogleButton.tsx`
- [ ] Reescrever `Auth.tsx` e `ResetPassword.tsx` no Gallery seguindo o mesmo shell
- [ ] Manter a lógica de auth do Gallery (não copiar do Studio)
- [ ] Trocar headline para "Galeria de seleção / para seus clientes" (ou equivalente do Gallery)
- [ ] Confirmar fonte/typeface ativa (Inter por padrão)
- [ ] QA: viewport 375px (mobile) e 1440px (desktop) lado a lado
- [ ] QA: dark mode forçado mesmo com usuário em tema light

---

## 8. Notas

- O logo já vem com brilho/branco — não aplicar `filter`/`invert`.
- Em viewports muito altos (>900px), o conteúdo permanece centralizado verticalmente — aceitável (efeito de imersão).
- Em viewports curtos (<700px), o `py-10` + `min-h-[100dvh]` permite scroll natural se necessário.
