import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { StepIndicator } from '@/components/auth/StepIndicator';
import lunariLogo from '@/assets/lunari-logo.png';
import authBackground from '@/assets/auth-background.jpg';

export default function Auth() {
  const navigate = useNavigate();
  const { signInWithGoogle, user, loading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    if (!loading && user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const { error } = await signInWithGoogle();
      
      if (error) {
        toast.error(`Erro ao entrar com Google: ${error.message}`);
        setIsSigningIn(false);
      }
    } catch (error) {
      toast.error('Erro inesperado. Tente novamente.');
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lunar-bg">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CD7F5E]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Barra Superior com Logo */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 p-3 md:p-4">
        <div className="container mx-auto">
          <img 
            src={lunariLogo} 
            alt="Lunari" 
            className="h-8 md:h-10 lg:h-12 object-contain" 
          />
        </div>
      </div>

      {/* Background com Gradiente */}
      <div 
        className="min-h-screen flex items-center justify-center pt-20 px-4"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#CD7F5E]/60 via-[#E89A7A]/50 to-[#CD7F5E]/60" />
        
        {/* Card Principal */}
        <Card className="relative z-10 w-full max-w-md bg-black/20 backdrop-blur-md border-white/20 shadow-2xl overflow-hidden">
          {mode === 'signup' && <StepIndicator currentStep={1} />}
          
          <CardContent className="space-y-6 p-6 md:p-8">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl md:text-4xl font-light text-white">
                {mode === 'login' ? 'Entrar' : 'Criar Conta'}
              </h1>
              <p className="text-sm text-white/80 font-light">
                {mode === 'login' 
                  ? 'Entre com sua conta Google para continuar' 
                  : 'Cadastre-se com Google para começar'
                }
              </p>
            </div>

            <Button 
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="w-full h-12 flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 border border-white/30 font-light shadow-sm transition-all duration-150"
              variant="outline"
            >
              {isSigningIn ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {mode === 'login' ? 'Entrar com Google' : 'Cadastre-se com Google'}
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/30"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-black/20 text-white/80 font-light">ou</span>
              </div>
            </div>

            <button 
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="w-full text-sm text-white/80 hover:text-white font-light transition-colors duration-150"
            >
              {mode === 'login' 
                ? 'Não tem conta? Cadastre-se' 
                : 'Já tem conta? Entre'
              }
            </button>

            <div className="border-t border-white/20 pt-4">
              <p className="text-xs text-center text-white/70 font-light">
                Ao continuar, você concorda com nossos{' '}
                <a href="#" className="text-[#CD7F5E] hover:underline">Termos de Serviço</a>
                {' '}e{' '}
                <a href="#" className="text-[#CD7F5E] hover:underline">Política de Privacidade</a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
