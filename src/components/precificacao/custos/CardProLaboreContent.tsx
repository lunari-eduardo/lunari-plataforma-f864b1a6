import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useState, useEffect, useCallback } from 'react';

interface CardProLaboreContentProps {
  percentualProLabore: number;
  onPercentualChange: (value: number) => void;
  totalGastosPessoais: number;
  proLaboreCalculado: number;
}

export function CardProLaboreContent({
  percentualProLabore,
  onPercentualChange,
  totalGastosPessoais,
  proLaboreCalculado
}: CardProLaboreContentProps) {
  const [localPercentual, setLocalPercentual] = useState(percentualProLabore);
  const [isDragging, setIsDragging] = useState(false);
  
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

  const proLaboreLocal = totalGastosPessoais * (1 + localPercentual / 100);

  const handleSliderCommit = useCallback((values: number[]) => {
    const newValue = values[0];
    setIsDragging(false);
    onPercentualChange(newValue);
  }, [onPercentualChange]);

  const handleSliderChange = useCallback((values: number[]) => {
    setLocalPercentual(values[0]);
    setIsDragging(true);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setLocalPercentual(value);
  }, []);

  const handleInputBlur = useCallback(() => {
    onPercentualChange(localPercentual);
  }, [localPercentual, onPercentualChange]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onPercentualChange(localPercentual);
      (e.target as HTMLInputElement).blur();
    }
  }, [localPercentual, onPercentualChange]);

  return (
    <>
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
    </>
  );
}
