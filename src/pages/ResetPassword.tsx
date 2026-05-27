import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import lunariLogo from '@/assets/auth/lunari-studio-logo.png';
import loginBackground from '@/assets/auth/login-background.jpg';
import { AuthInput } from '@/components/auth/AuthInput';
import { AuthButton } from '@/components/auth/AuthButton';

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="dark min-h-[100dvh] w-full relative bg-[#0a0a0a] flex flex-col items-center justify-center px-6 py-10"
      style={{
        backgroundImage: `url(${loginBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60 pointer-events-none" />
      <main className="relative z-10 w-full max-w-[400px] flex flex-col items-center">
        <img
          src={lunariLogo}
          alt="Lunari Studio"
          className="w-[200px] md:w-[220px] h-auto object-contain mb-8 select-none"
          draggable={false}
        />
        {children}
      </main>
    </div>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsValidSession(true);
      else if (event === 'SIGNED_IN' && session) setIsValidSession(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setIsValidSession(true);
      else setTimeout(() => setIsValidSession((p) => p === null ? false : p), 2000);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('Senha deve ter pelo menos 6 caracteres'); return; }
    if (password !== confirmPassword) { toast.error('As senhas não coincidem'); return; }
    setIsLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) toast.error(error.message || 'Erro ao atualizar senha');
      else {
        setSuccess(true);
        toast.success('Senha atualizada com sucesso!');
        setTimeout(() => navigate('/app'), 2000);
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#C97A4A]" />
          <p className="text-white/60 text-sm">Verificando link...</p>
        </div>
      </div>
    );
  }

  if (isValidSession === false) {
    return (
      <AuthShell>
        <div className="text-center space-y-4">
          <AlertCircle className="h-16 w-16 text-yellow-400 mx-auto" />
          <h2 className="text-xl font-medium text-white">Link inválido ou expirado</h2>
          <p className="text-white/60 text-sm">
            O link de recuperação não é válido ou já expirou.<br />
            Solicite um novo link de recuperação.
          </p>
          <div className="pt-2">
            <AuthButton onClick={() => navigate('/auth')}>Voltar ao login</AuthButton>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {success ? (
        <div className="text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-[#C97A4A] mx-auto" />
          <h3 className="text-xl font-medium text-white">Senha atualizada!</h3>
          <p className="text-white/60 text-sm">
            Sua senha foi alterada com sucesso.<br />Redirecionando...
          </p>
        </div>
      ) : (
        <div className="w-full">
          <div className="text-center mb-6">
            <h1 className="text-xl font-light text-white">Nova senha</h1>
            <p className="text-white/60 text-sm mt-1 font-light">Digite sua nova senha abaixo</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <AuthInput
              icon={Lock}
              type="password"
              placeholder="Nova senha (mínimo 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
              autoFocus
            />
            <AuthInput
              icon={Lock}
              type="password"
              placeholder="Confirmar nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
            />
            <AuthButton type="submit" loading={isLoading} className="mt-2">
              Atualizar senha
            </AuthButton>
          </form>
        </div>
      )}
    </AuthShell>
  );
}
