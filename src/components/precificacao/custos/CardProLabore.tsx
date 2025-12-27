import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Briefcase, Info } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface CardProLaboreProps {
  percentualProLabore: number;
  onPercentualChange: (value: number) => void;
  totalGastosPessoais: number;
  proLaboreCalculado: number;
}

export function CardProLabore({
  percentualProLabore,
  onPercentualChange,
  totalGastosPessoais,
  proLaboreCalculado
}: CardProLaboreProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Card className="border-2 shadow-sm bg-card">
      <CardHeader className="pb-3 bg-muted/50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Pró-labore</CardTitle>
          </div>
          <span className="font-bold text-lg text-foreground">
            {formatCurrency(proLaboreCalculado)}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
        {/* Explicação */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 border border-border">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            O pró-labore é a remuneração mínima que você deve tirar do negócio. 
            É calculado somando seus gastos pessoais + uma margem de segurança.
          </p>
        </div>

        {/* Slider de percentual */}
        <div className="bg-background border-2 border-dashed border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Margem sobre Gastos</Label>
            <div className="flex items-center gap-2">
              <Input 
                type="number"
                min="0"
                max="100"
                value={percentualProLabore}
                onChange={e => onPercentualChange(Number(e.target.value))}
                className="w-16 h-8 text-center text-sm font-bold bg-background border-input"
              />
              <span className="text-sm font-medium">%</span>
            </div>
          </div>
          
          <Slider
            value={[percentualProLabore]}
            onValueChange={(values) => onPercentualChange(values[0])}
            max={100}
            step={5}
            className="w-full"
          />
        </div>

        {/* Resumo do cálculo */}
        <div className="rounded-lg p-4 bg-muted/40 border border-border space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gastos Pessoais:</span>
            <span className="font-medium">{formatCurrency(totalGastosPessoais)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Margem aplicada:</span>
            <span className="font-medium">+{percentualProLabore}%</span>
          </div>
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between">
              <span className="font-semibold">Pró-labore Calculado:</span>
              <span className="font-bold text-lg text-foreground">
                {formatCurrency(proLaboreCalculado)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
