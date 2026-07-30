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
    <div className="space-y-3">
      {/* Explicação */}
      <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        O pró-labore é a remuneração mínima que você deve tirar do negócio: gastos
        pessoais + uma margem de segurança.
      </p>

      {/* Margem */}
      <div className="border-y border-border/60 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-[13px] font-medium">Margem sobre gastos</Label>
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min="0"
              max="100"
              value={localPercentual}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="h-8 w-16 text-center text-[13px] font-medium tabular-nums"
            />
            <span className="text-[13px] text-muted-foreground">%</span>
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
      <div className="space-y-1.5">
        <div className="flex justify-between text-[13px]">
          <span className="text-muted-foreground">Gastos pessoais</span>
          <span className="font-medium tabular-nums">{formatCurrency(totalGastosPessoais)}</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-muted-foreground">Margem aplicada</span>
          <span className="font-medium tabular-nums">+{localPercentual}%</span>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-2">
          <span className="text-[13px] font-semibold">Pró-labore calculado</span>
          <span className="text-[15px] font-semibold tabular-nums text-[hsl(var(--accent-gold))]">
            {formatCurrency(proLaboreLocal)}
          </span>
        </div>
      </div>
    </div>

    </>
  );
}
