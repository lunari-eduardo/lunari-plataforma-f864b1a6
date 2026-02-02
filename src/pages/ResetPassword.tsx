import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import lunariLogo from '@/assets/lunari-logo.png';
import authBackground from '@/assets/auth-background.jpg';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 ResetPassword auth event:', event);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('✅ Sessão de recuperação válida');
        setIsValidSession(true);
      } else if (event === 'SIGNED_IN' && session) {
        // Also valid if user is signed in (might have clicked link while logged in)
        setIsValidSession(true);
      }
    });

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidSession(true);
      } else {
        // Wait a bit for PASSWORD_RECOVERY event
        setTimeout(() => {
          setIsValidSession((prev) => prev === null ? false : prev);
        }, 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await updatePassword(password);

      if (error) {
        toast.error(error.message || 'Erro ao atualizar senha');
      } else {
        setSuccess(true);
        toast.success('Senha atualizada com sucesso!');
        
        // Redirect after a short delay
        setTimeout(() => {
          navigate('/app');
        }, 2000);
      }
    } catch (error) {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-lunar-bg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[#CD7F5E]" />
          <p className="text-lunar-textSecondary">Verificando link...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired link
  if (isValidSession === false) {
    return (
      <div className="min-h-screen relative">
        <div className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 p-3 md:p-4">
          <div className="container mx-auto">
            <img src={lunariLogo} alt="Lunari" className="h-8 md:h-10 lg:h-12 object-contain" />
          </div>
        </div>

        <div 
          className="min-h-screen flex items-center justify-center pt-20 px-4"
          style={{
            backgroundImage: `url(${authBackground})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#CD7F5E]/60 via-[#E89A7A]/50 to-[#CD7F5E]/60" />
          
          <Card className="relative z-10 w-full max-w-md bg-black/20 backdrop-blur-md border-white/20 shadow-2xl">
            <CardContent className="p-6 md:p-8 text-center">
              <AlertCircle className="h-16 w-16 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-white mb-2">Link inválido ou expirado</h2>
              <p className="text-white/70 mb-6">
                O link de recuperação não é válido ou já expirou. 
                Solicite um novo link de recuperação.
              </p>
              <Button
                onClick={() => navigate('/auth')}
                className="bg-[#CD7F5E] hover:bg-[#B86F4E] text-white"
              >
                Voltar ao login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20 p-3 md:p-4">
        <div className="container mx-auto">
          <img src={lunariLogo} alt="Lunari" className="h-8 md:h-10 lg:h-12 object-contain" />
        </div>
      </div>

      <div 
        className="min-h-screen flex items-center justify-center pt-20 px-4"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#CD7F5E]/60 via-[#E89A7A]/50 to-[#CD7F5E]/60" />
        
        <Card className="relative z-10 w-full max-w-md bg-black/20 backdrop-blur-md border-white/20 shadow-2xl">
          <CardContent className="p-6 md:p-8">
            {success ? (
              <div className="text-center py-6 space-y-4">
                <CheckCircle className="h-16 w-16 text-green-400 mx-auto" />
                <h3 className="text-xl font-semibold text-white">Senha atualizada!</h3>
                <p className="text-white/70 text-sm">
                  Sua senha foi alterada com sucesso.
                  <br />
                  Redirecionando...
                </p>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <h1 className="text-2xl md:text-3xl font-light text-white mb-2">
                    Nova senha
                  </h1>
                  <p className="text-white/70 text-sm">
                    Digite sua nova senha abaixo
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-white/90 text-sm">
                      Nova senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11 pr-10"
                        disabled={isLoading}
                        autoComplete="new-password"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/80"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-new-password" className="text-white/90 text-sm">
                      Confirmar nova senha
                    </Label>
                    <Input
                      id="confirm-new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repita a nova senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-[#CD7F5E] hover:bg-[#B86F4E] text-white font-medium"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Atualizar senha'
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
