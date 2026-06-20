import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import lunariLogo from '@/assets/auth/lunari-studio-logo.png';
import loginBackground from '@/assets/auth/login-background.jpg';
import { EmailLoginForm } from '@/components/auth/EmailLoginForm';
import { EmailSignupForm } from '@/components/auth/EmailSignupForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { AuthGoogleButton } from '@/components/auth/AuthGoogleButton';
import { Loader2 } from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithGoogle, user, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');

  useEffect(() => {
    const reason = searchParams.get('reason');
    const error = searchParams.get('error');
    if (reason === 'suspended') toast.error('Sua assinatura está inativa ou expirada. Entre em contato com o suporte.');
    else if (reason === 'session_expired') toast.info('Sua sessão expirou. Por favor, faça login novamente.');
    else if (error === 'access_denied') toast.error('Acesso negado. Seu e-mail não está autorizado.');
  }, [searchParams]);

  useEffect(() => {
    if (!loading && user) {
      const isAdminHost = typeof window !== 'undefined' &&
        (window.location.hostname.startsWith('admin.') ||
         new URLSearchParams(window.location.search).get('context') === 'admin');
      navigate(isAdminHost ? '/' : '/app');
    }
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        if (error.message?.includes('signup_not_allowed')) {
          toast.error('E-mail não autorizado. Entre em contato com o suporte para solicitar acesso.');
        } else {
          toast.error(`Erro ao entrar com Google: ${error.message}`);
        }
        setIsSigningIn(false);
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#C97A4A]" />
      </div>
    );
  }

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

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
      {/* Overlay para garantir legibilidade */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60 pointer-events-none" />

      <main className="relative z-10 w-full max-w-[400px] flex flex-col items-center">
        {/* Logo + headline */}
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src={lunariLogo}
            alt="Lunari Studio"
            className="w-[200px] md:w-[220px] h-auto object-contain mb-6 select-none"
            draggable={false}
          />
          {!isForgot && (
            <>
              <h1 className="text-white text-xl font-light tracking-wide">
                {isSignup ? 'Crie sua conta' : 'Gestão completa'}
              </h1>
              <p className="text-white/60 text-sm mt-1 font-light">
                {isSignup ? 'Comece a usar o Lunari Studio' : 'para fotógrafos'}
              </p>
            </>
          )}
        </div>

        {/* Form area */}
        <div className="w-full">
          {isForgot ? (
            <ForgotPasswordForm onBack={() => setMode('login')} />
          ) : isSignup ? (
            <EmailSignupForm />
          ) : (
            <EmailLoginForm onForgotPassword={() => setMode('forgot')} />
          )}
        </div>

        {/* Divider + Google */}
        {!isForgot && (
          <>
            <div className="w-full flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-white/40 text-xs font-light">ou continue com</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <AuthGoogleButton onClick={handleGoogleSignIn} loading={isSigningIn} />

            {/* Footer toggle login/signup */}
            <p className="text-center text-sm text-white/60 mt-8 font-light">
              {isSignup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
              <button
                type="button"
                onClick={() => setMode(isSignup ? 'login' : 'signup')}
                className="text-[#C97A4A] hover:text-[#E08B5A] font-medium transition-colors"
              >
                {isSignup ? 'Entrar' : 'Criar conta'}
              </button>
            </p>

            <p className="text-xs text-center text-white/40 mt-6 font-light leading-relaxed">
              Ao continuar, você concorda com nossos{' '}
              <a href="#" className="text-[#C97A4A] hover:underline">Termos de Serviço</a> e{' '}
              <a href="#" className="text-[#C97A4A] hover:underline">Política de Privacidade</a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
