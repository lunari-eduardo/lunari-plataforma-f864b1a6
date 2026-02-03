import { useRef, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, QrCode, ExternalLink } from 'lucide-react';
import mercadopagoLogo from '@/assets/mercadopago-logo.png';

interface MercadoPagoCardProps {
  status: 'conectado' | 'desconectado' | 'pendente' | 'erro';
  connectedAt?: string;
  mpUserId?: string;
  habilitarPix?: boolean;
  habilitarCartao?: boolean;
  maxParcelas?: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onConfigure?: () => void;
  loading?: boolean;
}

export interface MercadoPagoCardRef {
  scrollIntoView: () => void;
}

export const MercadoPagoCard = forwardRef<MercadoPagoCardRef, MercadoPagoCardProps>(({
  status,
  connectedAt,
  mpUserId,
  habilitarPix = true,
  habilitarCartao = true,
  maxParcelas = 12,
  onConnect,
  onDisconnect,
  onConfigure,
  loading,
}, ref) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    scrollIntoView: () => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  }));

  const isConnected = status === 'conectado';
  const formattedDate = connectedAt
    ? new Date(connectedAt).toLocaleDateString('pt-BR')
    : null;

  return (
    <Card ref={cardRef} className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <img
            src={mercadopagoLogo}
            alt="Mercado Pago"
            className="w-10 h-10 object-contain"
          />
          <div className="flex-1">
            <CardTitle className="text-base">Mercado Pago</CardTitle>
            <CardDescription className="text-xs">
              Receba pagamentos via PIX e Cartão
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Conta Conectada</p>
                {formattedDate && (
                  <p className="text-xs text-muted-foreground">
                    Conectado em {formattedDate}
                  </p>
                )}
                {mpUserId && (
                  <p className="text-xs text-muted-foreground font-mono">
                    ID: {mpUserId}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5">
                {habilitarPix && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <QrCode className="w-3 h-3" />
                    PIX
                  </Badge>
                )}
                {habilitarCartao && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <CreditCard className="w-3 h-3" />
                    {maxParcelas > 1 ? `Cartão até ${maxParcelas}x` : 'Cartão à vista'}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {onConfigure && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onConfigure}
                  className="flex-1"
                >
                  Configurar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={onDisconnect}
                disabled={loading}
                className="flex-1 text-destructive hover:text-destructive"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Desconectar'
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Conecte sua conta do Mercado Pago para receber pagamentos automaticamente via PIX ou cartão de crédito.
            </p>
            <Button
              onClick={onConnect}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                'Conectar Mercado Pago'
              )}
            </Button>
          </>
        )}

        <a
          href="https://www.mercadopago.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Saiba mais sobre Mercado Pago
        </a>
      </CardContent>
    </Card>
  );
});

MercadoPagoCard.displayName = 'MercadoPagoCard';
