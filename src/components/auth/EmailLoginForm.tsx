import { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AuthInput } from './AuthInput';
import { AuthButton } from './AuthButton';
import { Checkbox } from '@/components/ui/checkbox';

interface EmailLoginFormProps {
  onForgotPassword: () => void;
}

export function EmailLoginForm({ onForgotPassword }: EmailLoginFormProps) {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signInWithEmail(email.trim(), password);
      if (error) {
        if (error.message?.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else if (error.message?.includes('Email not confirmed')) {
          toast.error('Email não confirmado. Verifique sua caixa de entrada.');
        } else {
          toast.error(error.message || 'Erro ao fazer login');
        }
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <AuthInput
        icon={Mail}
        type="email"
        placeholder="E-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={isLoading}
        autoComplete="email"
      />
      <AuthInput
        icon={Lock}
        type="password"
        placeholder="Senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={isLoading}
        autoComplete="current-password"
      />

      <div className="flex items-center justify-between pt-1 pb-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={remember}
            onCheckedChange={(v) => setRemember(!!v)}
            className="border-white/30 data-[state=checked]:bg-[#C97A4A] data-[state=checked]:border-[#C97A4A]"
          />
          <span className="text-sm text-white/70">Lembrar de mim</span>
        </label>
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm text-[#C97A4A] hover:text-[#E08B5A] transition-colors"
        >
          Esqueci minha senha
        </button>
      </div>

      <AuthButton type="submit" loading={isLoading} className="mt-2">
        Entrar
      </AuthButton>
    </form>
  );
}
