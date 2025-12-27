import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Briefcase, ChevronDown, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface CardProLaboreProps {
  percentualProLabore: number;
  setPercentualProLabore: (value: number) => void;
  totalGastosPessoais: number;
  proLaboreCalculado: number;
}

export function CardProLabore({
  percentualProLabore,
  setPercentualProLabore,
  totalGastosPessoais,
  proLaboreCalculado
}: CardProLaboreProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <Card className="overflow-hidden shadow-sm border-2 hover:shadow-md transition-all duration-200">
      <CardHeader className="pb-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-800 flex items-center justify-center">
              <Briefcase className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-base">Pró-labore</CardTitle>
          </div>
          <Badge variant="outline" className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 font-bold">
            {formatCurrency(proLaboreCalculado)}
          </Badge>
        </div>
      </CardHeader>
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between rounded-none border-t h-10 hover:bg-muted/50"
          >
            <span className="text-sm text-muted-foreground">
              {percentualProLabore}% sobre gastos pessoais
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-4 space-y-4">
            {/* Explicação */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                O pró-labore é a remuneração mínima que você deve tirar do negócio. 
                É calculado somando seus gastos pessoais + uma margem de segurança.
              </p>
            </div>

            {/* Slider de percentual */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Percentual sobre Gastos Pessoais</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number"
                    min="0"
                    max="100"
                    value={percentualProLabore}
                    onChange={e => setPercentualProLabore(Number(e.target.value))}
                    className="w-16 h-8 text-center text-sm font-bold"
                  />
                  <span className="text-sm font-medium">%</span>
                </div>
              </div>
              
              <Slider
                value={[percentualProLabore]}
                onValueChange={(values) => setPercentualProLabore(values[0])}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            {/* Resumo do cálculo */}
            <div className="rounded-lg p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gastos Pessoais:</span>
                <span className="font-medium">{formatCurrency(totalGastosPessoais)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Margem aplicada:</span>
                <span className="font-medium">+{percentualProLabore}%</span>
              </div>
              <div className="border-t border-green-200 dark:border-green-700 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-green-700 dark:text-green-300">Pró-labore Calculado:</span>
                  <span className="font-bold text-lg text-green-600 dark:text-green-400">
                    {formatCurrency(proLaboreCalculado)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
