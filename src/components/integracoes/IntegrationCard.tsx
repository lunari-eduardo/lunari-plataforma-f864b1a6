import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, AlertCircle } from 'lucide-react';

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  status: 'conectado' | 'desconectado' | 'pendente' | 'erro' | 'em_breve';
  onConnect?: () => void;
  onDisconnect?: () => void;
  loading?: boolean;
  disabled?: boolean;
  connectedInfo?: string;
}

export function IntegrationCard({
  title,
  description,
  icon,
  status,
  onConnect,
  onDisconnect,
  loading = false,
  disabled = false,
  connectedInfo,
}: IntegrationCardProps) {
  const statusConfig = {
    conectado: {
      badge: <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
        <Check className="w-3 h-3 mr-1" />
        Conectado
      </Badge>,
      action: onDisconnect,
      actionLabel: 'Desconectar',
      actionVariant: 'outline' as const,
    },
    desconectado: {
      badge: <Badge variant="secondary" className="bg-muted text-muted-foreground">
        <X className="w-3 h-3 mr-1" />
        Desconectado
      </Badge>,
      action: onConnect,
      actionLabel: 'Conectar',
      actionVariant: 'default' as const,
    },
    pendente: {
      badge: <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        Pendente
      </Badge>,
      action: onConnect,
      actionLabel: 'Tentar novamente',
      actionVariant: 'default' as const,
    },
    erro: {
      badge: <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/30">
        <AlertCircle className="w-3 h-3 mr-1" />
        Erro
      </Badge>,
      action: onConnect,
      actionLabel: 'Reconectar',
      actionVariant: 'default' as const,
    },
    em_breve: {
      badge: <Badge variant="secondary" className="bg-muted text-muted-foreground">
        Em breve
      </Badge>,
      action: undefined,
      actionLabel: '',
      actionVariant: 'default' as const,
    },
  };

  const config = statusConfig[status];

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {config.badge}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription className="text-sm">
          {description}
        </CardDescription>

        {status === 'conectado' && connectedInfo && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            {connectedInfo}
          </div>
        )}

        {config.action && (
          <Button
            variant={config.actionVariant}
            onClick={config.action}
            disabled={loading || disabled}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              config.actionLabel
            )}
          </Button>
        )}

        {status === 'em_breve' && (
          <Button variant="secondary" disabled className="w-full">
            Em breve
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
