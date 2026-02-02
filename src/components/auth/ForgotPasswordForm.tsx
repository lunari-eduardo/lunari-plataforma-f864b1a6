import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react';

interface ForgotPasswordFormProps {
  onBack: () => void;
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Digite um email válido');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await resetPassword(email.trim());
      
      if (error) {
        toast.error(error.message || 'Erro ao enviar email de recuperação');
      } else {
        setSuccess(true);
        toast.success('Email de recuperação enviado!');
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
        <h3 className="text-xl font-semibold text-white">Email enviado!</h3>
        <p className="text-white/70 text-sm">
          Enviamos um link de recuperação para <br />
          <span className="text-white font-medium">{email}</span>
        </p>
        <p className="text-white/60 text-xs">
          Verifique sua caixa de entrada e spam.
        </p>
        <Button
          onClick={onBack}
          variant="ghost"
          className="text-[#CD7F5E] hover:text-[#CD7F5E]/80 hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao login
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center text-white/70 hover:text-white text-sm mb-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar
      </button>

      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold text-white">Recuperar senha</h3>
        <p className="text-white/70 text-sm mt-1">
          Digite seu email para receber um link de recuperação
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recovery-email" className="text-white/90 text-sm">
            Email
          </Label>
          <Input
            id="recovery-email"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-11"
            disabled={isLoading}
            autoComplete="email"
            autoFocus
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
            'Enviar link de recuperação'
          )}
        </Button>
      </form>
    </div>
  );
}
