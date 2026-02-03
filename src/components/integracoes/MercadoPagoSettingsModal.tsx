import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QrCode, CreditCard, Info, Loader2 } from 'lucide-react';
import pixLogo from '@/assets/pix-logo.png';

export interface MercadoPagoSettings {
  habilitarPix: boolean;
  habilitarCartao: boolean;
  maxParcelas: number;
}

interface MercadoPagoSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: MercadoPagoSettings | null;
  onSave: (settings: MercadoPagoSettings) => Promise<void>;
  loading?: boolean;
}

const PARCELAS_OPTIONS = [
  { value: 1, label: 'À vista (1x)' },
  { value: 3, label: 'Até 3x' },
  { value: 6, label: 'Até 6x' },
  { value: 12, label: 'Até 12x' },
];

export function MercadoPagoSettingsModal({
  open,
  onOpenChange,
  settings,
  onSave,
  loading,
}: MercadoPagoSettingsModalProps) {
  const [habilitarPix, setHabilitarPix] = useState(true);
  const [habilitarCartao, setHabilitarCartao] = useState(true);
  const [maxParcelas, setMaxParcelas] = useState(12);
  const [saving, setSaving] = useState(false);

  // Sync state when settings change or modal opens
  useEffect(() => {
    if (open && settings) {
      setHabilitarPix(settings.habilitarPix !== false);
      setHabilitarCartao(settings.habilitarCartao !== false);
      setMaxParcelas(settings.maxParcelas || 12);
    } else if (open && !settings) {
      // Defaults
      setHabilitarPix(true);
      setHabilitarCartao(true);
      setMaxParcelas(12);
    }
  }, [open, settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        habilitarPix,
        habilitarCartao,
        maxParcelas,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const atLeastOneEnabled = habilitarPix || habilitarCartao;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações do Mercado Pago</DialogTitle>
          <DialogDescription>
            Escolha quais métodos de pagamento seus clientes poderão usar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Payment Methods Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Métodos de Pagamento Aceitos</Label>
            
            {/* PIX Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center">
                  <img src={pixLogo} alt="PIX" className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-medium">PIX</p>
                  <p className="text-xs text-muted-foreground">Pagamento instantâneo</p>
                </div>
              </div>
              <Switch
                checked={habilitarPix}
                onCheckedChange={setHabilitarPix}
              />
            </div>

            {/* Credit Card Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-lg">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Cartão de Crédito</p>
                  <p className="text-xs text-muted-foreground">Parcelado ou à vista</p>
                </div>
              </div>
              <Switch
                checked={habilitarCartao}
                onCheckedChange={setHabilitarCartao}
              />
            </div>
          </div>

          {/* Installments Section - Only show if credit card is enabled */}
          {habilitarCartao && (
            <div className="space-y-2">
              <Label htmlFor="parcelas" className="text-sm font-medium">
                Limite de Parcelas
              </Label>
              <Select
                value={maxParcelas.toString()}
                onValueChange={(val) => setMaxParcelas(parseInt(val))}
              >
                <SelectTrigger id="parcelas">
                  <SelectValue placeholder="Selecione o limite" />
                </SelectTrigger>
                <SelectContent>
                  {PARCELAS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Até quantas vezes o cliente pode parcelar
              </p>
            </div>
          )}

          {/* Info Box */}
          <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
            <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              As taxas do Mercado Pago variam conforme o método e número de parcelas. 
              Consulte as taxas atuais no painel do Mercado Pago.
            </p>
          </div>

          {/* Warning if nothing enabled */}
          {!atLeastOneEnabled && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <Info className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">
                Você precisa habilitar pelo menos um método de pagamento
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || loading || !atLeastOneEnabled}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configurações'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
