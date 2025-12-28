import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Briefcase, Info } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useState, useEffect, useCallback } from 'react';

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
  // Estado local para UI responsiva durante arraste do slider
  const [localPercentual, setLocalPercentual] = useState(percentualProLabore);
  const [isDragging, setIsDragging] = useState(false);
  
  // Sincronizar com prop externa quando não está arrastando
  useEffect(() => {
    if (!isDragging) {
      setLocalPercentual(percentualProLabore);
    }
  }, [percentualProLabore, isDragging]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Calculo local para UI responsiva
  const proLaboreLocal = totalGastosPessoais * (1 + localPercentual / 100);

  // Handler para quando o usuário SOLTAR o slider
  const handleSliderCommit = useCallback((values: number[]) => {
    const newValue = values[0];
    console.log('🎚️ [SLIDER] Valor final ao soltar:', newValue, '%');
    setIsDragging(false);
    onPercentualChange(newValue);
  }, [onPercentualChange]);

  // Handler para mudanças durante arraste (só UI)
  const handleSliderChange = useCallback((values: number[]) => {
    setLocalPercentual(values[0]);
    setIsDragging(true);
  }, []);

  // Handler para input (salva imediatamente ao blur ou enter)
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setLocalPercentual(value);
  }, []);

  const handleInputBlur = useCallback(() => {
    console.log('📝 [INPUT] Salvando valor ao blur:', localPercentual, '%');
    onPercentualChange(localPercentual);
  }, [localPercentual, onPercentualChange]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      console.log('📝 [INPUT] Salvando valor ao Enter:', localPercentual, '%');
      onPercentualChange(localPercentual);
      (e.target as HTMLInputElement).blur();
    }
  }, [localPercentual, onPercentualChange]);

  return (
    <Card className="border shadow-lg bg-white dark:bg-card">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/20 to-blue-500/5 border-b border-blue-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-base text-blue-800 dark:text-blue-300">Pró-labore</CardTitle>
          </div>
          <span className="font-bold text-lg text-foreground">
            {formatCurrency(proLaboreLocal)}
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
                value={localPercentual}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                className="w-16 h-8 text-center text-sm font-bold bg-background border-input"
              />
              <span className="text-sm font-medium">%</span>
            </div>
          </div>
          
          <Slider
            value={[localPercentual]}
            onValueChange={handleSliderChange}
            onValueCommit={handleSliderCommit}
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
            <span className="font-medium">+{localPercentual}%</span>
          </div>
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between">
              <span className="font-semibold">Pró-labore Calculado:</span>
              <span className="font-bold text-lg text-foreground">
                {formatCurrency(proLaboreLocal)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
