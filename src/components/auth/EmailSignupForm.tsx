import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';

export function EmailSignupForm() {
  const { signUpWithEmail } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateForm = (): string | null => {
    if (nome.trim().length < 2) {
      return 'Nome deve ter pelo menos 2 caracteres';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Email inválido';
    }
    if (password.length < 6) {
      return 'Senha deve ter pelo menos 6 caracteres';
    }
    if (password !== confirmPassword) {
      return 'As senhas não coincidem';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await signUpWithEmail(email.trim(), password, nome.trim());
      
      if (error) {
        if (error.message?.includes('already registered')) {
          toast.error('Este email já está cadastrado');
        } else if (error.message?.includes('password')) {
          toast.error('Senha muito fraca. Use pelo menos 6 caracteres.');
        } else {
          toast.error(error.message || 'Erro ao criar conta');
        }
      } else if (data?.user) {
        // Check if email confirmation is required
        if (data.user.identities?.length === 0) {
          toast.error('Este email já está cadastrado');
        } else {
          setSuccess(true);
          toast.success('Conta criada! Verifique seu email para confirmar.');
        }
      }
    } catch (error) {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-6 space-y-4">
        <CheckCircle className="h-16 w-16 text-green-400 mx-auto" />
        <h3 className="text-xl font-semibold text-white">Verifique seu email</h3>
        <p className="text-white/70 text-sm">
          Enviamos um link de confirmação para <br />
          <span className="text-white font-medium">{email}</span>
        </p>
        <p className="text-white/60 text-xs">
          Clique no link do email para ativar sua conta.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome" className="text-white/90 text-sm">
          Nome completo
        </Label>
        <Input
          id="nome"
          type="text"
          placeholder="Seu nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11"
          disabled={isLoading}
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email" className="text-white/90 text-sm">
          Email
        </Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11"
          disabled={isLoading}
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password" className="text-white/90 text-sm">
          Senha
        </Label>
        <div className="relative">
          <Input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11 pr-10"
            disabled={isLoading}
            autoComplete="new-password"
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
        <Label htmlFor="confirm-password" className="text-white/90 text-sm">
          Confirmar senha
        </Label>
        <Input
          id="confirm-password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Repita a senha"
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
          'Criar conta'
        )}
      </Button>
    </form>
  );
}
