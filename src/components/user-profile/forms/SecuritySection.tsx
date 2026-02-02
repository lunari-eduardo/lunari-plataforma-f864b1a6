import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Mail, Lock, AlertTriangle, CheckCircle } from 'lucide-react';

export function SecuritySection() {
  const { user, updateEmail, updatePassword } = useAuth();
  
  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);
  
  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Detect if user signed up with Google
  const isGoogleAccount = user?.app_metadata?.provider === 'google' || 
                          user?.app_metadata?.providers?.includes('google');

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error('Digite um email válido');
      return;
    }

    if (newEmail.trim().toLowerCase() === user?.email?.toLowerCase()) {
      toast.error('O novo email deve ser diferente do atual');
      return;
    }

    setIsChangingEmail(true);
    try {
      const { error } = await updateEmail(newEmail.trim());
      
      if (error) {
        if (error.message?.includes('already registered')) {
          toast.error('Este email já está em uso');
        } else {
          toast.error(error.message || 'Erro ao solicitar alteração de email');
        }
      } else {
        setEmailSuccess(true);
        setNewEmail('');
        toast.success('Email de confirmação enviado para o novo endereço!');
      }
    } catch (error) {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      
      if (error) {
        toast.error(error.message || 'Erro ao alterar senha');
      } else {
        setPasswordSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        toast.success('Senha alterada com sucesso!');
        
        // Reset success state after a few seconds
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch (error) {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Email Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-lunar-accent" />
          <h3 className="text-lg font-medium text-lunar-text">Alterar Email</h3>
        </div>
        
        <div className="bg-lunar-surface/50 rounded-lg p-4 space-y-4">
          <div>
            <Label className="text-lunar-textSecondary text-sm">Email atual</Label>
            <p className="text-lunar-text font-medium">{user?.email}</p>
          </div>

          {emailSuccess ? (
            <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-green-500 font-medium text-sm">Email de confirmação enviado!</p>
                <p className="text-lunar-textSecondary text-xs mt-1">
                  Verifique a caixa de entrada do novo email e clique no link para confirmar a alteração.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleEmailChange} className="space-y-3">
              <div>
                <Label htmlFor="new-email" className="text-lunar-textSecondary text-sm">
                  Novo email
                </Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="novo@email.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={isChangingEmail}
                  className="mt-1"
                />
              </div>
              
              <p className="text-lunar-textSecondary text-xs">
                Um email de confirmação será enviado para o novo endereço. 
                Seu email atual permanecerá ativo até você confirmar a alteração.
              </p>

              <Button 
                type="submit" 
                disabled={isChangingEmail || !newEmail.trim()}
                size="sm"
              >
                {isChangingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Solicitar alteração
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-lunar-border" />

      {/* Password Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-lunar-accent" />
          <h3 className="text-lg font-medium text-lunar-text">Alterar Senha</h3>
        </div>

        {isGoogleAccount ? (
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-yellow-600 font-medium text-sm">Conta vinculada ao Google</p>
              <p className="text-lunar-textSecondary text-xs mt-1">
                Sua conta foi criada com o Google. Para alterar sua senha, 
                acesse sua conta Google diretamente em{' '}
                <a 
                  href="https://myaccount.google.com/security" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-lunar-accent hover:underline"
                >
                  myaccount.google.com
                </a>
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-lunar-surface/50 rounded-lg p-4">
            {passwordSuccess ? (
              <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-green-500 font-medium text-sm">Senha alterada com sucesso!</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-3">
                <div>
                  <Label htmlFor="new-password" className="text-lunar-textSecondary text-sm">
                    Nova senha
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isChangingPassword}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-lunar-textSecondary hover:text-lunar-text"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirm-password" className="text-lunar-textSecondary text-sm">
                    Confirmar nova senha
                  </Label>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isChangingPassword}
                    className="mt-1"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={isChangingPassword || !newPassword.trim() || !confirmPassword.trim()}
                  size="sm"
                >
                  {isChangingPassword ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Atualizar senha
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
