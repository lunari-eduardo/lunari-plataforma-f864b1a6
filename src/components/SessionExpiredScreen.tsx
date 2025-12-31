import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, RefreshCw } from 'lucide-react';

interface SessionExpiredScreenProps {
  onRelogin: () => void;
}

export const SessionExpiredScreen: React.FC<SessionExpiredScreenProps> = ({ onRelogin }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-6 bg-card border-border">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          
          <h2 className="text-2xl font-bold text-foreground">Sessão Expirada</h2>
          
          <p className="text-muted-foreground">
            Por segurança, sua sessão expirou após um período de inatividade.
          </p>
          
          <p className="text-sm text-muted-foreground">
            Isso é normal e ajuda a proteger seus dados. Faça login novamente para continuar.
          </p>
          
          <Button
            onClick={onRelogin}
            className="w-full mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Entrar Novamente
          </Button>
        </div>
      </Card>
    </div>
  );
};
