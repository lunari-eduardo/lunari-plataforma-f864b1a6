

# Plano: Sistema de Login com Email/Senha + Troca de Email e Senha

## Contexto Atual

### Arquitetura Existente
- **AuthContext**: Apenas suporta `signInWithGoogle()` e `signOut()`
- **Página Auth**: Apenas botão de login com Google
- **Supabase**: Já tem usuários com provider `email` (criados pelo Gallery)
- **Tabela profiles**: RLS configurado corretamente (`auth.uid() = user_id`)
- **Onboarding**: Fluxo de 3 etapas (Nome → Nicho → Cidade)
- **Domínios**: Suporte a `app.lunarihub.com` + domínios antigos

### Integrações Críticas
- Gestão e Gallery compartilham o **mesmo Supabase Auth**
- Usuários criados em um projeto funcionam automaticamente no outro
- Não há trigger automático para criar profiles (criação no hook `useUserProfile`)

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/contexts/AuthContext.tsx` | Modificar | Adicionar métodos de email/senha |
| `src/pages/Auth.tsx` | Modificar | Interface com abas Login/Cadastro/Esqueci Senha |
| `src/pages/ResetPassword.tsx` | **CRIAR** | Página para redefinir senha via token |
| `src/components/auth/EmailLoginForm.tsx` | **CRIAR** | Formulário de login com email |
| `src/components/auth/EmailSignupForm.tsx` | **CRIAR** | Formulário de cadastro |
| `src/components/auth/ForgotPasswordForm.tsx` | **CRIAR** | Formulário esqueci minha senha |
| `src/components/user-profile/forms/SecuritySection.tsx` | **CRIAR** | Seção de segurança (alterar email/senha) |
| `src/pages/MinhaConta.tsx` | Modificar | Adicionar aba "Segurança" |
| `src/App.tsx` | Modificar | Adicionar rota `/reset-password` |

---

## Fase 1: Expandir AuthContext

### Novos Métodos a Adicionar

```typescript
interface AuthContextType {
  // Existentes
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<{ data: any; error: any }>;
  signOut: () => Promise<void>;
  
  // NOVOS
  signInWithEmail: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signUpWithEmail: (email: string, password: string, nome: string) => Promise<{ data: any; error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  updateEmail: (newEmail: string) => Promise<{ error: any }>;
}
```

### Implementação dos Métodos

**signInWithEmail**: Usa `supabase.auth.signInWithPassword()`

**signUpWithEmail**: 
1. Usa `supabase.auth.signUp()` com `emailRedirectTo` dinâmico
2. Passa `nome` via `data` metadata para uso no onboarding
3. Envia email de confirmação automaticamente

**resetPassword**: 
- Usa `supabase.auth.resetPasswordForEmail()`
- Redireciona para `/reset-password` com token

**updatePassword**: 
- Usa `supabase.auth.updateUser({ password })`
- Requer usuário autenticado

**updateEmail**: 
- Usa `supabase.auth.updateUser({ email })`
- Supabase envia email de confirmação **apenas para o novo email**

---

## Fase 2: Reformular Página Auth

### Estrutura Visual

```text
┌────────────────────────────────────────────────────────┐
│                    [LUNARI LOGO]                       │
├────────────────────────────────────────────────────────┤
│                                                        │
│   ┌────────────────────────────────────────────────┐   │
│   │     [LOGIN]  |  [CADASTRO]  |  [RECUPERAR]     │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
│   MODO LOGIN:                                          │
│   ┌────────────────────────────────────────────────┐   │
│   │  Email: [________________________]              │   │
│   │  Senha: [________________________]              │   │
│   │                                                 │   │
│   │  [     Entrar com Email     ]                   │   │
│   │                                                 │   │
│   │  ─────────── ou ───────────                     │   │
│   │                                                 │   │
│   │  [    🔵 Entrar com Google    ]                 │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
│   MODO CADASTRO:                                       │
│   ┌────────────────────────────────────────────────┐   │
│   │  Nome: [________________________]               │   │
│   │  Email: [________________________]              │   │
│   │  Senha: [________________________]              │   │
│   │  Confirmar: [____________________]              │   │
│   │                                                 │   │
│   │  [     Criar Conta     ]                        │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
│   MODO RECUPERAR:                                      │
│   ┌────────────────────────────────────────────────┐   │
│   │  Email: [________________________]              │   │
│   │                                                 │   │
│   │  [  Enviar Link de Recuperação  ]               │   │
│   └────────────────────────────────────────────────┘   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Regras de Validação

| Campo | Validação |
|-------|-----------|
| Nome | Mínimo 2 caracteres |
| Email | Formato válido |
| Senha | Mínimo 6 caracteres |
| Confirmar Senha | Deve ser igual à senha |

---

## Fase 3: Página Reset Password

### Rota: `/reset-password`

Página acessada via link do email de recuperação:

```text
URL: https://app.lunarihub.com/reset-password#access_token=...&type=recovery
```

### Funcionalidade

1. Detectar token na URL via `onAuthStateChange` (evento `PASSWORD_RECOVERY`)
2. Exibir formulário com campos:
   - Nova Senha
   - Confirmar Nova Senha
3. Chamar `supabase.auth.updateUser({ password })`
4. Redirecionar para `/app` após sucesso

---

## Fase 4: Seção de Segurança em Minha Conta

### Nova Aba "Segurança"

```text
┌──────────────────────────────────────────────────────┐
│  [Perfil]    [Marca]    [Segurança]                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📧 ALTERAR EMAIL                                    │
│  ─────────────────────────────────────────────────   │
│  Email atual: usuario@email.com                      │
│                                                      │
│  Novo email: [________________________]              │
│                                                      │
│  [  Solicitar Alteração  ]                           │
│                                                      │
│  ℹ️ Um email de confirmação será enviado para o      │
│     novo endereço. O antigo permanece ativo até      │
│     a confirmação.                                   │
│                                                      │
│  ─────────────────────────────────────────────────   │
│                                                      │
│  🔐 ALTERAR SENHA                                    │
│  ─────────────────────────────────────────────────   │
│  Nova senha: [________________________]              │
│  Confirmar:  [________________________]              │
│                                                      │
│  [  Atualizar Senha  ]                               │
│                                                      │
│  ─────────────────────────────────────────────────   │
│                                                      │
│  ⚠️ CONTA GOOGLE                                     │
│  Se você criou sua conta com Google, a senha e       │
│  email são gerenciados pelo Google. Para alterar,    │
│  acesse sua conta Google diretamente.                │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Lógica de Exibição

- **Conta Google**: Ocultar campos de senha, mostrar aviso
- **Conta Email**: Exibir todos os campos
- Detectar provedor via `user.app_metadata.provider`

---

## Fase 5: Fluxo de Troca de Email (Supabase Nativo)

### Como Funciona

1. Usuário informa novo email em "Minha Conta"
2. Supabase envia email de confirmação **apenas para o novo endereço**
3. Email antigo permanece ativo até confirmação
4. Ao clicar no link, `auth.users.email` é atualizado automaticamente

### Configuração Necessária no Supabase Dashboard

| Configuração | Valor |
|--------------|-------|
| Confirm email | ✅ Enabled |
| Secure email change | ✅ Enabled (single confirm) |
| Double confirm email change | ❌ Disabled (validação apenas no novo) |

### Template de Email (Email Change)

```html
<h2>Confirme seu novo email</h2>
<p>Você solicitou a alteração do email da sua conta Lunari.</p>
<p>Clique no link abaixo para confirmar:</p>
<a href="{{ .ConfirmationURL }}">Confirmar novo email</a>
<p>Se você não solicitou esta alteração, ignore este email.</p>
```

---

## Fase 6: Configurações do Supabase Dashboard

### Authentication > URL Configuration

| Campo | Valor |
|-------|-------|
| Site URL | `https://app.lunarihub.com` |
| Redirect URLs | `https://app.lunarihub.com/**` |
| | `https://*.gallery.lunarihub.com/**` |
| | `https://www.lunariplataforma.com.br/**` |
| | `https://lunari-gallery.lovable.app/**` |

### Authentication > Providers > Email

| Configuração | Valor |
|--------------|-------|
| Enable Email provider | ✅ |
| Confirm email | ✅ (recomendado) |
| Secure email change | ✅ |
| Double confirm email change | ❌ (validação só no novo) |

### Authentication > Email Templates

Personalizar em português:
- **Confirm signup**: Email de confirmação de cadastro
- **Reset password**: Email de recuperação de senha
- **Email change**: Email de alteração de email

---

## Detalhes Técnicos

### Redirect URLs para Email Auth

```typescript
// Em AuthContext.tsx
const signUpWithEmail = async (email: string, password: string, nome: string) => {
  const siteUrl = getAppBaseUrl();
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/app`,
      data: {
        nome: nome  // Disponível em user.user_metadata.nome
      }
    }
  });
  return { data, error };
};

const resetPassword = async (email: string) => {
  const siteUrl = getAppBaseUrl();
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`
  });
  return { error };
};
```

### Detectar Tipo de Conta

```typescript
// Em SecuritySection.tsx
const isGoogleAccount = user?.app_metadata?.provider === 'google';

// Se conta Google, desabilitar alteração de senha
```

### Sincronização com Gallery

O Gallery e Gestão compartilham o mesmo Supabase Auth, então:

- Usuário cadastrado no Gestão pode logar no Gallery automaticamente
- Troca de email/senha reflete em ambos os projetos
- Não é necessário sincronização adicional

---

## Resultado Esperado

Após implementação:

| Funcionalidade | Status |
|----------------|--------|
| Login com email/senha | ✅ Disponível |
| Cadastro com email | ✅ Com confirmação por email |
| Login com Google | ✅ Mantido |
| Esqueci minha senha | ✅ Link por email |
| Redefinir senha | ✅ Página dedicada |
| Alterar email | ✅ Confirmação apenas no novo email |
| Alterar senha (conta email) | ✅ Em Minha Conta |
| Alterar senha (conta Google) | ⚠️ Aviso para ir ao Google |
| Compatibilidade Gallery | ✅ Mesmo auth compartilhado |

