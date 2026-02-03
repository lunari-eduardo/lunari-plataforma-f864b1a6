import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Check, Star } from 'lucide-react';

export type SelectedProvider = 'mercadopago_link' | 'infinitepay' | 'pix_manual';

export interface ProviderOption {
  id: SelectedProvider;
  name: string;
  description: string;
  logo: string;
  isDefault: boolean;
  provedor: 'mercadopago' | 'infinitepay' | 'pix_manual';
}

interface ProviderRowProps {
  provider: ProviderOption;
  selected: boolean;
  onClick: () => void;
}

export function ProviderRow({ provider, selected, onClick }: ProviderRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all',
        'hover:border-primary/50 hover:bg-primary/5',
        selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card',
      )}
    >
      {/* Logo */}
      <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center shrink-0 border">
        <img
          src={provider.logo}
          alt={provider.name}
          className="w-7 h-7 object-contain"
        />
      </div>

      {/* Info */}
      <div className="flex-1 text-left min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium text-sm',
            selected ? 'text-primary' : 'text-foreground'
          )}>
            {provider.name}
          </span>
          {provider.isDefault && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 gap-1">
              <Star className="h-3 w-3" />
              Padrão
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {provider.description}
        </p>
      </div>

      {/* Selected indicator */}
      <div className={cn(
        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30'
      )}>
        {selected && <Check className="h-3 w-3" />}
      </div>
    </button>
  );
}
