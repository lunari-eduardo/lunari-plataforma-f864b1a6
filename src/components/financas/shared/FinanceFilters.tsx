/**
 * Unified Finance Filters Component
 * Standardized filter layout for Dashboard and Extrato
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Search, X, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FinanceFiltersProps {
  // Variant controls which filters are active
  variant: 'dashboard' | 'extrato';
  
  // Period filters
  dataInicio?: string;
  dataFim?: string;
  onDataInicioChange?: (value: string) => void;
  onDataFimChange?: (value: string) => void;
  
  // Dashboard-specific (year/month)
  anoSelecionado?: number;
  mesSelecionado?: number | null;
  anosDisponiveis?: number[];
  onAnoChange?: (value: number) => void;
  onMesChange?: (value: number | null) => void;
  getNomeMes?: (mes: number) => string;
  
  // Type filter
  tipo?: string;
  onTipoChange?: (value: string) => void;
  
  // Origin filter
  origem?: string;
  onOrigemChange?: (value: string) => void;
  
  // Status filter
  status?: string;
  onStatusChange?: (value: string) => void;
  
  // Search filter
  busca?: string;
  onBuscaChange?: (value: string) => void;
  
  // Clear action
  onLimparFiltros?: () => void;
  
  className?: string;
}

const MESES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

export default function FinanceFilters({
  variant,
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
  anoSelecionado,
  mesSelecionado,
  anosDisponiveis = [],
  onAnoChange,
  onMesChange,
  getNomeMes,
  tipo,
  onTipoChange,
  origem,
  onOrigemChange,
  status,
  onStatusChange,
  busca,
  onBuscaChange,
  onLimparFiltros,
  className,
}: FinanceFiltersProps) {
  const isDashboard = variant === 'dashboard';
  const isExtrato = variant === 'extrato';

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex flex-wrap items-end gap-4">
        {/* Period Filters - Dashboard Style (Year/Month) */}
        {isDashboard && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ano</Label>
              <Select 
                value={anoSelecionado?.toString()} 
                onValueChange={(v) => onAnoChange?.(parseInt(v))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {anosDisponiveis.map((ano) => (
                    <SelectItem key={ano} value={ano.toString()}>
                      {ano}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mês</Label>
              <Select 
                value={mesSelecionado?.toString() || 'ano_completo'} 
                onValueChange={(v) => onMesChange?.(v === 'ano_completo' ? null : parseInt(v))}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ano_completo">Ano Completo</SelectItem>
                  {MESES.map((mes) => (
                    <SelectItem key={mes.value} value={mes.value.toString()}>
                      {mes.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Period Filters - Extrato Style (Date Range) */}
        {isExtrato && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                De
              </Label>
              <Input 
                type="date" 
                value={dataInicio || ''} 
                onChange={(e) => onDataInicioChange?.(e.target.value)} 
                className="w-36" 
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Até
              </Label>
              <Input 
                type="date" 
                value={dataFim || ''} 
                onChange={(e) => onDataFimChange?.(e.target.value)} 
                className="w-36" 
              />
            </div>
          </>
        )}

        {/* Search Filter - Only for Extrato */}
        <div className={cn("space-y-1.5", isDashboard && "opacity-40 pointer-events-none")}>
          <Label className="text-xs text-muted-foreground">Busca</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar..." 
              value={busca || ''} 
              onChange={(e) => onBuscaChange?.(e.target.value)} 
              className="w-36 pl-8" 
              disabled={isDashboard}
            />
          </div>
        </div>

        {/* Clear Filters Button */}
        <Button 
          variant="ghost" 
          onClick={onLimparFiltros} 
          className="h-9 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Limpar
        </Button>
      </div>
    </Card>
  );
}
