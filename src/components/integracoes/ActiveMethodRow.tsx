import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Power, Star } from 'lucide-react';
import pixLogo from '@/assets/pix-logo.png';
import infinitepayLogo from '@/assets/infinitepay-logo.png';
import mercadopagoLogo from '@/assets/mercadopago-logo.png';

export type ProvedorPagamento = 'mercadopago' | 'infinitepay' | 'pix_manual';

interface ActiveMethodRowProps {
  provedor: ProvedorPagamento;
  info: string;
  isPadrao: boolean;
  onSetPadrao: () => void;
  onEdit: () => void;
  onDisconnect: () => void;
  loading?: boolean;
}

const provedorConfig: Record<ProvedorPagamento, { nome: string; logo: string }> = {
  mercadopago: { nome: 'Mercado Pago', logo: mercadopagoLogo },
  infinitepay: { nome: 'InfinitePay', logo: infinitepayLogo },
  pix_manual: { nome: 'PIX Manual', logo: pixLogo },
};

export function ActiveMethodRow({
  provedor,
  info,
  isPadrao,
  onSetPadrao,
  onEdit,
  onDisconnect,
  loading,
}: ActiveMethodRowProps) {
  const config = provedorConfig[provedor];

  return (
    <div className="flex items-center justify-between p-4 bg-card/50 border border-border/50 rounded-xl transition-all duration-200 hover:border-border">
      <div className="flex items-center gap-3">
        <img
          src={config.logo}
          alt={config.nome}
          className="w-8 h-8 object-contain rounded"
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{config.nome}</span>
            {isPadrao && (
              <Badge variant="secondary" className="text-xs">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Padrão
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{info}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!isPadrao && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSetPadrao}
            disabled={loading}
            className="text-xs"
          >
            Definir Padrão
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          disabled={loading}
          className="h-8 w-8"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDisconnect}
          disabled={loading}
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Power className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
