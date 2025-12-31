import React, { useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface OfflineScreenProps {
  onRetry: () => void;
  lastOnlineAt?: Date | null;
  isNetworkError?: boolean;
}

export const OfflineScreen: React.FC<OfflineScreenProps> = ({ 
  onRetry, 
  lastOnlineAt,
  isNetworkError = false 
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      // Delay para feedback visual
      setTimeout(() => setIsRetrying(false), 1500);
    }
  };

  const formatLastOnline = (date: Date | null) => {
    if (!date) return null;
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'Agora há pouco';
    if (diffMinutes < 60) return `Há ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 bg-card border-border text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-destructive/10">
            <WifiOff className="h-12 w-12 text-destructive" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {isNetworkError ? 'Erro de Conexão' : 'Sem conexão com internet'}
        </h2>
        
        <p className="text-muted-foreground mb-6">
          {isNetworkError 
            ? 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
            : 'Verifique sua conexão com a internet e tente novamente.'}
        </p>
        
        {lastOnlineAt && (
          <p className="text-sm text-muted-foreground mb-6">
            Última conexão: {formatLastOnline(lastOnlineAt)}
          </p>
        )}
        
        <Button 
          onClick={handleRetry}
          disabled={isRetrying}
          className="w-full"
          size="lg"
        >
          {isRetrying ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Tentando reconectar...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </>
          )}
        </Button>
        
        <p className="text-xs text-muted-foreground mt-4">
          Tentaremos reconectar automaticamente quando a internet voltar.
        </p>
      </Card>
    </div>
  );
};
