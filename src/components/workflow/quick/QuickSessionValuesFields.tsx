import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const handleNumberInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  setTimeout(() => e.target.select(), 0);
};

interface Props {
  valorBasePacote: string;
  setValorBasePacote: (v: string) => void;
  autoFilledByPackage: boolean;
  qtdFotosExtra: string;
  setQtdFotosExtra: (v: string) => void;
  totalFotosExtraManual: string;
  setTotalFotosExtraManual: (v: string) => void;
  valorFotoExtraCalculado: number;
  desconto: string;
  setDesconto: (v: string) => void;
  valorPago: string;
  setValorPago: (v: string) => void;
  formatCurrency: (v: any) => string;
}

export function QuickSessionValuesFields({
  valorBasePacote, setValorBasePacote, autoFilledByPackage,
  qtdFotosExtra, setQtdFotosExtra,
  totalFotosExtraManual, setTotalFotosExtraManual,
  valorFotoExtraCalculado,
  desconto, setDesconto,
  valorPago, setValorPago,
  formatCurrency,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="qs-vlr-pacote">
          Valor Pacote{autoFilledByPackage && " (auto)"}
        </Label>
        <Input
          id="qs-vlr-pacote"
          type="number"
          step="0.01"
          min="0"
          value={valorBasePacote}
          onChange={(e) => setValorBasePacote(e.target.value)}
          onFocus={handleNumberInputFocus}
          readOnly={autoFilledByPackage}
          placeholder="0.00"
          className={cn("h-7 text-xs", autoFilledByPackage && "bg-muted/50 cursor-not-allowed")}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs" htmlFor="qs-qtd-fotos">Qtd Fotos Extra</Label>
        <Input
          id="qs-qtd-fotos"
          type="number"
          min="0"
          value={qtdFotosExtra}
          onChange={(e) => setQtdFotosExtra(e.target.value)}
          onFocus={handleNumberInputFocus}
          placeholder="0"
          className="h-7 text-xs"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-blue-700 font-medium" htmlFor="qs-total-fotos">Total Fotos Extra *</Label>
        <Input
          id="qs-total-fotos"
          type="number"
          step="0.01"
          min="0"
          value={totalFotosExtraManual}
          onChange={(e) => setTotalFotosExtraManual(e.target.value)}
          onFocus={handleNumberInputFocus}
          placeholder="247.00"
          className="h-7 text-xs border-blue-300 focus:border-blue-500"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Vlr Foto (calc)</Label>
        <div className="h-7 flex items-center text-xs font-medium text-muted-foreground bg-muted/50 px-2 rounded border">
          {formatCurrency(valorFotoExtraCalculado)}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs" htmlFor="qs-desconto">Desconto</Label>
        <Input
          id="qs-desconto"
          type="number"
          step="0.01"
          min="0"
          value={desconto}
          onChange={(e) => setDesconto(e.target.value)}
          onFocus={handleNumberInputFocus}
          placeholder="0.00"
          className="h-7 text-xs"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-green-700 font-medium" htmlFor="qs-vlr-pago">Valor Pago</Label>
        <Input
          id="qs-vlr-pago"
          type="number"
          step="0.01"
          min="0"
          value={valorPago}
          onChange={(e) => setValorPago(e.target.value)}
          onFocus={handleNumberInputFocus}
          placeholder="0.00"
          className="h-7 text-xs border-green-300 focus:border-green-500"
        />
      </div>
    </div>
  );
}
