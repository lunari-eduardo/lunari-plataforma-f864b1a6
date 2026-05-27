import { useState } from 'react';
import { Mail, Lock, User, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { AuthInput } from './AuthInput';
import { AuthButton } from './AuthButton';

export function EmailSignupForm() {
  const { signUpWithEmail } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateForm = (): string | null => {
    if (nome.trim().length < 2) return 'Nome deve ter pelo menos 2 caracteres';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email inválido';
    if (password.length < 6) return 'Senha deve ter pelo menos 6 caracteres';
    if (password !== confirmPassword) return 'As senhas não coincidem';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) { toast.error(err); return; }
    setIsLoading(true);
    try {
      const { data, error } = await signUpWithEmail(email.trim(), password, nome.trim());
      if (error) {
        if (error.message?.includes('already registered')) toast.error('Este email já está cadastrado');
        else if (error.message?.includes('password')) toast.error('Senha muito fraca. Use pelo menos 6 caracteres.');
        else toast.error(error.message || 'Erro ao criar conta');
      } else if (data?.user) {
        if (data.user.identities?.length === 0) toast.error('Este email já está cadastrado');
        else {
          setSuccess(true);
          toast.success('Conta criada! Verifique seu email para confirmar.');
        }
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-6 space-y-4">
        <CheckCircle className="h-16 w-16 text-[#C97A4A] mx-auto" />
        <h3 className="text-xl font-medium text-white">Verifique seu email</h3>
        <p className="text-white/60 text-sm">
          Enviamos um link de confirmação para<br />
          <span className="text-white font-medium">{email}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <AuthInput icon={User} type="text" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} disabled={isLoading} autoComplete="name" />
      <AuthInput icon={Mail} type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} autoComplete="email" />
      <AuthInput icon={Lock} type="password" placeholder="Senha (mínimo 6 caracteres)" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} autoComplete="new-password" />
      <AuthInput icon={Lock} type="password" placeholder="Confirmar senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} autoComplete="new-password" />

      <AuthButton type="submit" loading={isLoading} className="mt-2">
        Criar conta
      </AuthButton>
    </form>
  );
}
